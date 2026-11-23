import { forwardRef } from "react";
import { Html } from "@react-three/drei";

// Stylised figure about 6.6 ft tall. The parent animates position and
// rotation; legs and arms are exposed via named children for the stride.
const Player = forwardRef(function Player({ color, skin = "#b9b2a8", label, sub, highlight }, ref) {
  return (
    <group ref={ref}>
      <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.1, 32]} />
        <meshBasicMaterial color={highlight ? "#ffd166" : "#000000"} transparent opacity={highlight ? 0.75 : 0.25} />
      </mesh>
      <group name="legL" position={[-0.35, 3.1, 0]}>
        <mesh position={[0, -1.5, 0]} castShadow>
          <capsuleGeometry args={[0.26, 2.5, 4, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group name="legR" position={[0.35, 3.1, 0]}>
        <mesh position={[0, -1.5, 0]} castShadow>
          <capsuleGeometry args={[0.26, 2.5, 4, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <mesh position={[0, 3.15, 0]} castShadow>
        <cylinderGeometry args={[0.72, 0.62, 1.1, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 4.6, 0]} castShadow>
        <capsuleGeometry args={[0.7, 1.3, 6, 16]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <group name="armL" position={[-0.95, 5.3, 0]}>
        <mesh position={[0, -1.1, 0]} castShadow>
          <capsuleGeometry args={[0.19, 1.9, 4, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group name="armR" position={[0.95, 5.3, 0]}>
        <mesh position={[0, -1.1, 0]} castShadow>
          <capsuleGeometry args={[0.19, 1.9, 4, 8]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <mesh position={[0, 6.15, 0]} castShadow>
        <sphereGeometry args={[0.5, 20, 16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      <Html position={[0, 7.6, 0]} center distanceFactor={42} zIndexRange={[10, 0]}>
        <div className="tag" style={{ borderColor: color }}>
          <b>{label}</b>
          {sub && <span>{sub}</span>}
        </div>
      </Html>
    </group>
  );
});

export default Player;
