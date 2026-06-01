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

const CTX_SCHED = [20, 78, 160, 214, 266, 320, 376]; // frame each file becomes active
const CTX_TITLES = ['README', 'Service Map', 'Tech Stack', 'Data Flows', 'Key Decisions', 'Operational Risks', 'Open Questions'];

function CtxContent({ idx, frame, start }: { idx: number; frame: number; start: number }) {
  const o = interpolate(frame, [start, start + 12], [0, 1], OUT);
  const ty = interpolate(frame, [start, start + 12], [14, 0], OUT);
  const wrap = { opacity: o, transform: `translateY(${ty}px)` };
  if (idx === 0)
    return (
      <div style={wrap}>
        <div className="font-heading text-on-surface" style={{ fontSize: 30, marginBottom: 12 }}>Online Boutique</div>
        <p className="text-on-surface-variant" style={{ fontSize: 17, maxWidth: 820, lineHeight: 1.6 }}>
          A cloud-first microservices demo — a web storefront where users browse products, add them to a cart, and check
          out. Eleven services communicate over gRPC; checkout is the most SLA-critical path.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-6" style={{ maxWidth: 720 }}>
          {[['account_tree', 'Services', '11 microservices'], ['cable', 'Protocol', 'gRPC'], ['code', 'Languages', 'Go · C# · Node · Python · Java'], ['priority_high', 'Critical path', 'checkout → cart → redis']].map(([ic, k, v]) => (
            <div key={k} className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 flex items-center gap-3">
              <Icon name={ic} className="text-primary !text-2xl" />
              <div><div className="font-mono uppercase text-on-surface-variant" style={{ fontSize: 11 }}>{k}</div><div className="text-on-surface" style={{ fontSize: 16 }}>{v}</div></div>
            </div>
          ))}
        </div>
      </div>
    );
  if (idx === 1)
    return (
      <div style={wrap}>
        <p className="text-on-surface-variant" style={{ fontSize: 15, maxWidth: 820, marginBottom: 8 }}>The system, mapped automatically. <span className="text-error font-medium">redis-cart</span> is flagged as the checkout single-point-of-failure.</p>
        <div style={{ transform: 'scale(0.95)', transformOrigin: 'top left' }}><Diagram /></div>
      </div>
    );
  if (idx === 2)
    return (
      <div style={wrap} className="space-y-5">
        {[['Languages', ['Go', 'C#', 'Node.js', 'Python', 'Java']], ['Platform', ['Kubernetes', 'Docker', 'Skaffold', 'Kustomize']], ['Data & comms', ['Redis', 'gRPC', 'Protocol Buffers']]].map(([grp, items]) => (
          <div key={grp as string}>
            <div className="font-mono uppercase text-on-surface-variant" style={{ fontSize: 12, marginBottom: 8 }}>{grp as string}</div>
            <div className="flex flex-wrap gap-2">{(items as string[]).map((t) => <Badge key={t} tone="primary" className="!text-sm !px-3 !py-1.5">{t}</Badge>)}</div>
          </div>
        ))}
      </div>
    );
  if (idx === 3)
    return (
      <div style={wrap} className="space-y-2.5">
        {FLOWS.map((f) => <div key={f} className="font-mono bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface" style={{ fontSize: 15 }}>{f}</div>)}
      </div>
    );
  if (idx === 4)
    return (
      <div style={wrap} className="space-y-3">
        {DECISIONS.map((d) => <div key={d} className="flex items-start gap-2.5 text-on-surface rounded-lg bg-surface-container-low border border-outline-variant/30 px-4 py-3" style={{ fontSize: 15 }}><Icon name="rule" className="text-primary !text-lg shrink-0" />{d}</div>)}
      </div>
    );
  if (idx === 5)
    return (
      <div style={wrap} className="space-y-3">
        {RISKS.map((r) => <div key={r} className="flex items-start gap-2.5 text-on-surface rounded-lg bg-error-container/10 border border-error/20 px-4 py-3" style={{ fontSize: 15 }}><Icon name="priority_high" className="text-error !text-lg shrink-0" />{r}</div>)}
      </div>
    );
  return (
    <div style={wrap} className="space-y-3">
      {QUESTIONS.map((q) => <div key={q} className="flex items-start gap-2.5 text-on-surface-variant rounded-lg bg-surface-container-low border border-outline-variant/30 px-4 py-3" style={{ fontSize: 15 }}><Icon name="help" className="text-primary !text-lg shrink-0" />{q}</div>)}
    </div>
  );
}

