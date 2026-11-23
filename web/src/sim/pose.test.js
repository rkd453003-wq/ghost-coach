import { describe, expect, it } from "vitest";
import { BODY, computePose, legHeight } from "./pose.js";

const base = { fwd: 0, side: 0, dt: 1 / 60, t: 0, role: "off", dribble: null, shoot: null, catching: false };
const footY = (p, leg) => p.pelvisY - BODY.hipDrop - legHeight(leg.hipX, leg.knee, leg.hipZ);

function runFor(seconds, state) {
  const m = {};
  const poses = [];
  for (let t = 0; t < seconds; t += state.dt) poses.push(computePose(m, { ...state, t }));
  return poses;
}

describe("pose", () => {
  it("keeps the lower foot on the floor while running", () => {
    for (const p of runFor(2, { ...base, fwd: 15 })) {
      const lowest = Math.min(footY(p, p.legs.L), footY(p, p.legs.R));
      expect(lowest).toBeGreaterThanOrEqual(BODY.foot - 1e-6);
      expect(lowest).toBeLessThan(BODY.foot + 0.2); // bounce only
    }
  });

  it("swings the legs in opposite directions when running", () => {
    const poses = runFor(1, { ...base, fwd: 15 });
    const opposite = poses.filter((p) => Math.sign(p.legs.L.hipX - p.legs.R.hipX) !== 0);
    expect(opposite.some((p) => p.legs.L.hipX < p.legs.R.hipX)).toBe(true);
    expect(opposite.some((p) => p.legs.L.hipX > p.legs.R.hipX)).toBe(true);
  });

  it("puts defenders lower than attackers", () => {
    const off = computePose({}, base);
    const def = computePose({}, { ...base, role: "def" });
    expect(def.pelvisY).toBeLessThan(off.pelvisY - 0.2);
  });

  it("leaves the floor at the top of a jump shot and lands", () => {
    const top = computePose({}, { ...base, shoot: 0.57 });
    const landed = computePose({}, { ...base, shoot: 1 });
    expect(footY(top, top.legs.L)).toBeGreaterThan(1.5);
    expect(footY(landed, landed.legs.L)).toBeCloseTo(BODY.foot, 1);
    expect(top.arms.R.shoulderX).toBeLessThan(-2.5); // shooting arm up
  });

  it("stands still with no movement", () => {
    const a = computePose({}, base);
    const b = computePose({}, { ...base, t: 0.5 });
    expect(a.legs.L.hipX).toBeCloseTo(b.legs.L.hipX);
  });
});
