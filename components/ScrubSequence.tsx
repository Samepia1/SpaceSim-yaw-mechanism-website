'use client';

import { useEffect, useRef, useState } from 'react';
import { useScrollProgress, usePrefersReducedMotion } from '@/lib/useScrollProgress';
import styles from './ScrubSequence.module.css';

type Props = {
  /** Folder under /frames, e.g. "prototype" */
  name: string;
  count: number;
  /** How many viewport heights of scrolling the sequence spans. */
  scrollLength?: number;
  alt: string;
  children?: React.ReactNode;
};

const src = (name: string, i: number) =>
  `/frames/${name}/${String(i + 1).padStart(4, '0')}.webp`;

/**
 * Scroll-scrubbed image sequence painted to a canvas.
 *
 * Why frames and not a seeked <video>: iOS Safari throttles `currentTime` seeks,
 * needs a prior user gesture before it will decode, and stutters between
 * keyframes. Most visitors reach this site by scanning a QR code on a phone, so
 * that failure mode would hit the majority of them. Blitting a decoded image is
 * frame-accurate everywhere.
 */
export default function ScrubSequence({
  name,
  count,
  scrollLength = 3,
  alt,
  children,
}: Props) {
  const { ref, progress, active } = useScrollProgress<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cache = useRef<Map<number, HTMLImageElement>>(new Map());
  const drawn = useRef(-1);
  const [ready, setReady] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Paint one frame, scaled to fit the canvas box (letterboxed on white).
  const paint = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  };

  const load = (i: number): Promise<HTMLImageElement> => {
    const hit = cache.current.get(i);
    if (hit?.complete) return Promise.resolve(hit);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src(name, i);
      img.onload = () => {
        cache.current.set(i, img);
        resolve(img);
      };
      img.onerror = reject;
    });
  };

  // First frame eagerly, so the section is never a blank white box.
  useEffect(() => {
    let alive = true;
    load(0)
      .then((img) => {
        if (!alive) return;
        paint(img);
        drawn.current = 0;
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Warm the rest in order once the section is near the viewport. Sequential
  // rather than parallel: 140 simultaneous requests would starve the first frames
  // the visitor actually needs.
  useEffect(() => {
    if (!active || reduced) return;
    let alive = true;
    (async () => {
      for (let i = 1; i < count; i++) {
        if (!alive) return;
        try {
          await load(i);
        } catch {
          /* a missing frame is survivable: the nearest cached one stays up */
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, count, name, reduced]);

  // Draw the frame the scroll position asks for, nearest already-decoded one.
  useEffect(() => {
    if (reduced) return;
    const target = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
    if (target === drawn.current) return;

    const exact = cache.current.get(target);
    if (exact?.complete) {
      paint(exact);
      drawn.current = target;
      return;
    }
    // Not decoded yet: show the closest frame we do have so scrubbing never
    // freezes on a stale image, and kick off this one's load.
    let best = -1;
    for (const i of cache.current.keys()) {
      if (best === -1 || Math.abs(i - target) < Math.abs(best - target)) best = i;
    }
    if (best !== -1) {
      const img = cache.current.get(best)!;
      if (img.complete) {
        paint(img);
        drawn.current = best;
      }
    }
    load(target).then((img) => {
      const now = Math.round(progress * (count - 1));
      if (Math.abs(now - target) <= 1) {
        paint(img);
        drawn.current = target;
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, count, reduced]);

  // Repaint on resize so the canvas stays sharp.
  useEffect(() => {
    const on = () => {
      const img = cache.current.get(drawn.current);
      if (img?.complete) paint(img);
    };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  if (reduced) {
    return (
      <div className={styles.reduced}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(name, Math.floor(count / 2))} alt={alt} className={styles.still} />
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={styles.track}
      style={{ height: `${scrollLength * 100}vh` }}
    >
      <div className={styles.sticky}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          role="img"
          aria-label={alt}
          data-ready={ready}
          data-scrub={name}
        />
        {children}
        <div className={styles.rail} aria-hidden>
          <div className={styles.railFill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
    </div>
  );
}