const ContextRepoShot: React.FC = () => {
  const frame = useCurrentFrame();
  // navigate the sidebar tabs one-by-one (no scroll); the cursor clicks each file
  let activeIdx = 0;
  for (let i = 0; i < CTX_SCHED.length; i++) if (frame >= CTX_SCHED[i]) activeIdx = i;
  const start = CTX_SCHED[activeIdx];
  const rowY = (i: number) => 78 + i * 46;
  const cursorPath = [{ f: 0, x: 640, y: 380 }];
  CTX_SCHED.forEach((sf, i) => {
    cursorPath.push({ f: Math.max(0, sf - 10), x: 150, y: rowY(i) });
    cursorPath.push({ f: sf, x: 150, y: rowY(i) });
  });
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
              const active = i === activeIdx;
              return (
                <div key={name} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5" style={{ ...fadeUp(frame, 8 + i * 3, 10, 8), background: active ? 'rgba(0,90,194,0.12)' : 'transparent', marginBottom: 2 }}>
                  <Icon name={ic} style={{ fontSize: 18, color: active ? '#005ac2' : '#79747e' }} />
                  <span className="font-mono" style={{ fontSize: 14, color: active ? '#005ac2' : '#49454f', fontWeight: active ? 600 : 400 }}>{name}</span>
                </div>
              );
            })}
            <div className="mt-4" style={fadeUp(frame, 40, 12)}>
              <Badge tone="success" className="!text-[10px]"><Icon name="commit" className="!text-xs" /> 9 files on GitHub</Badge>
            </div>
          </div>
          {/* main: the active artifact */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', padding: '28px 40px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <div className="font-heading text-on-surface" style={{ fontSize: 24 }}>{CTX_TITLES[activeIdx]}</div>
              <Badge tone="primary" className="!text-xs">Online Boutique · 11 microservices · gRPC</Badge>
            </div>
            <CtxContent idx={activeIdx} frame={frame} start={start} />
          </div>
          <Cursor path={cursorPath} clicks={CTX_SCHED} />
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
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 56, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>Ask anything about your servers.</div>
        <div style={{ ...fadeUp(frame, 16, 14), fontSize: 28, color: 'rgba(255,255,255,0.82)', fontFamily: "'Inter', sans-serif", marginTop: 8 }}>
          Now <span style={{ color: '#7fb0ff', fontWeight: 600 }}>Mindy</span> is ready — health, pods &amp; logs, in plain language.
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

/* ---------------- Shot 8: skill creation (learns with you) ---------------- */
const SkillShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winY = interpolate(frame, [16, 44], [140, 0], OUT);
  const winO = interpolate(frame, [16, 42], [0, 1], OUT);
  const cardAt = 56;
  const glow = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(frame / 8));
  const zoom = interpolate(frame, [cardAt, cardAt + 28], [1, 1.1], OUT);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 54, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>Your system learns with you.</div>
        <div style={{ ...fadeUp(frame, 16, 14), fontSize: 26, color: 'rgba(255,255,255,0.8)', fontFamily: "'Inter', sans-serif", marginTop: 8 }}>Every incident it resolves becomes a reusable skill — applied automatically next time.</div>
      </div>
      <div style={{ position: 'absolute', top: 300, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ transform: `translateY(${winY}px) scale(${zoom})`, transformOrigin: '50% 40%', opacity: winO }}>
          <AppWindow width={1180} height={520}>
            <div style={{ width: 1180, height: 468, padding: '30px 40px' }}>
              <div className="font-mono uppercase tracking-wide text-on-surface-variant flex items-center gap-2" style={{ fontSize: 13, marginBottom: 18 }}>
                <Icon name="school" className="!text-base text-primary" /> Learned Skills · SRE Playbook
              </div>
              <div
                className="rounded-2xl p-6 bg-surface-container-low"
                style={{
                  border: '2px solid #006b4d',
                  boxShadow: `0 0 ${20 + 24 * glow}px rgba(0,107,77,${0.25 + 0.3 * glow})`,
                  ...popIn(frame, fps, cardAt),
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-heading text-on-surface" style={{ fontSize: 22 }}>
                    <Icon name="lightbulb" className="text-tertiary" style={{ fontSize: 26, fontVariationSettings: "'FILL' 1" }} /> New skill learned
                  </div>
                  <Badge tone="success" className="!text-xs">NEW</Badge>
                </div>
                <div className="font-mono text-on-surface" style={{ fontSize: 18, marginBottom: 10 }}>cartservice: redis connection refused</div>
                <div className="flex items-start gap-2 text-on-surface-variant" style={{ fontSize: 16 }}>
                  <Icon name="flare" className="text-primary !text-lg shrink-0" /> Verify redis-cart health &amp; network; restart if connections are refused.
                </div>
                <div className="flex gap-2 mt-4">
                  <Badge tone="neutral" className="!text-[10px]"><Icon name="psychology" className="!text-xs" /> learned by RCA agent</Badge>
                  <Badge tone="primary" className="!text-[10px]">×1 · reinforces on repeat</Badge>
                  <Badge tone="success" className="!text-[10px]">95% confidence</Badge>
                </div>
              </div>
            </div>
          </AppWindow>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 9: skills tab (the playbook) ---------------- */
const NAV: [string, string][] = [
  ['forum', 'Chat'],
  ['rocket_launch', 'Onboarding'],
  ['menu_book', 'Context Repo'],
  ['psychology', 'Investigation'],
  ['deployed_code', 'Releases'],
  ['school', 'Knowledge'],
];
const SKILLS: [string, string, number][] = [
  ['cartservice: redis connection refused', 'Verify redis-cart health & network; restart if connections are refused.', 2],
  ['productcatalogservice: db pool exhaustion', 'Raise the connection pool ceiling; add backpressure on burst traffic.', 1],
];

const SkillsTabShot: React.FC = () => {
  const frame = useCurrentFrame();
  const winY = interpolate(frame, [14, 40], [140, 0], OUT);
  const winO = interpolate(frame, [14, 38], [0, 1], OUT);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 58, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 52, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>A playbook that writes itself.</div>
      </div>
      <div style={{ position: 'absolute', top: 188, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ transform: `translateY(${winY}px)`, opacity: winO }}>
          <AppWindow width={1540} height={800}>
            <div style={{ position: 'relative', width: 1540, height: 748, display: 'flex' }}>
              {/* sidebar */}
              <div style={{ width: 250, borderRight: '1px solid rgba(0,0,0,0.07)', background: '#fdf8fd', padding: '18px 12px' }}>
                <div className="flex items-center gap-2 px-2 mb-5">
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: '#005ac2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="hub" style={{ fontSize: 18, color: '#fff', fontVariationSettings: "'FILL' 1" }} /></div>
                  <span className="font-heading" style={{ fontSize: 18, fontWeight: 700 }}>OpsMindAI</span>
                </div>
                {NAV.map(([ic, label]) => {
                  const active = label === 'Knowledge';
                  return (
                    <div key={label} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: active ? 'rgba(0,90,194,0.12)' : 'transparent', marginBottom: 2 }}>
                      <Icon name={ic} style={{ fontSize: 18, color: active ? '#005ac2' : '#79747e' }} />
                      <span style={{ fontSize: 14, color: active ? '#005ac2' : '#49454f', fontWeight: active ? 600 : 400 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              {/* main */}
              <div style={{ flex: 1, padding: '28px 36px' }}>
                <div className="flex items-center gap-2 mb-1" style={fadeUp(frame, 8, 12)}>
                  <Icon name="school" className="text-primary !text-xl" />
                  <span className="font-heading text-on-surface" style={{ fontSize: 26 }}>Learned Skills</span>
                  <Badge tone="success" className="!text-xs">{SKILLS.length}</Badge>
                </div>
                <p className="text-on-surface-variant" style={{ fontSize: 15, marginBottom: 18, ...fadeUp(frame, 12, 12) }}>Every resolved incident, captured as a reusable runbook — reinforced each time it recurs.</p>
                <div className="space-y-3">
                  {SKILLS.map(([pat, res, count], i) => (
                    <div key={pat} className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-4" style={fadeUp(frame, 24 + i * 12, 12, 16)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-mono text-on-surface" style={{ fontSize: 16, fontWeight: 600 }}>{pat}</div>
                        <Badge tone="success">×{count}</Badge>
                      </div>
                      <div className="flex items-start gap-2 text-on-surface-variant mt-2" style={{ fontSize: 14 }}><Icon name="flare" className="text-primary !text-base shrink-0" />{res}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AppWindow>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- Shot 10: release agent (multi-region rollout) ---------------- */
const REGIONS = ['us-east-1', 'eu-west-1', 'ap-south-1'];
const FAIL_REGION = 1; // eu-west-1 fails startup/sanity (degraded scenario)

function relState(frame: number, start: number, doneAt: number, fail: boolean): 'pending' | 'running' | 'done' | 'failed' {
  if (frame < start) return 'pending';
  if (frame < doneAt) return 'running';
  return fail ? 'failed' : 'done';
}
function RelStep({ label, state, frame, start, doneAt }: { label: string; state: string; frame: number; start: number; doneAt: number }) {
  const spin = interpolate(frame, [start, doneAt], [0, 360]);
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ fontSize: 14 }}>
      {state === 'done' ? <Icon name="check_circle" className="text-tertiary !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
        : state === 'failed' ? <Icon name="cancel" className="text-error !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
        : state === 'running' ? <Icon name="progress_activity" className="text-primary !text-lg" style={{ transform: `rotate(${spin}deg)` }} />
        : <Icon name="radio_button_unchecked" className="text-outline-variant !text-lg" />}
      <span className={state === 'pending' ? 'text-on-surface-variant/60' : state === 'failed' ? 'text-error' : 'text-on-surface'}>{label}</span>
    </div>
  );
}

const ReleaseShot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const winY = interpolate(frame, [14, 42], [150, 0], OUT);
  const winO = interpolate(frame, [14, 40], [0, 1], OUT);
  const runClick = 48;
  const preDeploy = relState(frame, 56, 82, false);
  const reportAt = 214;
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center' }}>
        <div style={{ ...fadeUp(frame, 4, 14), fontSize: 52, fontWeight: 700, color: '#fff', fontFamily: "'Geist', sans-serif", letterSpacing: '-0.03em' }}>Ship to every region — with a safety net.</div>
      </div>
      <div style={{ position: 'absolute', top: 176, left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{ transform: `translateY(${winY}px)`, opacity: winO }}>
          <AppWindow width={1560} height={812}>
            <div style={{ position: 'relative', width: 1560, height: 760, padding: '28px 40px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <div className="flex items-center gap-3">
                  <Icon name="rocket_launch" className="text-primary !text-2xl" />
                  <span className="font-heading text-on-surface" style={{ fontSize: 24 }}>Rolling out payment-service v1.4.0</span>
                </div>
                <div style={{ transform: `scale(${frame >= runClick && frame < runClick + 9 ? 0.95 : 1})` }}>
                  <Button className="!text-sm !px-5 !py-2.5">{frame < runClick + 4 ? <><Icon name="rocket_launch" className="!text-sm" /> Run Release</> : <><Icon name="sync" className="!text-sm" style={{ transform: `rotate(${interpolate(frame, [runClick, reportAt], [0, 1440])}deg)` }} /> Releasing</>}</Button>
                </div>
              </div>

              {frame >= 56 && (
                <div className="flex items-center gap-2" style={{ fontSize: 15, marginBottom: 16, ...fadeUp(frame, 56, 8) }}>
                  {preDeploy === 'done' ? <Icon name="check_circle" className="text-tertiary !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} /> : <Icon name="progress_activity" className="text-primary !text-lg" style={{ transform: `rotate(${interpolate(frame, [56, 82], [0, 360])}deg)` }} />}
                  <span className="text-on-surface">Pre-deploy checks (AWS config, policy)</span>
                </div>
              )}

              {frame >= 86 && (
                <div className="grid grid-cols-3 gap-4" style={fadeUp(frame, 86, 10)}>
                  {REGIONS.map((r, i) => {
                    const fail = i === FAIL_REGION;
                    const deploy = relState(frame, 86, 102 + i * 8, false);
                    const startup = relState(frame, 120, 140 + i * 8, fail);
                    const sanity = relState(frame, 158, 178 + i * 8, fail);
                    return (
                      <div key={r} className="rounded-xl border border-outline-variant/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon name="public" className="text-primary !text-lg" />
                          <span className="font-mono text-on-surface" style={{ fontSize: 15 }}>{r}</span>
                        </div>
                        <RelStep label="Deploy pipeline" state={deploy} frame={frame} start={86} doneAt={102 + i * 8} />
                        <RelStep label="Startup logs" state={startup} frame={frame} start={120} doneAt={140 + i * 8} />
                        <RelStep label="Sanity checks" state={sanity} frame={frame} start={158} doneAt={178 + i * 8} />
                      </div>
                    );
                  })}
                </div>
              )}

              {frame >= reportAt && (
                <div className="rounded-xl p-5 mt-6 flex items-center gap-4 bg-[#fbbc04]/5 border border-[#fbbc04]/30" style={popIn(frame, fps, reportAt)}>
                  <Icon name="warning" className="!text-3xl" style={{ color: '#9a7400', fontVariationSettings: "'FILL' 1" }} />
                  <div className="flex-1">
                    <div className="font-heading text-on-surface" style={{ fontSize: 22 }}>Partial — 2/3 regions healthy</div>
                    <div className="text-on-surface-variant" style={{ fontSize: 15 }}>eu-west-1 failed its startup health gate (redis-cart connection refused) and was automatically rolled back.</div>
                  </div>
                  <Badge tone="warning" className="!text-xs">payment-service v1.4.0</Badge>
                </div>
              )}
              <Cursor path={[{ f: 0, x: 1200, y: 200 }, { f: 42, x: 1420, y: 56 }, { f: runClick, x: 1420, y: 56 }, { f: 300, x: 1420, y: 56 }]} clicks={[runClick]} />
            </div>
          </AppWindow>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- assembled cinematic composition ---------------- */
export const LandingToOnboarding: React.FC = () => {
  const slideIn = springTiming({ config: { damping: 200 }, durationInFrames: 30 });
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
        <TransitionSeries.Sequence durationInFrames={290}>
          <OnboardingShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={420}>
          <ContextRepoShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={320}>
          <ChatShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={320}>
          <RcaShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={200}>
          <SkillShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={190}>
          <SkillsTabShot />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={slideIn} />
        <TransitionSeries.Sequence durationInFrames={310}>
          <ReleaseShot />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
