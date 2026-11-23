"""Pull real rosters and stats from stats.nba.com into the app's teams.json.

    pip install -r requirements.txt
    python fetch_nba.py --season 2025-26 --teams TOR MIA BOS NYK CLE MIL

For each team it takes the five players with the most minutes, then pulls:
  - each player's makes and attempts by shot zone (shot chart),
  - each player's defensive impact (opponent FG% vs normal, perimeter and at the rim),
  - the team's opponent FG% by zone (how it defends each area).
Screen coverage isn't in public data, so it comes from coverages.json, which you edit.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "src" / "data" / "teams.json"
COVERAGES = HERE / "coverages.json"

ZONE_MAP = {
    "Restricted Area": "RA",
    "In The Paint (Non-RA)": "PAINT",
    "Mid-Range": "MID",
    "Left Corner 3": "CORNER3",
    "Right Corner 3": "CORNER3",
    "Corner 3": "CORNER3",
    "Above the Break 3": "ATB3",
}
ZONES = ["RA", "PAINT", "MID", "CORNER3", "ATB3"]
POSITION_ORDER = {"G": 0, "G-F": 1, "F-G": 2, "F": 3, "F-C": 4, "C-F": 5, "C": 6}
SLOT_POS = {1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C"}
PAUSE = 0.8  # be polite to stats.nba.com


# ---- pure helpers (tested offline) -------------------------------------------

def zone_stats(shots: list[dict]) -> dict:
    """Shot-chart rows -> {zone: {fg, att}}. Backcourt heaves are ignored."""
    made = {z: 0 for z in ZONES}
    att = {z: 0 for z in ZONES}
    for row in shots:
        zone = ZONE_MAP.get(row["SHOT_ZONE_BASIC"])
        if zone:
            att[zone] += 1
            made[zone] += int(row["SHOT_MADE_FLAG"])
    return {z: {"fg": round(made[z] / att[z], 3) if att[z] else 0.0, "att": att[z]} for z in ZONES if att[z]}


def league_from_averages(rows: list[dict]) -> dict:
    """League-average shot-chart rows -> {zone: fg}."""
    made = {z: 0.0 for z in ZONES}
    att = {z: 0.0 for z in ZONES}
    for row in rows:
        zone = ZONE_MAP.get(row["SHOT_ZONE_BASIC"])
        if zone:
            made[zone] += float(row["FGM"])
            att[zone] += float(row["FGA"])
    return {z: round(made[z] / att[z], 3) for z in ZONES if att[z]}


def parse_team_shot_locations(raw: dict) -> dict:
    """Opponent shot-location payload (two-row header) -> {team_id: {zone: fg}}."""
    rs = raw["resultSets"]
    rs = rs[0] if isinstance(rs, list) else rs
    zone_header, col_header = rs["headers"]
    zone_names = zone_header["columnNames"]
    skip = zone_header.get("columnsToSkip", 2)
    span = zone_header.get("columnSpan", 3)
    cols = col_header["columnNames"]

    out = {}
    for row in rs["rowSet"]:
        team_id = row[0]
        made = {z: 0.0 for z in ZONES}
        att = {z: 0.0 for z in ZONES}
        for i, name in enumerate(zone_names):
            zone = ZONE_MAP.get(name)
            if not zone or name == "Corner 3" and "Left Corner 3" in zone_names:
                continue  # avoid double-counting corners
            start = skip + i * span
            block = dict(zip(cols[start:start + span], row[start:start + span]))
            fgm = next((v for k, v in block.items() if k.endswith("FGM")), None)
            fga = next((v for k, v in block.items() if k.endswith("FGA")), None)
            if fgm is not None and fga:
                made[zone] += float(fgm)
                att[zone] += float(fga)
        out[team_id] = {z: round(made[z] / att[z], 3) for z in ZONES if att[z]}
    return out


def defender_rating(pct_plusminus: float | None) -> float:
    """Opponent FG% vs their normal (e.g. -0.03) -> multiplier on shooter FG% (0.97)."""
    if pct_plusminus is None:
        return 1.0
    return round(min(1.15, max(0.85, 1 + float(pct_plusminus))), 3)


def order_lineup(players: list[dict]) -> list[dict]:
    """Five players -> slot order 1..5 by listed position, guards first."""
    return sorted(players, key=lambda p: POSITION_ORDER.get(p["position"], 3))


# ---- network --------------------------------------------------------------------

def rows(endpoint, index: int = 0) -> list[dict]:
    return endpoint.get_data_frames()[index].to_dict("records")


def fetch(season: str, abbrs: list[str]) -> dict:
    from nba_api.stats.endpoints import (
        commonteamroster,
        leaguedashplayerstats,
        leaguedashptdefend,
        leaguedashteamshotlocations,
        shotchartdetail,
    )
    from nba_api.stats.static import teams as static_teams

    coverages = json.loads(COVERAGES.read_text()) if COVERAGES.exists() else {}

    print("League defence tables...")
    defend = {}
    for category, kind in (("3 Pointers", "perimeter"), ("Less Than 6Ft", "interior")):
        for r in rows(leaguedashptdefend.LeagueDashPtDefend(season=season, defense_category=category, timeout=30)):
            defend.setdefault(r["CLOSE_DEF_PERSON_ID"], {})[kind] = defender_rating(r.get("PCT_PLUSMINUS"))
        time.sleep(PAUSE)

    team_def = {}
    try:
        loc = leaguedashteamshotlocations.LeagueDashTeamShotLocations(
            season=season, measure_type_simple="Opponent", distance_range="By Zone", timeout=30)
        team_def = parse_team_shot_locations(loc.get_dict())
    except (KeyError, IndexError, TypeError, ValueError, OSError) as exc:  # fall back to league averages
        print(f"  Couldn't read team defence by zone ({exc}); using league averages.")
    time.sleep(PAUSE)

    league = {}
    teams = {}
    for abbr in abbrs:
        team = static_teams.find_team_by_abbreviation(abbr)
        if not team:
            raise SystemExit(f"Unknown team abbreviation: {abbr}")
        tid = team["id"]
        print(f"{team['full_name']}...")

        roster = {r["PLAYER_ID"]: r for r in rows(commonteamroster.CommonTeamRoster(team_id=tid, season=season, timeout=30))}
        time.sleep(PAUSE)
        stats = rows(leaguedashplayerstats.LeagueDashPlayerStats(season=season, team_id_nullable=tid,
                                                                  per_mode_detailed="Totals", timeout=30))
        time.sleep(PAUSE)
        top = sorted((s for s in stats if s["PLAYER_ID"] in roster), key=lambda s: s["MIN"], reverse=True)[:5]
        lineup = order_lineup([{"id": s["PLAYER_ID"], "name": s["PLAYER_NAME"],
                                "position": roster[s["PLAYER_ID"]].get("POSITION") or "F"} for s in top])

        players = []
        for slot, p in enumerate(lineup, start=1):
            chart = shotchartdetail.ShotChartDetail(team_id=0, player_id=p["id"], season_nullable=season,
                                                    context_measure_simple="FGA", timeout=30)
            frames = chart.get_data_frames()
            if not league and len(frames) > 1:
                league = league_from_averages(frames[1].to_dict("records"))
            d = defend.get(p["id"], {})
            players.append({
                "slot": slot,
                "name": p["name"],
                "pos": SLOT_POS[slot],
                "zones": zone_stats(frames[0].to_dict("records")),
                "def": {"perimeter": d.get("perimeter", 1.0), "interior": d.get("interior", 1.0)},
            })
            print(f"  {slot}. {p['name']}")
            time.sleep(PAUSE)

        teams[abbr] = {
            "name": team["nickname"],
            "coverage": coverages.get(abbr, "drop"),
            "allowed": team_def.get(tid, {}),
            "players": players,
        }

    for t in teams.values():  # fill any zone a team table missed
        t["allowed"] = {z: t["allowed"].get(z, league.get(z)) for z in ZONES}
    return {"source": "nba_api", "season": season, "league": league, "teams": teams}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--season", default="2025-26")
    ap.add_argument("--teams", nargs="+", default=["TOR", "MIA", "BOS", "NYK", "CLE", "MIL"])
    args = ap.parse_args()
    data = fetch(args.season, [t.upper() for t in args.teams])
    OUT.write_text(json.dumps(data, indent=1))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
