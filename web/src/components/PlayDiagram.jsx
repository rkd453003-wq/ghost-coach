import { useId } from "react";
import { CORNER_THREE_MAX_Y, CORNER_THREE_X, HOOP, THREE_RADIUS } from "../sim/court.js";

// Whiteboard-style X's and O's drawn straight from a play's data:
// O = attacker with their slot number, curved arrow = cut, T-bar = screen,
// dashed arrow = pass. Baseline at the top, like a coach's clipboard.
const Y_MAX = 36; // crop the half court a little below the top of the key

const toSvg = ([x, y]) => [x, y];

function keyframes(play) {
  const frames = [{ ...play.start }];
  for (const phase of play.phases) frames.push({ ...frames.at(-1), ...phase.moves });
  return frames;
}

function pathFor(points) {
  if (points.length < 2) return null;
  const [first, ...rest] = points.map(toSvg);
  if (rest.length === 1) return `M${first} L${rest[0]}`;
  // Smooth curve through the keyframes.
  let d = `M${first}`;
  let prev = first;
  rest.forEach((p, i) => {
    const next = rest[i + 1];
    const mid = next ? [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2] : p;
    d += ` Q${p} ${mid}`;
    prev = p;
  });
  return prev ? d : null;
}

function screenBar(at, toward) {
  const dx = toward[0] - at[0];
  const dy = toward[1] - at[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 2.2;
  const ny = (dx / len) * 2.2;
  return `M${at[0] + nx},${at[1] + ny} L${at[0] - nx},${at[1] - ny}`;
}

export default function PlayDiagram({ play, active }) {
  const uid = useId().replace(/:/g, "");
  const frames = keyframes(play);
  const slots = [1, 2, 3, 4, 5];
  const cornerAngle = Math.asin((CORNER_THREE_MAX_Y - HOOP[1]) / THREE_RADIUS);
  const arcStart = [HOOP[0] + Math.cos(cornerAngle) * THREE_RADIUS, HOOP[1] + Math.sin(cornerAngle) * THREE_RADIUS];

  const passes = [];
  let holder = play.ball;
  play.phases.forEach((ph, i) => {
    if (ph.ball && ph.ball !== holder) {
      passes.push([frames[i][holder], frames[i + 1][ph.ball]]);
      holder = ph.ball;
    }
  });

  const screens = play.phases
    .map((ph, i) => (ph.screen ? { at: frames[i][ph.screen.screener], toward: frames[i][ph.screen.handler] } : null))
    .filter(Boolean);

  return (
    <svg className={`diagram${active ? " on" : ""}`} viewBox={`-26 -2 52 ${Y_MAX + 4}`} aria-hidden="true">
      <defs>
        <filter id={`wob${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="0.9" />
        </filter>
        <marker id={`arr${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--red)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <marker id={`parr${uid}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M1,1 L9,5 L1,9" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      <g className="court" filter={`url(#wob${uid})`}>
        <path d={`M-25,${Y_MAX} L-25,0 L25,0 L25,${Y_MAX}`} />
        <path d="M-8,0 L-8,19 L8,19 L8,0" />
        <path d="M-6,19 A6,6 0 0 0 6,19" />
        <path d={`M-${CORNER_THREE_X},0 L-${CORNER_THREE_X},${CORNER_THREE_MAX_Y} A${THREE_RADIUS},${THREE_RADIUS} 0 0 0 ${CORNER_THREE_X},${arcStart[1]} L${CORNER_THREE_X},0`} />
        <circle cx={HOOP[0]} cy={HOOP[1]} r="0.9" />
        <path d="M-3,4 L3,4" />
      </g>

      <g filter={`url(#wob${uid})`}>
        {slots.map((s) => {
          const pts = frames.map((f) => f[s]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
          const d = pathFor(pts);
          return d ? <path key={s} className="cut" d={d} markerEnd={`url(#arr${uid})`} /> : null;
        })}
        {passes.map(([a, b], i) => (
          <path key={i} className="pass" d={`M${a} L${b}`} markerEnd={`url(#parr${uid})`} />
        ))}
        {screens.map((sc, i) => (
          <path key={i} className="screen" d={screenBar(sc.at, sc.toward)} />
        ))}
      </g>

      {slots.map((s) => {
        const [x, y] = frames[0][s];
        return (
          <g key={s} className="o" transform={`translate(${x} ${y})`}>
            <circle r="2.6" />
            <text y="1.15">{s}</text>
          </g>
        );
      })}
      <circle className="ball" cx={frames[0][play.ball][0] + 2.3} cy={frames[0][play.ball][1] - 2.1} r="0.95" />
    </svg>
  );
}
