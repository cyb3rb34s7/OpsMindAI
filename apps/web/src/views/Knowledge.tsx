import { useEffect, useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner, Spinner } from '../ui'
import { getSkills, runOrchestrator, type Skill } from '../api'

interface Routed {
  intent: string
  confidence: number
  reasoning: string
}

export default function Knowledge({ customerId }: { customerId: string }) {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loadingSkills, setLoadingSkills] = useState(true)
  const [query, setQuery] = useState('Our checkout is throwing 500s, can you investigate?')
  const [asking, setAsking] = useState(false)
  const [routed, setRouted] = useState<Routed | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadSkills() {
    setLoadingSkills(true)
    try {
      setSkills(await getSkills(customerId))
    } catch {
      /* ignore */
    } finally {
      setLoadingSkills(false)
    }
  }

  useEffect(() => {
    loadSkills()
  }, [customerId])

  async function ask() {
    setAsking(true)
    setError(null)
    setRouted(null)
    try {
      const res = await runOrchestrator(customerId, query.trim())
      setRouted(res.data.route.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Operational Knowledge Graph</h1>
        <p className="text-on-surface-variant">
          Ask in natural language — the orchestrator routes to the right agent. Every resolved incident becomes a reusable
          skill below.
        </p>
      </div>

      {/* Orchestrator ask */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 bg-surface-variant/30 flex items-center gap-3">
          <Icon name="search" className="text-on-surface-variant" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="Ask anything…"
            className="flex-1 bg-transparent text-body-lg outline-none placeholder-on-surface-variant/50"
          />
          <Button onClick={ask} disabled={asking || !query.trim()}>{asking ? 'Routing' : 'Ask'}</Button>
        </div>
        {(asking || routed || error) && (
          <div className="p-5">
            {asking && <Spinner label="Orchestrator classifying intent…" />}
            {error && <ErrorBanner message={error} />}
            {routed && (
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0"><Icon name="hub" className="!text-sm" /></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">Routed to</span>
                    <Badge tone="primary">{routed.intent} agent</Badge>
                    <span className="text-xs font-mono text-on-surface-variant">{Math.round(routed.confidence * 100)}% confident</span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{routed.reasoning}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Learned skills */}
      <Card className="p-0 overflow-hidden">
        <CardHeader
          icon="school"
          title="Learned Skills (SRE Playbook)"
          right={
            <button onClick={loadSkills} className="text-on-surface-variant hover:text-primary"><Icon name="refresh" className="!text-base" /></button>
          }
        />
        <div className="p-5">
          {loadingSkills ? (
            <Spinner label="Loading skills…" />
          ) : skills.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant">
              <Icon name="psychology_alt" className="!text-4xl opacity-40" />
              <p className="mt-2 text-sm">No skills yet. Run the RCA agent — each resolved incident is saved here and reused next time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {skills.map((s) => (
                <div key={s.id} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm leading-snug">{s.failure_pattern}</h4>
                    <Badge tone="success">×{s.success_count}</Badge>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-on-surface-variant">
                    <Icon name="flare" className="text-primary !text-base shrink-0 mt-0.5" />
                    {s.resolution}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Badge>via {s.agent_name}</Badge>
                    <Badge tone="primary">{Math.round(s.confidence * 100)}% conf</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
