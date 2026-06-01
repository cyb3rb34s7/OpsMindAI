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
      <svg
        width="40"
        height="40"
        viewBox="0 0 28 28"
        style={{ transform: `translate(-11px, -2px) scale(${press})`, transformOrigin: '11px 2px', filter: 'drop-shadow(0 4px 7px rgba(0,0,0,0.4))' }}
      >
        {/* pointing-hand (link pointer) cursor */}
        <path
          d="M11 3.2c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v7.3h.8V6.2c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v4.8h.8V8.4c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8v2.6h.8V9.6c0-1 .8-1.8 1.8-1.8s1.7.8 1.7 1.8v7.2c0 3.6-2.9 6.5-6.5 6.5h-2.2c-1.7 0-3.4-.7-4.6-1.9l-4.7-4.7c-.7-.7-.7-1.9 0-2.6.7-.7 1.9-.7 2.6 0l2.1 2.1V3.2z"
          fill="#ffffff"
          stroke="#1d1b20"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
