import { useEffect, useState } from 'react'
import { Icon } from './ui'
import { getContext } from './api'
import Home from './views/Home'
import Onboarding from './views/Onboarding'
import ContextRepo from './views/ContextRepo'
import Incident from './views/Incident'
import Release from './views/Release'
import Knowledge from './views/Knowledge'

export type Section = 'home' | 'onboarding' | 'context' | 'incident' | 'release' | 'knowledge'

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'home', label: 'Chat', icon: 'forum' },
  { key: 'onboarding', label: 'Onboarding', icon: 'rocket_launch' },
  { key: 'context', label: 'Context Repo', icon: 'menu_book' },
  { key: 'incident', label: 'Investigation', icon: 'psychology' },
  { key: 'release', label: 'Releases', icon: 'deployed_code' },
  { key: 'knowledge', label: 'Knowledge', icon: 'school' },
]

// Everything except onboarding itself needs a context repo first. Onboarding is
// the mandatory first step, so the rest is locked until it produces context.
const GATED: Section[] = ['home', 'context', 'incident', 'release', 'knowledge']

export default function AppShell({
  customerId,
  section,
  setSection,
  onExit,
}: {
  customerId: string
  section: Section
  setSection: (s: Section) => void
  onExit: () => void
}) {
  const [hasContext, setHasContext] = useState(false)

  // Probe for a context repo. If none, force the onboarding-first flow.
  useEffect(() => {
    let cancelled = false
    getContext(customerId)
      .then((r) => {
        if (cancelled) return
        setHasContext(r.exists)
        if (!r.exists && GATED.includes(section)) setSection('onboarding')
      })
      .catch(() => !cancelled && setHasContext(false))
    return () => {
      cancelled = true
    }
  }, [customerId, section, setSection])

  const isLocked = (key: Section) => GATED.includes(key) && !hasContext

  const go = (key: Section) => {
    if (isLocked(key)) {
      setSection('onboarding')
      return
    }
    setSection(key)
  }

  const onboarded = () => {
    setHasContext(true)
    setSection('home')
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r border-outline-variant/30 bg-surface flex flex-col sticky top-0 h-screen">
        <button onClick={onExit} className="px-5 py-5 flex items-center gap-2 border-b border-outline-variant/30 text-left">
          <Icon name="hub" className="text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="text-headline-sm font-heading font-bold tracking-tight">OpsMindAI</span>
        </button>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => {
            const locked = isLocked(n.key)
            return (
              <button
                key={n.key}
                onClick={() => go(n.key)}
                title={locked ? 'Onboard a repo first to unlock this' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  section === n.key
                    ? 'bg-primary-container/40 text-primary font-semibold'
                    : locked
                      ? 'text-on-surface-variant/40 hover:bg-surface-variant/30'
                      : 'text-on-surface-variant hover:bg-surface-variant/50'
                }`}
              >
                <Icon name={n.icon} className="!text-lg" />
                <span className="flex-1 text-left">{n.label}</span>
                {locked && <Icon name="lock" className="!text-sm" />}
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-outline-variant/30">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-on-surface-variant">
            <Icon name="account_circle" className="!text-lg" />
            <div>
              <div className="font-mono uppercase tracking-wide text-[10px]">Tenant</div>
              <div className="text-on-surface font-medium">{customerId}</div>
            </div>
          </div>
          <button onClick={onExit} className="w-full mt-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-variant/50">
            <Icon name="logout" className="!text-base" /> Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col h-screen">
        <header className="h-14 shrink-0 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Icon name="bolt" className="text-primary !text-base" />
            <span className="font-mono uppercase tracking-wide text-label-sm">{NAV.find((n) => n.key === section)?.label} Console</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="text-label-sm font-mono uppercase text-on-surface-variant">Live · Groq</span>
          </div>
        </header>

        {/* Chat is full-bleed (panel flush right); other consoles are constrained. */}
        {section === 'home' ? (
          <div key="home" className="flex-1 min-h-0 px-6 py-5 animate-page">
            <Home customerId={customerId} />
          </div>
        ) : (
          <div key={section} className="flex-1 overflow-y-auto p-6 animate-page">
            <div className="max-w-[1200px] mx-auto">
              {section === 'onboarding' && <Onboarding customerId={customerId} onViewContext={() => setSection('context')} onOnboarded={onboarded} />}
              {section === 'context' && <ContextRepo customerId={customerId} />}
              {section === 'incident' && <Incident customerId={customerId} />}
              {section === 'release' && <Release customerId={customerId} />}
              {section === 'knowledge' && <Knowledge customerId={customerId} />}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
