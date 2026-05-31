import { useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner, Terminal } from '../ui'
import { runRCA, type RCAReport, type Skill } from '../api'

export default function Incident({ customerId }: { customerId: string }) {
  const [traceId, setTraceId] = useState('trace_123')
  const [description, setDescription] = useState('Checkout failing intermittently in production')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RCAReport | null>(null)
  const [applied, setApplied] = useState<Skill[]>([])
  const [learned, setLearned] = useState<Skill | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await runRCA(customerId, traceId.trim(), description.trim())
      setReport(res.data.report)
      setApplied(res.data.applied_skills || [])
      setLearned(res.data.learned_skill || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const confidencePct = report ? Math.round(report.confidence * 100) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">RCA Agent</h1>
        <p className="text-on-surface-variant">
          Give the agent an incident trace. It correlates logs across services, pinpoints where it broke, and applies
          skills learned from past incidents.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Trace ID</label>
            <input value={traceId} onChange={(e) => setTraceId(e.target.value)} className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 font-mono text-sm outline-none focus:border-primary" />
            <div className="flex gap-2 mt-2">
              {['trace_123', 'trace_456'].map((t) => (
                <button key={t} onClick={() => setTraceId(t)} className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-variant/60 hover:bg-surface-variant text-on-surface-variant">{t}</button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Incident description</label>
            <div className="flex gap-3 mt-2">
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary" />
              <Button onClick={run} disabled={loading || !traceId.trim()}>
                {loading ? <Icon name="sync" className="animate-spin !text-sm" /> : <Icon name="psychology" className="!text-sm" />}
                {loading ? 'Investigating' : 'Investigate'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {report && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Trace timeline */}
          <Card className="lg:col-span-7 p-0 overflow-hidden">
            <CardHeader icon="timeline" title="Correlated Trace Timeline" right={<Badge tone="neutral">{traceId}</Badge>} />
            <div className="p-5">
              <Terminal>
                {report.trace_flow.map((line, i) => {
                  const isError = /error|timeout|drop|exhaust|fail/i.test(line)
                  return (
                    <div key={i} className={`flex gap-2 py-0.5 ${isError ? 'text-[#ff7b72]' : 'text-[#c9d1d9]'}`}>
                      <span className="text-[#6e7681] select-none">{String(i + 1).padStart(2, '0')}</span>
                      <span>{line}</span>
                      {isError && <Icon name="error" className="!text-sm text-error ml-auto" />}
                    </div>
                  )
                })}
              </Terminal>
              <div className="mt-4 flex flex-wrap gap-2">
                {report.impacted_services.map((s) => <Badge key={s} tone="neutral"><Icon name="lan" className="!text-xs" />{s}</Badge>)}
              </div>
            </div>
          </Card>

          {/* RCA verdict */}
          <Card className="lg:col-span-5 p-0 overflow-hidden">
            <CardHeader icon="psychology" title="Root Cause Analysis" right={<Badge tone="error"><span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />Resolved</Badge>} />
            <div className="p-5 space-y-4">
              <div>
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-1">Root Cause</div>
                <h4 className="text-headline-sm font-heading leading-tight">{report.root_cause}</h4>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-mono uppercase text-on-surface-variant">Confidence</span>
                  <span className="font-mono">{confidencePct}%</span>
                </div>
                <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${confidencePct >= 70 ? 'bg-tertiary' : 'bg-[#fbbc04]'}`} style={{ width: `${confidencePct}%` }} />
                </div>
              </div>
              <div className="bg-primary-container/10 p-4 rounded-xl border border-primary/10">
                <div className="text-label-sm font-mono text-primary mb-2 uppercase tracking-wide flex items-center gap-2"><Icon name="flare" className="!text-sm" />Recommended Actions</div>
                <ul className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm"><Icon name="arrow_right" className="text-primary !text-base shrink-0" />{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          {/* Self-improvement banner */}
          <Card className="lg:col-span-12 p-5">
            <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-tertiary-container/40 text-tertiary flex items-center justify-center"><Icon name="school" /></div>
                <div>
                  <div className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Self-Improving Memory</div>
                  {applied.length > 0 ? (
                    <div className="text-sm">
                      Applied a learned skill: <span className="font-medium">{applied[0].failure_pattern}</span>{' '}
                      <Badge tone="success">seen {applied[0].success_count}×</Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-on-surface-variant">First time seeing this pattern — saved as a new skill for next time.</div>
                  )}
                </div>
              </div>
              {learned && (
                <Badge tone="primary"><Icon name="bookmark_added" className="!text-xs" />Skill memory now holds “{learned.failure_pattern}” (×{learned.success_count})</Badge>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
