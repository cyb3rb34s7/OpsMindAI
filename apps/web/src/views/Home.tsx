import { useEffect, useRef, useState } from 'react'
import { Icon, Button, Badge, Card } from '../ui'
import { streamChat, stopChat, getSkills, type ChatEvent, type Skill } from '../api'

interface ToolEvt { name: string; status: string; summary?: string }
interface Msg {
  role: 'user' | 'assistant'
  text?: string
  routing?: { intent: string; reasoning?: string }
  thinking: string[]
  tools: ToolEvt[]
  card?: { agent: string; data: any }
  status: 'streaming' | 'done' | 'cancelled' | 'error' | 'queued'
  memoryUsed?: Record<string, string[]>
}

const SUGGESTIONS = [
  'What are the biggest risks in my system?',
  'Investigate trace_123 — checkout is failing',
  'Have we seen redis incidents before?',
]

function blank(): Msg {
  return { role: 'assistant', thinking: [], tools: [], status: 'streaming' }
}

function RcaCard({ d }: { d: any }) {
  const rep = d.report
  const pct = Math.round((rep.confidence ?? 0) * 100)
  return (
    <div className="mt-3 rounded-lg border border-outline-variant/30 overflow-hidden">
      <div className="px-4 py-2 bg-surface-variant/40 flex items-center gap-2 text-label-sm font-mono uppercase">
        <Icon name="psychology" className="text-primary !text-sm" /> Root Cause Analysis
      </div>
      <div className="p-4 space-y-3">
        <div className="font-heading text-headline-sm leading-tight">{rep.root_cause}</div>
        <div className="h-2 bg-surface-variant rounded-full overflow-hidden">
          <div className={`h-full ${pct >= 70 ? 'bg-tertiary' : 'bg-[#fbbc04]'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="bg-[#0f1115] rounded-lg p-3 font-mono text-[11px] text-[#c9d1d9] space-y-0.5">
          {(rep.trace_flow ?? []).map((l: string, i: number) => (
            <div key={i} className={/error|timeout|drop|fail/i.test(l) ? 'text-[#ff7b72]' : ''}>{l}</div>
          ))}
        </div>
        {(d.applied_skills?.length ?? 0) > 0 && (
          <Badge tone="success"><Icon name="school" className="!text-xs" /> applied learned skill (seen {d.applied_skills[0].success_count}×)</Badge>
        )}
      </div>
    </div>
  )
}

function ResultCard({ agent, data }: { agent: string; data: any }) {
  if (agent === 'rca') return <RcaCard d={data} />
  if (agent === 'onboarding') {
    const rep = data.report
    return (
      <Card className="mt-3 p-4">
        <div className="text-label-sm font-mono uppercase text-on-surface-variant mb-1">Onboarded {rep.repo_name}</div>
        <div className="text-sm">{(rep.components?.length ?? 0)} components · {rep.tech_stack?.slice(0, 5).join(', ')}</div>
        {data.context_repo?.context_repo_url && (
          <a href={data.context_repo.context_repo_url} target="_blank" rel="noreferrer" className="text-primary text-sm hover:underline inline-flex items-center gap-1 mt-2">
            <Icon name="open_in_new" className="!text-sm" /> context repo
          </a>
        )}
      </Card>
    )
  }
  if (agent === 'release') {
    const rep = data.report
    const blocked = rep.rollback_recommended
    return (
      <Card className={`mt-3 p-4 ${blocked ? 'bg-error-container/10 border-error/20' : 'bg-tertiary-container/10'}`}>
        <div className="text-label-sm font-mono uppercase text-on-surface-variant">Release Gate</div>
        <div className={`text-headline-sm font-heading ${blocked ? 'text-error' : 'text-tertiary'}`}>{rep.deployment_status}</div>
        {(rep.infra_warnings ?? []).map((w: string, i: number) => <div key={i} className="text-sm flex items-center gap-1.5"><Icon name="cancel" className="text-error !text-sm" />{w}</div>)}
      </Card>
    )
  }
  return null
}

function Trace({ m }: { m: Msg }) {
  if (!m.routing && !m.thinking.length && !m.tools.length) return null
  return (
    <div className="mb-2 space-y-1.5">
      {m.routing && (
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Icon name="alt_route" className="!text-sm text-primary" /> routed to <Badge tone="primary">{m.routing.intent}</Badge>
        </div>
      )}
      {m.thinking.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Icon name="psychology" className="!text-sm text-primary" /> {t}
        </div>
      ))}
      {m.tools.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {t.status === 'done'
            ? <Icon name="check_circle" className="!text-sm text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }} />
            : <Icon name="progress_activity" className="!text-sm text-primary animate-spin" />}
          <span className="font-mono text-on-surface">{t.name}</span>
          {t.summary && <span className="text-on-surface-variant truncate">— {t.summary}</span>}
        </div>
      ))}
    </div>
  )
}

export default function Home({ customerId }: { customerId: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [skills, setSkills] = useState<Skill[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const loadSkills = () => getSkills(customerId).then(setSkills).catch(() => undefined)
  useEffect(() => { loadSkills() }, [customerId])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  function patchLast(fn: (m: Msg) => void) {
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') fn(last)
      return next
    })
  }

  async function send(text: string) {
    if (!text.trim() || busy) return
    setInput('')
    setMessages((p) => [...p, { role: 'user', text, thinking: [], tools: [], status: 'done' }, blank()])
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamChat(customerId, 'main', text, (e: ChatEvent) => {
        if (e.type === 'queued') patchLast((m) => { m.status = 'queued' })
        else if (e.type === 'memory') patchLast((m) => { m.memoryUsed = (e as any).used; m.status = 'streaming' })
        else if (e.type === 'routing') patchLast((m) => { m.routing = { intent: (e as any).intent, reasoning: (e as any).reasoning } })
        else if (e.type === 'thinking') patchLast((m) => { m.thinking = [...m.thinking, (e as any).text] })
        else if (e.type === 'tool') patchLast((m) => {
          const t = e as any as ToolEvt
          const i = m.tools.findIndex((x) => x.name === t.name)
          if (i >= 0) m.tools[i] = t
          else m.tools = [...m.tools, t]
        })
        else if (e.type === 'reply') patchLast((m) => { m.text = (e as any).text })
        else if (e.type === 'result') patchLast((m) => { m.card = { agent: (e as any).agent, data: (e as any).data } })
        else if (e.type === 'cancelled') patchLast((m) => { m.status = 'cancelled' })
        else if (e.type === 'error') patchLast((m) => { m.status = 'error'; m.text = 'Something went wrong: ' + (e as any).message })
        else if (e.type === 'done') patchLast((m) => { m.status = 'done' })
      }, ctrl.signal)
    } catch {
      patchLast((m) => { if (m.status === 'streaming') m.status = 'cancelled' })
    } finally {
      setBusy(false)
      abortRef.current = null
      loadSkills()
    }
  }

  async function stop() {
    abortRef.current?.abort()
    await stopChat(customerId, 'main')
    setBusy(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Chat */}
      <div className="lg:col-span-2 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Icon name="hub" className="text-primary !text-2xl" style={{ fontVariationSettings: "'FILL' 1" }} />
              </div>
              <h2 className="text-headline-sm font-heading">Hi, I'm your OpsMindAI agent.</h2>
              <p className="text-on-surface-variant mt-1 max-w-md">Ask about your system, investigate an incident, or run a release. I remember what we've onboarded and every incident we've resolved.</p>
              <div className="flex flex-col gap-2 mt-6 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm p-3 rounded-lg border border-outline-variant/30 hover:border-primary/40 hover:bg-surface-variant/40 transition-colors">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              {m.role === 'user' ? (
                <div className="bg-primary text-on-primary rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] text-sm">{m.text}</div>
              ) : (
                <div className="max-w-[90%] animate-row-in">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0"><Icon name="hub" className="!text-sm" /></div>
                    <span className="text-label-sm font-mono uppercase text-on-surface-variant">OpsMindAI</span>
                    {m.status === 'queued' && <Badge tone="neutral">queued</Badge>}
                    {m.status === 'cancelled' && <Badge tone="error">stopped</Badge>}
                  </div>
                  <div className="pl-8">
                    <Trace m={m} />
                    {m.text && <div className="text-sm text-on-surface whitespace-pre-wrap">{m.text}</div>}
                    {m.card && <ResultCard agent={m.card.agent} data={m.card.data} />}
                    {m.status === 'streaming' && !m.text && !m.tools.length && !m.thinking.length && (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant"><Icon name="progress_activity" className="!text-sm animate-spin" /> thinking…</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="mt-3 flex gap-2 items-end">
          <div className="flex-1 flex items-center gap-2 bg-surface border border-outline-variant/40 rounded-xl px-3 focus-within:border-primary">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="Ask your agent anything…"
              className="flex-1 bg-transparent py-3 outline-none text-sm"
            />
          </div>
          {busy ? (
            <Button variant="danger" onClick={stop}><Icon name="stop" className="!text-sm" /> Stop</Button>
          ) : (
            <Button onClick={() => send(input)} disabled={!input.trim()}><Icon name="send" className="!text-sm" /> Send</Button>
          )}
        </div>
      </div>

      {/* Skills panel */}
      <Card className="p-0 overflow-hidden flex flex-col min-h-0">
        <div className="p-4 border-b border-outline-variant/30 flex items-center gap-2">
          <Icon name="school" className="text-primary !text-base" />
          <span className="text-label-sm font-mono uppercase tracking-wider">Learned Skills</span>
        </div>
        <div className="p-4 overflow-y-auto space-y-2">
          {skills.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No skills yet — resolve an incident and I'll remember the fix.</p>
          ) : skills.map((s) => (
            <div key={s.id} className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium leading-snug">{s.failure_pattern}</div>
                <Badge tone="success">×{s.success_count}</Badge>
              </div>
              <div className="text-xs text-on-surface-variant mt-1 flex items-start gap-1.5"><Icon name="flare" className="!text-sm text-primary shrink-0" />{s.resolution}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
