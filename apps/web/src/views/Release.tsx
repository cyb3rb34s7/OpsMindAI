import { useRef, useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner } from '../ui'
import { streamRelease, type ReleaseReport, type RegionResult, type ChatEvent } from '../api'

type Mode = 'healthy' | 'degraded' | 'blocked'
type Step = 'pending' | 'running' | 'done' | 'failed'
type RegionSteps = { deploy: Step; startup: Step; sanity: Step }
const REGIONS = ['us-east-1', 'eu-west-1', 'ap-south-1']

function StepIcon({ s }: { s: Step }) {
  if (s === 'done') return <Icon name="check_circle" className="text-tertiary !text-base" style={{ fontVariationSettings: "'FILL' 1" }} />
  if (s === 'failed') return <Icon name="cancel" className="text-error !text-base" style={{ fontVariationSettings: "'FILL' 1" }} />
  if (s === 'running') return <Icon name="progress_activity" className="text-primary !text-base animate-spin" />
  return <Icon name="radio_button_unchecked" className="text-outline-variant/60 !text-base" />
}

function RegionLogCard({ r }: { r: RegionResult }) {
  const [open, setOpen] = useState(false)
  const ok = r.status === 'deployed'
  return (
    <div className={`rounded-lg border overflow-hidden ${ok ? 'border-tertiary/30' : 'border-error/30'}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface">
        <div className="flex items-center gap-2">
          <Icon name={ok ? 'check_circle' : 'cancel'} className={ok ? 'text-tertiary' : 'text-error'} style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="font-mono text-sm">{r.region}</span>
          <span className="font-mono text-xs text-on-surface-variant">{r.deployment_id}</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="text-on-surface-variant hover:text-primary text-xs font-mono flex items-center gap-1">
          logs <Icon name={open ? 'expand_less' : 'expand_more'} className="!text-sm" />
        </button>
      </div>
      {open && (
        <div className="bg-[#0f1115] p-3 font-mono text-[11px] text-[#c9d1d9] space-y-0.5 max-h-56 overflow-auto term-scroll">
          {r.logs.map((l, i) => <div key={i} className={/error|fail|refused|crash|rolling back/i.test(l) ? 'text-[#ff7b72]' : ''}>{l}</div>)}
        </div>
      )}
    </div>
  )
}

export default function Release({ customerId }: { customerId: string }) {
  const [service, setService] = useState('payment-service')
  const [version, setVersion] = useState('v1.4.0')
  const [mode, setMode] = useState<Mode>('healthy')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preDeploy, setPreDeploy] = useState<Step>('pending')
  const [steps, setSteps] = useState<Record<string, RegionSteps>>({})
  const [report, setReport] = useState<ReleaseReport | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const started = streaming || report !== null || preDeploy !== 'pending'

  function patch(region: string, phase: keyof RegionSteps, s: Step) {
    setSteps((prev) => ({ ...prev, [region]: { ...(prev[region] ?? { deploy: 'pending', startup: 'pending', sanity: 'pending' }), [phase]: s } }))
  }

  async function run() {
    setError(null)
    setReport(null)
    setPreDeploy('running')
    setSteps(Object.fromEntries(REGIONS.map((r) => [r, { deploy: 'pending', startup: 'pending', sanity: 'pending' }])))
    setStreaming(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamRelease(customerId, service.trim(), version.trim(), mode, (e: ChatEvent) => {
        if (e.type === 'tool') {
          const name = (e as any).name as string
          const status = (e as any).status as string
          const summary = ((e as any).summary as string) || ''
          if (name === 'pre-deploy checks') setPreDeploy(status === 'running' ? 'running' : /block/i.test(summary) ? 'failed' : 'done')
          else if (name.startsWith('deploy ')) patch(name.slice(7), 'deploy', status === 'running' ? 'running' : 'done')
          else if (name.startsWith('startup ')) patch(name.slice(8), 'startup', status === 'running' ? 'running' : summary === 'failed' ? 'failed' : 'done')
          else if (name.startsWith('sanity ')) patch(name.slice(7), 'sanity', status === 'running' ? 'running' : summary === 'fail' ? 'failed' : 'done')
        } else if (e.type === 'result') setReport((e as any).data.report)
        else if (e.type === 'error') setError((e as any).message)
      }, ctrl.signal)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const blocked = report?.deployment_status === 'blocked' || preDeploy === 'failed'
  const partial = report?.deployment_status === 'partial'
  const healthyCount = report?.regions.filter((r) => r.status === 'deployed').length ?? 0
  const modeColor: Record<Mode, string> = { healthy: 'bg-tertiary text-on-tertiary', degraded: 'bg-[#fbbc04] text-[#3a2d00]', blocked: 'bg-error text-on-error' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Release Agent</h1>
        <p className="text-on-surface-variant">
          A multi-region release bot: pre-deploy checks → trigger pipelines per region → verify startup logs → run sanity
          scripts → publish a release report. It reads your context repo to deploy the real service with its dependencies.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Service</label>
            <input value={service} onChange={(e) => setService(e.target.value)} className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 font-mono text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Version</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 font-mono text-sm outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Scenario</label>
            <div className="flex mt-2 rounded-md overflow-hidden border border-outline-variant/40">
              {(['healthy', 'degraded', 'blocked'] as const).map((m) => (
                <button key={m} disabled={streaming} onClick={() => setMode(m)} className={`flex-1 py-2.5 text-[11px] font-mono uppercase disabled:opacity-50 ${mode === m ? modeColor[m] : 'bg-surface text-on-surface-variant'}`}>{m}</button>
              ))}
            </div>
          </div>
          <Button onClick={run} disabled={streaming}>
            {streaming ? <Icon name="sync" className="animate-spin !text-sm" /> : <Icon name="rocket_launch" className="!text-sm" />}
            {streaming ? 'Releasing' : 'Run Release'}
          </Button>
        </div>
        <div className="mt-3 text-xs text-on-surface-variant font-mono">Regions: {REGIONS.join(' · ')}</div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Live rollout */}
      {started && (
        <Card className="p-0 overflow-hidden">
          <CardHeader icon="rocket_launch" title={`Rolling out ${service} ${version}`} right={streaming ? <Badge tone="primary"><Icon name="progress_activity" className="!text-xs animate-spin" /> live</Badge> : undefined} />
          <div className="p-5 space-y-4">
            {/* pre-deploy */}
            <div className="flex items-center gap-2 text-sm">
              <StepIcon s={preDeploy} />
              <span className={preDeploy === 'pending' ? 'text-on-surface-variant' : 'text-on-surface'}>Pre-deploy checks (AWS config, policy)</span>
              {preDeploy === 'failed' && <Badge tone="error">blocked</Badge>}
            </div>

            {preDeploy !== 'failed' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {REGIONS.map((r) => {
                  const st = steps[r] ?? { deploy: 'pending', startup: 'pending', sanity: 'pending' }
                  return (
                    <div key={r} className="rounded-lg border border-outline-variant/30 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="public" className="text-primary !text-base" />
                        <span className="font-mono text-sm">{r}</span>
                      </div>
                      {([['deploy', 'Deploy pipeline'], ['startup', 'Startup logs'], ['sanity', 'Sanity checks']] as const).map(([k, label]) => (
                        <div key={k} className="flex items-center gap-2 py-1 text-sm">
                          <StepIcon s={st[k]} />
                          <span className={st[k] === 'pending' ? 'text-on-surface-variant/60' : 'text-on-surface'}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Report */}
      {report && (
        <>
          <Card className={`p-5 flex items-center justify-between ${blocked ? 'bg-error-container/10 border-error/20' : partial ? 'bg-[#fbbc04]/5 border-[#fbbc04]/30' : 'bg-tertiary-container/10 border-tertiary/20'}`}>
            <div className="flex items-center gap-3">
              <Icon name={blocked ? 'gpp_maybe' : partial ? 'warning' : 'verified'} className={`!text-3xl ${blocked ? 'text-error' : partial ? 'text-[#9a7400]' : 'text-tertiary'}`} style={{ fontVariationSettings: "'FILL' 1" }} />
              <div>
                <div className="text-headline-sm font-heading capitalize">{report.deployment_status}</div>
                <div className="text-sm text-on-surface-variant">
                  {blocked ? 'Blocked at pre-deploy — nothing shipped.' : `${healthyCount}/${report.regions.length} regions healthy.${report.rollback_recommended ? ' Failed regions rolled back.' : ''}`}
                </div>
              </div>
            </div>
            <Badge tone="neutral">{report.service} {report.version}</Badge>
          </Card>

          {report.infra_warnings.length > 0 && (
            <Card className="p-5">
              <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="gpp_maybe" className="text-error !text-base" /> Pre-deploy findings</div>
              <ul className="space-y-1.5">{report.infra_warnings.map((w, i) => <li key={i} className="flex items-start gap-2 text-sm"><Icon name="cancel" className="text-error !text-base shrink-0" />{w}</li>)}</ul>
            </Card>
          )}

          {report.regions.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <CardHeader icon="receipt_long" title="Release report — regions & logs" right={<Badge tone={partial ? 'error' : 'success'}>{healthyCount}/{report.regions.length} healthy</Badge>} />
              <div className="p-4 space-y-2">{report.regions.map((r) => <RegionLogCard key={r.region} r={r} />)}</div>
              <div className="px-5 pb-5">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Changelog</div>
                <ul className="space-y-1.5">{report.changelog.map((c, i) => <li key={i} className="flex items-start gap-2 text-sm"><Icon name="arrow_right" className="text-primary !text-base shrink-0" />{c}</li>)}</ul>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
