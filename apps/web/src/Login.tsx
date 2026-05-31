import { useEffect, useState } from 'react'
import { Icon } from './ui'

const STEPS = [
  { icon: 'lock', label: 'Authenticating with GitHub', done: 'Identity verified' },
  { icon: 'hub', label: 'Connecting your repositories', done: 'Repositories linked' },
  { icon: 'workspaces', label: 'Provisioning your workspace', done: 'Workspace ready' },
]

export default function Login({ onAuthed, onBack }: { onAuthed: () => void; onBack: () => void }) {
  const [connecting, setConnecting] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!connecting) return
    if (step >= STEPS.length) {
      const t = setTimeout(onAuthed, 650)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(t)
  }, [connecting, step, onAuthed])

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-15 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.png')" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background z-0" />

      <button onClick={onBack} className="absolute top-6 left-6 z-10 flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm">
        <Icon name="arrow_back" className="!text-base" /> Back to site
      </button>

      <div className="relative z-10 w-full max-w-md mx-6 animate-scale-in">
        <div className="bento-card p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Icon name="hub" className="text-primary !text-2xl" style={{ fontVariationSettings: "'FILL' 1" }} />
            </div>
            <h1 className="text-headline-sm font-heading">Sign in to OpsMindAI</h1>
            <p className="text-sm text-on-surface-variant mt-1">Your autonomous DevOps workspace</p>
          </div>

          {!connecting ? (
            <div className="space-y-4 animate-page">
              <button
                onClick={() => setConnecting(true)}
                className="w-full bg-[#1f2328] text-white rounded-lg py-3 px-4 flex items-center justify-center gap-3 hover:bg-[#2c333a] transition-colors font-medium"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>

              <div className="flex items-center gap-3 text-xs text-on-surface-variant/60">
                <div className="flex-1 h-px bg-outline-variant/40" /> or <div className="flex-1 h-px bg-outline-variant/40" />
              </div>

              <input disabled placeholder="you@company.com" className="w-full bg-surface-container-low/60 border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface-variant/50 cursor-not-allowed" />
              <button disabled className="w-full bg-surface-variant/50 text-on-surface-variant/50 rounded-lg py-2.5 text-sm cursor-not-allowed">
                Continue with email
              </button>

              <p className="text-center text-xs text-on-surface-variant/60 pt-2">
                <Icon name="bolt" className="!text-xs text-primary align-middle" /> Demo account — no credentials needed. You'll be signed in as <span className="font-mono text-on-surface">acme</span>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {STEPS.map((s, i) => {
                const state = step > i ? 'done' : step === i ? 'active' : 'pending'
                return (
                  <div
                    key={s.label}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      state === 'active'
                        ? 'border-primary/40 bg-primary-container/10 animate-row-in'
                        : state === 'done'
                          ? 'border-tertiary/30 bg-tertiary-container/10'
                          : 'border-outline-variant/20 opacity-50'
                    }`}
                  >
                    <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                      {state === 'active' && <span className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-ring" />}
                      <Icon
                        name={state === 'done' ? 'check_circle' : s.icon}
                        className={`!text-lg ${state === 'done' ? 'text-tertiary' : state === 'active' ? 'text-primary' : 'text-outline'}`}
                        style={state === 'done' ? { fontVariationSettings: "'FILL' 1" } : undefined}
                      />
                    </div>
                    <span className={`text-sm ${state === 'pending' ? 'text-on-surface-variant' : 'text-on-surface font-medium'}`}>
                      {state === 'done' ? s.done : s.label}
                      {state === 'active' && <span className="text-on-surface-variant">…</span>}
                    </span>
                  </div>
                )
              })}
              <div className="h-1 bg-surface-variant rounded-full overflow-hidden mt-4">
                <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (step / STEPS.length) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-label-sm font-mono uppercase tracking-wider text-on-surface-variant/50 mt-6">
          Kinetic Operational Intelligence
        </p>
      </div>
    </div>
  )
}
