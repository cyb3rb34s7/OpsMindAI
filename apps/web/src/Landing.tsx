import { useEffect, useState } from 'react'
import { Icon, Button, Badge } from './ui'
import type { Section } from './AppShell'

function TopNav({ onEnter }: { onEnter: (s?: Section) => void }) {
  const links: { label: string; section: Section }[] = [
    { label: 'Intelligence', section: 'onboarding' },
    { label: 'Investigation', section: 'incident' },
    { label: 'Releases', section: 'release' },
    { label: 'Knowledge', section: 'knowledge' },
  ]
  return (
    <header className="bg-surface/80 backdrop-blur-xl sticky top-0 z-50 border-b border-outline-variant/30">
      <div className="max-w-[1440px] mx-auto px-6 flex justify-between items-center py-4">
        <div className="flex items-center gap-8">
          <a className="text-headline-sm font-heading font-bold tracking-tight text-on-surface flex items-center gap-2">
            <Icon name="hub" className="text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
            OpsMindAI
          </a>
          <nav className="hidden md:flex gap-6">
            {links.map((l, i) => (
              <button
                key={l.label}
                onClick={() => onEnter(l.section)}
                className={`text-label-sm font-mono uppercase tracking-wide pb-1 transition-colors ${
                  i === 0
                    ? 'text-primary font-bold border-b-2 border-primary'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {l.label}
              </button>
            ))}
          </nav>
        </div>
        <Button onClick={() => onEnter('onboarding')}>Launch Console</Button>
      </div>
    </header>
  )
}

const STEP_LABELS = ['Connecting to Source', 'Ingesting Files', 'Synthesizing Intelligence', 'Context Repository']

function HeroSequencer() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const delays = [2500, 3500, 4000, 6000]
    const t = setTimeout(() => setStep((s) => (s + 1) % 4), delays[step])
    return () => clearTimeout(t)
  }, [step])

  return (
    <div className="w-full max-w-3xl h-[350px] glass-panel rounded-2xl shadow-2xl flex items-center justify-center relative overflow-hidden float-1 border border-outline-variant/40">
      {/* Step 0: connecting */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${step === 0 ? 'opacity-100' : 'opacity-0 scale-95'}`}>
        <div className="flex items-center gap-8 text-on-surface">
          <Icon name="hub" className="!text-6xl text-primary" />
          <div className="h-1 w-32 bg-outline-variant/30 relative overflow-hidden rounded-full">
            <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-primary rounded-full animate-flow-right" />
          </div>
          <Icon name="account_tree" className="!text-5xl text-on-surface-variant" />
        </div>
        <p className="mt-8 text-label-sm font-mono uppercase tracking-widest text-primary font-bold">Connecting to Source Repository</p>
      </div>
      {/* Step 1: ingesting */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ${step === 1 ? 'opacity-100' : 'opacity-0 scale-95'}`}>
        <h3 className="text-label-sm font-mono uppercase tracking-widest text-on-surface mb-6 font-bold flex items-center gap-2">
          <Icon name="sync" className="!text-sm animate-spin" /> Ingesting Files…
        </h3>
        <div className="w-72 bg-surface-container-lowest/60 border border-outline-variant/30 rounded-lg p-4 font-mono text-xs text-on-surface space-y-1">
          <div className="text-outline">reading main.ts…</div>
          <div className="text-primary">parsing auth-service.js…</div>
          <div className="text-tertiary">indexing components/App.tsx…</div>
          <div className="text-on-surface-variant">analyzing docker-compose.yml…</div>
        </div>
        <div className="w-72 h-1.5 bg-surface-variant rounded-full mt-5 overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-flow-right" style={{ width: '60%' }} />
        </div>
      </div>
      {/* Step 2: synthesizing */}
      <div className={`absolute inset-0 flex flex-row items-center justify-center gap-8 transition-all duration-700 p-8 ${step === 2 ? 'opacity-100' : 'opacity-0 scale-95'}`}>
        <div className="flex flex-col items-center w-1/3">
          <Icon name="psychology" className="!text-7xl text-primary animate-pulse-glow" />
          <p className="mt-4 text-label-sm font-mono uppercase tracking-widest text-primary font-bold text-center">Synthesizing Intelligence</p>
        </div>
        <div className="w-2/3 h-[220px] bg-[#0c0c0e] rounded-xl border border-outline-variant/30 p-4 font-mono text-xs flex flex-col justify-end overflow-hidden">
          <div className="space-y-2">
            <p className="text-tertiary opacity-60">&gt; Initializing agent…</p>
            <p className="text-outline-variant">&gt; Loading codebase context [142 files]</p>
            <p className="text-primary-fixed-dim animate-pulse">&gt; Analyzing architecture patterns…</p>
            <p className="text-[#c9d1d9]">&gt; Mapping dependencies…</p>
            <p className="text-[#c9d1d9] flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-ping" /> Building context graph
            </p>
          </div>
        </div>
      </div>
      {/* Step 3: context repo */}
      <div className={`absolute inset-0 flex flex-col transition-all duration-700 bg-surface/90 ${step === 3 ? 'opacity-100' : 'opacity-0 scale-95'}`}>
        <div className="border-b border-outline-variant/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="account_tree" className="text-primary" />
            <h3 className="text-label-sm font-mono text-on-surface font-bold uppercase tracking-wider">Context Repository</h3>
          </div>
          <Badge tone="success">Analysis Complete</Badge>
        </div>
        <div className="flex-grow p-4 flex flex-col gap-2">
          {[
            ['folder', '/src/auth', 'Handles JWT verification, OAuth flow, and session state.'],
            ['folder', '/infrastructure', 'Terraform configs for EKS cluster and Redis cache.'],
            ['description', 'main.go', 'Service entrypoint. Initializes Gin router and DB conn.'],
          ].map(([icon, path, desc]) => (
            <div key={path} className="flex items-center justify-between p-3 bg-surface rounded border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <Icon name={icon} className="text-outline-variant !text-lg" />
                <span className="font-mono text-on-surface font-medium text-sm">{path}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant max-w-[55%] truncate">
                <Icon name="auto_awesome" className="text-primary !text-[14px]" />
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* step indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {STEP_LABELS.map((_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant/40'}`} />
        ))}
      </div>
    </div>
  )
}

function SectionShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`py-24 ${className}`}>
      <div className="max-w-[1440px] mx-auto px-6">{children}</div>
    </section>
  )
}

export default function Landing({ onEnter }: { onEnter: (s?: Section) => void }) {
  return (
    <div className="min-h-screen">
      <TopNav onEnter={onEnter} />
      <main>
        {/* Hero */}
        <section className="relative pt-24 pb-20 overflow-hidden min-h-[88vh] flex flex-col justify-center">
          <div className="absolute inset-0 wireframe-bg opacity-30 z-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background z-0" />
          <div className="max-w-[1440px] mx-auto px-6 relative z-10 flex flex-col items-center text-center">
            <Badge tone="primary" className="mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> System Status: Operational
            </Badge>
            <h1 className="text-display-lg font-heading max-w-4xl mb-6 leading-tight">
              <span className="gradient-text">Engineered Intelligence</span>
              <br />
              for Modern Ops.
            </h1>
            <p className="text-body-lg font-body text-on-surface-variant max-w-2xl mb-10">
              A high-density operational platform that blends birds-eye architectural mapping with precise,
              low-level execution control — powered by autonomous DevOps agents.
            </p>
            <div className="flex gap-4 mb-20">
              <Button onClick={() => onEnter('onboarding')}>
                Initialize Discovery <Icon name="arrow_forward" className="!text-sm" />
              </Button>
              <Button variant="ghost" onClick={() => onEnter('incident')}>
                Investigate an Incident
              </Button>
            </div>
            <HeroSequencer />
          </div>
        </section>

        {/* Incident showcase */}
        <SectionShell className="relative overflow-hidden bg-surface-container-lowest">
          <div className="absolute inset-0 wireframe-bg opacity-20" />
          <div className="relative">
            <h2 className="text-headline-md font-heading mb-4">Incident Investigation Console</h2>
            <p className="text-body-lg font-body text-on-surface-variant max-w-3xl mb-12">
              Instantly surface root causes with an AI reasoning engine that correlates trace logs across services.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8 bento-card p-0 overflow-hidden min-h-[380px] flex flex-col">
                <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="hub" className="text-primary !text-sm" />
                    <span className="text-label-sm font-mono uppercase tracking-wider">Live Service Topography</span>
                  </div>
                  <Badge tone="error"><span className="w-1.5 h-1.5 rounded-full bg-error" /> Spike Detected</Badge>
                </div>
                <div className="flex-grow p-8 flex items-center">
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-8 relative">
                      <div className="absolute top-1/2 left-0 w-full border-t border-dashed border-outline-variant/40 -z-10" />
                      {[
                        ['public', 'Ingress', '100% OK', 'ok'],
                        ['payment', 'Payment Gateway', 'Timeout 504', 'err'],
                        ['database', 'Auth DB', '99.9% OK', 'ok'],
                      ].map(([icon, name, status, state]) => (
                        <div key={name} className={`glass-panel p-4 rounded-xl flex flex-col items-center gap-2 w-32 ${state === 'err' ? 'border-error/40' : ''}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${state === 'err' ? 'bg-error/10 text-error border border-error/30' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                            <Icon name={icon} />
                          </div>
                          <span className="text-[10px] font-mono uppercase text-center leading-tight">{name}</span>
                          <span className={`text-[9px] font-mono ${state === 'err' ? 'text-error' : 'text-tertiary'}`}>{status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[#0f1115] rounded-xl p-4 font-mono text-xs text-[#c9d1d9] relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-error/80" />
                      <div className="flex justify-between text-outline mb-3 border-b border-white/10 pb-2">
                        <span>TRACE: <span className="text-primary-fixed-dim">a8f9c21</span></span>
                        <span>10:42:03 UTC</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex gap-4"><span className="w-14 text-outline-variant">0.00ms</span><span className="text-tertiary">ingress</span>→<span>auth-service (OK)</span></div>
                        <div className="flex gap-4 bg-error/10 -mx-4 px-4 py-1"><span className="w-14 text-error">45.2ms</span><span className="text-error font-semibold">payment-gateway</span>→<span className="text-error">TIMEOUT</span></div>
                        <div className="flex gap-4"><span className="w-14 text-outline-variant">45.3ms</span><span>external-provider</span>→<span>CONN_REFUSED</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 bento-card p-0 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-outline-variant/30 flex items-center gap-2">
                  <Icon name="psychology" className="text-primary !text-sm" />
                  <span className="text-label-sm font-mono uppercase tracking-wider">AI Root Cause Analysis</span>
                </div>
                <div className="p-6 flex-grow flex flex-col gap-5">
                  <Badge tone="error"><span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" /> Anomaly Detected</Badge>
                  <h4 className="text-headline-sm font-heading leading-tight">Elevated error rates in checkout flow</h4>
                  <p className="text-body-md text-on-surface-variant">The payment-gateway service is failing to connect to the external API due to a spike in timeout responses.</p>
                  <div className="bg-primary-container/10 p-5 rounded-xl border border-primary/10 mt-auto">
                    <h4 className="text-label-sm font-mono text-primary mb-3 uppercase tracking-wide flex items-center gap-2"><Icon name="flare" className="!text-sm" /> Recommended Action</h4>
                    <p className="text-body-md mb-5">Scale payment-gateway replicas by 2, or trip the circuit breaker for non-critical paths.</p>
                    <Button className="w-full" onClick={() => onEnter('incident')}>Open Investigation Console <Icon name="arrow_forward" className="!text-sm" /></Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* Release showcase */}
        <SectionShell className="bg-surface">
          <h2 className="text-headline-md font-heading mb-4">Release Intelligence</h2>
          <p className="text-body-lg font-body text-on-surface-variant max-w-3xl mb-12">
            Deploy with confidence. Predictive risk assessment and automated health gates block bad releases before they reach users.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 bento-card p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-headline-sm font-heading flex items-center gap-2"><Icon name="rocket_launch" /> Deployment: v2.4.1-rc</h3>
                <Badge>In Progress</Badge>
              </div>
              <div className="relative flex justify-between items-center">
                <div className="absolute left-0 top-4 w-full h-0.5 bg-outline-variant/30 -z-10" />
                {[['check', 'Build', 'done'], ['check', 'Test', 'done'], ['hourglass_empty', 'Canary', 'active'], ['done_all', 'Production', 'pending']].map(([icon, label, state]) => (
                  <div key={label} className="flex flex-col items-center gap-2 bg-surface px-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface ${state === 'done' ? 'bg-tertiary text-on-tertiary' : state === 'active' ? 'bg-primary-container text-primary border-primary animate-pulse' : 'bg-surface-variant text-outline'}`}>
                      <Icon name={icon} className="!text-sm" />
                    </div>
                    <span className={`text-label-sm font-mono ${state === 'active' ? 'text-primary' : 'text-on-surface'}`}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-10 bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4">
                <h4 className="text-label-sm font-mono text-on-surface-variant uppercase mb-4">Canary Health Metrics</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-l-2 border-tertiary pl-3">
                    <div className="text-sm text-on-surface-variant mb-1">Error Rate vs Baseline</div>
                    <div className="text-headline-sm font-heading">0.02% <span className="text-tertiary text-sm">↓0.01%</span></div>
                  </div>
                  <div className="border-l-2 border-[#fbbc04] pl-3">
                    <div className="text-sm text-on-surface-variant mb-1">p99 Latency</div>
                    <div className="text-headline-sm font-heading">145ms <span className="text-[#9a7400] text-sm">↑12ms</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bento-card p-0 overflow-hidden bg-error-container/10 border-error/20 flex flex-col">
              <div className="p-6 border-b border-error/10 bg-surface">
                <div className="flex items-center gap-2 mb-2"><Icon name="gpp_maybe" className="text-error" /><span className="text-label-sm font-mono uppercase tracking-wider text-error">Risk Assessment</span></div>
                <div className="text-display-lg font-heading text-error">High</div>
                <p className="text-body-md text-on-surface-variant mt-1">Deployment blocked by AI policy.</p>
              </div>
              <div className="p-6 flex-grow flex flex-col justify-between">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2"><Icon name="cancel" className="text-error !text-base shrink-0" />Security group allows public database access.</li>
                  <li className="flex items-start gap-2"><Icon name="cancel" className="text-error !text-base shrink-0" />Missing env var OAUTH_CLIENT_SECRET.</li>
                </ul>
                <div className="mt-6"><Button variant="danger" className="w-full" onClick={() => onEnter('release')}>Open Release Console</Button></div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* Knowledge showcase */}
        <SectionShell className="bg-surface-container-lowest">
          <h2 className="text-headline-md font-heading mb-4">Operational Knowledge Graph</h2>
          <p className="text-body-lg font-body text-on-surface-variant max-w-3xl mb-12">
            Stop searching wikis. Every resolved incident becomes a reusable skill — the agent gets smarter with each one.
          </p>
          <div className="bento-card p-0 overflow-hidden">
            <button onClick={() => onEnter('knowledge')} className="w-full p-4 border-b border-outline-variant/30 bg-surface-variant/30 flex items-center gap-3 text-left">
              <Icon name="search" className="text-on-surface-variant" />
              <span className="text-body-lg font-body text-on-surface-variant/60">Ask anything: e.g., "How do we scale the redis cluster?"</span>
            </button>
            <div className="grid grid-cols-1 md:grid-cols-12">
              <div className="md:col-span-4 border-r border-outline-variant/30 bg-surface-container-low p-4 flex flex-col gap-2">
                <span className="text-label-sm font-mono text-on-surface-variant uppercase mb-2">Suggested Queries</span>
                {['"Recent deployments to production-eu"', '"Runbook for redis connection drop"', '"Who owns the billing-service?"'].map((q, i) => (
                  <button key={q} onClick={() => onEnter('knowledge')} className={`text-left p-3 rounded-lg text-sm transition-colors ${i === 1 ? 'bg-surface border border-outline-variant/30 shadow-sm' : 'hover:bg-surface-variant/50'}`}>{q}</button>
                ))}
              </div>
              <div className="md:col-span-8 bg-surface p-8">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0"><Icon name="hub" className="!text-sm" /></div>
                  <div>
                    <h3 className="text-headline-sm font-heading mb-4">Runbook: Redis Connection Recovery</h3>
                    <p className="text-on-surface-variant text-sm mb-4">Steps to recover from a redis connection drop during session lookup in the payment path — learned automatically from a prior incident.</p>
                    <div className="bg-surface-variant/30 border border-outline-variant/30 rounded p-4 font-mono text-xs">
                      <span className="text-outline"># restart the redis connection pool</span><br />
                      kubectl rollout restart deploy/payment-service -n prod
                    </div>
                    <div className="mt-5 flex gap-2">
                      <Badge>Learned by RCA agent</Badge>
                      <Badge>Reused 2×</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>
      </main>

      <footer className="bg-surface-container-lowest py-12 border-t border-outline-variant/30">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="text-headline-sm font-heading font-bold flex items-center gap-2 mb-2"><Icon name="hub" className="text-primary" /> OpsMindAI</div>
            <p className="text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">Kinetic Operational Intelligence.</p>
          </div>
          <Button onClick={() => onEnter('onboarding')}>Launch Console <Icon name="arrow_forward" className="!text-sm" /></Button>
        </div>
      </footer>
    </div>
  )
}
