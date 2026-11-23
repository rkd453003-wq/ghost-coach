import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Court from "./Court.jsx";
import Player from "./Player.jsx";
import { HOOP } from "../sim/court.js";
import { offensePositions } from "../sim/engine.js";
import { playDuration } from "../sim/plays.js";
import { frameAt, totalDuration } from "../sim/timeline.js";

const SLOTS = [1, 2, 3, 4, 5];
const OFFENSE_COLOR = "#e4e8ee";
const DEFENSE_COLOR = "#2f5fa7";

export const CAMERAS = {
  broadcast: { label: "Broadcast", pos: [0, 30, 64], target: [0, 3, 17] },
  overhead: { label: "Overhead", pos: [0, 70, 24], target: [0, 0, 20] },
  baseline: { label: "Baseline", pos: [0, 15, -16], target: [0, 4, 22] },
};

function angleTo(from, to) {
  return Math.atan2(to[0] - from[0], to[1] - from[1]);
}

function turn(current, target, k) {
  let d = target - current;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return current + d * k;
}

function CameraRig({ view }) {
  const { camera, controls } = useThree();
  const anim = useRef(null);
  useEffect(() => {
    const preset = CAMERAS[view];
    anim.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls ? controls.target.clone() : new THREE.Vector3(...preset.target),
      toPos: new THREE.Vector3(...preset.pos),
      toTarget: new THREE.Vector3(...preset.target),
      k: 0,
    };
  }, [view, controls, camera]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.k = Math.min(1, a.k + dt / 0.9);
    const e = 1 - Math.pow(1 - a.k, 3);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
    controls.update();
    if (a.k >= 1) anim.current = null;
  });
  return null;
}

// Tag shows surname for real players, position for sample placeholders.
const shortName = (p, slot) => (p ? (p.name.includes(" ") && !/^[A-Z]{3} /.test(p.name) ? p.name.split(" ").slice(1).join(" ") : p.pos) : String(slot));

export default function Simulation({ play, coverage, offense, defense, result, timeRef, playing, speed, onTime, onEnd, view }) {
  const offRefs = useRef({});
  const defRefs = useRef({});
  const ballRef = useRef();
  const motion = useRef({});
  const lastReport = useRef(0);
  const best = result.best;
  const duration = totalDuration(play, best);

  const paths = useMemo(() => {
    const end = playDuration(play);
    return SLOTS.map((slot) => {
      const pts = [];
      for (let t = 0; t <= end + 0.001; t += 0.08) {
        const [x, y] = offensePositions(play, t)[slot];
        pts.push([x, 0.05, y]);
      }
      return pts;
    });
  }, [play]);

  const optionSpots = useMemo(() => {
    const end = offensePositions(play, playDuration(play));
    return result.options.map((o) => ({ ...o, spot: end[o.slot] }));
  }, [play, result]);

  const animateFigure = (group, key, pos, face, dt, extra = {}) => {
    if (!group) return;
    const m = (motion.current[key] ??= { prev: pos, stride: 0, rot: face });
    const speedFt = dt > 0 ? Math.hypot(pos[0] - m.prev[0], pos[1] - m.prev[1]) / dt : 0;
    m.prev = pos;
    m.stride += Math.min(speedFt, 18) * dt * 0.9;
    m.rot = turn(m.rot, face, Math.min(1, dt * 8));
    group.position.set(pos[0], extra.lift ?? 0, pos[1]);
    group.rotation.y = m.rot;
    const swing = Math.sin(m.stride) * 0.7 * Math.min(speedFt / 8, 1);
    const legL = group.getObjectByName("legL");
    const legR = group.getObjectByName("legR");
    const armL = group.getObjectByName("armL");
    const armR = group.getObjectByName("armR");
    legL.rotation.x = swing;
    legR.rotation.x = -swing;
    const armBase = extra.armsUp ? -2.8 : extra.armsOut ? -1.2 : 0;
    armL.rotation.x = armBase - swing * 0.8 * (extra.armsUp ? 0 : 1);
    armR.rotation.x = armBase + swing * 0.8 * (extra.armsUp ? 0 : 1);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (playing) {
      timeRef.current = Math.min(duration, timeRef.current + dt * speed);
      if (timeRef.current >= duration) onEnd();
    }
    const t = timeRef.current;
    const f = frameAt(play, t, coverage, best);

    const shooterUp = f.stage === "shot" && t - (duration - 1.2) < 0.45;
    for (const slot of SLOTS) {
      const pos = f.off[slot];
      const isShooter = slot === best.slot && f.stage === "shot";
      const face = isShooter ? angleTo(pos, HOOP) : angleTo(pos, f.ball.pos[0] === pos[0] && f.ball.pos[1] === pos[1] ? HOOP : f.ball.pos);
      const jump = isShooter && shooterUp ? Math.sin(((t - (duration - 1.2)) / 0.45) * Math.PI) * 1.6 : 0;
      animateFigure(offRefs.current[slot], `o${slot}`, pos, face, dt, { armsUp: isShooter && shooterUp, lift: jump });
    }
    for (const slot of SLOTS) {
      const d = f.def[slot];
      const man = f.off[d.guarding];
      animateFigure(defRefs.current[slot], `d${slot}`, d.pos, angleTo(d.pos, man), dt, { armsOut: true });
    }
    if (ballRef.current) ballRef.current.position.set(f.ball.pos[0] + 0.6, f.ball.h, f.ball.pos[1]);

    if (performance.now() - lastReport.current > 60) {
      lastReport.current = performance.now();
      onTime(t, f.stage);
    }
  });

  const shooter = (team, slot) => team.players.find((p) => p.slot === slot);

  return (
    <>
      <color attach="background" args={["#0d1118"]} />
      <fog attach="fog" args={["#0d1118", 90, 160]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[20, 60, 30]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <pointLight position={[0, 40, 10]} intensity={300} distance={120} color="#fff3e0" />
      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} minDistance={15} maxDistance={120} />
      <CameraRig view={view} />
      <Court />

      {paths.map((pts, i) => (
        <Line key={`path${i}`} points={pts} color="#ffd166" lineWidth={1.5} dashed dashSize={0.8} gapSize={0.6} transparent opacity={0.55} />
      ))}

      {optionSpots.map((o) => (
        <mesh key={o.slot} position={[o.spot[0], 0.06, o.spot[1]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.4, 1.75, 40]} />
          <meshBasicMaterial color={o.slot === best.slot ? "#ffd166" : "#ffffff"} transparent opacity={o.slot === best.slot ? 0.95 : 0.35} />
        </mesh>
      ))}

      {SLOTS.map((slot) => {
        const p = shooter(offense, slot);
        return (
          <Player key={`o${slot}`} ref={(el) => (offRefs.current[slot] = el)} color={OFFENSE_COLOR}
            label={shortName(p, slot)} highlight={slot === best.slot} />
        );
      })}
      {SLOTS.map((slot) => {
        const p = shooter(defense, slot);
        return (
          <Player key={`d${slot}`} ref={(el) => (defRefs.current[slot] = el)} color={DEFENSE_COLOR} skin="#8f897f"
            label={shortName(p, slot)} />
        );
      })}

      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.42, 24, 18]} />
        <meshStandardMaterial color="#e0712c" roughness={0.65} />
      </mesh>
    </>
  );
}
