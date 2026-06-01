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

const TECH = ['Go', 'C#', 'Node.js', 'Python', 'Java', 'gRPC', 'Redis', 'Kubernetes', 'Docker', 'Skaffold'];
const COMPONENTS: [string, string, string, string][] = [
  ['frontend', 'Go', 'checkout, cart, catalog', '—'],
  ['cartservice', 'C#', 'redis-cart', 'Redis'],
  ['checkoutservice', 'Go', 'cart, payment, shipping', '—'],
  ['paymentservice', 'Node.js', '—', '—'],
  ['productcatalogservice', 'Go', '—', 'flat file'],
  ['currencyservice', 'Node.js', '—', '—'],
];
const FLOWS = [
  'frontend → checkoutservice → cartservice → redis-cart',
  'checkoutservice → paymentservice (charge)',
  'frontend → productcatalogservice (browse)',
  'checkoutservice → shippingservice → currencyservice',
];
const DECISIONS = [
  'ADR-003 — gRPC between services for typed contracts and low latency',
  'ADR-009 — cart state externalized to Redis so cartservice stays stateless',
  'ADR-014 — each service owns its Dockerfile; deploys gated via Skaffold + Kustomize',
];
const RISKS = [
  'redis-cart is the checkout single-point-of-failure — a drop fails carts and aborts checkout',
  'No circuit breaker on the payment path',
  'Cart only survives a pod restart via Redis',
];
const QUESTIONS = ['What is the redis-cart failover plan?', 'Who owns shippingservice?', 'Is there a checkout retry budget?'];

function ArtifactHeader({ icon, title, frame, at }: { icon: string; title: string; frame: number; at: number }) {
  return (
    <div className="flex items-center gap-2 font-mono uppercase tracking-wide text-on-surface-variant" style={{ fontSize: 13, margin: '30px 0 12px', ...fadeUp(frame, at, 10, 12) }}>
      <Icon name={icon} className="!text-base text-primary" /> {title}
    </div>
  );
}

