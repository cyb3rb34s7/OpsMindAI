import type { CSSProperties, ReactNode } from 'react';

function Dot({ c }: { c: string }) {
  return <div style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />;
}

/** A browser window mock that the OpsMind UI "opens" inside. The viewport is clipped
 *  so the content can scroll/scale within it. Entrance/camera transforms are applied
 *  by the parent via `style`. */
export const AppWindow: React.FC<{
  url?: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
  children?: ReactNode;
}> = ({ url = 'opsmind-ai.rajakumarsingh.com', width = 1560, height = 920, style, children }) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 18,
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: '0 50px 140px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)',
        ...style,
      }}
    >
      <div
        style={{
          height: 52,
          background: '#f1ecf6',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 9 }}>
          <Dot c="#ff5f56" />
          <Dot c="#ffbd2e" />
          <Dot c="#27c93f" />
        </div>
        <div
          style={{
            flex: 1,
            maxWidth: 560,
            margin: '0 auto',
            height: 32,
            borderRadius: 9,
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            color: '#49454f',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#006b4d' }}>lock</span>
          {url}
        </div>
        <div style={{ width: 64 }} />
      </div>
      <div style={{ position: 'relative', width: '100%', height: height - 52, overflow: 'hidden', background: '#f8f9fa' }}>
        {children}
      </div>
    </div>
  );
};
