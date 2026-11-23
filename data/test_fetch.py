"""Offline tests for the parsing in fetch_nba.py (no network needed)."""
from fetch_nba import (
    defender_rating,
    height_inches,
    league_from_averages,
    order_lineup,
    parse_team_shot_locations,
    zone_stats,
)


def test_zone_stats_merges_corners_and_skips_backcourt():
    shots = [
        {"SHOT_ZONE_BASIC": "Left Corner 3", "SHOT_MADE_FLAG": 1},
        {"SHOT_ZONE_BASIC": "Right Corner 3", "SHOT_MADE_FLAG": 0},
        {"SHOT_ZONE_BASIC": "Restricted Area", "SHOT_MADE_FLAG": 1},
        {"SHOT_ZONE_BASIC": "Backcourt", "SHOT_MADE_FLAG": 0},
    ]
    z = zone_stats(shots)
    assert z["CORNER3"] == {"fg": 0.5, "att": 2}
    assert z["RA"] == {"fg": 1.0, "att": 1}
    assert "MID" not in z


def test_league_averages():
    rows = [
        {"SHOT_ZONE_BASIC": "Mid-Range", "FGM": 40, "FGA": 100},
        {"SHOT_ZONE_BASIC": "Mid-Range", "FGM": 44, "FGA": 100},
    ]
    assert league_from_averages(rows) == {"MID": 0.42}


def test_parse_team_shot_locations_two_row_header():
    raw = {
        "resultSets": {
            "headers": [
                {"name": "SHOT_CATEGORY", "columnsToSkip": 2, "columnSpan": 3,
                 "columnNames": ["Restricted Area", "Left Corner 3", "Right Corner 3", "Corner 3"]},
                {"name": "columns", "columnNames": ["TEAM_ID", "TEAM_NAME",
                                                    "OPP_FGM", "OPP_FGA", "OPP_FG_PCT",
                                                    "OPP_FGM", "OPP_FGA", "OPP_FG_PCT",
                                                    "OPP_FGM", "OPP_FGA", "OPP_FG_PCT",
                                                    "OPP_FGM", "OPP_FGA", "OPP_FG_PCT"]},
            ],
            "rowSet": [[1, "Team", 60, 100, 0.6, 4, 10, 0.4, 2, 10, 0.2, 6, 20, 0.3]],
        }
    }
    assert parse_team_shot_locations(raw) == {1: {"RA": 0.6, "CORNER3": 0.3}}


def test_defender_rating_is_clamped():
    assert defender_rating(-0.04) == 0.96
    assert defender_rating(0.5) == 1.15
    assert defender_rating(None) == 1.0


def test_lineup_orders_guards_first():
    players = [{"position": "C"}, {"position": "G"}, {"position": "F"}, {"position": "G-F"}, {"position": "F-C"}]
    assert [p["position"] for p in order_lineup(players)] == ["G", "G-F", "F", "F-C", "C"]


def test_height_inches():
    assert height_inches("6-8") == 80
    assert height_inches("7-0") == 84
    assert height_inches(None) is None
    assert height_inches("") is None
