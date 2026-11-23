// Everything the 3D view needs for one moment: the designed play, then the
// read (an extra pass if the best option isn't the holder) and the shot.
import { HOOP, dist } from "./court.js";
import { ballState, defensePositions, finalHolder, offensePositions } from "./engine.js";
import { playDuration } from "./plays.js";

const PASS_TIME = 0.7;
const SHOT_TIME = 1.3;
const GATHER = 0.36; // seconds the shooter holds the ball before release
const POSE_TIME = 0.75; // seconds the shooting motion takes, gather to landing
const RIM_HEIGHT = 10;
const RELEASE_HEIGHT = 9.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, s) => a + (b - a) * s;
const lerp2 = (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];

export function totalDuration(play, best) {
  return playDuration(play) + (best.slot !== finalHolder(play) ? PASS_TIME : 0) + SHOT_TIME;
}

/** Ball height while dribbling and how far up the bounce it is (0 floor .. 1 hand). */
function dribble(t) {
  const d = Math.abs(Math.sin(t * 6.5));
  return { h: 0.45 + d * 2.55, d };
}

/**
 * Returns positions plus who is doing what:
 * holder (dribbling, slot or null), catcher (slot reaching for a pass),
 * shooter + shootK (0..1 through the shooting motion).
 */
export function frameAt(play, t, coverage, best) {
  const end = playDuration(play);
  if (t <= end) {
    const ball = ballState(play, t);
    const inPass = ball.holder === null;
    const dr = dribble(t);
    return {
      off: offensePositions(play, t),
      def: defensePositions(play, t, coverage),
      ball: { pos: ball.pos, h: inPass ? 4.6 + ball.inAir * 2.5 : dr.h },
      holder: inPass ? null : ball.holder,
      dribble: inPass ? null : dr.d,
      catcher: inPass || ball.to !== ball.holder ? ball.to : null,
      shooter: null,
      shootK: null,
      stage: "play",
    };
  }

  const off = offensePositions(play, end);
  const def = defensePositions(play, end, coverage);
  const holder = finalHolder(play);
  const shooterSpot = off[best.slot];
  const passTime = best.slot !== holder ? PASS_TIME : 0;
  const after = t - end;

  // Nearest defender closes out on the shooter during the read.
  const [closer] = Object.entries(def).sort((a, b) => dist(a[1].pos, shooterSpot) - dist(b[1].pos, shooterSpot));
  const closeK = clamp(after / (passTime + 0.45), 0, 1);
  const gap = dist(closer[1].pos, shooterSpot);
  const target = gap > 3 ? lerp2(closer[1].pos, shooterSpot, ((gap - 3) / gap) * Math.min(1, 6 / gap)) : closer[1].pos;
  def[closer[0]] = { ...closer[1], pos: lerp2(closer[1].pos, target, closeK) };

  if (after < passTime) {
    const k = after / passTime;
    return {
      off,
      def,
      ball: { pos: lerp2(off[holder], shooterSpot, k), h: 4.6 + Math.sin(Math.PI * k) * 2.5 },
      holder: null,
      dribble: null,
      catcher: best.slot,
      shooter: null,
      shootK: null,
      stage: "pass",
    };
  }

  const shotT = after - passTime;
  const shootK = clamp(shotT / POSE_TIME, 0, 1);
  if (shotT < GATHER) {
    // Ball in the shooter's hands, carried up through the gather.
    const g = shotT / GATHER;
    return {
      off, def,
      ball: { pos: shooterSpot, h: lerp(4.6, RELEASE_HEIGHT, g * g), inHands: true },
      holder: null, dribble: null, catcher: null, shooter: best.slot, shootK, stage: "shot",
    };
  }

  const k = clamp((shotT - GATHER) / (SHOT_TIME - GATHER), 0, 1);
  const pos = lerp2(shooterSpot, HOOP, k);
  const peak = 13 + dist(shooterSpot, HOOP) * 0.15;
  const ctrl = 2 * peak - (RELEASE_HEIGHT + RIM_HEIGHT) / 2;
  const h = (1 - k) * (1 - k) * RELEASE_HEIGHT + 2 * (1 - k) * k * ctrl + k * k * RIM_HEIGHT;
  return { off, def, ball: { pos, h }, holder: null, dribble: null, catcher: null, shooter: best.slot, shootK, stage: "shot" };
}
