import { HOOP, ZONES, dist, pointsFor, zoneOf } from "./court.js";
import { phaseTimes, playDuration } from "./plays.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (s) => s * s * (3 - 2 * s);
const lerp2 = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
const toward = (from, to, d) => {
  const len = dist(from, to) || 1;
  return [from[0] + ((to[0] - from[0]) / len) * d, from[1] + ((to[1] - from[1]) / len) * d];
};
const SLOTS = [1, 2, 3, 4, 5];

export const COVERAGES = {
  drop: "Drop: big sags into the paint, guard chases over the screen",
  switch: "Switch: defenders swap assignments on the screen",
  hedge: "Hedge/blitz: both defenders trap the ball, weak side rotates",
};

/** Offensive spots at the end of every phase (index 0 = start). */
function keyframes(play) {
  const frames = [{ ...play.start }];
  for (const phase of play.phases) frames.push({ ...frames.at(-1), ...phase.moves });
  return frames;
}

function locate(play, t) {
  const times = phaseTimes(play);
  const tt = clamp(t, 0, times.at(-1));
  let i = 0;
  while (i < play.phases.length - 1 && tt > times[i + 1]) i++;
  const s = play.phases.length ? clamp((tt - times[i]) / (times[i + 1] - times[i]), 0, 1) : 0;
  return { i, s, t: tt, times };
}

/** Where each attacker stands at time t. */
export function offensePositions(play, t) {
  const frames = keyframes(play);
  const { i, s } = locate(play, t);
  const out = {};
  for (const slot of SLOTS) out[slot] = lerp2(frames[i][slot], frames[i + 1][slot], ease(s));
  return out;
}

/** Ball holder at the end of each phase (index 0 = start). */
function holders(play) {
  const list = [play.ball];
  for (const phase of play.phases) list.push(phase.ball ?? list.at(-1));
  return list;
}

/** Ball on the floor plan plus whether it is in the air on a pass. */
export function ballState(play, t) {
  const off = offensePositions(play, t);
  const { i, s } = locate(play, t);
  const hs = holders(play);
  const from = hs[i];
  const to = hs[i + 1];
  if (from === to || s < 0.5) return { pos: off[from], holder: from, to: from, inAir: 0 };
  const k = (s - 0.5) / 0.5; // pass travels in the second half of the phase
  return { pos: lerp2(off[from], off[to], k), holder: k >= 1 ? to : null, to, inAir: Math.sin(Math.PI * k) };
}

export const finalHolder = (play) => holders(play).at(-1);

function screenWindow(play) {
  const times = phaseTimes(play);
  const idx = play.phases.findIndex((p) => p.screen);
  if (idx < 0) return null;
  return { ...play.phases[idx].screen, start: times[idx], end: times[idx + 1] };
}

function guardSpot(man, ballPos, isOnBall) {
  const sag = isOnBall ? 3 : clamp(3 + dist(man, ballPos) * 0.2, 3, 8);
  return toward(man, HOOP, Math.min(sag, dist(man, HOOP) * 0.7));
}

/**
 * Where each defender stands at time t, keyed by defender slot.
 * Each entry: { pos, guarding } where guarding is the attacker slot they are on.
 */
export function defensePositions(play, t, coverage) {
  const off = offensePositions(play, t);
  const ball = ballState(play, t);
  const holder = ball.holder ?? finalHolder(play);
  const scr = screenWindow(play);
  const assign = Object.fromEntries(SLOTS.map((s) => [s, s]));

  if (scr && coverage === "switch" && t >= scr.start + (scr.end - scr.start) * 0.5) {
    assign[scr.handler] = scr.screener;
    assign[scr.screener] = scr.handler;
  }

  const out = {};
  for (const d of SLOTS) {
    const man = off[assign[d]];
    out[d] = { pos: guardSpot(man, ball.pos, assign[d] === holder), guarding: assign[d] };
  }
  if (!scr || t < scr.start || coverage === "switch") return out;

  const h = off[scr.handler];
  const sc = off[scr.screener];
  const inScreen = t <= scr.end;

  if (scr.offBall) {
    // Off-ball screen: the chaser is held up and trails; the screener's man stays home.
    if (inScreen || t - scr.end < 1.5) out[scr.handler].pos = toward(h, HOOP, -(inScreen ? 4 : 3.5));
    return out;
  }

  if (coverage === "drop") {
    // Big sits between the ball and the rim; guard trails behind the handler.
    out[scr.screener].pos = toward(HOOP, h, clamp(dist(h, HOOP) - 5, 3, 6));
    const trail = inScreen ? 4 : 3;
    out[scr.handler].pos = toward(h, HOOP, -trail);
  }

  if (coverage === "hedge") {
    // Both defenders trap the ball; the weak-side defender drops onto the roller.
    const helper = SLOTS.filter((s) => s !== scr.handler && s !== scr.screener)
      .sort((a, b) => dist(off[b], h) - dist(off[a], h))[0];
    const trapSpot = toward(h, sc, 2.5);
    if (inScreen) {
      out[scr.screener].pos = trapSpot;
    } else {
      const k = clamp((t - scr.end) / 1.5, 0, 1); // big recovers to the helper's man
      out[scr.screener] = { pos: lerp2(trapSpot, guardSpot(off[helper], ball.pos, false), k), guarding: helper };
    }
    out[helper] = { pos: toward(sc, HOOP, 2), guarding: scr.screener };
  }
  return out;
}

