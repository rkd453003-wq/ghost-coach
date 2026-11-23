"""Write a SAMPLE teams.json so the app runs without network access.

Every number here is synthetic: plausible league-shaped values with seeded
random variation. Players are position placeholders, not real people.
Run fetch_nba.py on a machine with internet access to replace this with
real rosters and stats.
"""
import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "web" / "src" / "data" / "teams.json"

LEAGUE = {"RA": 0.655, "PAINT": 0.435, "MID": 0.415, "CORNER3": 0.385, "ATB3": 0.355}

# Typical attempts per season by zone for each position, and baseline skill.
POSITIONS = {
    1: ("PG", {"RA": 140, "PAINT": 120, "MID": 160, "CORNER3": 30, "ATB3": 380}, (0.97, 1.08)),
    2: ("SG", {"RA": 110, "PAINT": 80, "MID": 110, "CORNER3": 90, "ATB3": 330}, (0.98, 1.07)),
    3: ("SF", {"RA": 150, "PAINT": 90, "MID": 90, "CORNER3": 110, "ATB3": 240}, (0.98, 1.02)),
    4: ("PF", {"RA": 210, "PAINT": 110, "MID": 70, "CORNER3": 60, "ATB3": 180}, (1.03, 0.97)),
    5: ("C", {"RA": 330, "PAINT": 140, "MID": 40, "CORNER3": 5, "ATB3": 40}, (1.07, 0.92)),
}

# Coverage on ball screens. These are placeholder assumptions to edit, not scouting.
TEAMS = {
    "TOR": ("Toronto", "drop"),
    "MIA": ("Miami", "switch"),
    "BOS": ("Boston", "switch"),
    "NYK": ("New York", "drop"),
    "CLE": ("Cleveland", "drop"),
    "MIL": ("Milwaukee", "hedge"),
}


def main() -> None:
    rng = random.Random(2026)
    teams = {}
    for abbr, (city, coverage) in TEAMS.items():
        players = []
        for slot, (pos, atts, (perim, inter)) in POSITIONS.items():
            skill = rng.uniform(-0.04, 0.04)
            zones = {
                z: {"fg": round(LEAGUE[z] + skill + rng.uniform(-0.04, 0.04), 3), "att": a}
                for z, a in atts.items()
            }
            players.append({
                "slot": slot,
                "name": f"{abbr} {pos}",
                "pos": pos,
                "zones": zones,
                "def": {
                    "perimeter": round(perim + rng.uniform(-0.03, 0.03), 3),
                    "interior": round(inter + rng.uniform(-0.03, 0.03), 3),
                },
            })
        allowed = {z: round(v + rng.uniform(-0.025, 0.025), 3) for z, v in LEAGUE.items()}
        teams[abbr] = {"name": city, "coverage": coverage, "allowed": allowed, "players": players}

    data = {"source": "sample", "season": "sample", "league": LEAGUE, "teams": teams}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1))
    print(f"Wrote sample data to {OUT}")


if __name__ == "__main__":
    main()
