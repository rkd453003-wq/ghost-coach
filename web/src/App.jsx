import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Simulation, { CAMERAS } from "./components/Simulation.jsx";
import { PLAYS } from "./sim/plays.js";
import { COVERAGES, compareOpponents, evaluatePlay } from "./sim/engine.js";
import { ZONE_LABELS } from "./sim/court.js";
import { totalDuration } from "./sim/timeline.js";
import data from "./data/teams.json";

const pct = (v) => `${Math.round(v * 100)}%`;
const pts = (v) => v.toFixed(2);
const COVERAGE_NAMES = { drop: "Drop", switch: "Switch", hedge: "Hedge" };

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
  const maxEpp = Math.max(...ranking.map((r) => r.best.epp), ...result.options.map((o) => o.epp));

  useEffect(() => {
    timeRef.current = 0;
    setPlaying(true);
  }, [playId, offenseId, defenseId, coverage]);

  useEffect(() => {
    if (offenseId === defenseId) setDefenseId(teamIds.find((id) => id !== offenseId));
  }, [offenseId, defenseId, teamIds]);

  const replay = () => {
    timeRef.current = 0;
    setPlaying(true);
  };

  const stageText =
    clock.stage === "play" ? "Running the play" : clock.stage === "pass" ? `Read: pass to ${result.best.shooter}` : `Shot: ${result.best.label}`;

  return (
    <div className="app">
      <section className="stage">
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
          <div className="matchup">
            <span className="chip light">{offenseId}</span>
            <span className="vs">vs</span>
            <span className="chip dark">{defenseId}</span>
            <span className="cov">{COVERAGE_NAMES[coverage]} coverage</span>
          </div>
          <div className="views">
            {Object.entries(CAMERAS).map(([id, c]) => (
              <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>{c.label}</button>
            ))}
          </div>
        </div>

        <div className="hud bottom">
          <button className="play" onClick={() => (clock.t >= duration - 0.01 ? replay() : setPlaying(!playing))}
            aria-label={playing ? "Pause" : "Play"}>
            {playing ? "❚❚" : clock.t >= duration - 0.01 ? "↺" : "▶"}
          </button>
          <input type="range" min="0" max={duration} step="0.01" value={Math.min(clock.t, duration)}
            aria-label="Timeline"
            onChange={(e) => {
              setPlaying(false);
              timeRef.current = Number(e.target.value);
              setClock((c) => ({ ...c, t: timeRef.current }));
            }} />
          <span className="stage-text">{stageText}</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </div>
      </section>

      <aside className="panel">
        <header>
          <h1>Ghost Coach</h1>
          <p>Run a play against any defence and see which read wins.</p>
          {data.source === "sample" && <span className="badge">Sample data · run the fetch script for real stats</span>}
        </header>

        <div className="pickers">
          <label>Offence
            <select value={offenseId} onChange={(e) => setOffenseId(e.target.value)}>
              {teamIds.map((id) => <option key={id} value={id}>{data.teams[id].name}</option>)}
            </select>
          </label>
          <label>Defence
            <select value={defenseId} onChange={(e) => setDefenseId(e.target.value)}>
              {teamIds.filter((id) => id !== offenseId).map((id) => <option key={id} value={id}>{data.teams[id].name}</option>)}
            </select>
          </label>
          <label className="wide">Screen coverage
            <select value={coverageChoice} onChange={(e) => setCoverageChoice(e.target.value)}>
              <option value="team">Team default ({COVERAGE_NAMES[defense.coverage]})</option>
              {Object.keys(COVERAGES).map((c) => <option key={c} value={c}>What if they {COVERAGE_NAMES[c].toLowerCase()}?</option>)}
            </select>
            <small>{COVERAGES[coverage]}</small>
          </label>
        </div>

        <h2>Play</h2>
        <div className="plays">
          {Object.entries(PLAYS).map(([id, p]) => (
            <button key={id} className={id === playId ? "on" : ""} onClick={() => setPlayId(id)}>
              <b>{p.name}</b>
              <span>{p.description}</span>
            </button>
          ))}
        </div>

        <h2>Best read vs {defense.name}</h2>
        <div className="best">
          <div>
            <b>{result.best.label}</b>
            <span>{result.best.shooter} · {ZONE_LABELS[result.best.zone]} · {result.best.openFeet.toFixed(1)} ft from {result.best.defender}</span>
          </div>
          <strong>{pts(result.best.epp)}<small>pts</small></strong>
        </div>
        <ul className="bars">
          {result.options.map((o) => (
            <li key={o.slot} className={o === result.best ? "top" : ""}>
              <span className="name">{o.label}<small>{ZONE_LABELS[o.zone]} · {pct(o.fg)}</small></span>
              <span className="bar"><i style={{ width: `${(o.epp / maxEpp) * 100}%` }} /></span>
              <span className="val">{pts(o.epp)}</span>
            </li>
          ))}
        </ul>

        <h2>This play vs every opponent</h2>
        <ul className="bars">
          {ranking.map((r) => (
            <li key={r.id} className={r.id === defenseId ? "top clickable" : "clickable"} onClick={() => setDefenseId(r.id)}>
              <span className="name">{r.name}<small>{COVERAGE_NAMES[r.coverage]} · {r.best.label}</small></span>
              <span className="bar"><i style={{ width: `${(r.best.epp / maxEpp) * 100}%` }} /></span>
              <span className="val">{pts(r.best.epp)}</span>
            </li>
          ))}
        </ul>
        <p className="note">Expected points per possession on the best read: the shooter's make rate from that zone, how the defence allows that zone, and how close the nearest defender is at the shot.</p>
      </aside>
    </div>
  );
}
