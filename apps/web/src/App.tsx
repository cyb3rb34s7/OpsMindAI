import { useState } from 'react'
import Landing from './Landing'
import Login from './Login'
import AppShell, { type Section } from './AppShell'

type View = 'landing' | 'login' | 'app'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [section, setSection] = useState<Section>('home')
  // A single demo tenant; the backend threads customer_id through everything.
  const customerId = 'acme'

  // Landing CTAs go through the login screen first, remembering where to land.
  const goLogin = (s: Section = 'home') => {
    setSection(s)
    setView('login')
  }

  return (
    <div key={view} className="animate-page">
      {view === 'landing' && <Landing onEnter={goLogin} />}
      {view === 'login' && <Login onAuthed={() => setView('app')} onBack={() => setView('landing')} />}
      {view === 'app' && (
        <AppShell customerId={customerId} section={section} setSection={setSection} onExit={() => setView('landing')} />
      )}
    </div>
  )
}
