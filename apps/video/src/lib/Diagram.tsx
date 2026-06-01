import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { Icon } from '../ui';

const OUT = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.16, 1, 0.3, 1) };

const W = 1180;
const H = 560;

type N = { id: string; x: number; y: number; label: string; icon: string; store?: boolean };
const NODES: N[] = [
  { id: 'frontend', x: 560, y: 36, label: 'frontend', icon: 'devices' },
  { id: 'recommend', x: 150, y: 150, label: 'recommendation', icon: 'recommend' },
  { id: 'catalog', x: 980, y: 150, label: 'productcatalog', icon: 'inventory_2' },
  { id: 'cart', x: 250, y: 300, label: 'cartservice', icon: 'shopping_cart' },
  { id: 'checkout', x: 560, y: 300, label: 'checkoutservice', icon: 'shopping_bag' },
  { id: 'currency', x: 980, y: 300, label: 'currencyservice', icon: 'paid' },
  { id: 'payment', x: 560, y: 480, label: 'paymentservice', icon: 'credit_card' },
  { id: 'shipping', x: 850, y: 480, label: 'shippingservice', icon: 'local_shipping' },
  { id: 'redis', x: 250, y: 480, label: 'redis-cart', icon: 'database', store: true },
];
const BY = Object.fromEntries(NODES.map((n) => [n.id, n]));
const EDGES: [string, string, boolean?][] = [
  ['frontend', 'recommend'],
  ['frontend', 'catalog'],
  ['frontend', 'cart'],
  ['frontend', 'checkout'],
  ['checkout', 'cart'],
  ['checkout', 'payment'],
  ['checkout', 'shipping'],
  ['checkout', 'currency'],
  ['cart', 'redis', true],
];

const NW = 200;
const NH = 54;

export const Diagram: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        {EDGES.map(([a, b, hot], i) => {
          const A = BY[a];
          const B = BY[b];
          const len = Math.hypot(B.x - A.x, B.y - A.y);
          const start = 44 + i * 4;
          const p = interpolate(frame, [start, start + 18], [0, 1], OUT);
          return (
            <line
              key={`${a}-${b}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke={hot ? '#b3261e' : '#9db8e8'}
              strokeWidth={hot ? 3 : 2}
              strokeDasharray={len}
              strokeDashoffset={len * (1 - p)}
              opacity={hot ? 0.9 : 0.55}
            />
          );
        })}
      </svg>
      {NODES.map((n, i) => {
        const start = 8 + i * 5;
        const o = interpolate(frame, [start, start + 14], [0, 1], OUT);
        const s = interpolate(frame, [start, start + 14], [0.8, 1], OUT);
        const pulse = n.store ? 1 + 0.04 * Math.sin(frame / 8) : 1;
        return (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: n.x - NW / 2,
              top: n.y - NH / 2,
              width: NW,
              height: NH,
              opacity: o,
              transform: `scale(${s * pulse})`,
            }}
          >
            <div
              className="w-full h-full rounded-xl flex items-center gap-2.5 px-3"
              style={{
                background: '#fff',
                border: n.store ? '2px solid #b3261e' : '1px solid rgba(0,90,194,0.25)',
                boxShadow: n.store ? '0 6px 20px rgba(179,38,30,0.18)' : '0 6px 18px rgba(0,90,194,0.10)',
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: n.store ? 'rgba(179,38,30,0.1)' : 'rgba(0,90,194,0.1)' }}
              >
                <Icon name={n.icon} style={{ fontSize: 20, color: n.store ? '#b3261e' : '#005ac2' }} />
              </div>
              <div>
                <div className="font-mono text-on-surface" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{n.label}</div>
                {n.store && <div className="font-mono text-error" style={{ fontSize: 10 }}>datastore · SPOF</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