const ContextRepoShot: React.FC = () => {
  const frame = useCurrentFrame();
  // auto-scroll the artifact document so we glide through every real artifact
  const scroll = interpolate(frame, [40, 300], [0, -1180], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.45, 0, 0.55, 1) });
  return (
    <AbsoluteFill className="items-center justify-center">
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
          {/* main: a tall artifact document that auto-scrolls */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ padding: '26px 40px', transform: `translateY(${scroll}px)` }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <div className="font-heading text-on-surface" style={{ fontSize: 26, ...fadeUp(frame, 6, 12) }}>Service Map</div>
                <div style={fadeUp(frame, 10, 12)}><Badge tone="primary" className="!text-xs">Online Boutique · 11 microservices · gRPC</Badge></div>
              </div>
              <p className="text-on-surface-variant" style={{ fontSize: 15, maxWidth: 780, ...fadeUp(frame, 14, 12) }}>
                The system, mapped automatically. <span className="text-error font-medium">redis-cart</span> is flagged as the checkout single-point-of-failure.
              </p>
              <div style={{ marginTop: 14, transform: 'scale(0.94)', transformOrigin: 'top left' }}>
                <Diagram />
              </div>

              <ArtifactHeader icon="memory" title="Tech Stack" frame={frame} at={70} />
              <div className="flex flex-wrap gap-2" style={fadeUp(frame, 74, 10, 12)}>
                {TECH.map((t) => <Badge key={t} tone="primary" className="!text-xs">{t}</Badge>)}
              </div>

              <ArtifactHeader icon="lan" title={`Components (${COMPONENTS.length} of 11)`} frame={frame} at={95} />
              <div className="rounded-lg border border-outline-variant/40 overflow-hidden" style={fadeUp(frame, 99, 10, 12)}>
                <table className="w-full" style={{ fontSize: 13 }}>
                  <thead className="bg-surface-container text-on-surface-variant" style={{ fontSize: 11 }}>
                    <tr><th className="text-left px-3 py-2 font-mono uppercase">Component</th><th className="text-left px-3 py-2 font-mono uppercase">Tech</th><th className="text-left px-3 py-2 font-mono uppercase">Depends on</th><th className="text-left px-3 py-2 font-mono uppercase">Store</th></tr>
                  </thead>
                  <tbody>
                    {COMPONENTS.map((c) => (
                      <tr key={c[0]} className="border-t border-outline-variant/20">
                        <td className="px-3 py-2 font-mono text-on-surface">{c[0]}</td>
                        <td className="px-3 py-2 text-on-surface-variant">{c[1]}</td>
                        <td className="px-3 py-2 text-on-surface-variant" style={{ fontSize: 12 }}>{c[2]}</td>
                        <td className="px-3 py-2">{c[3] !== '—' ? <Badge tone="primary" className="!text-[10px]">{c[3]}</Badge> : <span className="text-on-surface-variant">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ArtifactHeader icon="sync_alt" title="Data Flows" frame={frame} at={120} />
              <div className="space-y-1.5" style={fadeUp(frame, 124, 10, 12)}>
                {FLOWS.map((f) => <div key={f} className="font-mono bg-surface-container-low border border-outline-variant/30 rounded px-3 py-2 text-on-surface" style={{ fontSize: 13 }}>{f}</div>)}
              </div>

              <ArtifactHeader icon="rule" title="Key Decisions (ADRs)" frame={frame} at={145} />
              <div className="space-y-1.5" style={fadeUp(frame, 149, 10, 12)}>
                {DECISIONS.map((d) => <div key={d} className="flex items-start gap-2 text-on-surface" style={{ fontSize: 14 }}><Icon name="arrow_right" className="text-primary !text-base shrink-0" />{d}</div>)}
              </div>

              <ArtifactHeader icon="gpp_maybe" title="Operational Risks" frame={frame} at={170} />
              <div className="space-y-1.5" style={fadeUp(frame, 174, 10, 12)}>
                {RISKS.map((r) => <div key={r} className="flex items-start gap-2 text-on-surface-variant" style={{ fontSize: 14 }}><Icon name="priority_high" className="text-error !text-base shrink-0" />{r}</div>)}
              </div>

              <ArtifactHeader icon="help" title="Open Questions for Humans" frame={frame} at={195} />
              <div className="space-y-1.5" style={{ paddingBottom: 60, ...fadeUp(frame, 199, 10, 12) }}>
                {QUESTIONS.map((q) => <div key={q} className="flex items-start gap-2 text-on-surface-variant" style={{ fontSize: 14 }}><Icon name="help" className="text-primary !text-base shrink-0" />{q}</div>)}
              </div>
            </div>
            {/* top fade so scrolled content doesn't hard-cut at the chrome */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 24, background: 'linear-gradient(#f8f9fa, transparent)' }} />
          </div>
        </div>
      </AppWindow>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 6: chat — a normal query (headline + window) ---------------- */
const CHAT_Q = "What's my server health — is any service down?";
const CHAT_A = '⚠️ Heads up — cartservice is degraded: eu-west-1 is failing its readiness probe (Redis connection refused). Your other services are healthy. Want me to run a full root-cause investigation? 🔍';

const ChatShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winY = interpolate(frame, [16, 44], [150, 0], OUT);
  const winO = interpolate(frame, [16, 42], [0, 1], OUT);
  const zoom = interpolate(frame, [94, 132, 168, 198], [1, 1.22, 1.22, 1], OUT); // zoom into the loader, back out for the answer
  const sendClick = 78;
  const toolStart = 98;
  const toolDone = frame >= toolStart + 30;
  const replyStart = 150;
  const spin = interpolate(frame, [toolStart, toolStart + 30], [0, 720]);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 64, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 56, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>Initialize once.</div>
        <div style={{ ...fadeUp(frame, 16, 14), fontSize: 28, color: 'rgba(255,255,255,0.82)', fontFamily: "'Inter', sans-serif", marginTop: 8 }}>
          Now <span style={{ color: '#7fb0ff', fontWeight: 600 }}>Mindy</span> is ready to manage your DevOps.
        </div>
      </div>
      <div style={{ position: 'absolute', top: 252, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ transform: `translateY(${winY}px) scale(${zoom})`, transformOrigin: '32% 60%', opacity: winO }}>
          <AppWindow width={1500} height={764}>
            <div style={{ position: 'relative', width: 1500, height: 712, padding: '30px 44px' }}>
              {/* user message */}
              <div className="flex justify-end">
                <div className="bg-primary text-on-primary rounded-2xl rounded-br-sm px-4 py-2.5" style={{ fontSize: 18, maxWidth: '66%' }}>
                  {typed(CHAT_Q, frame, 42, fps, 42)}
                </div>
              </div>
              {/* Mindy response */}
              {frame >= 82 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center"><Icon name="hub" className="!text-sm" /></div>
                    <span className="font-mono uppercase text-on-surface-variant" style={{ fontSize: 12 }}>Mindy</span>
                  </div>
                  <div className="pl-9 space-y-2.5">
                    <div className="flex items-center gap-2 text-on-surface-variant" style={{ fontSize: 13, ...fadeUp(frame, 84, 8) }}><Icon name="neurology" className="!text-sm text-primary" /> pulled memory · 5 core · 4 learned · 6 recalled</div>
                    <div className="flex items-center gap-2 text-on-surface-variant" style={{ fontSize: 13, ...fadeUp(frame, 90, 8) }}><Icon name="monitor_heart" className="!text-sm text-primary" /> routed to <Badge tone="primary" className="!text-[10px]">status</Badge></div>
                    {frame >= toolStart && (
                      <div className="flex items-center gap-2" style={{ fontSize: 15, ...fadeUp(frame, toolStart, 8) }}>
                        {toolDone
                          ? <Icon name="check_circle" className="text-tertiary !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
                          : <Icon name="progress_activity" className="text-primary !text-lg" style={{ transform: `rotate(${spin}deg)` }} />}
                        <span className="font-mono text-on-surface">service status · all services</span>
                        {toolDone && <span className="text-error" style={{ fontSize: 13 }}>— cartservice degraded</span>}
                      </div>
                    )}
                    {frame >= replyStart && (
                      <div className="text-on-surface whitespace-pre-wrap" style={{ fontSize: 18, maxWidth: '90%', lineHeight: 1.5 }}>{typed(CHAT_A, frame, replyStart, fps, 50)}</div>
                    )}
                  </div>
                </div>
              )}
              {/* composer */}
              <div style={{ position: 'absolute', left: 44, right: 44, bottom: 26 }} className="flex gap-2 items-center">
                <div className="flex-1 bg-surface border border-outline-variant/40 rounded-xl px-4 py-3 text-on-surface-variant" style={{ fontSize: 15 }}>Ask Mindy anything…</div>
                <Button className="!px-5 !py-3"><Icon name="send" className="!text-sm" /> Send</Button>
              </div>
              <Cursor path={[{ f: 0, x: 1250, y: 360 }, { f: 64, x: 1392, y: 664 }, { f: sendClick, x: 1392, y: 664 }, { f: 260, x: 1392, y: 664 }]} clicks={[sendClick]} />
            </div>
          </AppWindow>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 7: RCA agent investigation ---------------- */
const RCA_Q = 'Investigate why checkout is failing — trace_123';
const RCA_STEPS = ['Reading service logs', 'Correlating the trace timeline', 'Identifying the impacted service', 'Fetching project context', 'Reasoning about the root cause'];
const RCA_ROOT = 'cartservice could not reach redis-cart (redis-cart:6379) — connection refused. The cart lookup failed, so checkoutservice aborted the order.';
const RCA_RECS = ['Verify redis-cart health & network reachability', 'Restart redis-cart if connections are refused', 'Add a circuit breaker on the cart → checkout path'];
const TRACE: [string, string, string, boolean][] = [
  ['0.0s', 'frontend', 'placeOrder received', false],
  ['+8.0s', 'cartservice', 'redis connection refused', true],
  ['+10s', 'checkoutservice', 'cart retrieval failed — aborting', true],
];

const RcaShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winY = interpolate(frame, [16, 44], [150, 0], OUT);
  const winO = interpolate(frame, [16, 42], [0, 1], OUT);
  const sendClick = 70;
  const stepBase = 92;
  const stepDur = 20;
  const analysisAt = stepBase + RCA_STEPS.length * stepDur + 8;
  const skillAt = analysisAt + 60;
  const scroll = interpolate(frame, [analysisAt - 14, analysisAt + 16], [0, -210], OUT);
  const zoom = interpolate(frame, [86, 116, analysisAt - 8, analysisAt + 22], [1, 1.16, 1.16, 1.02], OUT);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 50, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 46, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>
          When something breaks, Mindy finds the root cause.
        </div>
      </div>
      <div style={{ position: 'absolute', top: 168, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ transform: `translateY(${winY}px) scale(${zoom})`, transformOrigin: '34% 52%', opacity: winO }}>
          <AppWindow width={1500} height={840}>
            <div style={{ position: 'relative', width: 1500, height: 788, overflow: 'hidden' }}>
              <div style={{ padding: '28px 44px', transform: `translateY(${scroll}px)` }}>
                <div className="flex justify-end">
                  <div className="bg-primary text-on-primary rounded-2xl rounded-br-sm px-4 py-2.5" style={{ fontSize: 18, maxWidth: '70%' }}>{typed(RCA_Q, frame, 40, fps, 42)}</div>
                </div>
                {frame >= 80 && (
                  <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center"><Icon name="hub" className="!text-sm" /></div>
                      <span className="font-mono uppercase text-on-surface-variant" style={{ fontSize: 12 }}>Mindy</span>
                      <Badge tone="primary" className="!text-[10px]" style={fadeUp(frame, 82, 8)}><Icon name="psychology" className="!text-xs" /> delegating to RCA agent</Badge>
                    </div>
                    <div className="pl-9 space-y-2.5">
                      {RCA_STEPS.map((s, i) => {
                        const st = stepBase + i * stepDur;
                        if (frame < st) return null;
                        const done = frame >= st + stepDur - 2;
                        const spin = interpolate(frame, [st, st + stepDur - 2], [0, 360]);
                        return (
                          <div key={s} className="flex items-center gap-2.5" style={{ fontSize: 15, ...fadeUp(frame, st, 8, 8) }}>
                            {done ? <Icon name="check_circle" className="text-tertiary !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} /> : <Icon name="progress_activity" className="text-primary !text-lg" style={{ transform: `rotate(${spin}deg)` }} />}
                            <span className={done ? 'text-on-surface' : 'text-on-surface-variant'}>{s}{done ? '' : '…'}</span>
                          </div>
                        );
                      })}
                      {frame >= analysisAt && (
                        <div className="mt-3 rounded-xl border border-outline-variant/40 overflow-hidden" style={popIn(frame, fps, analysisAt)}>
                          <div className="px-4 py-2.5 bg-surface-variant/40 flex items-center gap-2 font-mono uppercase" style={{ fontSize: 12 }}><Icon name="psychology" className="text-primary !text-sm" /> Root Cause Analysis</div>
                          <div className="p-4 space-y-3">
                            <div className="font-heading text-on-surface" style={{ fontSize: 21, lineHeight: 1.25 }}>{RCA_ROOT}</div>
                            <div className="flex items-center gap-3">
                              <div className="h-2.5 rounded-full bg-surface-variant overflow-hidden" style={{ width: 240 }}>
                                <div className="h-full bg-tertiary" style={{ width: `${interpolate(frame, [analysisAt + 6, analysisAt + 26], [0, 95], OUT)}%` }} />
                              </div>
                              <span className="font-mono text-tertiary" style={{ fontSize: 14 }}>95% confidence</span>
                            </div>
                            <div className="rounded-lg p-3 font-mono" style={{ background: '#0f1115', fontSize: 13 }}>
                              {TRACE.map((t, i) => (
                                <div key={i} className="flex gap-3" style={{ color: t[3] ? '#ff7b72' : '#9db8e8', ...fadeUp(frame, analysisAt + 14 + i * 4, 8, 6) }}>
                                  <span style={{ width: 56, color: '#6b7280' }}>{t[0]}</span><span style={{ width: 150 }}>{t[1]}</span><span>{t[2]}</span>
                                </div>
                              ))}
                            </div>
                            <div className="space-y-1.5">
                              {RCA_RECS.map((r, i) => (
                                <div key={r} className="flex items-start gap-2 text-on-surface" style={{ fontSize: 14, ...fadeUp(frame, analysisAt + 26 + i * 4, 8, 8) }}><Icon name="flare" className="text-primary !text-base shrink-0" />{r}</div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {frame >= skillAt && (
                        <div className="flex items-center gap-2 text-tertiary" style={{ fontSize: 15, ...fadeUp(frame, skillAt, 10) }}>
                          <Icon name="lightbulb" className="!text-lg" style={{ fontVariationSettings: "'FILL' 1" }} /> 🧠 Saved this as a reusable skill — next time it's instant.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Cursor path={[{ f: 0, x: 1240, y: 380 }, { f: 60, x: 1392, y: 700 }, { f: sendClick, x: 1392, y: 700 }, { f: 320, x: 1392, y: 700 }]} clicks={[sendClick]} />
            </div>
          </AppWindow>
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
        <TransitionSeries.Sequence durationInFrames={330}>
          <ContextRepoShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={260}>
          <ChatShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={320}>
          <RcaShot />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
