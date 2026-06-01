import { Easing, interpolate, spring } from 'remotion';

const cubic = { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

/** Fade + slide up entrance. Returns inline style. */
export function fadeUp(frame: number, start: number, dur = 18, dist = 26) {
  return {
    opacity: interpolate(frame, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(frame, [start, start + dur], [dist, 0], cubic)}px)`,
  };
}

/** Springy pop-in (scale + fade). */
export function popIn(frame: number, fps: number, start: number) {
  const s = spring({ frame: frame - start, fps, config: { damping: 14, mass: 0.7, stiffness: 130 } });
  return { opacity: Math.min(1, s), transform: `scale(${0.82 + 0.18 * Math.min(1, s)})` };
}

/** Typewriter reveal of `text` by the current frame. */
export function typed(text: string, frame: number, start: number, fps: number, cps = 42) {
  const n = Math.max(0, Math.floor(((frame - start) * cps) / fps));
  return text.slice(0, n);
}

/** Smooth fade between [in..in+f] and out at [out..out+f]. */
export function fade(frame: number, inAt: number, outAt: number, f = 14) {
  const a = interpolate(frame, [inAt, inAt + f], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const b = interpolate(frame, [outAt, outAt + f], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return a * b;
}

export { interpolate };
