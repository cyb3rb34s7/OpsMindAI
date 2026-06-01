import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import type { ReactNode } from 'react';

function Orb({ cx, cy, r, color, sx, sy, op }: { cx: number; cy: number; r: number; color: string; sx: number; sy: number; op: number }) {
  const frame = useCurrentFrame();
  const x = cx + Math.sin(frame / sx) * 70;
  const y = cy + Math.cos(frame / sy) * 55;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r / 2,
        top: y - r / 2,
        width: r,
        height: r,
        borderRadius: '50%',
        background: color,
        filter: 'blur(90px)',
        opacity: op,
      }}
    />
  );
}

/** Rich animated launch-video backdrop: deep gradient, drifting orbs, faint grid,
 *  a slow light sweep, and a vignette. All frame-driven (no CSS animations). */
export const Stage: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame % 300, [0, 300], [-500, 2400]);
  const gridY = interpolate(frame, [0, 900], [0, -60]);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(1300px 900px at 50% 28%, #0b2f63 0%, #06163a 55%, #020a1f 100%)' }}>
      <Orb cx={360} cy={240} r={620} color="#0a55b8" sx={70} sy={90} op={0.45} />
      <Orb cx={1580} cy={760} r={720} color="#0b2f86" sx={85} sy={70} op={0.42} />
      <Orb cx={1000} cy={-60} r={520} color="#1f6fd0" sx={60} sy={100} op={0.35} />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(150,190,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(150,190,255,0.06) 1px, transparent 1px)',
          backgroundSize: '54px 54px',
          backgroundPosition: `0px ${gridY}px`,
          WebkitMaskImage: 'radial-gradient(circle at 50% 42%, black 30%, transparent 78%)',
          maskImage: 'radial-gradient(circle at 50% 42%, black 30%, transparent 78%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -100,
          bottom: -100,
          left: sweep,
          width: 360,
          background: 'linear-gradient(90deg, transparent, rgba(150,200,255,0.10), transparent)',
          transform: 'skewX(-14deg)',
        }}
      />
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 420px rgba(0,0,0,0.55)' }} />
      {children}
    </AbsoluteFill>
  );
};
