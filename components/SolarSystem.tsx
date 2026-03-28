"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// The Original Vortex Background
function Galaxy() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const pos = new Float32Array(20000 * 3);
    for (let i = 0; i < 20000; i++) {
        const radius = 2 + Math.pow(Math.random(), 2) * 15; 
        const angle = Math.random() * Math.PI * 2;
        const height = (Math.random() - 0.5) * (Math.random() * 2); 
        const twist = radius * 0.8;
        
        pos[i * 3] = Math.cos(angle + twist) * radius;
        pos[i * 3 + 1] = height;
        pos[i * 3 + 2] = Math.sin(angle + twist) * radius;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (ref.current) {
        ref.current.rotation.y += delta * 0.03; 
    }
  });

  return (
    <points ref={ref} rotation={[0.5, 0, 0]}>
        <bufferGeometry>
             {/* @ts-ignore */}
             <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.015} color="#88aaff" transparent opacity={0.4} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// Minimal Orbit Path
function OrbitRing({ radius }: { radius: number }) {
  const points = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    return pts;
  }, [radius]);
  return <Line points={points} color="#ffffff" opacity={0.15} transparent lineWidth={1} />;
}

// Minimal White Pearl Planets
function PlanetObj({ radius, speed, size }: { radius: number, speed: number, size: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
        ref.current.rotation.y = state.clock.elapsedTime * speed;
    }
  });

  return (
    <group ref={ref}>
        <Sphere args={[size, 64, 64]} position={[radius, 0, 0]}>
            <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={1} />
        </Sphere>
    </group>
  );
}

// Global Camera mapped seamlessly to DOM scroll
function CameraRig() {
  const { camera } = useThree();

  useFrame(() => {
    const scrollMax = document.body.scrollHeight - window.innerHeight;
    const progress = scrollMax > 0 ? Math.min(window.scrollY / scrollMax, 1) : 0;
    
    // Zoom deeper into the minimalist solar system as we scroll
    const zPos = THREE.MathUtils.lerp(25, 6, progress);
    const yPos = THREE.MathUtils.lerp(6, 1, progress);
    const xPos = THREE.MathUtils.lerp(0, 5, progress);
    
    camera.position.lerp(new THREE.Vector3(xPos, yPos, zPos), 0.05);
    camera.lookAt(0, 0, 0);
  });
  
  return null;
}

export default function SolarSystem() {
  return (
    <div className="fixed inset-0 z-0 bg-black pointer-events-none">
      <Canvas camera={{ position: [0, 6, 25], fov: 45 }}>
          <ambientLight intensity={0.1} />
          <pointLight position={[0,0,0]} intensity={10} distance={100} color="#ffffff" />
          
          <CameraRig />

          <group rotation={[0.2, 0, 0]}>
            {/* Swirling deep space vortex background */}
            <Galaxy />

            {/* Core: Minimal White Glow Sun */}
            <Sphere args={[2, 64, 64]}>
                <meshBasicMaterial color="#ffffff" />
            </Sphere>

            {/* Minimal Sub-System Orbits */}
            <OrbitRing radius={5} />
            <PlanetObj radius={5} speed={0.4} size={0.3} />
            
            <OrbitRing radius={9} />
            <PlanetObj radius={9} speed={0.2} size={0.6} />

            <OrbitRing radius={15} />
            <PlanetObj radius={15} speed={0.1} size={0.8} />
          </group>

          {/* Minimalist subtle bloom for pure white sun */}
          <EffectComposer>
             <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} intensity={1} mipmapBlur />
          </EffectComposer>
      </Canvas>
    </div>
  );
}
