import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { CORNER_THREE_MAX_Y, CORNER_THREE_X, HOOP, THREE_RADIUS } from "../sim/court.js";

const LINE = "#f4ecdf";
const Y = 0.02; // lift lines just above the floor

const arc = (cx, cy, r, from, to, n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * r, Y, cy + Math.sin(a) * r];
  });

export default function Court() {
  const lines = useMemo(() => {
    const cornerAngle = Math.asin((CORNER_THREE_MAX_Y - HOOP[1]) / THREE_RADIUS);
    return [
      [[-25, Y, 0], [25, Y, 0], [25, Y, 47], [-25, Y, 47], [-25, Y, 0]],
      [[-8, Y, 0], [-8, Y, 19], [8, Y, 19], [8, Y, 0]],
      [[-6, Y, 0], [-6, Y, 19]],
      [[6, Y, 0], [6, Y, 19]],
      arc(0, 19, 6, 0, Math.PI),
      arc(0, 47, 6, Math.PI, 2 * Math.PI),
      arc(HOOP[0], HOOP[1], 4, 0, Math.PI, 24),
      [[-CORNER_THREE_X, Y, 0], [-CORNER_THREE_X, Y, CORNER_THREE_MAX_Y]],
      [[CORNER_THREE_X, Y, 0], [CORNER_THREE_X, Y, CORNER_THREE_MAX_Y]],
      arc(HOOP[0], HOOP[1], THREE_RADIUS, cornerAngle, Math.PI - cornerAngle, 80),
    ];
  }, []);

  return (
    <group>
      {/* apron */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 22]} receiveShadow>
        <planeGeometry args={[70, 66]} />
        <meshStandardMaterial color="#1b2230" />
      </mesh>
      {/* hardwood */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 23.5]} receiveShadow>
        <planeGeometry args={[50, 47]} />
        <meshStandardMaterial color="#c99a62" roughness={0.55} />
      </mesh>
      {/* painted lane */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 9.5]} receiveShadow>
        <planeGeometry args={[16, 19]} />
        <meshStandardMaterial color="#9c4a35" roughness={0.6} />
      </mesh>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={LINE} lineWidth={2} />
      ))}
      <Hoop />
    </group>
  );
}

function Hoop() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 6.5, -2.2]} castShadow>
        <boxGeometry args={[0.6, 13, 0.6]} />
        <meshStandardMaterial color="#2a2f38" />
      </mesh>
      <mesh position={[0, 11.5, 4]} castShadow>
        <boxGeometry args={[6, 3.5, 0.15]} />
        <meshStandardMaterial color="#e9eef5" transparent opacity={0.85} />
      </mesh>
      <mesh position={[0, 11.1, 4.08]}>
        <boxGeometry args={[2, 1.5, 0.02]} />
        <meshStandardMaterial color="#d6452f" wireframe />
      </mesh>
      <mesh position={[0, 10, 4]} rotation-x={Math.PI / 2}>
        <boxGeometry args={[0.15, 1.25, 0.15]} />
        <meshStandardMaterial color="#d6452f" />
      </mesh>
      <mesh position={[HOOP[0], 10, HOOP[1]]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.75, 0.06, 12, 40]} />
        <meshStandardMaterial color="#e2572f" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[HOOP[0], 9.25, HOOP[1]]}>
        <cylinderGeometry args={[0.75, 0.5, 1.5, 16, 1, true]} />
        <meshStandardMaterial color="#ffffff" wireframe transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
