import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { Icon } from '../ui';

type Key = { f: number; x: number; y: number };

/** A pointing-hand cursor (Material 'touch_app') that glides between keyframes and
 *  ripples on click. Coordinates are in the parent (window-content) space. */
export const Cursor: React.FC<{ path: Key[]; clicks?: number[] }> = ({ path, clicks = [] }) => {
  const frame = useCurrentFrame();
  const fs = path.map((p) => p.f);
  const ease = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.5, 0, 0.18, 1) };
  const x = interpolate(frame, fs, path.map((p) => p.x), ease);
  const y = interpolate(frame, fs, path.map((p) => p.y), ease);

  let press = 1;
  for (const c of clicks) {
    const d = frame - c;
    if (d >= 0 && d < 9) press = 0.78 + 0.22 * Math.abs(Math.cos((d / 9) * Math.PI));
  }
  const ripples = clicks
    .map((c) => {
      const d = frame - c;
      if (d >= 0 && d < 22) {
        const p = d / 22;
        return { c, r: 18 + p * 56, o: (1 - p) * 0.5 };
      }
      return null;
    })
    .filter(Boolean) as { c: number; r: number; o: number }[];

  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 60, pointerEvents: 'none' }}>
      {ripples.map((r) => (
        <div key={r.c} style={{ position: 'absolute', left: -r.r / 2, top: -r.r / 2, width: r.r, height: r.r, borderRadius: '50%', border: '2.5px solid #005ac2', opacity: r.o }} />
      ))}
      <div style={{ transform: `translate(-10px, -2px) scale(${press})`, transformOrigin: '10px 2px', filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 3px 5px rgba(0,0,0,0.4))' }}>
        <Icon name="touch_app" style={{ fontSize: 44, color: '#1d1b20', fontVariationSettings: "'FILL' 1" }} />
      </div>
    </div>
  );
};
