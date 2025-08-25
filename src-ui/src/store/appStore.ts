import { create } from 'zustand'
import * as api from '../ipc/commands'

export interface Agent {
  name: string
  capabilities: ('code' | 'text' | 'image' | 'sound' | 'video')[]
  endpoint_url?: string
  enabled: boolean
  priority: number
  health: 'unknown' | 'healthy' | 'degraded' | 'unreachable'
  local: boolean
}

export interface Task {
  id: string
  project_id: string
  type: string
  capability: 'code' | 'text' | 'image' | 'sound' | 'video' | 'any'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'waiting_clarification' | 'paused' | 'cancelled'
  deps: string[]
  input_chain?: string[]
  preamble?: string
  token_limit?: number
  manual_agent_override?: string
  priority_override?: number
  metadata?: any
  approval_required?: boolean
  clarity_prompt?: string
}

export interface Project {
  id: string
  type: 'coding_project' | 'presentation' | 'report' | 'video' | 'custom'
  prompt: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'waiting_clarification' | 'paused' | 'cancelled'
  created_at: string
  tasks?: Task[]
  progress?: number
}

export interface TaskTypePriority {
  id: string
  name: string
  capability: 'code' | 'text' | 'image' | 'sound' | 'video' | 'any'
  priority: number
}

export interface Config {
  batching: {
    enabled: boolean
    batch_size: number
    concurrency: number
  }
  allowlist: string[]
  auto_start_queue: boolean
  approval_mode: 'automatic' | 'manual' | 'dynamic'
  silent_mode: boolean
  failure_strategy: 'halt' | 'continue'
  show_workflow_by_default: boolean
  theme: 'light' | 'dark' | 'system'
  task_priorities?: TaskTypePriority[]
  ignore_task_token_limits?: boolean
}

interface AppState {
  // Projects
  projects: Project[]
  activeProjectId: string | null
  queueStatus: 'idle' | 'running' | 'paused'
  
  // Agents
  agents: Agent[]
  
  // Config
  config: Config
  
  // UI State
  showWorkflowVisualization: boolean
  showFirstRunWizard: boolean
  notifications: Array<{id: string, type: 'info' | 'success' | 'error' | 'warning', message: string}>
  
  // Actions
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'status'>) => Promise<void>
  removeProject: (id: string) => Promise<void>
  updateProjectStatus: (id: string, status: Project['status']) => Promise<void>
  setActiveProject: (id: string | null) => void
  
  addAgent: (agent: Agent) => Promise<void>
  updateAgent: (name: string, updates: Partial<Agent>) => Promise<void>
  removeAgent: (name: string) => Promise<void>
  
  updateConfig: (updates: Partial<Config>) => Promise<void>
  toggleWorkflowVisualization: () => void
  setQueueStatus: (status: 'idle' | 'running' | 'paused') => Promise<void>
  
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
  
  completeFirstRun: () => void
  
  // Data fetchers
  fetchProjects: () => Promise<void>
  fetchAgents: () => Promise<void>
  fetchTasks: (projectId: string) => Promise<Task[]>
}

// Load theme from localStorage or default to 'dark'
const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark' | 'system' | null

