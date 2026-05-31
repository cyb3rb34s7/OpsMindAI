import { useState } from 'react'
import Landing from './Landing'
import AppShell, { type Section } from './AppShell'

export default function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing')
  const [section, setSection] = useState<Section>('onboarding')
  // A single demo tenant; the backend threads customer_id through everything.
  const customerId = 'acme'

  const enterApp = (s: Section = 'onboarding') => {
    setSection(s)
    setView('app')
  }

  if (view === 'app') {
    return (
      <AppShell
        customerId={customerId}
        section={section}
        setSection={setSection}
        onExit={() => setView('landing')}
      />
    )
  }
  return <Landing onEnter={enterApp} />
}
