"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sparkles, useGLTF } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

useGLTF.preload("/orb/scene.gltf");

// "Orb of Chi" — concentric translucent blue shells, already centered at
// the origin. Materials stay native; spin + bloom are coded. Shells
// counter-rotate against the core for a gyroscope feel.
function Orb({ reduced }: { reduced: boolean }) {
  const { scene } = useGLTF("/orb/scene.gltf");
  const core = useRef<THREE.Group>(null);
  // Copy lives on the left: park the orb right on wide screens, drop it
  // below the copy on narrow ones. Read live so resizes track.
  const wide = useThree((s) => s.size.width >= 768);

  const { model, shells } = useMemo(() => {
    const obj = scene.clone(true);
    const found: THREE.Object3D[] = [];
    obj.traverse((o) => {
      if (o.name.startsWith("pPlatonic")) found.push(o);
    });
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const scale = 1.6 / (Math.max(size.x, size.y, size.z) || 1);
    obj.scale.setScalar(scale);
    obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    return { model: obj, shells: found };
  }, [scene]);

  useFrame((state, delta) => {
    if (reduced) return;
    if (core.current) core.current.rotation.y += delta * 0.4;
    const wobble = Math.sin(state.clock.elapsedTime * 0.5) * 0.12;
    for (const shell of shells) {
      shell.rotation.y -= delta * 0.25;
      shell.rotation.x = wobble;
    }
  });

  return (
    <Float
      speed={reduced ? 0 : 1.2}
      rotationIntensity={reduced ? 0 : 0.25}
      floatIntensity={reduced ? 0 : 0.7}
    >
      <group position={wide ? [1.3, 0, 0] : [0, -0.9, 0]}>
        <group ref={core}>
          <primitive object={model} />
        </group>
      </group>
    </Float>
  );
}

function webglAvailable() {
  if (typeof window === "undefined" || !window.WebGLRenderingContext)
    return false;
  const canvas = document.createElement("canvas");
  return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
}

// Full-bleed backdrop: blue orb + matching sparkle field + bloom, melting
// into the void via vignette. Static + silent when WebGL is missing or
// reduced motion is preferred — the hero copy stands alone and no error
// ever reaches the page.
export function HeroOrb() {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [supported] = useState(webglAvailable);
  if (!supported) return null;

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true }}
      camera={{ position: [0, 0, 4.4], fov: 42 }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 2, 4]} intensity={10} color="#7dd3fc" />
      <pointLight position={[-4, -1, 2]} intensity={5} color="#6366f1" />
      <Suspense fallback={null}>
        <Orb reduced={reduced} />
        <Sparkles
          count={110}
          scale={[7, 4, 4]}
          size={3.5}
          speed={reduced ? 0 : 0.35}
          color="#38bdf8"
          opacity={0.7}
        />
        <Sparkles
          count={45}
          scale={[9, 5.5, 5]}
          size={5}
          speed={reduced ? 0 : 0.2}
          color="#bfe9ff"
          opacity={0.5}
        />
      </Suspense>
      <EffectComposer multisampling={4}>
        <Bloom
          mipmapBlur
          intensity={0.9}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.2}
        />
        <Vignette offset={0.2} darkness={0.65} />
      </EffectComposer>
    </Canvas>
  );
}