const CLOSEOUT_FEET = 6;

// Closest-defender adjustment to shooting %. Approximate shape of public
// NBA closest-defender splits: tight contests lower FG%, wide-open raises it.
const CONTEST = [[0, 0.7], [2, 0.8], [4, 0.92], [6, 1.0], [10, 1.1]];
export function contestFactor(d) {
  for (let i = 1; i < CONTEST.length; i++) {
    const [d0, f0] = CONTEST[i - 1];
    const [d1, f1] = CONTEST[i];
    if (d <= d1) return f0 + ((f1 - f0) * (Math.max(d, d0) - d0)) / (d1 - d0);
  }
  return CONTEST.at(-1)[1];
}

/** Shrink small samples toward league average so 3 makes in 4 tries isn't 75%. */
function shrunkFg(player, zone, league) {
  const z = player?.zones?.[zone];
  if (!z) return league[zone];
  return (z.fg * z.att + league[zone] * 25) / (z.att + 25);
}

const playerIn = (team, slot) => team.players.find((p) => p.slot === slot);

/**
 * Score each designed option against a defence and pick the best read.
 * Expected points = player FG% in the zone × how that team defends the zone
 * × contest from the nearest defender × points, minus a small pass risk.
 */
export function evaluatePlay(play, offense, defense, coverage, league) {
  const end = playDuration(play);
  const off = offensePositions(play, end);
  const def = defensePositions(play, end, coverage);
  const holder = finalHolder(play);

  const options = play.options.map((opt) => {
    const spot = off[opt.slot];
    const zone = zoneOf(spot);
    const shooter = playerIn(offense, opt.slot);

    let nearest = null;
    for (const [dSlot, d] of Object.entries(def)) {
      let eff = dist(d.pos, spot);
      if (dist(d.pos, HOOP) > dist(spot, HOOP) + 1) eff += 2.5; // trailing from behind
      if (!nearest || eff < nearest.eff) nearest = { slot: Number(dSlot), eff, raw: dist(d.pos, spot) };
    }
    const needsPass = opt.slot !== holder;
    // While a pass is in the air the nearest defender closes out on the catch.
    if (needsPass) nearest.eff = Math.max(nearest.eff - CLOSEOUT_FEET, nearest.eff * 0.4);
    const defender = playerIn(defense, nearest.slot);
    const kind = zone === "RA" || zone === "PAINT" ? "interior" : "perimeter";
    const defRating = defender?.def?.[kind] ?? 1;
    const reach = clamp((6 - nearest.eff) / 6, 0, 1);

    const base = shrunkFg(shooter, zone, league);
    const teamAdj = (defense.allowed?.[zone] ?? league[zone]) / league[zone];
    const fg = clamp(base * teamAdj * contestFactor(nearest.eff) * (1 + (defRating - 1) * reach), 0.05, 0.95);
    const passRisk = needsPass ? 0.04 : 0;
    const epp = fg * pointsFor(zone) * (1 - passRisk);

    return {
      ...opt,
      shooter: shooter?.name ?? `Player ${opt.slot}`,
      zone,
      fg,
      openFeet: nearest.raw,
      defender: defender?.name ?? `Defender ${nearest.slot}`,
      epp,
    };
  });

  const best = options.reduce((a, b) => (b.epp > a.epp ? b : a));
  return { options: options.sort((a, b) => b.epp - a.epp), best };
}

/** Run one play against every other team, best read each time. */
export function compareOpponents(play, offenseId, data, coverageOverride) {
  const offense = data.teams[offenseId];
  return Object.entries(data.teams)
    .filter(([id]) => id !== offenseId)
    .map(([id, team]) => {
      const coverage = coverageOverride ?? team.coverage;
      const { best } = evaluatePlay(play, offense, team, coverage, data.league);
      return { id, name: team.name, coverage, best };
    })
    .sort((a, b) => b.best.epp - a.best.epp);
}

export { ZONES };
