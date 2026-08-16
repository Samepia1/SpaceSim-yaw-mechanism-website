'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Progress (0..1) of a tall element travelling past the viewport.
 *
 * 0 when the element's top reaches the top of the viewport, 1 when its bottom
 * reaches the bottom. That mapping is what makes a `position: sticky` child feel
 * pinned for exactly the element's scrollable height.
 *
 * Scroll events fire far faster than frames, so they only ever set a ref; the
 * state update happens once per animation frame. Reading layout in the rAF
 * callback also keeps `getBoundingClientRect` out of the scroll handler, which
 * is what otherwise causes forced reflow jank on long pages.
 */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let queued = false;

    const measure = () => {
      queued = false;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Total distance the element can travel while any part of it is on screen.
      const travel = r.height - vh;
      const p = travel <= 0
        // Shorter than the viewport: fall back to how far its centre has passed.
        ? 1 - (r.top + r.height / 2) / vh
        : -r.top / travel;
      setProgress(Math.min(1, Math.max(0, p)));
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(measure);
    };

    // Only listen while the section is anywhere near the viewport.
    const io = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting);
        if (entry.isIntersecting) measure();
      },
      { rootMargin: '200px 0px' }
    );
    io.observe(el);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    measure();

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return { ref, progress, active };
}

/**
 * True when the visitor has asked for reduced motion.
 *
 * useSyncExternalStore rather than an effect + setState: matchMedia is exactly the
 * external mutable source it exists for, it gives a correct server snapshot, and
 * it avoids the cascading render that setting state synchronously in an effect
 * causes.
 */
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false, // server render: assume motion is fine, corrected on hydration
  );
}
