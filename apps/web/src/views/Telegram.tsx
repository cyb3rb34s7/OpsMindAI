import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, Button, Badge, Card, CardHeader, Spinner, ErrorBanner } from '../ui'
import {
  getTelegramStatus,
  getTelegramSessions,
  getTelegramSessionHistory,
  disconnectTelegram,
  type TelegramStatus,
  type TelegramSession,
  type ChatTurn,
} from '../api'

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, (Date.now() - then) / 1000)
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function SessionCard({ customerId, s }: { customerId: string; s: TelegramSession }) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ChatTurn[] | null>(null)
  const chatId = s.thread_id.replace(/^tg-/, '')

  useEffect(() => {
    if (!open) return
    let alive = true
    const load = () => getTelegramSessionHistory(customerId, s.thread_id).then((t) => alive && setTurns(t)).catch(() => {})
    load()
    const iv = setInterval(load, 4000) // keep the open transcript live
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [open, customerId, s.thread_id])

  return (
    <div className="rounded-lg border border-outline-variant/30 overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-surface-variant/30 text-left">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#229ED9]/15 flex items-center justify-center shrink-0">
            <Icon name="send" className="text-[#229ED9] !text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">Chat {chatId}</div>
            <div className="text-xs text-on-surface-variant truncate max-w-[42ch]">{s.last_message || '—'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge tone="neutral">{s.count} msgs</Badge>
          <span className="text-xs text-on-surface-variant font-mono">{timeAgo(s.last_at)}</span>
          <Icon name={open ? 'expand_less' : 'expand_more'} className="text-on-surface-variant" />
        </div>
      </button>
      {open && (
        <div className="bg-surface-container-low/40 border-t border-outline-variant/30 p-4 space-y-2 max-h-80 overflow-auto term-scroll">
          {turns === null ? (
            <Spinner label="Loading transcript…" />
          ) : turns.length === 0 ? (
            <div className="text-xs text-on-surface-variant">No messages yet.</div>
          ) : (
            turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${t.role === 'user' ? 'bg-[#229ED9] text-white rounded-br-sm' : 'bg-surface border border-outline-variant/40 rounded-bl-sm'}`}>
                  {t.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function Telegram({ customerId, onConnect, onDisconnected }: { customerId: string; onConnect: () => void; onDisconnected: () => void }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null)
  const [sessions, setSessions] = useState<TelegramSession[]>([])
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const st = await getTelegramStatus(customerId)
      setStatus(st)
      if (st.connected) setSessions(await getTelegramSessions(customerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [customerId])

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, 4000) // live mirror of the bot's chats
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [refresh])

  async function disconnect() {
    await disconnectTelegram(customerId).catch(() => {})
    setStatus({ connected: false })
    setSessions([])
    onDisconnected()
  }

  if (status === null) return <Spinner label="Checking Telegram connection…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Telegram Gateway</h1>
        <p className="text-on-surface-variant">
          Connect your own Telegram bot and OpsMindAI answers from it — same brain, same memory as this console.
          Every chat appears below as a live session.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {!status.connected ? (
        <Card className="p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#229ED9]/15 flex items-center justify-center">
            <Icon name="send" className="text-[#229ED9] !text-3xl" style={{ fontVariationSettings: "'FILL' 1" }} />
          </div>
          <div>
            <div className="text-headline-sm font-heading">No bot connected</div>
            <div className="text-on-surface-variant text-sm mt-1 max-w-md">
              Create a bot with <span className="font-mono">@BotFather</span> on Telegram, copy its token, and connect it here.
            </div>
          </div>
          <Button onClick={onConnect}>
            <Icon name="add_link" className="!text-sm" /> Connect a bot
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-5 flex items-center justify-between bg-[#229ED9]/5 border-[#229ED9]/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#229ED9]/15 flex items-center justify-center">
                <Icon name="send" className="text-[#229ED9] !text-xl" style={{ fontVariationSettings: "'FILL' 1" }} />
              </div>
              <div>
                <div className="text-headline-sm font-heading flex items-center gap-2">
                  {status.bot_name}
                  {status.bot_username && <span className="text-on-surface-variant text-base font-mono">@{status.bot_username}</span>}
                </div>
                <div className="text-sm text-on-surface-variant flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${status.running ? 'bg-tertiary animate-pulse' : 'bg-outline-variant'}`} />
                  {status.running ? 'Polling for messages' : 'Connected'} · {status.messages ?? 0} handled
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status.bot_username && (
                <a href={`https://t.me/${status.bot_username}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost"><Icon name="open_in_new" className="!text-sm" /> Open in Telegram</Button>
                </a>
              )}
              <Button variant="danger" onClick={disconnect}><Icon name="link_off" className="!text-sm" /> Disconnect</Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <CardHeader
              icon="forum"
              title="Live sessions"
              right={<Badge tone="primary"><Icon name="autorenew" className="!text-xs animate-spin" /> live · {sessions.length}</Badge>}
            />
            <div className="p-4 space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant text-sm">
                  No messages yet. Open the bot in Telegram and say hello — the conversation shows up here.
                </div>
              ) : (
                sessions.map((s) => <SessionCard key={s.thread_id} customerId={customerId} s={s} />)
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
