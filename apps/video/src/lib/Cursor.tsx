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
        width="30"
        height="30"
        viewBox="0 0 24 24"
        style={{ transform: `translate(-7px, -2px) scale(${press})`, transformOrigin: '7px 2px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))' }}
      >
        {/* sleek pointing-hand (link) cursor */}
        <path
          d="M7 2.6a1.5 1.5 0 0 1 3 0v7.6l1.9-.7a2 2 0 0 1 2.5 1l1.3 2.7a4 4 0 0 1 .3 2.7l-.6 2.4a2.2 2.2 0 0 1-2.1 1.7H9.2a3.5 3.5 0 0 1-2.7-1.3l-3.3-4a1.5 1.5 0 0 1 2.2-2l1.6 1.5V2.6z"
          fill="#ffffff"
          stroke="#1d1b20"
          strokeWidth="1.3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
