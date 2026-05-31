import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon, Badge, Card, Spinner } from '../ui'
import { getContext, type ContextFile } from '../api'

const ICONS: Record<string, string> = {
  'README.md': 'home',
  'project_index.md': 'account_tree',
  'service_map.md': 'lan',
  'data_flows.md': 'sync_alt',
  'tech_stack.md': 'stack',
  'business_context.md': 'business_center',
  'risks.md': 'warning',
  'decision_records.md': 'rule',
  'open_questions.md': 'help',
}

export default function ContextRepo({ customerId }: { customerId: string }) {
  const [files, setFiles] = useState<ContextFile[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exists, setExists] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getContext(customerId)
      .then((res) => {
        if (cancelled) return
        setExists(res.exists)
        setFiles(res.files)
      })
      .catch(() => setExists(false))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (loading) {
    return (
      <div className="p-10">
        <Spinner label="Loading context repo…" />
      </div>
    )
  }

  if (!exists || files.length === 0) {
    return (
      <div className="text-center py-20 text-on-surface-variant">
        <Icon name="folder_off" className="!text-5xl opacity-40" />
        <p className="mt-3">No context repo yet. Run the onboarding agent first.</p>
      </div>
    )
  }

  const current = files[active]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-md font-heading mb-1">Context Repository</h1>
        <p className="text-on-surface-variant">
          The structured operational context the onboarding agent produced — readable here and committed to GitHub.
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
          {/* File tree */}
          <div className="md:col-span-3 border-r border-outline-variant/30 bg-surface-container-low p-3">
            <div className="text-label-sm font-mono uppercase tracking-wide text-on-surface-variant px-2 pb-2 flex items-center gap-1.5">
              <Icon name="folder" className="!text-sm text-primary" /> context-repo
            </div>
            <div className="flex flex-col gap-0.5">
              {files.map((f, i) => (
                <button
                  key={f.name}
                  onClick={() => setActive(i)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                    i === active ? 'bg-primary-container/40 text-primary font-medium' : 'text-on-surface-variant hover:bg-surface-variant/50'
                  }`}
                >
                  <Icon name={ICONS[f.name] ?? 'description'} className="!text-base" />
                  <span className="font-mono text-xs truncate">{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Rendered markdown */}
          <div className="md:col-span-9 p-6 overflow-auto">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-outline-variant/30">
              <Icon name={ICONS[current.name] ?? 'description'} className="text-primary !text-base" />
              <span className="font-mono text-sm">{current.name}</span>
              <Badge tone="success" className="ml-auto">committed</Badge>
            </div>
            <div className="ctx-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{current.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
