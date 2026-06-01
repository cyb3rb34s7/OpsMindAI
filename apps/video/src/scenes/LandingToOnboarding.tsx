import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { Icon, Badge, Button, Card } from '../ui';
import { fadeUp, popIn, typed, fade } from '../anim';

const NAVY = '#001a42';

function Backdrop() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 540], [0, -40]);
  return (
    <AbsoluteFill className="bg-background">
      <div className="absolute inset-0 wireframe-bg opacity-40" style={{ transform: `translateY(${drift}px)` }} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(900px 600px at 50% 22%, rgba(0,90,194,0.10), transparent 70%)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(248,249,250,0.96))' }} />
    </AbsoluteFill>
  );
}

/* ---------- Scene A: brand cold open ---------- */
function ColdOpen() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = fade(frame, 0, 66, 12);
  return (
    <AbsoluteFill className="items-center justify-center" style={{ opacity: out }}>
      <div className="flex flex-col items-center">
        <div style={popIn(frame, fps, 4)}>
          <div className="w-[120px] h-[120px] rounded-[28px] bg-primary flex items-center justify-center shadow-2xl">
            <Icon name="hub" className="text-on-primary" style={{ fontSize: 72, fontVariationSettings: "'FILL' 1" }} />
          </div>
        </div>
        <div className="mt-8 font-heading font-bold tracking-tight text-on-surface" style={{ ...fadeUp(frame, 18, 16), fontSize: 64 }}>
          OpsMind<span className="text-primary">AI</span>
        </div>
        <div className="mt-3 font-mono uppercase tracking-[0.3em] text-on-surface-variant" style={{ ...fadeUp(frame, 30, 16), fontSize: 16 }}>
          Kinetic Operational Intelligence
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------- Scene B: landing hero ---------- */
function Hero() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = fade(frame, 0, 999, 14);
  // a subtle "click" pulse on the primary CTA near the end → leads into onboarding
  const click = spring({ frame: frame - 180, fps, config: { damping: 8, mass: 0.5, stiffness: 200 } });
  const ctaScale = 1 - 0.06 * Math.max(0, Math.sin(click * Math.PI)) * (frame > 178 && frame < 196 ? 1 : 0);
  return (
    <AbsoluteFill className="items-center justify-center" style={{ opacity: appear }}>
      <div className="flex flex-col items-center text-center px-24" style={{ maxWidth: 1280 }}>
        <div style={popIn(frame, fps, 8)}>
          <Badge tone="primary" className="!text-sm !px-3 !py-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> System Status: Operational
          </Badge>
        </div>
        <h1 className="font-heading leading-[1.05] mt-8" style={{ fontSize: 88, letterSpacing: '-0.04em' }}>
          <span className="block gradient-text" style={fadeUp(frame, 16, 18)}>Engineered Intelligence</span>
          <span className="block text-on-surface" style={fadeUp(frame, 30, 18)}>for Modern Ops.</span>
        </h1>
        <p className="font-body text-on-surface-variant mt-8" style={{ ...fadeUp(frame, 46, 18), fontSize: 26, maxWidth: 880 }}>
          A high-density operational platform that pairs birds-eye architectural mapping with precise execution
          control — powered by autonomous DevOps agents.
        </p>
        <div className="flex gap-5 mt-12 items-center">
          <div style={{ ...popIn(frame, fps, 62), transformOrigin: 'center' }}>
            <div style={{ transform: `scale(${ctaScale})` }}>
              <Button className="!text-base !px-7 !py-4">
                Initialize Discovery <Icon name="arrow_forward" className="!text-base" />
              </Button>
            </div>
          </div>
          <div style={popIn(frame, fps, 70)}>
            <Button variant="ghost" className="!text-base !px-7 !py-4">Investigate an Incident</Button>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ---------- Scene C: onboarding agent ---------- */
const GREETING = "Hi, I'm your onboarding agent.";
const FIELDS: [string, string, string][] = [
  ['link', 'GitHub repository', 'github.com/GoogleCloudPlatform/microservices-demo'],
  ['business_center', 'Business context', 'Online Boutique — checkout is the SLA-critical path…'],
  ['rule', 'Decision records (ADRs)', 'gRPC between services; cart state externalized to Redis…'],
  ['forum', 'Transcripts', 'Standup: redis-cart flagged as a checkout SPOF…'],
  ['description', 'Runbooks', 'If checkout errors spike, check redis-cart first…'],
];
const STEPS = ['Connecting to source', 'Scanning files', 'Reading provided context', 'Synthesizing intelligence', 'Committing context repo'];

function StepRow({ label, frame, start }: { label: string; frame: number; start: number }) {
  const fps = 30;
  const running = frame >= start;
  const done = frame >= start + 26;
  const spin = interpolate(frame, [start, start + 26], [0, 360]);
  return (
    <div className="flex items-center gap-3 text-base" style={fadeUp(frame, start, 10, 10)}>
      {done ? (
        <Icon name="check_circle" className="text-tertiary" style={{ fontSize: 22, fontVariationSettings: "'FILL' 1" }} />
      ) : running ? (
        <Icon name="progress_activity" className="text-primary" style={{ fontSize: 22, transform: `rotate(${spin}deg)` }} />
      ) : (
        <Icon name="radio_button_unchecked" className="text-outline-variant" style={{ fontSize: 22 }} />
      )}
      <span className={done ? 'text-on-surface' : 'text-on-surface-variant'}>{label}{done ? '' : '…'}</span>
    </div>
  );
}

function Onboarding() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = fade(frame, 0, 999, 16);
  const showSteps = frame >= 120;
  const complete = frame >= 120 + STEPS.length * 18 + 30;
  return (
    <AbsoluteFill className="items-center justify-center" style={{ opacity: appear }}>
      <div className="w-full px-28" style={{ maxWidth: 1320 }}>
        {/* agent greeting card */}
        <Card className="p-7 flex items-start gap-5" style={popIn(frame, fps, 4)}>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon name="hub" className="text-primary" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }} />
          </div>
          <div className="flex-1">
            <h1 className="font-heading text-on-surface" style={{ fontSize: 34 }}>
              {typed(GREETING, frame, 10, fps, 36)}
              <span style={{ opacity: frame % 16 < 8 && frame < 70 ? 1 : 0 }}>|</span>
            </h1>
            <p className="text-on-surface-variant mt-2" style={{ ...fadeUp(frame, 40, 14), fontSize: 19, maxWidth: 760 }}>
              Point me at a repo — and paste any decisions, transcripts, or business context that isn't in the code —
              and I'll build your context repo.
            </p>
          </div>
          <div style={popIn(frame, fps, 48)}>
            <Button variant="ghost" className="!text-sm !px-4 !py-2.5"><Icon name="auto_fix_high" className="!text-sm" /> Prefill demo data</Button>
          </div>
        </Card>

        {/* source fields cascade in */}
        <Card className="p-7 mt-5 space-y-4">
          {FIELDS.map(([icon, label, val], i) => (
            <div key={label} style={fadeUp(frame, 54 + i * 9, 12, 14)}>
              <div className="font-mono uppercase tracking-wide text-on-surface-variant flex items-center gap-1.5" style={{ fontSize: 13 }}>
                <Icon name={icon} className="!text-sm text-primary" /> {label}
              </div>
              <div className="mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-4 py-3 font-mono text-on-surface-variant" style={{ fontSize: 15 }}>
                {val}
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1" style={fadeUp(frame, 104, 12)}>
            <Button className="!text-base !px-6 !py-3">
              <Icon name="bolt" className="!text-sm" /> Initialize Discovery
            </Button>
          </div>
        </Card>

        {/* discovery steps / completion */}
        {showSteps && !complete && (
          <Card className="p-7 mt-5 space-y-3.5">
            {STEPS.map((s, i) => (
              <StepRow key={s} label={s} frame={frame} start={132 + i * 18} />
            ))}
            <p className="font-mono text-on-surface-variant/60 mt-2" style={{ fontSize: 13 }}>
              Running live agent on Groq — real GitHub scan + commit, ~10–20s.
            </p>
          </Card>
        )}
        {complete && (
          <div style={popIn(frame, fps, 120 + STEPS.length * 18 + 30)}>
            <Card className="p-7 mt-5 flex items-center gap-4 bg-tertiary-container/10 border-tertiary/20">
              <Icon name="verified" className="text-tertiary" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }} />
              <div className="flex-1">
                <div className="font-heading text-on-surface" style={{ fontSize: 24 }}>Onboarding complete</div>
                <div className="text-on-surface-variant" style={{ fontSize: 16 }}>Context repo committed to GitHub · 9 files · ready to investigate & release.</div>
              </div>
              <Badge tone="success" className="!text-xs !px-3 !py-1.5"><Icon name="check_circle" className="!text-xs" /> Analysis Complete</Badge>
            </Card>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

export const LandingToOnboarding: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <Backdrop />
      <Sequence durationInFrames={80}>
        <ColdOpen />
      </Sequence>
      <Sequence from={80} durationInFrames={220}>
        <Hero />
      </Sequence>
      <Sequence from={300} durationInFrames={300}>
        <Onboarding />
      </Sequence>
    </AbsoluteFill>
  );
};
