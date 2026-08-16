'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './Clip.module.css';

type Props = {
  /** Base name under /video, e.g. "lab" -> lab.mp4 / lab.webm / lab-poster.webp */
  name: string;
  caption?: string;
  /** Prefer the VP9 copy. Only set where the WebM is actually the smaller file. */
  webm?: boolean;
  /** Loop silently without controls, like a moving figure rather than a video. */
  ambient?: boolean;
};

/**
 * A muted, inline clip. Nothing here has audio, so everything is `muted` — which
 * is also what lets iOS autoplay at all.
 *
 * Playback is started only once the element is on screen and paused when it
 * leaves: four HD videos all decoding at once behind a long page would burn
 * battery and stutter the scrub sections.
 */
export default function Clip({ name, caption, webm = false, ambient = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (ambient) el.play().then(() => setPlaying(true)).catch(() => {});
        } else {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ambient]);

  return (
    <figure className={styles.wrap}>
      <div className={styles.frame}>
        <video
          ref={ref}
          className={styles.video}
          poster={`/video/${name}-poster.webp`}
          muted
          playsInline
          loop={ambient}
          preload="none"
          controls={!ambient}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        >
          {/* Ordered smallest-first; the browser takes the first it can decode. */}
          {webm && <source src={`/video/${name}.webm`} type="video/webm" />}
          <source src={`/video/${name}.mp4`} type="video/mp4" />
        </video>

        {ambient && !playing && (
          <button
            className={styles.play}
            onClick={() => ref.current?.play()}
            aria-label="Play clip"
          >
            ▶
          </button>
        )}
      </div>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
