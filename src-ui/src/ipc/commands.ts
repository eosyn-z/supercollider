import { invokeWithFallback } from './tauriWrapper'

// Types
export interface Agent {
  name: string
  capabilities: string[]
  endpoint_url?: string
  enabled: boolean
  priority: number
  health: 'unknown' | 'healthy' | 'degraded' | 'unreachable'
  local: boolean
}

export interface Project {
  id: string
  type: string
  prompt: string
  status: string
  created_at: string
  offline_only: boolean
}

export interface Task {
  id: string
  project_id: string
  type: string
  capability: string
  status: string
  deps: string[]
  input: any
  output?: any
  error?: any
  retries: number
}

// Notifications
export async function notificationsTest() {
  return invokeWithFallback('notifications_test')
}

// Agents
export async function agentsRegister(agent: any) {
  return invokeWithFallback('agents_register', { payload: { agent } })
}

export async function agentsTest(name: string) {
  return invokeWithFallback<{ ok: boolean; latency_ms: number; health: string }>('agents_test', { name })
}

export async function agentsList() {
  return invokeWithFallback<{ ok: boolean; agents: Agent[] }>('agents_list')
}

export async function agentsEnable(name: string, enabled: boolean) {
  return invokeWithFallback('agents_enable', { name, enabled })
}

export async function agentsDelete(name: string) {
  return invokeWithFallback('agents_delete', { name })
}

// Projects
export async function runStart(project: { type: string; prompt: string; config_override?: Record<string, unknown> }) {
  return invokeWithFallback<{ ok: boolean; project_id?: string; error?: string }>('run_start', { project })
}

export async function projectsList() {
  return invokeWithFallback<{ ok: boolean; projects: Project[] }>('projects_list')
}

export async function projectsCancel(projectId: string) {
  return invokeWithFallback('projects_cancel', { project_id: projectId })
}

export async function projectsDelete(projectId: string) {
  return invokeWithFallback('projects_delete', { project_id: projectId })
}

export async function projectsStatus(projectId: string) {
  return invokeWithFallback<{ ok: boolean; status: string; tasks_summary: any }>('projects_status', { project_id: projectId })
}

export async function projectsLogs(projectId: string, tail?: number) {
  return invokeWithFallback<{ ok: boolean; lines: string[] }>('projects_logs', { project_id: projectId, tail })
}

// Shredder
export async function shredderAnalyze(projectId: string, model?: string, provider?: string) {
  return invokeWithFallback<{ ok: boolean; atoms?: string[]; atomic_task_types?: string[]; questions?: string[]; tasks?: any[]; raw?: any }>('shredder_analyze', { project_id: projectId, model, provider })
}

export async function shredderApply(projectId: string, tasks: any[]) {
  return invokeWithFallback<{ ok: boolean; created: number }>('shredder_apply', { project_id: projectId, tasks })
}

// Execution
export async function executeProject(projectId: string) {
  return invokeWithFallback<{ ok: boolean; message: string }>('execute_project', { project_id: projectId })
}

export async function executeTask(projectId: string, task: any) {
  return invokeWithFallback<{ ok: boolean; message: string }>('execute_task', { project_id: projectId, task })
}

export async function cancelTask(taskId: string) {
  return invokeWithFallback<{ ok: boolean }>('cancel_task', { task_id: taskId })
}

export async function setApiKey(provider: string, key: string) {
  return invokeWithFallback<{ ok: boolean; message: string }>('set_api_key', { provider, key })
}

export async function testApiConnection(provider: string) {
  return invokeWithFallback<{ ok: boolean; message?: string; error?: string }>('test_api_connection', { provider })
}

// Config
export async function configUpdate(partialConfig: any) {
  return invokeWithFallback<{ ok: boolean; config: any }>('config_update', { partial_config: partialConfig })
}

// Queue
export async function queueStart() {
  return invokeWithFallback('queue_start')
}

export async function queuePause() {
  return invokeWithFallback('queue_pause')
}

export async function queueResume() {
  return invokeWithFallback('queue_resume')
}

