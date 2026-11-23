import { phaseTimes } from "../sim/plays.js";

// Scrubber split into the stages of the play, so you can see (and jump to)
// the set-up, the screen, the read and the shot.
export function stagesFor(play, duration, readTime) {
  const times = phaseTimes(play);
  const stages = play.phases.map((ph, i) => ({
    label: ph.screen ? (ph.screen.offBall ? "Off-ball screen" : "Ball screen") : i === 0 ? "Set up" : "Cuts",
    start: times[i],
    end: times[i + 1],
  }));
  const end = times.at(-1);
  if (readTime > 0) stages.push({ label: "Read", start: end, end: end + readTime });
  stages.push({ label: "Shot", start: end + readTime, end: duration });
  return stages;
}

export default function Timeline({ stages, t, duration, onSeek }) {
  return (
    <div className="timeline">
      <div className="track">
        {stages.map((s) => {
          const fill = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
          const current = t >= s.start && (t < s.end || s.end === duration);
          return (
            <button
              key={s.label + s.start}
              className={`seg${current ? " current" : ""}`}
              style={{ flexGrow: s.end - s.start }}
              onClick={() => onSeek(s.start + 0.001)}
              aria-label={`Jump to ${s.label}`}
            >
              <span className="fill" style={{ transform: `scaleX(${fill})` }} />
              <span className="lbl">{s.label}</span>
            </button>
          );
        })}
      </div>
      <input
        type="range"
        min="0"
        max={duration}
        step="0.01"
        value={Math.min(t, duration)}
        aria-label="Timeline"
        onChange={(e) => onSeek(Number(e.target.value))}
      />
    </div>
  );
}
