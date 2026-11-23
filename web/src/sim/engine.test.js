import { describe, expect, it } from "vitest";
import { HOOP, dist, zoneOf } from "./court.js";
import { PLAYS, playDuration } from "./plays.js";
import {
  ballState,
  compareOpponents,
  contestFactor,
  defensePositions,
  evaluatePlay,
  offensePositions,
} from "./engine.js";
import data from "../data/teams.json";

const pnr = PLAYS.highPnr;
const end = playDuration(pnr);

describe("court zones", () => {
  it.each([
    [[0, 6], "RA"],
    [[5, 14], "PAINT"],
    [[12, 18], "MID"],
    [[-22.5, 4], "CORNER3"],
    [[0, 31], "ATB3"],
  ])("%j is %s", (spot, zone) => expect(zoneOf(spot)).toBe(zone));
});

describe("movement", () => {
  it("starts at the play's start spots and ends at the last moves", () => {
    expect(offensePositions(pnr, 0)[1]).toEqual(pnr.start[1]);
    expect(offensePositions(pnr, end)[5]).toEqual([0.5, 7]);
  });

  it("animates a pass between holders", () => {
    const horns = PLAYS.horns;
    const mid = playDuration(horns) - 0.2;
    expect(ballState(horns, mid).holder).toBeNull();
    expect(ballState(horns, playDuration(horns)).holder).toBe(4);
  });

  it("keeps every play inside the half court", () => {
    for (const play of Object.values(PLAYS)) {
      for (let t = 0; t <= playDuration(play); t += 0.25) {
        for (const [x, y] of Object.values(offensePositions(play, t))) {
          expect(Math.abs(x)).toBeLessThanOrEqual(25);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(47);
        }
      }
    }
  });
});

describe("defence", () => {
  it("swaps assignments on a switch", () => {
    const d = defensePositions(pnr, end, "switch");
    expect(d[1].guarding).toBe(5);
    expect(d[5].guarding).toBe(1);
  });

  it("drops the big toward the rim in drop coverage", () => {
    const off = offensePositions(pnr, end);
    const d = defensePositions(pnr, end, "drop");
    expect(dist(d[5].pos, HOOP)).toBeLessThan(dist(off[1], HOOP));
  });

  it("leaves a shooter more open when the weak side helps on a hedge", () => {
    const hedge = evaluatePlay(pnr, data.teams.TOR, data.teams.MIA, "hedge", data.league);
    const drop = evaluatePlay(pnr, data.teams.TOR, data.teams.MIA, "drop", data.league);
    const openest = (r) => Math.max(...r.options.filter((o) => o.slot !== 1 && o.slot !== 5).map((o) => o.openFeet));
    expect(openest(hedge)).toBeGreaterThan(openest(drop));
  });
});

describe("outcomes", () => {
  it("tighter contests lower the make rate", () => {
    expect(contestFactor(1)).toBeLessThan(contestFactor(4));
    expect(contestFactor(4)).toBeLessThan(contestFactor(8));
  });

  it("returns sensible expected points and picks the best option", () => {
    const r = evaluatePlay(pnr, data.teams.TOR, data.teams.MIA, "switch", data.league);
    for (const o of r.options) {
      expect(o.epp).toBeGreaterThan(0.3);
      expect(o.epp).toBeLessThan(2.2);
    }
    expect(r.best.epp).toBe(Math.max(...r.options.map((o) => o.epp)));
  });

  it("ranks every opponent except the offence", () => {
    const ranked = compareOpponents(pnr, "TOR", data);
    expect(ranked.map((r) => r.id)).not.toContain("TOR");
    expect(ranked).toHaveLength(Object.keys(data.teams).length - 1);
    expect(ranked[0].best.epp).toBeGreaterThanOrEqual(ranked.at(-1).best.epp);
  });
});
