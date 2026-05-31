import { Icon } from './ui'
import Onboarding from './views/Onboarding'
import ContextRepo from './views/ContextRepo'
import Incident from './views/Incident'
import Release from './views/Release'
import Knowledge from './views/Knowledge'

export type Section = 'onboarding' | 'context' | 'incident' | 'release' | 'knowledge'

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'onboarding', label: 'Onboarding', icon: 'rocket_launch' },
  { key: 'context', label: 'Context Repo', icon: 'menu_book' },
  { key: 'incident', label: 'Investigation', icon: 'psychology' },
  { key: 'release', label: 'Releases', icon: 'deployed_code' },
  { key: 'knowledge', label: 'Knowledge', icon: 'school' },
]

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
  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-outline-variant/30 bg-surface flex flex-col sticky top-0 h-screen">
        <button onClick={onExit} className="px-5 py-5 flex items-center gap-2 border-b border-outline-variant/30 text-left">
          <Icon name="hub" className="text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="text-headline-sm font-heading font-bold tracking-tight">OpsMindAI</span>
        </button>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                section === n.key
                  ? 'bg-primary-container/40 text-primary font-semibold'
                  : 'text-on-surface-variant hover:bg-surface-variant/50'
              }`}
            >
              <Icon name={n.icon} className="!text-lg" />
              {n.label}
            </button>
          ))}
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
            <Icon name="logout" className="!text-base" /> Back to site
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b border-outline-variant/30 bg-surface/80 backdrop-blur-xl sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-on-surface-variant text-sm">
            <Icon name="bolt" className="text-primary !text-base" />
            <span className="font-mono uppercase tracking-wide text-label-sm">{NAV.find((n) => n.key === section)?.label} Console</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
            <span className="text-label-sm font-mono uppercase text-on-surface-variant">Live · Groq</span>
          </div>
        </header>
        <div key={section} className="p-6 max-w-[1200px] mx-auto animate-page">
          {section === 'onboarding' && <Onboarding customerId={customerId} onViewContext={() => setSection('context')} />}
          {section === 'context' && <ContextRepo customerId={customerId} />}
          {section === 'incident' && <Incident customerId={customerId} />}
          {section === 'release' && <Release customerId={customerId} />}
          {section === 'knowledge' && <Knowledge customerId={customerId} />}
        </div>
      </main>
    </div>
  )
}
