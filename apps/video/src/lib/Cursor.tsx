import { useCurrentFrame, interpolate, Easing } from 'remotion';

type Key = { f: number; x: number; y: number };

/** A macOS-style pointer that glides between keyframes and ripples on click.
 *  Coordinates are in the parent (window-content) space. */
export const Cursor: React.FC<{ path: Key[]; clicks?: number[] }> = ({ path, clicks = [] }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const ease = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.5, 0, 0.18, 1) };
  const x = interpolate(frame, fs, path.map((p) => p.x), ease);
  const y = interpolate(frame, fs, path.map((p) => p.y), ease);

  let press = 1;
  for (const c of clicks) {
    const d = frame - c;
    if (d >= 0 && d < 9) press = 0.76 + 0.24 * Math.abs(Math.cos((d / 9) * Math.PI));
  }
  const ripples = clicks
    .map((c) => {
      const d = frame - c;
      if (d >= 0 && d < 22) {
        const p = d / 22;
        return { c, r: 18 + p * 58, o: (1 - p) * 0.5 };
      }
      return null;
    })
    .filter(Boolean) as { c: number; r: number; o: number }[];

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 60, pointerEvents: 'none' }}>
      {ripples.map((r) => (
        <div
          key={r.c}
          style={{
            position: 'absolute',
            left: -r.r / 2,
            top: -r.r / 2,
            width: r.r,
            height: r.r,
            borderRadius: '50%',
            border: '2.5px solid #005ac2',
            opacity: r.o,
          }}
        />
      ))}
      <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: `scale(${press})`, transformOrigin: '5px 4px', filter: 'drop-shadow(0 4px 7px rgba(0,0,0,0.4))' }}>
        <path d="M5 3.2 L5 20.8 L9.4 16.6 L12.3 22.8 L14.9 21.6 L12 15.4 L18.4 15 Z" fill="#ffffff" stroke="#1d1b20" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
