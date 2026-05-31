import { useState } from 'react'
import { Icon, Button, Badge, Card, ErrorBanner } from '../ui'
import { runRelease, type ReleaseReport } from '../api'

export default function Release({ customerId }: { customerId: string }) {
  const [service, setService] = useState('payment-service')
  const [version, setVersion] = useState('v1.4.2')
  const [demoMode, setDemoMode] = useState<'healthy' | 'blocked'>('healthy')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ReleaseReport | null>(null)

  async function run() {
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const res = await runRelease(customerId, service.trim(), version.trim(), demoMode)
      setReport(res.data.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const blocked = report ? report.rollback_recommended || report.deployment_status.toLowerCase().includes('block') : false
  const pipeline = [
    { icon: 'check', label: 'Build', state: 'done' },
    { icon: 'check', label: 'Test', state: 'done' },
    { icon: report ? (blocked ? 'cancel' : 'check') : 'hourglass_empty', label: 'Canary Gate', state: report ? (blocked ? 'fail' : 'done') : 'active' },
    { icon: 'done_all', label: 'Production', state: report ? (blocked ? 'pending' : 'done') : 'pending' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Release Agent</h1>
        <p className="text-on-surface-variant">
          Validates AWS config, monitors startup, runs sanity checks, and gates the deploy. Try a healthy release vs. a
          blocked one with an injected misconfiguration.
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
              {(['healthy', 'blocked'] as const).map((m) => (
                <button key={m} onClick={() => setDemoMode(m)} className={`flex-1 py-2.5 text-xs font-mono uppercase ${demoMode === m ? (m === 'healthy' ? 'bg-tertiary text-on-tertiary' : 'bg-error text-on-error') : 'bg-surface text-on-surface-variant'}`}>{m}</button>
              ))}
            </div>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Icon name="sync" className="animate-spin !text-sm" /> : <Icon name="rocket_launch" className="!text-sm" />}
            {loading ? 'Running gate' : 'Run Release Gate'}
          </Button>
        </div>
      </Card>

      {error && <ErrorBanner message={error} />}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="md:col-span-2 p-6">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-headline-sm font-heading flex items-center gap-2"><Icon name="rocket_launch" /> {service}: {version}</h3>
              <Badge tone={blocked ? 'error' : 'success'}>{report.deployment_status}</Badge>
            </div>
            <div className="relative flex justify-between items-center">
              <div className="absolute left-0 top-4 w-full h-0.5 bg-outline-variant/30 -z-10" />
              {pipeline.map((p) => (
                <div key={p.label} className="flex flex-col items-center gap-2 bg-surface px-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-surface ${p.state === 'done' ? 'bg-tertiary text-on-tertiary' : p.state === 'active' ? 'bg-primary-container text-primary border-primary animate-pulse' : p.state === 'fail' ? 'bg-error text-on-error' : 'bg-surface-variant text-outline'}`}>
                    <Icon name={p.icon} className="!text-sm" />
                  </div>
                  <span className="text-label-sm font-mono">{p.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-1">Startup Health</div>
                <div className={`text-headline-sm font-heading ${report.startup_health === 'healthy' ? 'text-tertiary' : 'text-[#9a7400]'}`}>{report.startup_health}</div>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4">
                <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-2">Sanity Checks</div>
                <ul className="space-y-1">
                  {report.sanity_results.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs"><Icon name={/fail|error/i.test(s) ? 'cancel' : 'check_circle'} className={`!text-sm ${/fail|error/i.test(s) ? 'text-error' : 'text-tertiary'}`} />{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card className={`p-0 overflow-hidden flex flex-col ${blocked ? 'bg-error-container/10 border-error/20' : 'bg-tertiary-container/10 border-tertiary/20'}`}>
            <div className="p-6 border-b border-outline-variant/20 bg-surface">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={blocked ? 'gpp_maybe' : 'verified'} className={blocked ? 'text-error' : 'text-tertiary'} />
                <span className={`text-label-sm font-mono uppercase tracking-wider ${blocked ? 'text-error' : 'text-tertiary'}`}>Risk Assessment</span>
              </div>
              <div className={`text-display-lg font-heading ${blocked ? 'text-error' : 'text-tertiary'}`}>{blocked ? 'High' : 'Low'}</div>
              <p className="text-body-md text-on-surface-variant mt-1">{blocked ? 'Deployment blocked by agent policy.' : 'Cleared for rollout across regions.'}</p>
            </div>
            <div className="p-6 flex-grow flex flex-col justify-between">
              <ul className="space-y-3 text-sm">
                {report.infra_warnings.length ? report.infra_warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2"><Icon name="cancel" className="text-error !text-base shrink-0" />{w}</li>
                )) : <li className="flex items-start gap-2 text-tertiary"><Icon name="check_circle" className="!text-base shrink-0" />No infrastructure misconfigurations detected.</li>}
              </ul>
              {blocked && (
                <div className="mt-6 flex gap-2">
                  <Button variant="ghost" className="flex-1">Override</Button>
                  <Button variant="danger" className="flex-1">Rollback</Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
