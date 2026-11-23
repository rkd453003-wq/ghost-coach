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
import { computePose } from "../sim/pose.js";

const SLOTS = [1, 2, 3, 4, 5];
const OFFENSE_COLOR = "#d8333a";
const OFFENSE_INK = "#ffffff";
const DEFENSE_COLOR = "#2457c5";
const DEFENSE_INK = "#ffffff";
const VEL_DT = 0.06; // seconds of sim time used to measure each player's velocity
const TYPICAL_HEIGHT = { PG: 75, SG: 77, SF: 79, PF: 81, C: 83 }; // inches
const FIGURE_HEIGHT = 77.5; // the rig's height in inches at scale 1
const heightScale = (p) => (p?.height ?? TYPICAL_HEIGHT[p?.pos] ?? 78) / FIGURE_HEIGHT;

export const CAMERAS = {
  broadcast: { label: "Broadcast", pos: [0, 30, 64], target: [0, 3, 17] },
  overhead: { label: "Overhead", pos: [0, 70, 24], target: [0, 0, 20] },
  baseline: { label: "Baseline", pos: [-17, 12, -9], target: [0, 4, 18] },
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
  const scales = useMemo(() => {
    const byTeam = (team) => Object.fromEntries(SLOTS.map((slot) => [slot, heightScale(team.players.find((p) => p.slot === slot))]));
    return { off: byTeam(offense), def: byTeam(defense) };
  }, [offense, defense]);
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

  const lastT = useRef(0);

  // Pose one figure: place it, turn it, and drive its joints from pose.js.
  const animateFigure = (group, key, pos, prevPos, face, simDt, state) => {
    if (!group) return;
    const m = (motion.current[key] ??= { rot: face, seed: Math.random() * 6, rig: null });
    if (!m.rig) {
      const get = (n) => group.getObjectByName(n);
      m.rig = Object.fromEntries(
        ["pelvis", "spine", "head", "hipL", "hipR", "kneeL", "kneeR", "ankleL", "ankleR", "shoulderL", "shoulderR", "elbowL", "elbowR"]
          .map((n) => [n, get(n)])
      );
    }
    const vx = (pos[0] - prevPos[0]) / VEL_DT;
    const vz = (pos[1] - prevPos[1]) / VEL_DT;
    m.rot = state.snap ? face : turn(m.rot, face, Math.min(1, Math.abs(simDt) * 9 + 0.04));
    const fwd = vx * Math.sin(m.rot) + vz * Math.cos(m.rot);
    const side = vx * Math.cos(m.rot) - vz * Math.sin(m.rot);

    const p = computePose(m, { fwd, side, dt: Math.abs(simDt), t: timeRef.current, ...state });
    group.position.set(pos[0], 0, pos[1]);
    group.rotation.y = m.rot;
    const r = m.rig;
    r.pelvis.position.y = p.pelvisY;
    r.spine.rotation.set(p.spine, 0, p.lean);
    r.head.rotation.x = -p.spine * 0.7;
    r.hipL.rotation.set(p.legs.L.hipX, 0, p.legs.L.hipZ);
    r.hipR.rotation.set(p.legs.R.hipX, 0, -p.legs.R.hipZ);
    r.kneeL.rotation.x = p.legs.L.knee;
    r.kneeR.rotation.x = p.legs.R.knee;
    r.ankleL.rotation.x = p.legs.L.ankle;
    r.ankleR.rotation.x = p.legs.R.ankle;
    r.shoulderL.rotation.set(p.arms.L.shoulderX, 0, p.arms.L.shoulderZ);
    r.shoulderR.rotation.set(p.arms.R.shoulderX, 0, -p.arms.R.shoulderZ);
    r.elbowL.rotation.x = p.arms.L.elbow;
    r.elbowR.rotation.x = p.arms.R.elbow;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (playing) {
      timeRef.current = Math.min(duration, timeRef.current + dt * speed);
      if (timeRef.current >= duration) onEnd();
    }
    const t = timeRef.current;
    const simDt = t - lastT.current;
    const snap = Math.abs(simDt) > 0.25; // scrubbed: jump straight to the pose
    lastT.current = t;
    const f = frameAt(play, t, coverage, best);
    const prev = frameAt(play, Math.max(0, t - VEL_DT), coverage, best);

    for (const slot of SLOTS) {
      const pos = f.off[slot];
      const before = prev.off[slot];
      const moving = Math.hypot(pos[0] - before[0], pos[1] - before[1]) / VEL_DT > 4;
      let face;
      if (slot === f.shooter) face = angleTo(pos, HOOP);
      else if (slot === f.catcher) face = angleTo(pos, f.ball.pos);
      else if (moving) face = angleTo(before, pos);
      else if (slot === f.holder) face = angleTo(pos, HOOP);
      else face = angleTo(pos, f.ball.pos);
      animateFigure(offRefs.current[slot], `o${slot}`, pos, before, face, simDt, {
        role: "off",
        snap,
        dribble: slot === f.holder ? f.dribble : null,
        catching: slot === f.catcher,
        shoot: slot === f.shooter ? f.shootK : null,
      });
    }
    for (const slot of SLOTS) {
      const d = f.def[slot];
      animateFigure(defRefs.current[slot], `d${slot}`, d.pos, prev.def[slot].pos, angleTo(d.pos, f.off[d.guarding]), simDt, {
        role: "def",
        snap,
      });
    }

    if (ballRef.current) {
      const owner = f.holder ?? (f.ball.inHands ? f.shooter : null);
      if (owner) {
        // Ball sits at the dribbling hand (figure's right) or in front for the gather.
        const rot = motion.current[`o${owner}`]?.rot ?? 0;
        const sc = scales.off[owner];
        const [ox, oz] = f.ball.inHands ? [0, 0.75] : [-0.95, 0.6];
        const x = f.ball.pos[0] + (ox * Math.cos(rot) + oz * Math.sin(rot)) * sc;
        const z = f.ball.pos[1] + (-ox * Math.sin(rot) + oz * Math.cos(rot)) * sc;
        ballRef.current.position.set(x, f.ball.h * (f.ball.inHands ? 1 : sc), z);
      } else {
        ballRef.current.position.set(f.ball.pos[0], f.ball.h, f.ball.pos[1]);
      }
    }

    if (performance.now() - lastReport.current > 60) {
      lastReport.current = performance.now();
      onTime(t, f.stage);
    }
  });

  const shooter = (team, slot) => team.players.find((p) => p.slot === slot);

  return (
    <>
      <color attach="background" args={["#1a2240"]} />
      <fog attach="fog" args={["#1a2240", 90, 160]} />
      <hemisphereLight args={["#e6ecf7", "#4a3424", 0.95]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[20, 60, 30]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} />
      <pointLight position={[0, 40, 10]} intensity={300} distance={120} color="#fff3e0" />
      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} minDistance={15} maxDistance={120} />
      <CameraRig view={view} />
      <Court />

      {paths.map((pts, i) => (
        <Line key={`path${i}`} points={pts} color="#ffffff" lineWidth={1.6} dashed dashSize={0.8} gapSize={0.6} transparent opacity={0.5} />
      ))}

      {optionSpots.map((o) => (
        <mesh key={o.slot} position={[o.spot[0], 0.06, o.spot[1]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.4, 1.75, 40]} />
          <meshBasicMaterial color={o.slot === best.slot ? "#ffd43b" : "#ffffff"} transparent opacity={o.slot === best.slot ? 0.95 : 0.35} />
        </mesh>
      ))}

      {SLOTS.map((slot) => {
        const p = shooter(offense, slot);
        return (
          <Player key={`o${slot}`} ref={(el) => (offRefs.current[slot] = el)} jersey={OFFENSE_COLOR} ink={OFFENSE_INK}
            number={p?.num ?? slot} scale={scales.off[slot]} label={shortName(p, slot)} highlight={slot === best.slot} />
        );
      })}
      {SLOTS.map((slot) => {
        const p = shooter(defense, slot);
        return (
          <Player key={`d${slot}`} ref={(el) => (defRefs.current[slot] = el)} jersey={DEFENSE_COLOR} ink={DEFENSE_INK}
            skin="#a39686" number={p?.num ?? slot} scale={scales.def[slot]} label={shortName(p, slot)} />
        );
      })}

      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.42, 24, 18]} />
        <meshStandardMaterial color="#e0712c" roughness={0.65} />
      </mesh>
    </>
  );
}
