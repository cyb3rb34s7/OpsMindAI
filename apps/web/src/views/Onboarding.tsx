import { useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner } from '../ui'
import { runOnboarding, type OnboardingReport, type ContextRepoResult, type OnboardingSources } from '../api'

const STEPS = ['Connecting to source', 'Scanning files', 'Reading provided context', 'Synthesizing intelligence', 'Committing context repo']

const DEMO: OnboardingSources = {
  repo_url: 'https://github.com/lootsblog/IntelliParse',
  business_context:
    'IntelliParse powers our enterprise document ingestion pipeline. Legal and compliance teams depend on it to convert contracts into AI-ready markdown; an outage blocks contract-review SLAs and downstream AI review.',
  decisions:
    'ADR-007: chose markdown over JSON for AI output (token efficiency).\nADR-012: synchronous CLI for now; async worker queue deferred until >100 docs/min.\nADR-019: zero content-loss guarantee enforced via post-conversion validation.',
  transcripts:
    'Standup 05-20: agreed to defer the async worker queue. Biggest risk flagged: large PDFs causing memory spikes during conversion. Owner: Priya.\nIncident 05-18: a 400-page PDF OOM-killed the converter; mitigated by a per-file size cap.',
  extra_docs:
    'Runbook: restart converter pod and re-queue failed docs from the dead-letter folder. On-call: #docops.',
}

type Field = { key: keyof OnboardingSources; label: string; icon: string; placeholder: string; multiline?: boolean }
const FIELDS: Field[] = [
  { key: 'repo_url', label: 'GitHub repository', icon: 'link', placeholder: 'https://github.com/owner/repo' },
  { key: 'business_context', label: 'Business context', icon: 'business_center', placeholder: 'What does this system do? Who depends on it when it breaks?', multiline: true },
  { key: 'decisions', label: 'Decision records (ADRs)', icon: 'rule', placeholder: 'Key architecture/operational decisions and rationale…', multiline: true },
  { key: 'transcripts', label: 'Transcripts', icon: 'forum', placeholder: 'Standup / incident / Slack notes…', multiline: true },
  { key: 'extra_docs', label: 'Other docs / runbooks', icon: 'description', placeholder: 'Anything else operationally relevant…', multiline: true },
]

export default function Onboarding({ customerId }: { customerId: string }) {
  const [sources, setSources] = useState<OnboardingSources>({ repo_url: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<OnboardingReport | null>(null)
  const [ctx, setCtx] = useState<ContextRepoResult | null>(null)

  const set = (k: keyof OnboardingSources, v: string) => setSources((s) => ({ ...s, [k]: v }))

  async function run() {
    setLoading(true)
    setError(null)
    setReport(null)
    setCtx(null)
    try {
      const res = await runOnboarding(customerId, sources)
      setReport(res.data.report)
      setCtx(res.data.context_repo)
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
          <Button onClick={run} disabled={loading || !sources.repo_url.trim()}>
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
            {report.warnings.length > 0 && (
              <Card className="p-5">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="warning" className="text-[#9a7400] !text-base" /> Agent Warnings</div>
                <ul className="space-y-1.5">{report.warnings.map((w, i) => <li key={i} className="text-xs text-on-surface-variant">{w}</li>)}</ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