const defaultConfig: Config = {
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
  theme: savedTheme || 'dark',
  ignore_task_token_limits: false
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  projects: [],
  activeProjectId: null,
  queueStatus: 'idle',
  agents: [],
  config: defaultConfig,
  showWorkflowVisualization: true,
  showFirstRunWizard: false, // Disable first run wizard for now
  notifications: [],
  
  // Actions
  addProject: async (project) => {
    try {
      const result = await api.runStart({
        type: project.type,
        prompt: project.prompt,
        config_override: undefined
      })
      
      if (result.ok && result.project_id) {
        // Fetch updated project list
        const { fetchProjects } = useAppStore.getState()
        await fetchProjects()
      }
    } catch (error) {
      console.error('Failed to add project:', error)
      throw error
    }
  },
  
  removeProject: async (id) => {
    try {
      await api.projectsDelete(id)
      set((state) => ({
        projects: state.projects.filter(p => p.id !== id),
        activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
      }))
    } catch (error) {
      console.error('Failed to remove project:', error)
      throw error
    }
  },
  
  updateProjectStatus: async (id, status) => {
    try {
      // Handle different status changes with appropriate API calls
      if (status === 'cancelled') {
        await api.projectsCancel(id)
      } else if (status === 'running') {
        // Start/resume the project - queue operations handle this
        await api.queueStart()
      } else if (status === 'paused') {
        // Pause the project
        await api.queuePause()
      }
      
      // Update local state
      set((state) => ({
        projects: state.projects.map(p => p.id === id ? { ...p, status } : p)
      }))
      
      // Fetch updated project list to sync with backend
      const { fetchProjects } = useAppStore.getState()
      await fetchProjects()
    } catch (error) {
      console.error('Failed to update project status:', error)
      throw error
    }
  },
  
  setActiveProject: (id) => set({ activeProjectId: id }),
  
  addAgent: async (agent) => {
    try {
      await api.agentsRegister(agent)
      const { fetchAgents } = useAppStore.getState()
      await fetchAgents()
    } catch (error) {
      console.error('Failed to add agent:', error)
      throw error
    }
  },
  
  updateAgent: async (name, updates) => {
    try {
      if ('enabled' in updates) {
        await api.agentsEnable(name, updates.enabled!)
      }
      set((state) => ({
        agents: state.agents.map(a => a.name === name ? { ...a, ...updates } : a)
      }))
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  },
  
  removeAgent: async (name) => {
    try {
      await api.agentsDelete(name)
      set((state) => ({
        agents: state.agents.filter(a => a.name !== name)
      }))
    } catch (error) {
      console.error('Failed to remove agent:', error)
      throw error
    }
  },
  
  updateConfig: async (updates) => {
    try {
      // Save theme to localStorage for immediate persistence
      if ('theme' in updates) {
        localStorage.setItem('app-theme', updates.theme!)
      }
      
      await api.configUpdate(updates)
      set((state) => ({
        config: { ...state.config, ...updates }
      }))
    } catch (error) {
      console.error('Failed to update config:', error)
      throw error
    }
  },
  
  toggleWorkflowVisualization: () => set((state) => ({
    showWorkflowVisualization: !state.showWorkflowVisualization
  })),
  
  setQueueStatus: async (status) => {
    try {
      switch (status) {
        case 'running':
          await api.queueStart()
          break
        case 'paused':
          await api.queuePause()
          break
        case 'idle':
          // No specific stop command, just pause
          await api.queuePause()
          break
      }
      set({ queueStatus: status })
    } catch (error) {
      console.error('Failed to set queue status:', error)
      throw error
    }
  },
  
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: `notif-${Date.now()}` }]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  completeFirstRun: () => set({ showFirstRunWizard: false }),
  
  // Data fetchers
  fetchProjects: async () => {
    try {
      const result = await api.projectsList()
      if (result.ok) {
        // Normalize backend shape (project_type) to frontend shape (type)
        const normalized = (result.projects as any[]).map((p: any) => ({
          id: p.id,
          type: (p.project_type || p.type || 'custom') as Project['type'],
          prompt: p.prompt,
          status: (p.status || 'queued') as Project['status'],
          created_at: typeof p.created_at === 'string' ? p.created_at : new Date(p.created_at).toISOString(),
        })) as Project[]
        set({ projects: normalized })
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  },
  
  fetchAgents: async () => {
    try {
      const result = await api.agentsList()
      if (result.ok) {
        set({ agents: result.agents as Agent[] })
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  },
  
  fetchTasks: async (projectId: string) => {
    try {
      const result = await api.tasksList(projectId)
      if (result.ok) {
        return result.tasks as Task[]
      }
      return []
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
      return []
    }
  }
}))