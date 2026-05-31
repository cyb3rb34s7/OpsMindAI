import { useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner } from '../ui'
import { runOnboarding, type OnboardingReport, type ContextRepoResult, type OnboardingSources } from '../api'

const STEPS = ['Connecting to source', 'Scanning files', 'Reading provided context', 'Synthesizing intelligence', 'Committing context repo']

const DEMO: OnboardingSources = {
  repo_url: 'https://github.com/GoogleCloudPlatform/microservices-demo',
  business_context:
    'Online Boutique is our flagship e-commerce storefront. Checkout availability directly affects revenue and is the most SLA-critical path; the cart must survive pod restarts.',
  decisions:
    'ADR-003: gRPC between services for typed contracts and low latency.\nADR-009: cart state externalized to Redis so cartservice stays stateless and horizontally scalable.\nADR-014: each service owns its Dockerfile; deploys are gated through Skaffold + Kustomize per environment.',
  transcripts:
    'Standup 05-28: flagged redis-cart as a single point of failure for checkout — if it drops, carts fail and checkout aborts. Owner: Maya.\nIncident 05-26: brief redis-cart connection drop caused a checkout error spike for ~2 minutes.',
  extra_docs:
    'Runbook: if checkout errors spike, first check redis-cart connectivity and the cartservice pod, then restart redis-cart if connections are refused. On-call: #boutique-sre.',
}

type Field = { key: keyof OnboardingSources; label: string; icon: string; placeholder: string; multiline?: boolean }
const FIELDS: Field[] = [
  { key: 'repo_url', label: 'GitHub repository', icon: 'link', placeholder: 'https://github.com/owner/repo' },
  { key: 'business_context', label: 'Business context', icon: 'business_center', placeholder: 'What does this system do? Who depends on it when it breaks?', multiline: true },
  { key: 'decisions', label: 'Decision records (ADRs)', icon: 'rule', placeholder: 'Key architecture/operational decisions and rationale…', multiline: true },
  { key: 'transcripts', label: 'Transcripts', icon: 'forum', placeholder: 'Standup / incident / Slack notes…', multiline: true },
  { key: 'extra_docs', label: 'Other docs / runbooks', icon: 'description', placeholder: 'Anything else operationally relevant…', multiline: true },
]

