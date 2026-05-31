import { useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner } from '../ui'
import { runOnboarding, type OnboardingReport, type ContextRepoResult } from '../api'

const STEPS = ['Connecting to source', 'Scanning files', 'Synthesizing intelligence', 'Committing context repo']

export default function Onboarding({ customerId }: { customerId: string }) {
  const [repoUrl, setRepoUrl] = useState('https://github.com/lootsblog/IntelliParse')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<OnboardingReport | null>(null)
  const [ctx, setCtx] = useState<ContextRepoResult | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setReport(null)
    setCtx(null)
    try {
      const res = await runOnboarding(customerId, repoUrl.trim())
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
      <div>
        <h1 className="text-headline-md font-heading mb-1">Onboarding Agent</h1>
        <p className="text-on-surface-variant">
          Point the agent at a repository. It scans the real codebase, infers the operational shape, and commits a
          structured context repo to GitHub.
        </p>
      </div>

      <Card className="p-5">
        <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">GitHub repository URL</label>
        <div className="flex gap-3 mt-2">
          <div className="flex-1 flex items-center gap-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 focus-within:border-primary">
            <Icon name="link" className="text-on-surface-variant !text-lg" />
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="flex-1 bg-transparent py-2.5 outline-none font-mono text-sm text-on-surface"
            />
          </div>
          <Button onClick={run} disabled={loading || !repoUrl.trim()}>
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
              <div>
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Tech Stack</div>
                <div className="flex flex-wrap gap-2">
                  {report.tech_stack.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}
                </div>
              </div>
              <div>
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Services</div>
                <div className="flex flex-wrap gap-2">
                  {report.services.length ? report.services.map((s) => <Badge key={s}>{s}</Badge>) : <span className="text-sm text-on-surface-variant">—</span>}
                </div>
              </div>
              <div>
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Open Questions for Humans</div>
                <ul className="space-y-1.5">
                  {report.open_questions.map((q) => (
                    <li key={q} className="flex items-start gap-2 text-sm">
                      <Icon name="help" className="text-primary !text-base shrink-0 mt-0.5" />{q}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <Card className="p-5">
              <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-3 flex items-center gap-2">
                <Icon name="commit" className="text-primary !text-base" /> Context Repository
              </div>
              {ctx?.context_repo_url ? (
                <>
                  <a href={ctx.context_repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary font-medium text-sm hover:underline break-all">
                    <Icon name="open_in_new" className="!text-base" />
                    {ctx.context_repo_full_name}
                  </a>
                  <div className="mt-3 space-y-1">
                    {(ctx.committed_files ?? []).map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
                        <Icon name="description" className="!text-sm text-tertiary" />{f}
                      </div>
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
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2">
                  <Icon name="warning" className="text-[#9a7400] !text-base" /> Agent Warnings
                </div>
                <ul className="space-y-1.5">
                  {report.warnings.map((w, i) => <li key={i} className="text-xs text-on-surface-variant">{w}</li>)}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
