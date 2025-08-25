// Tauri API wrapper with browser fallback for development
// This allows the app to run in browser for development without Tauri errors

export const isTauriAvailable = () => {
  if (typeof window === 'undefined') return false
  const w: any = window as any
  // Common Tauri markers across versions
  const hasIpc = typeof w.__TAURI_IPC__ === 'function'
  const hasTauri = typeof w.__TAURI__ !== 'undefined'
  const uaHasTauri = typeof navigator !== 'undefined' && /Tauri/i.test(navigator.userAgent || '')
  return !!(hasIpc || hasTauri || uaHasTauri)
}

const shouldUseMock = () => {
  const w: any = typeof window !== 'undefined' ? (window as any) : {}
  // Prefer explicit flag, otherwise default to dev in Vite
  const explicit = w.__DEV_MOCK__ === true
  // @ts-ignore - Vite injects import.meta.env.DEV
  const viteDev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV === true
  return explicit || (viteDev && !isTauriAvailable())
}

// Mock data for browser development
const mockAgents: any[] = [
  {
    name: 'Local Agent',
    capabilities: ['code', 'text'],
    endpoint_url: 'http://localhost:8080',
    enabled: true,
    priority: 1,
    health: 'healthy',
    local: true
  }
]

const mockProjects: any[] = []

const mockConfig = {
  batching: {
    enabled: false,
    batch_size: 4,
    concurrency: 1
  },
  allowlist: [],
  auto_start_queue: false,
  approval_mode: 'dynamic',
  silent_mode: false,
  failure_strategy: 'halt',
  show_workflow_by_default: true,
  theme: 'dark'
}

// Wrapper function that provides mock responses in browser
export async function invokeWithFallback<T>(
  command: string,
  args?: any
): Promise<T> {
  // Try Tauri first via dynamic import (works even if globals missing)
  try {
    const { invoke } = await import('@tauri-apps/api/tauri')
    return await invoke<T>(command, args)
  } catch (_e) {
    // Fall through to mock
  }

  // Running in browser - allow mocks in dev by default or if explicitly enabled
  if (!shouldUseMock()) {
    throw new Error(`Tauri not available and mocks disabled for command: ${command}`)
  }
  console.warn(`[DEV MODE] Mocking Tauri command: ${command}`, args)
  
  // Mock responses based on command
  switch (command) {
    case 'agents_list':
      return { ok: true, agents: mockAgents } as T
    
    case 'projects_list':
      return { ok: true, projects: mockProjects } as T
    
    case 'config_update':
      return { ok: true, config: { ...mockConfig, ...args?.partial_config } } as T
    
    case 'agents_register':
      mockAgents.push(args?.payload?.agent || {})
      return { ok: true } as T
    
    case 'agents_delete':
      const index = mockAgents.findIndex(a => a.name === args?.name)
      if (index > -1) mockAgents.splice(index, 1)
      return { ok: true } as T
    
    case 'agents_enable':
      const agent = mockAgents.find(a => a.name === args?.name)
      if (agent) agent.enabled = args?.enabled
      return { ok: true } as T
    
    case 'agents_test':
      return { 
        ok: true, 
        latency_ms: Math.floor(Math.random() * 100) + 50,
        health: 'healthy' 
      } as T
    
    case 'run_start':
      const newProject = {
        id: `mock-${Date.now()}`,
        type: args?.project?.type || 'custom',
        prompt: args?.project?.prompt || '',
        status: 'queued',
        created_at: new Date().toISOString(),
        offline_only: false
      }
      mockProjects.push(newProject)
      return { ok: true, project_id: newProject.id } as T
    
    case 'projects_delete':
      const projectIndex = mockProjects.findIndex(p => p.id === args?.project_id)
      if (projectIndex > -1) mockProjects.splice(projectIndex, 1)
      return { ok: true } as T
    
    case 'projects_cancel':
      const projectToCancel = mockProjects.find(p => p.id === args?.project_id)
      if (projectToCancel) projectToCancel.status = 'cancelled'
      return { ok: true } as T
    
    case 'projects_status':
      return { 
        ok: true, 
        status: 'running',
        tasks_summary: { total: 5, completed: 2, failed: 0 }
      } as T
    
    case 'projects_logs':
      return { 
        ok: true, 
        lines: ['[INFO] Project started', '[INFO] Processing...', '[INFO] Task completed']
      } as T
    
    case 'tasks_list':
      return { 
        ok: true, 
        tasks: []
      } as T
    
    case 'queue_start':
      // Update all queued projects to running in mock mode
      mockProjects.forEach(p => {
        if (p.status === 'queued') p.status = 'running'
      })
      return { ok: true } as T
    
    case 'queue_pause':
      // Update all running projects to paused in mock mode
      mockProjects.forEach(p => {
        if (p.status === 'running') p.status = 'paused'
      })
      return { ok: true } as T
    
    case 'queue_resume':
      // Update all paused projects to running in mock mode
      mockProjects.forEach(p => {
        if (p.status === 'paused') p.status = 'running'
      })
      return { ok: true } as T
    
    case 'notifications_test':
      return { ok: true } as T
    
    case 'templates_list':
      return { ok: true, templates: [] } as T
    
    case 'terminal_exec':
      return { 
        ok: true, 
        stdout: 'Mock output', 
        stderr: '', 
        exit_code: 0 
      } as T
    
    case 'tasks_update_priorities':
      console.log('[DEV MODE] Task priorities updated', args)
      return { ok: true } as T
    
    case 'tools_list':
      return { 
        tools: []  // Empty tools list in dev mode
      } as T
    
    case 'tools_detect':
      return { 
        detected: {}  // No tools detected in dev mode
      } as T
    
    case 'tools_validate':
      return { 
        valid: false,
        version: null
      } as T
    
    case 'tools_install':
      return { 
        success: false,
        message: 'Tool installation not available in dev mode',
        command: '',
        url: ''
      } as T
    
    case 'tools_get_for_capability':
      return { 
        tools: []
      } as T
    
    default:
      console.warn(`[DEV MODE] Unknown command: ${command}`)
      return { ok: true } as T
  }
}

// Export a helper to check if we're in dev mode
export const isDevMode = () => !isTauriAvailable()