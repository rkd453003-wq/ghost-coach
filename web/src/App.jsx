import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Simulation, { CAMERAS } from "./components/Simulation.jsx";
import PlayDiagram from "./components/PlayDiagram.jsx";
import Timeline, { stagesFor } from "./components/Timeline.jsx";
import { PLAYS } from "./sim/plays.js";
import { COVERAGES, compareOpponents, evaluatePlay, finalHolder } from "./sim/engine.js";
import { ZONE_LABELS } from "./sim/court.js";
import { totalDuration } from "./sim/timeline.js";
import data from "./data/teams.json";

const pct = (v) => `${Math.round(v * 100)}%`;
const COVERAGE_NAMES = { drop: "Drop", switch: "Switch", hedge: "Hedge" };
const PLAY_IDS = Object.keys(PLAYS);
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Animates a number toward its new value when it changes. */
function useCountUp(value, ms = 550) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function TeamChips({ label, value, onChange, exclude }) {
  return (
    <fieldset className="chips">
      <legend>{label}</legend>
      <div className="chip-row" role="radiogroup">
        {Object.entries(data.teams).map(([id, team]) => (
          <button
            key={id}
            role="radio"
            aria-checked={value === id}
            aria-label={team.name}
            title={team.name}
            disabled={id === exclude}
            className={value === id ? "on" : ""}
            onClick={() => onChange(id)}
          >
            {id}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function App() {
  const teamIds = Object.keys(data.teams);
  const [offenseId, setOffenseId] = useState(teamIds.includes("TOR") ? "TOR" : teamIds[0]);
  const [defenseId, setDefenseId] = useState(teamIds.includes("MIA") ? "MIA" : teamIds[1]);
  const [coverageChoice, setCoverageChoice] = useState("team");
  const [playId, setPlayId] = useState("highPnr");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState("broadcast");
  const [clock, setClock] = useState({ t: 0, stage: "play" });
  const timeRef = useRef(0);

  const offense = data.teams[offenseId];
  const defense = data.teams[defenseId];
  const play = PLAYS[playId];
  const coverage = coverageChoice === "team" ? defense.coverage : coverageChoice;
  const override = coverageChoice === "team" ? undefined : coverageChoice;

  const result = useMemo(() => evaluatePlay(play, offense, defense, coverage, data.league), [play, offense, defense, coverage]);
  const ranking = useMemo(() => compareOpponents(play, offenseId, data, override), [play, offenseId, override]);
  const duration = totalDuration(play, result.best);
  const readTime = result.best.slot !== finalHolder(play) ? 0.7 : 0;
  const stages = useMemo(() => stagesFor(play, duration, readTime), [play, duration, readTime]);
  const maxEpp = Math.max(...ranking.map((r) => r.best.epp), ...result.options.map((o) => o.epp));
  const bestShown = useCountUp(result.best.epp);
  const atEnd = clock.t >= duration - 0.01;

  const replay = useCallback(() => {
    timeRef.current = 0;
    setPlaying(true);
  }, []);

  const seek = (v) => {
    setPlaying(false);
    timeRef.current = v;
    setClock((c) => ({ ...c, t: v }));
  };

  useEffect(replay, [playId, offenseId, defenseId, coverage, replay]);

  useEffect(() => {
    if (offenseId === defenseId) setDefenseId(teamIds.find((id) => id !== offenseId));
  }, [offenseId, defenseId, teamIds]);

  // Space: play/pause. R: replay. 1-3: pick a play.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, select, textarea") || e.metaKey || e.ctrlKey) return;
      if (e.code === "Space" && !e.target.closest?.("button")) {
        e.preventDefault();
        if (timeRef.current >= duration - 0.01) replay();
        else setPlaying((p) => !p);
      } else if (e.key === "r") replay();
      else if (PLAY_IDS[Number(e.key) - 1]) setPlayId(PLAY_IDS[Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [duration, replay]);

  const stageText =
    clock.stage === "play" ? play.name : clock.stage === "pass" ? `Read: pass to ${result.best.shooter}` : `Shot: ${result.best.label.toLowerCase()}`;

  return (
    <div className="app">
      <section className="stage" aria-label="3D play view">
        <Canvas shadows camera={{ position: CAMERAS.broadcast.pos, fov: 42 }} dpr={[1, 2]}>
          <Suspense fallback={null}>
            <Simulation
              play={play}
              coverage={coverage}
              offense={offense}
              defense={defense}
              result={result}
              timeRef={timeRef}
              playing={playing}
              speed={speed}
              view={view}
              onTime={(t, stage) => setClock({ t, stage })}
              onEnd={() => setPlaying(false)}
            />
          </Suspense>
        </Canvas>

        <div className="hud top">
          <div className="scorebug">
            <span className="team off">{offenseId}</span>
            <span className="team def">{defenseId}</span>
            <span className="cov">{COVERAGE_NAMES[coverage]} coverage</span>
          </div>
          <div className="views" role="radiogroup" aria-label="Camera">
            {Object.entries(CAMERAS).map(([id, c]) => (
              <button key={id} role="radio" aria-checked={view === id} className={view === id ? "on" : ""} onClick={() => setView(id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hud bottom">
          <button className="play" onClick={() => (atEnd ? replay() : setPlaying(!playing))} aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? (
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              ) : atEnd ? (
                <path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z" />
              ) : (
                <path d="M8 5l11 7-11 7z" />
              )}
            </svg>
          </button>
          <div className="now">
            <span>{stageText}</span>
            <Timeline stages={stages} t={clock.t} duration={duration} onSeek={seek} />
          </div>
          <div className="speed" role="radiogroup" aria-label="Speed">
            {[0.5, 1, 1.5].map((s) => (
              <button key={s} role="radio" aria-checked={speed === s} className={speed === s ? "on" : ""} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="board">
        <header className="masthead">
          <h1>Ghost Coach</h1>
          <p>Draw up a play, pick who's guarding it, and see the shot it creates.</p>
          {data.source === "sample" && <p className="sample">Sample players. Run the data script for real rosters.</p>}
        </header>

        <div className="matchup">
          <TeamChips label="Your team" value={offenseId} onChange={setOffenseId} />
          <TeamChips label="Opponent" value={defenseId} onChange={setDefenseId} exclude={offenseId} />
        </div>

        <fieldset className="coverage">
          <legend>How they guard the screen</legend>
          <div className="toggle" role="radiogroup">
            {["team", ...Object.keys(COVERAGES)].map((c) => (
              <button key={c} role="radio" aria-checked={coverageChoice === c} className={coverageChoice === c ? "on" : ""} onClick={() => setCoverageChoice(c)}>
                {c === "team" ? `Usual (${COVERAGE_NAMES[defense.coverage]})` : COVERAGE_NAMES[c]}
              </button>
            ))}
          </div>
          <p className="hint">{COVERAGES[coverage]}</p>
        </fieldset>

        <h2>Playbook</h2>
        <div className="plays">
          {PLAY_IDS.map((id, i) => (
            <button key={id} className={`play-card${id === playId ? " on" : ""}`} onClick={() => setPlayId(id)} aria-pressed={id === playId}>
              <PlayDiagram play={PLAYS[id]} active={id === playId} />
              <span className="play-name">{PLAYS[id].name}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
        <p className="play-desc">{play.description}</p>

        <h2>Best read against {defense.name}</h2>
        <div className="verdict">
          <div className="score">
            <strong>{bestShown.toFixed(2)}</strong>
            <span>points per trip</span>
          </div>
          <div className="call">
            <b><mark>{result.best.label}</mark></b>
            <span>{result.best.shooter}, {ZONE_LABELS[result.best.zone].toLowerCase()}</span>
            <span>{result.best.openFeet.toFixed(1)} ft from {result.best.defender} at the shot</span>
          </div>
        </div>

        <ul className="bars options">
          {result.options.map((o) => (
            <li key={o.slot} className={o === result.best ? "top" : ""}>
              <span className="name">
                {o.label}
                <small>{ZONE_LABELS[o.zone]}, {pct(o.fg)} chance</small>
              </span>
              <span className="bar"><i style={{ width: `${(o.epp / maxEpp) * 100}%` }} /></span>
              <span className="val">{o.epp.toFixed(2)}</span>
            </li>
          ))}
        </ul>

        <h2>Same play, every opponent</h2>
        <ul className="bars ranking">
          {ranking.map((r, i) => (
            <li key={r.id} className={r.id === defenseId ? "top" : ""}>
              <button onClick={() => setDefenseId(r.id)}>
                <span className="rank">{i + 1}</span>
                <span className="name">
                  {r.name}
                  <small>{COVERAGE_NAMES[r.coverage]}, {r.best.label.toLowerCase()}</small>
                </span>
                <span className="bar"><i style={{ width: `${(r.best.epp / maxEpp) * 100}%` }} /></span>
                <span className="val">{r.best.epp.toFixed(2)}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="note">
          Points per trip on the best read: the shooter's make rate from that spot, how this defence allows it, and how close the
          nearest defender is when the shot goes up.
        </p>
        <p className="keys"><kbd>Space</kbd> play or pause <kbd>R</kbd> replay <kbd>1</kbd>–<kbd>3</kbd> switch plays</p>
      </aside>
    </div>
  );
}
