import { useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, ErrorBanner } from '../ui'
import { runRelease, type ReleaseReport, type RegionResult } from '../api'

type Mode = 'healthy' | 'degraded' | 'blocked'

function RegionCard({ r }: { r: RegionResult }) {
  const [open, setOpen] = useState(false)
  const ok = r.status === 'deployed'
  return (
    <div className={`rounded-lg border overflow-hidden ${ok ? 'border-tertiary/30' : 'border-error/30'}`}>
      <div className="flex items-center justify-between px-4 py-3 bg-surface">
        <div className="flex items-center gap-2">
          <Icon name={ok ? 'check_circle' : 'cancel'} className={ok ? 'text-tertiary' : 'text-error'} style={{ fontVariationSettings: "'FILL' 1" }} />
          <span className="font-mono text-sm">{r.region}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={ok ? 'success' : 'error'}>{r.status}</Badge>
          <button onClick={() => setOpen((o) => !o)} className="text-on-surface-variant hover:text-primary text-xs font-mono flex items-center gap-1">
            logs <Icon name={open ? 'expand_less' : 'expand_more'} className="!text-sm" />
          </button>
        </div>
      </div>
      <div className="px-4 py-2 flex flex-wrap gap-2 text-xs border-t border-outline-variant/20">
        <span className="font-mono text-on-surface-variant">{r.deployment_id}</span>
        <Badge tone={r.startup_health === 'healthy' ? 'success' : 'error'}>startup: {r.startup_health}</Badge>
        {r.sanity.map((c) => (
          <span key={c.name} className="inline-flex items-center gap-1 text-on-surface-variant">
            <Icon name={c.ok ? 'check_circle' : 'cancel'} className={`!text-xs ${c.ok ? 'text-tertiary' : 'text-error'}`} />{c.name}
          </span>
        ))}
      </div>
      {open && (
        <div className="bg-[#0f1115] p-3 font-mono text-[11px] text-[#c9d1d9] space-y-0.5 max-h-48 overflow-auto term-scroll">
          {r.logs.map((l, i) => (
            <div key={i} className={/error|fail|refused|crash|rolling back/i.test(l) ? 'text-[#ff7b72]' : ''}>{l}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Release({ customerId }: { customerId: string }) {
  const [service, setService] = useState('payment-service')
  const [version, setVersion] = useState('v1.4.0')
  const [mode, setMode] = useState<Mode>('healthy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReleaseReport | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await runRelease(customerId, service.trim(), version.trim(), mode)
      setReport(res.data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const blocked = report?.deployment_status === 'blocked'
  const partial = report?.deployment_status === 'partial'
  const healthyCount = report?.regions.filter((r) => r.status === 'deployed').length ?? 0
  const modeColor: Record<Mode, string> = { healthy: 'bg-tertiary text-on-tertiary', degraded: 'bg-[#fbbc04] text-[#3a2d00]', blocked: 'bg-error text-on-error' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Release Agent</h1>
        <p className="text-on-surface-variant">
          A multi-region release bot: pre-deploy checks → trigger pipelines per region → verify startup logs → run sanity
          scripts → publish a release report. Infra is mocked; pick a scenario to see each path.
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
                <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2.5 text-[11px] font-mono uppercase ${mode === m ? modeColor[m] : 'bg-surface text-on-surface-variant'}`}>{m}</button>
              ))}
            </div>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Icon name="sync" className="animate-spin !text-sm" /> : <Icon name="rocket_launch" className="!text-sm" />}
            {loading ? 'Releasing' : 'Run Release'}
          </Button>
        </div>
        <div className="mt-3 text-xs text-on-surface-variant font-mono">Regions: us-east-1 · eu-west-1 · ap-south-1</div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {report && (
        <div className="space-y-3">
          {/* Status banner */}
          <Card className={`p-5 flex items-center justify-between ${blocked ? 'bg-error-container/10 border-error/20' : partial ? 'bg-[#fbbc04]/5 border-[#fbbc04]/30' : 'bg-tertiary-container/10 border-tertiary/20'}`}>
            <div className="flex items-center gap-3">
              <Icon name={blocked ? 'gpp_maybe' : partial ? 'warning' : 'verified'} className={`!text-3xl ${blocked ? 'text-error' : partial ? 'text-[#9a7400]' : 'text-tertiary'}`} style={{ fontVariationSettings: "'FILL' 1" }} />
              <div>
                <div className="text-headline-sm font-heading capitalize">{report.deployment_status}</div>
                <div className="text-sm text-on-surface-variant">
                  {blocked ? 'Blocked at pre-deploy — nothing shipped.' : `${healthyCount}/${report.regions.length} regions healthy.${report.rollback_recommended ? ' Rollback recommended for failed regions.' : ''}`}
                </div>
              </div>
            </div>
            <Badge tone="neutral">{report.service} {report.version}</Badge>
          </Card>

          {/* Pre-deploy findings (blocked) */}
          {report.infra_warnings.length > 0 && (
            <Card className="p-5">
              <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="gpp_maybe" className="text-error !text-base" /> Pre-deploy findings</div>
              <ul className="space-y-1.5">{report.infra_warnings.map((w, i) => <li key={i} className="flex items-start gap-2 text-sm"><Icon name="cancel" className="text-error !text-base shrink-0" />{w}</li>)}</ul>
            </Card>
          )}

          {/* Per-region rollout */}
          {report.regions.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <CardHeader icon="public" title="Regional rollout" right={<Badge tone={partial ? 'error' : 'success'}>{healthyCount}/{report.regions.length} healthy</Badge>} />
              <div className="p-4 space-y-2">
                {report.regions.map((r) => <RegionCard key={r.region} r={r} />)}
              </div>
            </Card>
          )}

          {/* Changelog */}
          {report.changelog.length > 0 && (
            <Card className="p-5">
              <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2 flex items-center gap-2"><Icon name="receipt_long" className="text-primary !text-base" /> Release report</div>
              <ul className="space-y-1.5">{report.changelog.map((c, i) => <li key={i} className="flex items-start gap-2 text-sm"><Icon name="arrow_right" className="text-primary !text-base shrink-0" />{c}</li>)}</ul>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
