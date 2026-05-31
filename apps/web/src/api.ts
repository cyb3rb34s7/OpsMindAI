// Thin client for the OpsMindAI FastAPI backend (proxied at /api in dev).

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  trace_id?: string
}

export interface Component {
  name: string
  responsibility: string
  tech: string
  dependencies: string[]
  data_store: string
}

export interface OnboardingReport {
  repo_name: string
  tech_stack: string[]
  services: string[]
  architecture_summary: string
  business_context: string
  components: Component[]
  data_flows: string[]
  risks: string[]
  key_decisions: string[]
  open_questions: string[]
  warnings: string[]
  context_repo_url: string | null
  context_repo_full_name: string | null
  source_repo_url: string | null
}

export interface OnboardingSources {
  repo_url: string
  business_context?: string
  decisions?: string
  transcripts?: string
  extra_docs?: string
}

export interface ContextRepoResult {
  local_path: string
  context_repo_url: string | null
  context_repo_full_name: string | null
  committed_files?: string[]
  warnings: string[]
}

export interface TraceHop {
  seq: number
  ts: string
  service: string
  level: string
  message: string
  elapsed_s: number | null
  delta_s: number | null
}

export interface RCAReport {
  root_cause: string
  confidence: number
  impacted_services: string[]
  trace_flow: string[]
  recommendations: string[]
  warnings: string[]
  applied_skills: string[]
}

export interface Skill {
  id: string
  customer_id: string
  agent_name: string
  failure_pattern: string
  resolution: string
  success_count: number
  confidence: number
  created_at: string
  updated_at: string
}

export interface ReleaseReport {
  deployment_status: string
  infra_warnings: string[]
  startup_health: string
  sanity_results: string[]
  rollback_recommended: boolean
  warnings: string[]
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = (json && (json.detail || json.message)) || `HTTP ${res.status}`
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return json as T
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api/v1${path}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return json as T
}

export interface AgentResult<R> {
  success: boolean
  summary: string
  data: R
  warnings: string[]
}

export interface AgentRunEnvelope<R> {
  data: {
    run: { run_id: string; trace_id: string; status: string }
    result: AgentResult<R>
  }
}

// Agents can complete the HTTP call but still fail at the domain level
// (e.g. RCA before onboarding exists). Surface that as a visible error.
function unwrap<R>(result: AgentResult<R>): AgentResult<R> {
  if (!result.success) {
    const detail = [result.summary, ...(result.warnings || [])].filter(Boolean).join(' — ')
    throw new Error(detail || 'Agent reported failure')
  }
  return result
}

export async function runOnboarding(customerId: string, sources: OnboardingSources, forceRefresh = false) {
  const r = await post<AgentRunEnvelope<{ report: OnboardingReport; context_repo: ContextRepoResult; cached: boolean }>>(
    '/agents/onboarding',
    { customer_id: customerId, payload: { ...sources, force_refresh: forceRefresh } },
  )
  return unwrap(r.data.result)
}

export async function runRCA(customerId: string, traceId: string, description: string) {
  const r = await post<
    AgentRunEnvelope<{ report: RCAReport; applied_skills: Skill[]; learned_skill: Skill }>
  >('/agents/rca', {
    customer_id: customerId,
    payload: { trace_id: traceId, description, incident_id: `INC-${Date.now().toString().slice(-5)}` },
  })
  return unwrap(r.data.result)
}

export async function runRelease(
  customerId: string,
  service: string,
  version: string,
  demoMode: 'healthy' | 'blocked',
) {
  const r = await post<AgentRunEnvelope<{ report: ReleaseReport }>>('/agents/release', {
    customer_id: customerId,
    payload: { service, version, demo_mode: demoMode },
  })
  return unwrap(r.data.result)
}

export interface ContextFile {
  name: string
  content: string
}

export async function getContext(customerId: string): Promise<{ exists: boolean; files: ContextFile[] }> {
  const r = await get<ApiEnvelope<{ exists: boolean; files: ContextFile[] }>>(`/context/${customerId}`)
  return r.data
}

export async function getSkills(customerId: string): Promise<Skill[]> {
  const r = await get<ApiEnvelope<{ customer_id: string; skills: Skill[] }>>(`/skills/${customerId}`)
  return r.data.skills
}

export interface OrchestratorResult {
  data: {
    route: { data: { intent: string; confidence: number; reasoning: string } }
    agent?: unknown
  }
}

export async function runOrchestrator(customerId: string, message: string, payload: Record<string, unknown> = {}) {
  return post<OrchestratorResult>('/orchestrator/run', { customer_id: customerId, message, payload })
}

// ---- Chat SSE (hand-rolled reader) ----
export interface ChatEvent {
  type: 'queued' | 'memory' | 'routing' | 'thinking' | 'tool' | 'reply' | 'result' | 'done' | 'cancelled' | 'error'
  [k: string]: unknown
}

export async function streamChat(
  customerId: string,
  threadId: string,
  message: string,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId, thread_id: threadId, message }),
    signal,
  })
  if (!res.body) throw new Error('No response stream')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const frames = buf.split('\n\n')
    buf = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data: '))
      if (line) {
        try {
          onEvent(JSON.parse(line.slice(6)) as ChatEvent)
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}

export async function stopChat(customerId: string, threadId: string): Promise<void> {
  await fetch('/api/v1/chat/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer_id: customerId, thread_id: threadId }),
  }).catch(() => undefined)
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
  ts?: string
}

export async function getChatHistory(customerId: string, threadId = 'main'): Promise<ChatTurn[]> {
  const r = await get<ApiEnvelope<{ turns: ChatTurn[] }>>(`/chat/history/${customerId}?thread_id=${threadId}`)
  return r.data.turns
}
