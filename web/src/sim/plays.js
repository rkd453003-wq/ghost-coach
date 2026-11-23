// Play library. Slots: 1 PG, 2 SG, 3 SF, 4 PF, 5 C.
// Each play has start spots, then phases. A phase moves the listed players to
// new spots over `dur` seconds. `ball` is who holds the ball at the end of the
// phase (a change of holder is animated as a pass). `screen` marks a ball
// screen, which is where each defence's coverage kicks in.
// `options` are the shots the play is designed to create; the engine reads
// the defence at the end and takes the best one.

export const PLAYS = {
  highPnr: {
    name: "High pick-and-roll",
    description: "Centre sets a high ball screen; guard attacks right, centre rolls, shooters spaced in the corners.",
    start: { 1: [0, 31], 2: [-22.5, 4], 3: [22.5, 4], 4: [-18, 22], 5: [-4, 19] },
    ball: 1,
    phases: [
      { dur: 1.2, moves: { 5: [2, 28.5] } },
      { dur: 1.4, screen: { handler: 1, screener: 5 }, moves: { 1: [9, 21], 5: [1.5, 9] } },
      { dur: 0.9, moves: { 1: [9.5, 17.5], 5: [0.5, 7], 4: [-20, 18] } },
    ],
    options: [
      { slot: 1, label: "Guard pull-up" },
      { slot: 5, label: "Roll to the rim" },
      { slot: 3, label: "Kick to strong-side corner" },
      { slot: 2, label: "Skip to weak-side corner" },
    ],
  },
  horns: {
    name: "Horns pick-and-pop",
    description: "Bigs at both elbows. Centre screens for the guard, power forward pops to the top for three.",
    start: { 1: [0, 32], 2: [-22.5, 4], 3: [22.5, 4], 4: [-8, 19.5], 5: [8, 19.5] },
    ball: 1,
    phases: [
      { dur: 1.0, moves: { 5: [3, 28.5] } },
      { dur: 1.3, screen: { handler: 1, screener: 5 }, moves: { 1: [11, 20], 5: [2, 10], 4: [-6, 29] } },
      { dur: 0.9, ball: 4, moves: { 1: [14, 15], 5: [1, 7] } },
    ],
    options: [
      { slot: 4, label: "Pop three" },
      { slot: 5, label: "Roll to the rim" },
      { slot: 1, label: "Guard drive" },
      { slot: 2, label: "Weak-side corner" },
    ],
  },
  pinDown: {
    name: "Floppy pin-down",
    description: "Wing starts under the rim and runs off staggered screens to the right wing for a catch-and-shoot look.",
    start: { 1: [-6, 31], 2: [0, 6], 3: [-22.5, 4], 4: [7, 9], 5: [9, 15] },
    ball: 1,
    phases: [
      { dur: 1.1, moves: { 2: [9, 11], 1: [-2, 30] } },
      { dur: 1.1, screen: { handler: 2, screener: 5, offBall: true }, moves: { 2: [19, 21], 4: [6, 7], 5: [3, 9] } },
      { dur: 0.9, ball: 2, moves: { 2: [20, 22], 5: [2.5, 6.5] } },
    ],
    options: [
      { slot: 2, label: "Catch-and-shoot three" },
      { slot: 5, label: "Post seal" },
      { slot: 3, label: "Weak-side corner" },
      { slot: 1, label: "Guard pull-up" },
    ],
  },
};

/** Phase boundaries in seconds: [0, end of phase 1, end of phase 2, ...]. */
export function phaseTimes(play) {
  const times = [0];
  for (const p of play.phases) times.push(times.at(-1) + p.dur);
  return times;
}

export const playDuration = (play) => phaseTimes(play).at(-1);
