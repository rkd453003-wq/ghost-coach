# Planning and estimates

## Goal

Let a coach test a play against a specific opponent before the game: see how that team's defence is likely to react, and which read the play should lead to.

## Scope (v1)

**In:** 3 set plays, 3 screen coverages, expected points per option, ranking vs every opponent, 3 camera views, real-data script.
**Out for now:** zone defence, custom play editor, live data, video.

## Estimates

Fill in "Actual" honestly as you go; the gap is a good interview talking point.

| Milestone | Estimate | Actual | Status |
| --- | --- | --- | --- |
| Simulation engine + tests | 1 day | | Done |
| 3D court, figures, animation | 1.5 days | | Done |
| Controls, best read, opponent ranking | 0.5 day | | Done |
| Real-data script + parsing tests | 1 day | | Done (needs a live run) |
| Live run with 2025-26 data, tune model | 0.5 day | | |
| Deploy to Vercel | 0.5 day | | |
| Play editor | 2–3 days | | |
| Zone defence | 2 days | | |

## Decisions

- **Engine is pure functions of time** (`offensePositions(play, t)`, `defensePositions(play, t, coverage)`), so the 3D view, the scrubber and the tests all read the same source of truth.
- **Coverage is an input, not a guess.** Public data can't tell you how a team guards screens, so it's a setting a coach controls.
- **Small samples are pulled toward league average**, so a player who went 3 for 4 from a zone isn't treated as a 75% shooter.
- **Sample data ships with the repo** so anyone can run it without network access.

## Risks

- stats.nba.com is unofficial and sometimes slow or blocks requests. Mitigation: parsing is isolated and tested; the app keeps working on the last saved data.
