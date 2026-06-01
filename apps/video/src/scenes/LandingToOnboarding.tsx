import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { Icon, Badge, Button, Card } from '../ui';
import { Stage } from '../lib/Stage';
import { AppWindow } from '../lib/AppWindow';
import { Cursor } from '../lib/Cursor';
import { Diagram } from '../lib/Diagram';
import { fadeUp, popIn, typed, fade } from '../anim';

const OUT = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const, easing: Easing.bezier(0.16, 1, 0.3, 1) };
const CW = 1560; // window content width
const CH = 868; // window content height (920 - 52 chrome)

/* ---------------- Shot 1: brand cold open ---------------- */
const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill className="items-center justify-center">
      <div className="flex flex-col items-center">
        <div style={popIn(frame, fps, 4)}>
          <div style={{ width: 132, height: 132, borderRadius: 30, background: '#005ac2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 24px 70px rgba(0,90,194,0.55)' }}>
            <Icon name="hub" style={{ fontSize: 78, color: '#fff', fontVariationSettings: "'FILL' 1" }} />
          </div>
        </div>
        <div style={{ ...fadeUp(frame, 20, 16), fontSize: 72, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em', marginTop: 34 }}>
          OpsMind<span style={{ color: '#7fb0ff' }}>AI</span>
        </div>
        <div style={{ ...fadeUp(frame, 32, 16), fontSize: 17, color: 'rgba(255,255,255,0.6)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.34em', textTransform: 'uppercase', marginTop: 14 }}>
          Kinetic Operational Intelligence
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 2: landing opens in a window ---------------- */
const LandingShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pushIn = interpolate(frame, [0, 150], [1, 1.07], OUT); // slow camera push-in
  const clickF = 86;
  const btnPress = frame >= clickF && frame < clickF + 9 ? 0.95 : 1;
  return (
    <AbsoluteFill className="items-center justify-center">
      <div style={{ transform: `scale(${pushIn})`, transformOrigin: '50% 46%' }}>
        <AppWindow>
          <div style={{ position: 'relative', width: CW, height: CH }}>
            <div className="absolute inset-0 wireframe-bg opacity-30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-32">
              <div style={popIn(frame, fps, 8)}>
                <Badge tone="primary" className="!text-sm !px-3 !py-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> System Status: Operational</Badge>
              </div>
              <h1 className="font-heading leading-[1.05] mt-7" style={{ fontSize: 72, letterSpacing: '-0.04em' }}>
                <span className="block gradient-text" style={fadeUp(frame, 14, 16)}>Engineered Intelligence</span>
                <span className="block text-on-surface" style={fadeUp(frame, 26, 16)}>for Modern Ops.</span>
              </h1>
              <p className="font-body text-on-surface-variant mt-7" style={{ ...fadeUp(frame, 40, 16), fontSize: 23, maxWidth: 820 }}>
                A high-density operational platform that pairs birds-eye architectural mapping with precise execution
                control — powered by autonomous DevOps agents.
              </p>
              <div className="flex gap-5 mt-10 items-center">
                <div style={{ ...popIn(frame, fps, 54), transform: `scale(${btnPress})` }}>
                  <Button className="!text-base !px-7 !py-4">Initialize Discovery <Icon name="arrow_forward" className="!text-base" /></Button>
                </div>
                <div style={popIn(frame, fps, 62)}>
                  <Button variant="ghost" className="!text-base !px-7 !py-4">Investigate an Incident</Button>
                </div>
              </div>
            </div>
            <Cursor
              path={[{ f: 0, x: 1280, y: 800 }, { f: 70, x: 632, y: 612 }, { f: 150, x: 632, y: 612 }]}
              clicks={[clickF]}
            />
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 3: onboarding agent ---------------- */
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
  const running = frame >= start;
  const done = frame >= start + 22;
  const spin = interpolate(frame, [start, start + 22], [0, 360]);
  return (
    <div className="flex items-center gap-3 text-lg" style={fadeUp(frame, start, 10, 10)}>
      {done ? (
        <Icon name="check_circle" className="text-tertiary" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }} />
      ) : running ? (
        <Icon name="progress_activity" className="text-primary" style={{ fontSize: 24, transform: `rotate(${spin}deg)` }} />
      ) : (
        <Icon name="radio_button_unchecked" className="text-outline-variant" style={{ fontSize: 24 }} />
      )}
      <span className={done ? 'text-on-surface' : 'text-on-surface-variant'}>{label}{done ? '' : '…'}</span>
    </div>
  );
}

const OnboardingShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prefillClick = 30;
  const initClick = 96;
  const stepsStart = 116;
  const filled = frame >= prefillClick;
  const showSteps = frame >= stepsStart - 6;
  const complete = frame >= stepsStart + STEPS.length * 16 + 26;
  // auto-scroll content up to reveal the discovery steps, then a gentle zoom on them
  const scroll = interpolate(frame, [initClick, initClick + 26], [0, -300], OUT);
  const zoom = interpolate(frame, [stepsStart, stepsStart + 30], [1, 1.1], OUT);
  const btnInit = frame >= initClick && frame < initClick + 9 ? 0.96 : 1;
  const btnPre = frame >= prefillClick && frame < prefillClick + 9 ? 0.95 : 1;

  return (
    <AbsoluteFill className="items-center justify-center">
      <div style={{ transform: `scale(${zoom})`, transformOrigin: '50% 78%' }}>
        <AppWindow>
          <div style={{ position: 'relative', width: CW, height: CH }}>
            <div className="absolute inset-x-0 px-20" style={{ top: 40, transform: `translateY(${scroll}px)` }}>
              {/* agent greeting */}
              <Card className="p-7 flex items-start gap-5" style={popIn(frame, fps, 2)}>
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon name="hub" className="text-primary" style={{ fontSize: 36, fontVariationSettings: "'FILL' 1" }} />
                </div>
                <div className="flex-1">
                  <h1 className="font-heading text-on-surface" style={{ fontSize: 32 }}>
                    {typed(GREETING, frame, 8, fps, 38)}
                    <span style={{ opacity: frame % 16 < 8 && frame < 60 ? 1 : 0 }}>|</span>
                  </h1>
                  <p className="text-on-surface-variant mt-2" style={{ ...fadeUp(frame, 34, 12), fontSize: 18, maxWidth: 760 }}>
                    Point me at a repo — and paste any decisions, transcripts, or business context that isn't in the code — and I'll build your context repo.
                  </p>
                </div>
                <div style={{ ...popIn(frame, fps, 14), transform: `scale(${btnPre})` }}>
                  <Button variant="ghost" className="!text-sm !px-4 !py-2.5"><Icon name="auto_fix_high" className="!text-sm" /> Prefill demo data</Button>
                </div>
              </Card>

              {/* source fields */}
              <Card className="p-7 mt-5 space-y-3.5">
                {FIELDS.map(([icon, label, val], i) => (
                  <div key={label} style={filled ? fadeUp(frame, prefillClick + 4 + i * 7, 12, 14) : { opacity: 0.25 }}>
                    <div className="font-mono uppercase tracking-wide text-on-surface-variant flex items-center gap-1.5" style={{ fontSize: 12 }}>
                      <Icon name={icon} className="!text-sm text-primary" /> {label}
                    </div>
                    <div className="mt-1.5 bg-surface-container-low border border-outline-variant/40 rounded-md px-4 py-2.5 font-mono text-on-surface-variant" style={{ fontSize: 14 }}>
                      {filled ? val : ''}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <div style={{ transform: `scale(${btnInit})` }}>
                    <Button className="!text-base !px-6 !py-3"><Icon name="bolt" className="!text-sm" /> Initialize Discovery</Button>
                  </div>
                </div>
              </Card>

              {/* discovery / completion */}
              {showSteps && !complete && (
                <Card className="p-7 mt-5 space-y-3.5">
                  {STEPS.map((s, i) => <StepRow key={s} label={s} frame={frame} start={stepsStart + i * 16} />)}
                  <p className="font-mono text-on-surface-variant/60 mt-1" style={{ fontSize: 13 }}>Running live agent on Groq — real GitHub scan + commit, ~10–20s.</p>
                </Card>
              )}
              {complete && (
                <div style={popIn(frame, fps, stepsStart + STEPS.length * 16 + 26)}>
                  <Card className="p-7 mt-5 flex items-center gap-4 bg-tertiary-container/10 border-tertiary/20">
                    <Icon name="verified" className="text-tertiary" style={{ fontSize: 38, fontVariationSettings: "'FILL' 1" }} />
                    <div className="flex-1">
                      <div className="font-heading text-on-surface" style={{ fontSize: 24 }}>Onboarding complete</div>
                      <div className="text-on-surface-variant" style={{ fontSize: 16 }}>Context repo committed to GitHub · 9 files · ready to investigate &amp; release.</div>
                    </div>
                    <Badge tone="success" className="!text-xs !px-3 !py-1.5"><Icon name="check_circle" className="!text-xs" /> Analysis Complete</Badge>
                  </Card>
                </div>
              )}
            </div>
            <Cursor
              path={[{ f: 0, x: 760, y: 760 }, { f: 24, x: 1300, y: 116 }, { f: 60, x: 1300, y: 116 }, { f: initClick, x: 1180, y: 470 }, { f: 250, x: 1180, y: 470 }]}
              clicks={[prefillClick, initClick]}
            />
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 4: context repo + system map ---------------- */
const REPO_FILES: [string, string][] = [
  ['menu_book', 'README.md'],
  ['lan', 'service_map.md'],
  ['memory', 'tech_stack.md'],
  ['sync_alt', 'data_flows.md'],
  ['rule', 'decision_records.md'],
  ['gpp_maybe', 'risks.md'],
  ['help', 'open_questions.md'],
];

const ContextRepoShot: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [24, 165], [1, 1.06], OUT);
  return (
    <AbsoluteFill className="items-center justify-center">
      <div style={{ transform: `scale(${zoom})`, transformOrigin: '52% 58%' }}>
        <AppWindow>
          <div style={{ position: 'relative', width: CW, height: CH, display: 'flex' }}>
            {/* sidebar */}
            <div style={{ width: 300, borderRight: '1px solid rgba(0,0,0,0.07)', background: '#fbfbfd', padding: '22px 16px' }}>
              <div className="font-mono uppercase tracking-wide text-on-surface-variant flex items-center gap-2" style={{ fontSize: 12, marginBottom: 16 }}>
                <Icon name="menu_book" className="!text-sm text-primary" /> Context Repo
              </div>
              {REPO_FILES.map(([ic, name], i) => {
                const active = name === 'service_map.md';
                return (
                  <div key={name} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ ...fadeUp(frame, 8 + i * 4, 10, 8), background: active ? 'rgba(0,90,194,0.10)' : 'transparent', marginBottom: 2 }}>
                    <Icon name={ic} style={{ fontSize: 18, color: active ? '#005ac2' : '#79747e' }} />
                    <span className="font-mono" style={{ fontSize: 14, color: active ? '#005ac2' : '#49454f', fontWeight: active ? 600 : 400 }}>{name}</span>
                  </div>
                );
              })}
              <div className="mt-4" style={fadeUp(frame, 40, 12)}>
                <Badge tone="success" className="!text-[10px]"><Icon name="commit" className="!text-xs" /> 9 files on GitHub</Badge>
              </div>
            </div>
            {/* main */}
            <div style={{ flex: 1, padding: '26px 40px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div className="font-heading text-on-surface" style={{ fontSize: 26, ...fadeUp(frame, 6, 12) }}>Service Map</div>
                <div style={fadeUp(frame, 10, 12)}><Badge tone="primary" className="!text-xs">Online Boutique · 11 microservices · gRPC</Badge></div>
              </div>
              <p className="text-on-surface-variant" style={{ fontSize: 15, maxWidth: 780, ...fadeUp(frame, 14, 12) }}>
                The system, mapped automatically — services, dependencies, and the stores that matter.{' '}
                <span className="text-error font-medium">redis-cart</span> is flagged as the checkout single-point-of-failure.
              </p>
              <div style={{ marginTop: 16, transform: 'scale(0.96)', transformOrigin: 'top left' }}>
                <Diagram />
              </div>
            </div>
          </div>
        </AppWindow>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 5: marketing interstitial ---------------- */
const InterstitialShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill className="items-center justify-center">
      <div className="flex flex-col items-center text-center">
        <div style={popIn(frame, fps, 6)}>
          <div style={{ width: 96, height: 96, borderRadius: 24, background: '#005ac2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 20px 60px rgba(0,90,194,0.5)' }}>
            <Icon name="hub" style={{ fontSize: 56, color: '#fff', fontVariationSettings: "'FILL' 1" }} />
          </div>
        </div>
        <div style={{ ...fadeUp(frame, 18, 14), fontSize: 60, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em', marginTop: 30 }}>
          Initialize once.
        </div>
        <div style={{ ...fadeUp(frame, 42, 16), fontSize: 34, color: 'rgba(255,255,255,0.85)', fontFamily: "'Inter', sans-serif", marginTop: 10, maxWidth: 1040 }}>
          Now <span style={{ color: '#7fb0ff', fontWeight: 600 }}>Mindy</span> is ready to manage your DevOps.
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- assembled cinematic composition ---------------- */
export const LandingToOnboarding: React.FC = () => {
  const slideIn = springTiming({ config: { damping: 200 }, durationInFrames: 22 });
  return (
    <AbsoluteFill>
      <Stage />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <ColdOpen />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={150}>
          <LandingShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={250}>
          <OnboardingShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={170}>
          <ContextRepoShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={90}>
          <InterstitialShot />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
