// Procedural athlete animation. Given how a player is moving and what they're
// doing, returns joint angles for the rig in Player.jsx. Angles are radians in
// the figure's local frame (facing +z, figure's left is +x):
//   hip/shoulder .x < 0 swings the limb forward; knee .x > 0 bends the knee;
//   elbow .x < 0 bends the elbow; spine .x > 0 leans forward;
//   hip/shoulder .z > 0 moves a left limb outward (mirrored for the right).

export const BODY = {
  thigh: 1.62,
  shin: 1.58,
  foot: 0.24, // ankle joint height above the floor
  hipDrop: 0.12, // hip joints sit this far below the pelvis origin
  upperArm: 1.12,
  forearm: 1.02,
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, k) => a + (b - a) * k;
const STRIDE = 2.4; // feet travelled per radian of the run cycle / 2

/** Vertical reach of a leg from hip to ankle for given joint angles. */
export function legHeight(hipX, knee, hipZ = 0) {
  return (BODY.thigh * Math.cos(hipX) + BODY.shin * Math.cos(hipX + knee)) * Math.cos(hipZ);
}

/**
 * @param m motion state for this player (mutated: cycle phase)
 * @param s {fwd, side, dt, t, role: "off"|"def", dribble: 0..1|null,
 *           shoot: 0..1|null, catching: bool}
 */
export function computePose(m, s) {
  const speed = Math.hypot(s.fwd, s.side);
  const sliding = s.role === "def" && Math.abs(s.side) > Math.abs(s.fwd) * 0.8 && speed > 1;
  m.phase = (m.phase ?? 0) + (speed * s.dt) / STRIDE;

  const run = sliding ? 0 : clamp(speed / 14, 0, 1);
  const slide = sliding ? clamp(speed / 8, 0, 1) : 0;
  const crouch = s.role === "def" ? 1 : 0.35;
  const sinP = Math.sin(m.phase);

  // Legs: athletic base stance, then the run or slide cycle on top.
  const baseHip = -0.32 * crouch - 0.08;
  const baseKnee = 0.62 * crouch + 0.12;
  const spread = s.role === "def" ? 0.17 : 0.06;

  const legs = {};
  for (const [side, sign] of [["L", 1], ["R", -1]]) {
    const swing = sinP * sign;
    const hipX = baseHip * (1 - run * 0.6) - swing * 0.62 * run;
    // Knee folds most while the leg swings forward under the body.
    const kneeLift = Math.max(0, Math.cos(m.phase) * sign) * 1.3 * run;
    const knee = baseKnee * (1 - run * 0.5) + kneeLift + Math.max(0, swing) * 0.15 * run;
    const hipZ = spread + Math.max(0, swing) * 0.24 * slide;
    legs[side] = { hipX, knee, hipZ };
  }

  // Shot: gather (knees dip), rise, release, hang.
  let lift = 0;
  if (s.shoot != null) {
    const k = s.shoot;
    const dip = k < 0.25 ? Math.sin((k / 0.25) * Math.PI * 0.5) : Math.max(0, 1 - (k - 0.25) / 0.1);
    for (const leg of Object.values(legs)) {
      leg.hipX = mix(leg.hipX, -0.55, dip);
      leg.knee = mix(leg.knee, 1.05, dip);
      if (k > 0.3) { leg.hipX = -0.12; leg.knee = 0.25; leg.hipZ = 0.05; }
    }
    if (k > 0.3 && k < 0.85) lift = Math.sin(((k - 0.3) / 0.55) * Math.PI) * 2.1;
  }

  // Keep the lower foot on the floor; the other one lifts naturally in the cycle.
  const reach = Math.max(legHeight(legs.L.hipX, legs.L.knee, legs.L.hipZ), legHeight(legs.R.hipX, legs.R.knee, legs.R.hipZ));
  const bounce = Math.abs(Math.cos(m.phase)) * 0.18 * run;
  const pelvisY = reach + BODY.foot + BODY.hipDrop + bounce + lift;

  // Ankles keep the shoes roughly flat.
  for (const leg of Object.values(legs)) leg.ankle = -(leg.hipX + leg.knee) * 0.85;

  // Torso.
  const spine = 0.1 + 0.18 * crouch + 0.14 * run - (s.shoot != null && s.shoot > 0.3 ? 0.25 : 0);
  const breathe = Math.sin(s.t * 2.2 + (m.seed ?? 0)) * 0.015;

  // Arms: run swing, defensive "active hands", then task overrides.
  const arms = {};
  for (const [side, sign] of [["L", 1], ["R", -1]]) {
    const swing = sinP * sign;
    let shoulderX = swing * 0.75 * run + 0.05;
    let shoulderZ = 0.12;
    let elbow = -0.25 - 1.05 * run;
    if (s.role === "def") {
      shoulderX = mix(-0.55, shoulderX, run);
      shoulderZ = mix(0.85, 0.3, run) + Math.sin(s.t * 3 + sign) * 0.06;
      elbow = mix(-0.75, elbow, run);
    }
    arms[side] = { shoulderX, shoulderZ, elbow };
  }

  if (s.dribble != null) {
    // Right hand pumps the ball; left arm up for protection.
    const d = s.dribble; // 0 = ball at floor, 1 = ball at hand
    arms.R = { shoulderX: -0.15 - 0.25 * d, shoulderZ: 0.28, elbow: -0.55 - 0.55 * d };
    arms.L = { shoulderX: -0.75, shoulderZ: 0.35, elbow: -1.2 };
  }
  if (s.catching) {
    arms.L = { shoulderX: -1.25, shoulderZ: 0.15, elbow: -0.45 };
    arms.R = { shoulderX: -1.25, shoulderZ: 0.15, elbow: -0.45 };
  }
  if (s.shoot != null) {
    const k = s.shoot;
    const raise = clamp((k - 0.15) / 0.3, 0, 1);
    const release = clamp((k - 0.45) / 0.12, 0, 1);
    arms.R = { shoulderX: mix(-1.1, -2.85, raise), shoulderZ: 0.12, elbow: mix(-1.6, -0.15, release) };
    arms.L = { shoulderX: mix(-1.1, -2.6, raise), shoulderZ: 0.2, elbow: mix(-1.5, -0.9, raise) };
  }

  return { legs, arms, pelvisY, spine: spine + breathe, lean: clamp(s.side / 30, -0.12, 0.12) * run };
}