export async function queueGetStatus() {
  return invokeWithFallback<{ ok: boolean; status: { queued: number; running: number; completed: number; failed: number; total: number } }>('queue_get_status')
}

export async function queueCancel(projectId: string) {
  return invokeWithFallback('queue_cancel', { project_id: projectId })
}

export async function queueReorder(projectId: string, position: number) {
  return invokeWithFallback<{ ok: boolean; queue: string[] }>('queue_reorder', { project_id: projectId, position })
}

// Lazy queue helpers
export async function queueLoadSavedProjects(limit?: number) {
  return invokeWithFallback<{ ok: boolean; loaded: number; message?: string }>('queue_load_saved_projects', { limit })
}

export async function queueProcessLazy() {
  return invokeWithFallback<{ ok: boolean; message?: string }>('queue_process_lazy')
}

// Clarify
export async function clarifySubmit(projectId: string, answers: string[]) {
  return invokeWithFallback('clarify_submit', { project_id: projectId, answers })
}

// Templates
export async function templatesList() {
  return invokeWithFallback<{ ok: boolean; templates: any[] }>('templates_list')
}

export async function templatesGet(name: string) {
  return invokeWithFallback<{ ok: boolean; template: any }>('templates_get', { name })
}

export async function templatesSave(template: any) {
  return invokeWithFallback('templates_save', { template })
}

export async function templatesDelete(name: string) {
  return invokeWithFallback('templates_delete', { name })
}

// Terminal
export async function terminalExec(cmd: string, args: string[], stdin?: string) {
  return invokeWithFallback<{ ok: boolean; stdout?: string; stderr?: string; exit_code?: number; error?: string }>('terminal_exec', { cmd, args, stdin })
}

// Tasks
export async function tasksCreate(projectId: string, task: any) {
  return invokeWithFallback<{ ok: boolean; task_id: string }>('tasks_create', { project_id: projectId, task })
}

export async function tasksCreateSimple(projectId: string, input: {
  task_type: string;
  capability: string;
  preamble?: string;
  token_limit?: number;
  dependencies?: string[];
  input_chain?: string[];
  approval_required?: boolean;
  clarity_prompt?: string;
  metadata?: any;
}) {
  return invokeWithFallback<{ ok: boolean; task_id: string }>('tasks_create_simple', { project_id: projectId, input })
}

export async function tasksUpdate(projectId: string, taskId: string, partial: any) {
  return invokeWithFallback('tasks_update', { project_id: projectId, task_id: taskId, partial })
}

export async function tasksDelete(projectId: string, taskId: string) {
  return invokeWithFallback('tasks_delete', { project_id: projectId, task_id: taskId })
}

export async function tasksList(projectId: string) {
  return invokeWithFallback<{ ok: boolean; tasks: Task[] }>('tasks_list', { project_id: projectId })
}

export async function tasksListAll() {
  return invokeWithFallback<{ ok: boolean; tasks: any[] }>('tasks_list_all')
}

export async function tasksUpdatePriorities(priorities: Array<{ id: string; priority: number }>) {
  return invokeWithFallback('tasks_update_priorities', { priorities })
}

// Tools
export async function toolsList() {
  return invokeWithFallback<{ tools: any[] }>('tools_list')
}

export async function toolsDetect() {
  return invokeWithFallback<{ detected: Record<string, string> }>('tools_detect')
}

export async function toolsValidate(toolId: string) {
  return invokeWithFallback<{ valid: boolean; version: string | null }>('tools_validate', { tool_id: toolId })
}

export async function toolsInstall(toolId: string) {
  return invokeWithFallback<{ success: boolean; message: string; command: string; url: string }>('tools_install', { tool_id: toolId })
}

export async function toolsGetForCapability(capability: string) {
  return invokeWithFallback<{ tools: any[] }>('tools_get_for_capability', { capability })
}

export async function toolsRegisterManual(tool: {
  id: string
  name: string
  category: string
  capabilities?: string[]
  input_formats?: string[]
  output_formats?: string[]
  requires_gpu?: boolean
  requires_network?: boolean
}) {
  return invokeWithFallback<{ ok: boolean }>('tools_register_manual', { tool })
}
