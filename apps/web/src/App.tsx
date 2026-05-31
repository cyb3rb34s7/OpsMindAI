import { useMemo, useState } from 'react'
import Landing from './Landing'
import Login from './Login'
import AppShell, { type Section } from './AppShell'

type View = 'landing' | 'login' | 'app'

export default function App() {
  // Persist auth across refreshes so you stay logged in (and don't re-onboard).
  const [view, setView] = useState<View>(() =>
    sessionStorage.getItem('opsmind_authed') === '1' ? 'app' : 'landing',
  )
  const [section, setSection] = useState<Section>('home')
  // A fresh demo tenant per browser session, so each demo starts un-onboarded
  // (onboarding-first + gating are visible). Persists across refreshes in the
  // same tab; a new tab / cleared storage starts clean.
  const customerId = useMemo(() => {
    const KEY = 'opsmind_tenant'
    let id = sessionStorage.getItem(KEY)
    if (!id) {
      id = 'acme-' + Math.random().toString(36).slice(2, 6)
      sessionStorage.setItem(KEY, id)
    }
    return id
  }, [])

  // Landing CTAs go through the login screen first, remembering where to land.
  const goLogin = (s: Section = 'home') => {
    setSection(s)
    setView('login')
  }

  const onAuthed = () => {
    sessionStorage.setItem('opsmind_authed', '1')
    setView('app')
  }
  const onExit = () => {
    sessionStorage.removeItem('opsmind_authed')
    setView('landing')
  }

  return (
    <div key={view} className="animate-page">
      {view === 'landing' && <Landing onEnter={goLogin} />}
      {view === 'login' && <Login onAuthed={onAuthed} onBack={() => setView('landing')} />}
      {view === 'app' && (
        <AppShell customerId={customerId} section={section} setSection={setSection} onExit={onExit} />
      )}
    </div>
  )
}
