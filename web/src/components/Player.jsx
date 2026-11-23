import { forwardRef, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { BODY } from "../sim/pose.js";

// Jointed athlete rig. Joints are named groups that Simulation.jsx poses every
// frame: pelvis, spine, head, hipL/R, kneeL/R, ankleL/R, shoulderL/R, elbowL/R.
// Figures are deliberately generic (no faces or likenesses).

const torsoGeo = (() => {
  const profile = [
    [0.01, -0.02], [0.6, 0], [0.63, 0.3], [0.6, 0.7], [0.7, 1.15],
    [0.84, 1.5], [0.82, 1.7], [0.5, 1.88], [0.22, 1.94], [0.01, 1.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 28);
})();

const hipsGeo = (() => {
  const profile = [[0.01, 0.12], [0.62, 0.12], [0.68, -0.15], [0.6, -0.42], [0.01, -0.44]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 24);
})();

function numberTexture(num, ink) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `900 ${String(num).length > 1 ? 150 : 180}px "Arial Black", Impact, Arial, sans-serif`;
  g.fillText(String(num), 128, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Leg({ side, mats }) {
  const x = side === "L" ? 0.36 : -0.36;
  return (
    <group name={`hip${side}`} position={[x, -0.12, 0]}>
      <mesh position={[0, -0.62, 0]} material={mats.shorts} castShadow>
        <capsuleGeometry args={[0.39, 0.85, 6, 16]} />
      </mesh>
      <mesh position={[0, -BODY.thigh / 2, 0]} material={mats.skin} castShadow>
        <capsuleGeometry args={[0.29, BODY.thigh - 0.5, 6, 14]} />
      </mesh>
      <group name={`knee${side}`} position={[0, -BODY.thigh, 0]}>
        <mesh position={[0, -BODY.shin / 2 + 0.05, -0.02]} material={mats.skin} castShadow>
          <capsuleGeometry args={[0.19, BODY.shin - 0.4, 6, 14]} />
        </mesh>
        <mesh position={[0, -0.5, -0.07]} scale={[0.9, 1.6, 1]} material={mats.skin} castShadow>
          <sphereGeometry args={[0.24, 14, 12]} />
        </mesh>
        <mesh position={[0, -0.02, 0.06]} material={mats.skin}>
          <sphereGeometry args={[0.2, 12, 10]} />
        </mesh>
        <mesh position={[0, -BODY.shin + 0.32, -0.02]} material={mats.sock} castShadow>
          <cylinderGeometry args={[0.2, 0.19, 0.42, 14]} />
        </mesh>
        <group name={`ankle${side}`} position={[0, -BODY.shin, 0]}>
          <mesh position={[0, -0.08, 0.17]} rotation-x={Math.PI / 2} scale={[1.15, 1, 0.85]} material={mats.shoe} castShadow>
            <capsuleGeometry args={[0.17, 0.5, 6, 12]} />
          </mesh>
          <mesh position={[0, -0.19, 0.17]} scale={[1, 0.25, 1]} material={mats.sole}>
            <boxGeometry args={[0.38, 0.2, 0.86]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Arm({ side, mats }) {
  const x = side === "L" ? 0.9 : -0.9;
  return (
    <group name={`shoulder${side}`} position={[x, 1.7, 0]}>
      <mesh position={[0, -0.12, 0]} scale={[1, 1.25, 1]} material={mats.skin} castShadow>
        <sphereGeometry args={[0.27, 14, 12]} />
      </mesh>
      <mesh position={[0, -BODY.upperArm / 2, 0]} material={mats.skin} castShadow>
        <capsuleGeometry args={[0.19, BODY.upperArm - 0.3, 6, 12]} />
      </mesh>
      <group name={`elbow${side}`} position={[0, -BODY.upperArm, 0]}>
        <mesh position={[0, -BODY.forearm / 2, 0]} material={mats.skin} castShadow>
          <capsuleGeometry args={[0.155, BODY.forearm - 0.25, 6, 12]} />
        </mesh>
        <mesh position={[0, -BODY.forearm - 0.08, 0.02]} scale={[0.8, 1.15, 0.55]} material={mats.skin} castShadow>
          <sphereGeometry args={[0.2, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}

const Player = forwardRef(function Player({ jersey, ink, skin = "#b6aa9d", number, scale = 1, label, highlight }, ref) {
  const mats = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: skin, roughness: 0.5, metalness: 0.02 }),
      jersey: new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.75 }),
      shorts: new THREE.MeshStandardMaterial({ color: jersey, roughness: 0.7 }),
      trim: new THREE.MeshStandardMaterial({ color: ink, roughness: 0.6 }),
      sock: new THREE.MeshStandardMaterial({ color: "#f2f2f0", roughness: 0.9 }),
      shoe: new THREE.MeshStandardMaterial({ color: "#1b1e25", roughness: 0.45 }),
      sole: new THREE.MeshStandardMaterial({ color: "#f4f4f2", roughness: 0.6 }),
    }),
    [jersey, ink, skin]
  );
  const numTex = useMemo(() => numberTexture(number, ink), [number, ink]);

  return (
    <group ref={ref}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.2, 32]} />
        <meshBasicMaterial color={highlight ? "#ffd43b" : "#000000"} transparent opacity={highlight ? 0.75 : 0.22} depthWrite={false} />
      </mesh>

      <group scale={scale}>
        <group name="pelvis" position={[0, 3.3, 0]}>
          <mesh geometry={hipsGeo} material={mats.shorts} scale={[1, 1, 0.7]} castShadow />
          <mesh position={[0, 0.1, 0]} rotation-x={Math.PI / 2} scale={[1, 0.7, 1]} material={mats.trim}>
            <torusGeometry args={[0.63, 0.04, 6, 32]} />
          </mesh>
          <Leg side="L" mats={mats} />
          <Leg side="R" mats={mats} />

          <group name="spine" position={[0, 0.08, 0]}>
            <mesh geometry={torsoGeo} material={mats.jersey} scale={[1, 1, 0.62]} castShadow />
            <mesh position={[0, 1.08, 0.452]} rotation-x={-0.08}>
              <planeGeometry args={[0.78, 0.78]} />
              <meshStandardMaterial map={numTex} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
            <mesh position={[0, 1.15, -0.455]} rotation-y={Math.PI}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshStandardMaterial map={numTex} transparent roughness={0.8} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
            <mesh position={[0, 2.0, 0.02]} material={mats.skin} castShadow>
              <cylinderGeometry args={[0.19, 0.25, 0.34, 14]} />
            </mesh>
            <group name="head" position={[0, 2.38, 0.04]}>
              <mesh scale={[0.8, 1, 0.9]} material={mats.skin} castShadow>
                <sphereGeometry args={[0.37, 24, 20]} />
              </mesh>
              <mesh position={[0, -0.19, 0.1]} scale={[0.72, 0.5, 0.72]} material={mats.skin}>
                <sphereGeometry args={[0.3, 16, 12]} />
              </mesh>
              <mesh position={[0, 0.07, 0]} scale={[0.82, 0.92, 0.92]}>
                <sphereGeometry args={[0.372, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial color="#2a2522" roughness={0.95} />
              </mesh>
            </group>
            <Arm side="L" mats={mats} />
            <Arm side="R" mats={mats} />
          </group>
        </group>
      </group>

      <Html position={[0, 7.9 * scale, 0]} center distanceFactor={42} zIndexRange={[10, 0]}>
        <div className="tag" style={{ borderColor: jersey }}>
          <b>{label}</b>
        </div>
      </Html>
    </group>
  );
});

export default Player;
