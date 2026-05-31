import { useState } from 'react'
import { Icon, Button, ErrorBanner } from './ui'
import { connectTelegram, type TelegramStatus } from './api'

export default function TelegramConnectModal({
  customerId,
  onClose,
  onConnected,
}: {
  customerId: string
  onClose: () => void
  onConnected: (status: TelegramStatus) => void
}) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function connect() {
    if (!token.trim()) {
      setError('Paste your bot token from @BotFather.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const st = await connectTelegram(customerId, token.trim(), name.trim())
      onConnected(st)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-page" onClick={onClose}>
      <div className="w-full max-w-md mx-4 bg-surface rounded-2xl shadow-2xl border border-outline-variant/30 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#229ED9]/15 flex items-center justify-center shrink-0">
            <Icon name="send" className="text-[#229ED9] !text-xl" style={{ fontVariationSettings: "'FILL' 1" }} />
          </div>
          <div className="flex-1">
            <h2 className="text-headline-sm font-heading">Connect a Telegram bot</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              The agent will reply from your bot using the same memory as this console.
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Bot token</label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:AAE…"
              autoFocus
              className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 font-mono text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant">Bot name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="OpsMind Bot"
              onKeyDown={(e) => e.key === 'Enter' && !busy && connect()}
              className="w-full mt-2 bg-surface-container-low border border-outline-variant/40 rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container-low/60 rounded-lg p-3">
            <Icon name="info" className="!text-base shrink-0 mt-0.5 text-primary" />
            <span>
              Create a bot in Telegram by messaging <span className="font-mono">@BotFather</span> → <span className="font-mono">/newbot</span>,
              then paste the token it gives you. Nothing leaves your machine except calls to Telegram.
            </span>
          </div>

          {error && <ErrorBanner message={error} />}
        </div>

        <div className="px-6 py-4 bg-surface-container-low/40 border-t border-outline-variant/30 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={connect} disabled={busy}>
            {busy ? <Icon name="progress_activity" className="animate-spin !text-sm" /> : <Icon name="link" className="!text-sm" />}
            {busy ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  )
}
