'use client';

import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, Environment, useGLTF, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import styles from './ModelViewer.module.css';

type Props = {
  /** Path under /models, e.g. "/models/fullscale.glb" */
  url: string;
  label: string;
  explodable?: boolean;
  /** Travel at slider = 1, as a multiple of each part's offset from the centre. */
  spread?: number;
};

/** Self-hosted Draco decoder, rather than drei's default Google CDN fetch. */
const DRACO_PATH = '/draco/';

/**
 * The node whose children are the "parts".
 *
 * The two exports have different shapes and neither works with "every mesh":
 *
 *   full scale   Payload Iteration -> 60 children, one being `ODrive Kit.step`
 *                which itself holds 286 meshes (every SMD component on the S1
 *                driver board, imported from STEP)
 *   prototype    Small_scale -> one child -> 23 mesh children
 *
 * Exploding every mesh would spray ~230 resistors and capacitors across the scene
 * on one model, and move nothing at all on the other. So: skip cameras, then
 * descend while a node has exactly one child, and treat that node's children as
 * the parts. The ODrive kit then travels as a single unit.
 */
function hasGeometry(o: THREE.Object3D): boolean {
  let found = false;
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) found = true;
  });
  return found;
}

function findAssemblyRoot(scene: THREE.Object3D): THREE.Object3D {
  // Filter on "contains geometry", not on isCamera. SolidWorks exports a node
  // literally named `current camera` that carries no camera and no mesh - just a
  // translation - so an isCamera test does not see it. That made the root look
  // like it had two children, the descent stopped immediately, and the whole
  // assembly became a single part with zero offset: the slider did nothing.
  let node: THREE.Object3D = scene;
  let kids = node.children.filter(hasGeometry);
  while (kids.length === 1) {
    node = kids[0];
    kids = node.children.filter(hasGeometry);
  }
  return node;
}

type Piece = {
  node: THREE.Object3D;
  /** Original world position, so the explosion is computed in world space. */
  homeWorld: THREE.Vector3;
  /** Cached inverse of the parent's world matrix (the parent never moves). */
  parentInverse: THREE.Matrix4;
  /** Outward direction, world space. */
  dir: THREE.Vector3;
  dist: number;
};

function useExplode(root: THREE.Object3D, spread: number) {
  const pieces = useMemo<Piece[]>(() => {
    const assembly = findAssemblyRoot(root);
    root.updateWorldMatrix(true, true);

    const whole = new THREE.Box3().setFromObject(assembly);
    const centre = whole.getCenter(new THREE.Vector3());
    const out: Piece[] = [];

    for (const node of assembly.children) {
      if (!hasGeometry(node)) continue;
      const box = new THREE.Box3().setFromObject(node);
      if (box.isEmpty()) continue;

      const worldDelta = box.getCenter(new THREE.Vector3()).sub(centre);
      // Damp the horizontal component: these assemblies are built around a
      // vertical yaw axis, so a purely radial explosion throws the stacked gears,
      // bearings and encoder sideways into each other. Biasing upward separates
      // them the way the poster's exploded drawings do.
      const dir = new THREE.Vector3(worldDelta.x * 0.35, worldDelta.y, worldDelta.z * 0.35);
      if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
      dir.normalize();

      // Work entirely in world space, then convert the target back through the
      // parent's inverse. Offsetting node.position by a world-space distance
      // instead would be wrong under any parent scale, which CAD exports often
      // carry.
      const parentInverse = new THREE.Matrix4();
      if (node.parent) parentInverse.copy(node.parent.matrixWorld).invert();

      out.push({
        node,
        homeWorld: node.getWorldPosition(new THREE.Vector3()),
        parentInverse,
        dir,
        dist: worldDelta.length(),
      });
    }
    return out;
  }, [root]);

  // Dev-only handle so tests can assert on real world positions instead of
  // reading back WebGL framebuffer pixels, which is unreliable.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !pieces.length) return;
    const w = window as unknown as { __explode?: Record<string, Piece[]> };
    w.__explode ??= {};
    w.__explode[pieces[0].node.parent?.name || 'scene'] = pieces;
  }, [pieces]);

  return useCallback(
    (t: number) => {
      const target = new THREE.Vector3();
      for (const p of pieces) {
        target.copy(p.homeWorld).addScaledVector(p.dir, t * spread * p.dist);
        p.node.position.copy(target.applyMatrix4(p.parentInverse));
      }
    },
    [pieces, spread]
  );
}

function Model({
  url,
  explode,
  spread,
}: {
  url: string;
  explode: number;
  spread: number;
}) {
  const { scene } = useGLTF(url, DRACO_PATH);
  // Clone so a second viewer of the same file cannot fight over transforms.
  const root = useMemo(() => scene.clone(true), [scene]);
  const apply = useExplode(root, spread);

  useEffect(() => {
    apply(explode);
  }, [explode, apply]);

  return <primitive object={root} />;
}

function Placeholder() {
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

/** Progress readout while a Draco model decodes — several seconds on a phone. */
function LoadIndicator() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className={styles.loading} role="status">
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <span>Loading model {Math.round(progress)}%</span>
    </div>
  );
}

export default function ModelViewer({
  url,
  label,
  explodable = true,
  spread = 0.9,
}: Props) {
  const [explode, setExplode] = useState(0);
  const [hasModel, setHasModel] = useState<boolean | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();

  // Render continuously only while the viewer is actually on screen. Two canvases
  // spinning their render loops behind a long page is pure battery drain, but
  // frameloop="demand" would require an invalidate() call after every imperative
  // scene-graph change - fragile, and it did not repaint reliably.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      rootMargin: '150px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Probe before handing the URL to useGLTF: a 404 inside Suspense throws and
  // takes the whole section down.
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
      <div className={styles.stage} ref={stageRef}>
        <Canvas
          camera={{ position: [3.2, 2.2, 3.2], fov: 40 }}
          dpr={[1, 2]}
          frameloop={onScreen ? 'always' : 'never'}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 6, 3]} intensity={1.1} />
          <directionalLight position={[-4, 2, -3]} intensity={0.4} />
          <Suspense fallback={null}>
            {hasModel ? (
              <Bounds fit observe margin={1.45}>
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
            minDistance={0.12}
            maxDistance={14}
            zoomSpeed={0.8}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
          />
        </Canvas>

        <LoadIndicator />

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

useGLTF.preload('/models/prototype.glb', DRACO_PATH);