export default function Onboarding({ customerId, onViewContext }: { customerId: string; onViewContext?: () => void }) {
  const [sources, setSources] = useState<OnboardingSources>({ repo_url: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<OnboardingReport | null>(null)
  const [ctx, setCtx] = useState<ContextRepoResult | null>(null)
  const [cached, setCached] = useState(false)

  const set = (k: keyof OnboardingSources, v: string) => setSources((s) => ({ ...s, [k]: v }))

  async function run(force = false) {
    setLoading(true)
    setError(null)
    setReport(null)
    setCtx(null)
    try {
      const res = await runOnboarding(customerId, sources, force)
      setReport(res.data.report)
      setCtx(res.data.context_repo)
      setCached(Boolean(res.data.cached))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-headline-md font-heading mb-1">Onboarding Agent</h1>
          <p className="text-on-surface-variant max-w-2xl">
            Connect a repo and paste any context that isn't in the code — decisions, transcripts, business context. The
            agent consolidates all of it into a structured context repo on GitHub.
          </p>
        </div>
        <Button variant="ghost" onClick={() => setSources(DEMO)}>
          <Icon name="auto_fix_high" className="!text-sm" /> Prefill demo data
        </Button>
      </div>

      <Card className="p-5 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant flex items-center gap-1.5">
              <Icon name={f.icon} className="!text-sm text-primary" /> {f.label}
              {f.key !== 'repo_url' && <span className="text-on-surface-variant/50 normal-case tracking-normal">· optional</span>}
            </label>
            {f.multiline ? (
              <textarea
                value={(sources[f.key] as string) || ''}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
              />
            ) : (
              <div className="flex items-center gap-2 mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 focus-within:border-primary">
                <Icon name="link" className="text-on-surface-variant !text-lg" />
                <input
                  value={(sources[f.key] as string) || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="flex-1 bg-transparent py-2.5 outline-none font-mono text-sm text-on-surface"
                />
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-end pt-1">
          <Button onClick={() => run(false)} disabled={loading || !sources.repo_url.trim()}>
            {loading ? <Icon name="sync" className="animate-spin !text-sm" /> : <Icon name="bolt" className="!text-sm" />}
            {loading ? 'Discovering' : 'Initialize Discovery'}
          </Button>
        </div>
      </Card>

      {loading && (
        <Card className="p-6">
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3 text-sm">
                <Icon name="progress_activity" className="animate-spin text-primary" style={{ animationDelay: `${i * 0.2}s` }} />
                <span className="text-on-surface-variant">{s}…</span>
              </div>
            ))}
            <p className="text-xs text-on-surface-variant/60 font-mono mt-2">Running live agent on Groq — real GitHub scan + commit, ~10–20s.</p>
          </div>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {report && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="success"><Icon name="check_circle" className="!text-xs" /> Onboarding complete</Badge>
              {cached && <Badge tone="neutral"><Icon name="bolt" className="!text-xs" /> cached</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => run(true)} disabled={loading}>
                <Icon name="sync" className={`!text-sm ${loading ? 'animate-spin' : ''}`} /> Re-scan live
              </Button>
              {onViewContext && (
                <Button onClick={onViewContext}>
                  <Icon name="menu_book" className="!text-sm" /> Open Context Repo
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card className="lg:col-span-2 p-0 overflow-hidden">
            <CardHeader icon="account_tree" title={`Context: ${report.repo_name}`} right={<Badge tone="success">Analysis Complete</Badge>} />
            <div className="p-5 space-y-5">
              <p className="text-sm text-on-surface leading-relaxed">{report.architecture_summary}</p>

              {report.business_context && (
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-1.5"><Icon name="business_center" className="!text-sm text-primary" /> Business Context</div>
                  <p className="text-sm text-on-surface bg-primary-container/10 border border-primary/10 rounded-lg p-3">{report.business_context}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Tech Stack</div>
                  <div className="flex flex-wrap gap-2">{report.tech_stack.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</div>
                </div>
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Services</div>
                  <div className="flex flex-wrap gap-2">{report.services.length ? report.services.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-sm text-on-surface-variant">—</span>}</div>
                </div>
              </div>

              {report.components.length > 0 && (
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-1.5"><Icon name="lan" className="!text-sm text-primary" /> Components ({report.components.length})</div>
                  <div className="overflow-x-auto rounded-lg border border-outline-variant/30">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-container text-on-surface-variant text-[11px] uppercase font-mono">
                        <tr>
                          <th className="text-left px-3 py-2">Component</th>
                          <th className="text-left px-3 py-2">Tech</th>
                          <th className="text-left px-3 py-2">Depends on</th>
                          <th className="text-left px-3 py-2">Store</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.components.map((c) => (
                          <tr key={c.name} className="border-t border-outline-variant/20">
                            <td className="px-3 py-2 font-mono text-xs text-on-surface">{c.name}</td>
                            <td className="px-3 py-2 text-on-surface-variant">{c.tech || '—'}</td>
                            <td className="px-3 py-2 text-on-surface-variant text-xs">{c.dependencies.join(', ') || '—'}</td>
                            <td className="px-3 py-2">{c.data_store ? <Badge tone="primary">{c.data_store}</Badge> : <span className="text-on-surface-variant">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {report.data_flows.length > 0 && (
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-1.5"><Icon name="sync_alt" className="!text-sm text-primary" /> Data Flows</div>
                  <div className="space-y-1.5">
                    {report.data_flows.map((d) => (
                      <div key={d} className="font-mono text-xs bg-surface-container-low border border-outline-variant/30 rounded px-3 py-2 text-on-surface">{d}</div>
                    ))}
                  </div>
                </div>
              )}

              {report.key_decisions.length > 0 && (
                <div>
                  <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-1.5"><Icon name="rule" className="!text-sm text-primary" /> Key Decisions</div>
                  <ul className="space-y-1.5">
                    {report.key_decisions.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm"><Icon name="arrow_right" className="text-primary !text-base shrink-0" />{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Open Questions for Humans</div>
                <ul className="space-y-1.5">
                  {report.open_questions.map((q) => (
                    <li key={q} className="flex items-start gap-2 text-sm"><Icon name="help" className="text-primary !text-base shrink-0 mt-0.5" />{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Card className="p-5">
              <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-3 flex items-center gap-2"><Icon name="commit" className="text-primary !text-base" /> Context Repository</div>
              {ctx?.context_repo_url ? (
                <>
                  <a href={ctx.context_repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline break-all">
                    <Icon name="open_in_new" className="!text-base" />{ctx.context_repo_full_name}
                  </a>
                  <div className="mt-3 space-y-1">
                    {(ctx.committed_files ?? []).map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs font-mono text-on-surface-variant"><Icon name="description" className="!text-sm text-tertiary" />{f}</div>
                    ))}
                  </div>
                  <Badge tone="success" className="mt-3">{(ctx.committed_files ?? []).length} files committed to GitHub</Badge>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">Committed locally (no GitHub token configured).</p>
              )}
            </Card>
            {report.risks.length > 0 && (
              <Card className="p-5">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="gpp_maybe" className="text-error !text-base" /> Operational Risks</div>
                <ul className="space-y-1.5">{report.risks.map((r, i) => <li key={i} className="flex items-start gap-2 text-xs text-on-surface-variant"><Icon name="priority_high" className="!text-sm text-error shrink-0" />{r}</li>)}</ul>
              </Card>
            )}
            {report.warnings.length > 0 && (
              <Card className="p-5">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="warning" className="text-[#9a7400] !text-base" /> Agent Warnings</div>
                <ul className="space-y-1.5">{report.warnings.map((w, i) => <li key={i} className="text-xs text-on-surface-variant">{w}</li>)}</ul>
              </Card>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}
