'use client';

import { Suspense, useEffect, useId, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import styles from './ModelViewer.module.css';

type Props = {
  /** Path under /models, e.g. "/models/fullscale.glb" */
  url: string;
  label: string;
  /** Show the exploded-view slider. */
  explodable?: boolean;
  /** How far parts travel at slider = 1, as a multiple of their offset from centre. */
  spread?: number;
};

type Piece = {
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  dir: THREE.Vector3;
  dist: number;
};

/**
 * Explodes an assembly with no authored metadata.
 *
 * Each mesh gets a direction derived from its own bounding-box centre relative to
 * the whole assembly's centre, then travels outward along it. The horizontal part
 * of that vector is damped because these assemblies are built around a vertical
 * yaw axis: a purely radial explosion throws the stacked gears, bearings and
 * encoder sideways into each other, whereas biasing upward separates them the way
 * the poster's exploded drawings do.
 */
function useExplode(scene: THREE.Object3D, spread: number) {
  const pieces = useMemo<Piece[]>(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const centre = box.getCenter(new THREE.Vector3());
    const out: Piece[] = [];

    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const b = new THREE.Box3().setFromObject(mesh);
      if (b.isEmpty()) return;
      const c = b.getCenter(new THREE.Vector3());
      const delta = c.clone().sub(centre);
      // Bias toward the assembly's vertical axis.
      const dir = new THREE.Vector3(delta.x * 0.35, delta.y, delta.z * 0.35);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      out.push({
        mesh,
        home: mesh.position.clone(),
        dir: dir.normalize(),
        dist: delta.length(),
      });
    });
    return out;
  }, [scene]);

  return (t: number) => {
    for (const p of pieces) {
      p.mesh.position.copy(p.home).addScaledVector(p.dir, t * spread * p.dist);
    }
  };
}

function Model({ url, explode, spread }: { url: string; explode: number; spread: number }) {
  const { scene } = useGLTF(url);
  // Clone so two viewers can show the same file without fighting over transforms.
  const root = useMemo(() => scene.clone(true), [scene]);
  const apply = useExplode(root, spread);

  useEffect(() => {
    apply(explode);
  }, [explode, apply]);

  useEffect(() => {
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = false;
      }
    });
  }, [root]);

  return <primitive object={root} />;
}

function Placeholder() {
  // Stands in until the real GLB exports land, so layout and controls can be
  // built and reviewed without blocking on SolidWorks.
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, i * 0.9 - 0.9, 0]}>
          <boxGeometry args={[1.4 - i * 0.3, 0.5, 1.4 - i * 0.3]} />
          <meshStandardMaterial color={i === 1 ? '#7A0019' : '#b9bcc4'} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

export default function ModelViewer({ url, label, explodable = true, spread = 0.9 }: Props) {
  const [explode, setExplode] = useState(0);
  const [hasModel, setHasModel] = useState<boolean | null>(null);
  // useId, not Math.random in a ref: random during render is impure and reading
  // a ref during render is not allowed.
  const inputId = useId();

  // Probe before handing the URL to useGLTF: a 404 inside Suspense throws and
  // takes the whole section down, and the GLBs are exported by hand.
  useEffect(() => {
    let alive = true;
    fetch(url, { method: 'HEAD' })
      .then((r) => alive && setHasModel(r.ok))
      .catch(() => alive && setHasModel(false));
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <figure className={styles.wrap}>
      <div className={styles.stage}>
        <Canvas
          camera={{ position: [3.2, 2.2, 3.2], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 6, 3]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.4} />
          <Suspense fallback={null}>
            {hasModel ? (
              <Bounds fit clip observe margin={1.15}>
                <Model url={url} explode={explode} spread={spread} />
              </Bounds>
            ) : (
              <Placeholder />
            )}
            <Environment preset="city" background={false} />
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={1.2}
            maxDistance={12}
            // touch-action is handled by CSS; two-finger drag pans are disabled so
            // the page can still be scrolled past the viewer on a phone.
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          />
        </Canvas>

        {hasModel === false && (
          <p className={styles.missing}>
            <strong>{label}</strong> model not exported yet — showing a placeholder.
          </p>
        )}
      </div>

      <figcaption className={styles.controls}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>drag to rotate · pinch or scroll to zoom</span>
        {explodable && (
          <label className={styles.slider} htmlFor={inputId}>
            <span>Exploded</span>
            <input
              id={inputId}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explode}
              onChange={(e) => setExplode(Number(e.target.value))}
            />
          </label>
        )}
      </figcaption>
    </figure>
  );
}
