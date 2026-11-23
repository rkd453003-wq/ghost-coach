// Everything the 3D view needs for one moment: the designed play, then the
// read (an extra pass if the best option isn't the holder) and the shot.
import { HOOP, dist } from "./court.js";
import { ballState, defensePositions, finalHolder, offensePositions } from "./engine.js";
import { playDuration } from "./plays.js";

const PASS_TIME = 0.7;
const SHOT_TIME = 1.2;
const RIM_HEIGHT = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, s) => a + (b - a) * s;
const lerp2 = (a, b, s) => [lerp(a[0], b[0], s), lerp(a[1], b[1], s)];

export function totalDuration(play, best) {
  return playDuration(play) + (best.slot !== finalHolder(play) ? PASS_TIME : 0) + SHOT_TIME;
}

function dribbleHeight(t) {
  return 1 + Math.abs(Math.sin(t * 7)) * 2.2;
}

export function frameAt(play, t, coverage, best) {
  const end = playDuration(play);
  if (t <= end) {
    const ball = ballState(play, t);
    const inPass = ball.holder === null;
    return {
      off: offensePositions(play, t),
      def: defensePositions(play, t, coverage),
      ball: { pos: ball.pos, h: inPass ? 4.5 + ball.inAir * 2.5 : dribbleHeight(t) },
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
  const closeK = clamp(after / (passTime + 0.4), 0, 1);
  const gap = dist(closer[1].pos, shooterSpot);
  const target = gap > 3 ? lerp2(closer[1].pos, shooterSpot, ((gap - 3) / gap) * Math.min(1, 6 / gap)) : closer[1].pos;
  def[closer[0]] = { ...closer[1], pos: lerp2(closer[1].pos, target, closeK) };

  if (after < passTime) {
    const k = after / passTime;
    return {
      off,
      def,
      ball: { pos: lerp2(off[holder], shooterSpot, k), h: 4.5 + Math.sin(Math.PI * k) * 2.5 },
      stage: "pass",
    };
  }

  const k = clamp((after - passTime) / SHOT_TIME, 0, 1);
  const pos = lerp2(shooterSpot, HOOP, k);
  const peak = 13 + dist(shooterSpot, HOOP) * 0.15;
  // Parabola from release (7 ft) through the peak to the rim.
  const h = (1 - k) * (1 - k) * 7 + 2 * (1 - k) * k * (2 * peak - 8.5) + k * k * RIM_HEIGHT;
  return { off, def, ball: { pos, h }, stage: "shot" };
}
