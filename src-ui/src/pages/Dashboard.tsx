import React, { useEffect, useState } from 'react'
import { 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Eye, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  Zap,
  Activity,
  Users,
  Folder,
  Send,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  Bot,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Settings,
  GitBranch,
  Loader2,
  HelpCircle,
  PlayCircle
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import { invokeWithFallback as invoke } from '../ipc/tauriWrapper'
import * as api from '../ipc/commands'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import './Dashboard.css'
import { Card } from '../components/UI/Card'

const projectTypes = [
  { id: 'code_generation', name: 'Code', icon: FileCode, bgGradient: 'from-blue-600 to-blue-700', accent: 'text-blue-400' },
  { id: 'text_generation', name: 'Text', icon: FileText, bgGradient: 'from-green-600 to-green-700', accent: 'text-green-400' },
  { id: 'image_generation', name: 'Image', icon: Image, bgGradient: 'from-purple-600 to-purple-700', accent: 'text-purple-400' },
  { id: 'audio_generation', name: 'Audio', icon: Music, bgGradient: 'from-yellow-600 to-yellow-700', accent: 'text-yellow-400' },
  { id: 'video_generation', name: 'Video', icon: Video, bgGradient: 'from-red-600 to-red-700', accent: 'text-red-400' },
  { id: 'multi_modal', name: 'Multi', icon: Bot, bgGradient: 'from-brand-600 to-brand-700', accent: 'text-brand-400' }
]

type RunningTaskItem = { id: string; project_id: string; task_type: string; capability: string; status: string; updated_at?: string }

export default function Dashboard() {
  const navigate = useNavigate()
  const { 
    projects, 
    agents, 
    queueStatus, 
    removeProject, 
    updateProjectStatus,
    setActiveProject,
    setQueueStatus,
    fetchProjects,
    config,
    updateConfig
  } = useAppStore()
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({})
  const [prompt, setPrompt] = useState('')
  const [selectedType, setSelectedType] = useState('code_generation')
  const [isCreating, setIsCreating] = useState(false)
  const [showActivityDropdown, setShowActivityDropdown] = useState(false)
  const [showLazyQueueTooltip, setShowLazyQueueTooltip] = useState(false)
  const [hastyStart, setHastyStart] = useState(false)
  const [showHastyTooltip, setShowHastyTooltip] = useState(false)
  const [lazyQueueEnabled, setLazyQueueEnabled] = useState(false)
  const [isTogglingLazy, setIsTogglingLazy] = useState(false)
  const [showTokenTooltip, setShowTokenTooltip] = useState(false)
  const greetings = [
    'What are we doing today?',
    'Have any new ideas?',
    "Let\'s get building!",
    'Ready to orchestrate something great?'
  ]
  const [greeting, setGreeting] = useState('')
  const [runningTasks, setRunningTasks] = useState<RunningTaskItem[]>([])
  const isGradientGreeting = greeting === "Let's get building!"

  useEffect(() => {
    setGreeting(greetings[Math.floor(Math.random() * greetings.length)])
  }, [])

  // Poll backend for running tasks
  useEffect(() => {
    let cancelled = false
    const fetchTasks = async () => {
      try {
        const res = await api.tasksListAll() as any
        if (!cancelled && res?.ok) {
          const tasks = (res.tasks as any[]).filter(t => t.status === 'running') as RunningTaskItem[]
          setRunningTasks(tasks)
        }
      } catch (e) {
        // noop
      }
    }
    fetchTasks()
    const id = setInterval(fetchTasks, 3000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const stats = {
    queuedProjects: projects.filter(p => p.status === 'queued').length,
    runningProjects: projects.filter(p => p.status === 'running').length,
    savedProjects: projects.filter(p => p.status === 'paused').length,
    activeAgents: agents.filter(a => a.enabled).length
  }

  const handleQuickCreate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setIsCreating(true)
    try {
      navigate('/create-project', { 
        state: { 
          prompt: prompt.trim(), 
          type: selectedType,
          hasty: hastyStart
        } 
      })
      toast.success('Creating project...')
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleProjectAction = async (projectId: string, action: 'play' | 'pause' | 'cancel' | 'delete' | 'view' | 'workflow') => {
    const actionKey = `${projectId}-${action}`
    setLoadingActions(prev => ({ ...prev, [actionKey]: true }))
    
    try {
      switch (action) {
        case 'play':
          await updateProjectStatus(projectId, 'running')
          if (queueStatus === 'idle') {
            await setQueueStatus('running')
          }
          toast.success('Project started')
          break
          
        case 'pause':
          await updateProjectStatus(projectId, 'paused')
          toast.success('Project paused')
          break
          
        case 'cancel':
          await updateProjectStatus(projectId, 'cancelled')
          toast.success('Project cancelled')
          break
          
        case 'delete':
          if (window.confirm('Are you sure you want to delete this project?')) {
            await removeProject(projectId)
            toast.success('Project deleted')
          }
          break
          
        case 'view':
          setActiveProject(projectId)
          setSelectedProject(projectId)
          toast.success('Project selected')
          break

        case 'workflow':
          setActiveProject(projectId)
          navigate('/workflow-builder', { state: { projectId } })
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} project:`, error)
      toast.error(`Failed to ${action} project`)
    } finally {
      setLoadingActions(prev => ({ ...prev, [actionKey]: false }))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'queued': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-dark-700/50 text-dark-400 border-dark-600'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  // Refresh removed

  const handleLazyQueue = async () => {
    try {
      setIsTogglingLazy(true)
      if (!lazyQueueEnabled) {
        // Enable lazy queue and load saved projects
        const result = await invoke('queue_load_saved_projects', { limit: 5 }) as any
        if ((result?.loaded || 0) > 0) {
          toast.success(`Lazy Queue enabled - loaded ${result.loaded} saved projects`)
          // Start processing if queue was empty
          await invoke('queue_process_lazy')
        } else {
          toast('Lazy Queue enabled - no saved projects found')
        }
        setLazyQueueEnabled(true)
      } else {
        // Disable lazy queue
        setLazyQueueEnabled(false)
        toast.success('Lazy Queue disabled')
      }
      // Refresh the projects list
      await fetchProjects()
    } catch (error) {
      toast.error(`Failed to toggle lazy queue: ${error}`)
    }
    finally {
      setIsTogglingLazy(false)
    }
  }

  return (
    <div className="h-full bg-dark-950 overflow-hidden flex flex-col">
      {/* Header Section */}
      <div className="bg-dark-900 border-b border-dark-800">
        <div className="px-8 py-5">
          <div className="grid grid-cols-3 items-center mb-4">
            <div />
            <div className="text-center">
              <h1 className={clsx(
                'text-3xl font-bold py-4',
                isGradientGreeting ? 'bg-gradient-to-r from-brand-500 to-brand-400 bg-clip-text text-transparent' : 'text-white'
              )}>{greeting}</h1>
            </div>
            <div />
          </div>

          {/* Quick Create Section */}
          <Card className="p-4 mb-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && hastyStart) {
                      e.preventDefault()
                      handleQuickCreate()
                    }
                  }}
                  placeholder="Enter your prompt to create a new project..."
                  className="w-full px-4 py-3 bg-dark-900 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              
              <div className="flex gap-2">
                {projectTypes.map((type) => {
                  const Icon = type.icon
                  const isSelected = selectedType === type.id
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={clsx(
                        'relative px-4 py-3 rounded-lg transition-all duration-200',
                        isSelected
                          ? 'bg-dark-700 border-2 border-brand-500 shadow-lg transform scale-105'
                          : 'bg-dark-800 hover:bg-dark-700 border border-dark-700'
                      )}
                      title={type.name}
                    >
                      <Icon 
                        size={22} 
                        className={clsx(
                          'transition-colors',
                          type.accent
                        )}
                      />
                      {isSelected && (
                        <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-brand-500 rounded-full"></span>
                      )}
                    </button>
                  )
                })}
              </div>
              
              <button
                onClick={handleQuickCreate}
                disabled={isCreating || !prompt.trim()}
                className={clsx(
                  'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
                  prompt.trim()
                    ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-dark-800 text-dark-500 cursor-not-allowed'
                )}
              >
                <Send size={18} />
                <span>Create</span>
              </button>
              
              <div className="relative flex flex-col items-center whitespace-nowrap">
                <button
                  onClick={handleLazyQueue}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLazyQueue() } }}
                  disabled={isTogglingLazy}
                  role="switch"
                  aria-checked={lazyQueueEnabled}
                  tabIndex={0}
                  className={clsx(
                    'w-10 h-6 rounded-full border transition-colors relative',
                    lazyQueueEnabled ? 'bg-green-500/30 border-green-500/50' : 'bg-dark-800 border-dark-700',
                    isTogglingLazy && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span
                    className={clsx(
                      'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all bg-toggle-slider',
                      lazyQueueEnabled ? 'right-1' : 'left-1'
                    )}
                  />
                </button>
                <div className="mt-1 flex items-center">
                  <span className="text-xs text-dark-300 mr-1">Lazy Queue</span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-full hover:bg-dark-600 border border-dark-700 transition-colors flex items-center justify-center"
                    onMouseEnter={() => setShowLazyQueueTooltip(true)}
                    onMouseLeave={() => setShowLazyQueueTooltip(false)}
                    aria-label="What is Lazy Queue?"
                  >
                    <HelpCircle size={14} className="text-dark-400 hover:text-white" />
                  </button>
                </div>
                {showLazyQueueTooltip && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-80 p-4 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50">
                    <div className="flex items-start gap-2">
                      <HelpCircle size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-1">Lazy Queue</h4>
                        <p className="text-xs text-dark-300">
                          Automatically queues saved projects when nothing else is running. 
                          Perfect for running lower-priority tasks during idle time.
                        </p>
                        <p className="text-xs text-dark-400 mt-2">
                          Status: <span className={lazyQueueEnabled ? 'text-green-400' : 'text-dark-500'}>
                            {lazyQueueEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative flex items-center gap-2 pl-3 border-l border-dark-700 whitespace-nowrap">
                <div className="relative flex flex-col items-center">
                  <button
                    onClick={() => setHastyStart((v) => !v)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHastyStart((v) => !v) } }}
                    role="switch"
                    aria-checked={hastyStart}
                    tabIndex={0}
                    className={clsx(
                      'w-10 h-6 rounded-full border transition-colors relative',
                      hastyStart ? 'bg-green-500/30 border-green-500/50' : 'bg-dark-800 border-dark-700'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all bg-toggle-slider',
                        hastyStart ? 'right-1' : 'left-1'
                      )}
                    />
                  </button>
                  <div className="mt-1 flex items-center">
                    <span className="text-xs text-dark-300 mr-1">Hasty start</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full hover:bg-dark-600 border border-dark-700 transition-colors flex items-center justify-center"
                      onMouseEnter={() => setShowHastyTooltip(true)}
                      onMouseLeave={() => setShowHastyTooltip(false)}
                      aria-label="What is Hasty start?"
                    >
                      <HelpCircle size={14} className="text-dark-400 hover:text-white" />
                    </button>
                  </div>
                  {showHastyTooltip && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-96 p-4 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 text-left">
                      <div className="flex items-start gap-2">
                        <HelpCircle size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-1">Hasty start</h4>
                          <p className="text-xs text-dark-300">
                            Start as soon as you hit Enter. You can hot-modify the workflow while it runs;
                            modifications will halt each successive task per parallel branch.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative flex items-center gap-2 pl-3 border-l border-dark-700 whitespace-nowrap">
                <div className="relative flex flex-col items-center">
                  <button
                    onClick={() => updateConfig({ ignore_task_token_limits: !config.ignore_task_token_limits })}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); updateConfig({ ignore_task_token_limits: !config.ignore_task_token_limits }) } }}
                    role="switch"
                    aria-checked={!!config.ignore_task_token_limits}
                    tabIndex={0}
                    className={clsx(
                      'w-10 h-6 rounded-full border transition-colors relative',
                      config.ignore_task_token_limits ? 'bg-green-500/30 border-green-500/50' : 'bg-dark-800 border-dark-700'
                    )}
                  >
                    <span
                      className={clsx(
                        'absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all bg-toggle-slider',
                        config.ignore_task_token_limits ? 'right-1' : 'left-1'
                      )}
                    />
                  </button>
                  <div className="mt-1 flex items-center">
                    <span className="text-xs text-dark-300 mr-1">Ignore atomic task token limits</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full hover:bg-dark-600 border border-dark-700 transition-colors flex items-center justify-center"
                      onMouseEnter={() => setShowTokenTooltip(true)}
                      onMouseLeave={() => setShowTokenTooltip(false)}
                      aria-label="What does 'Ignore token limits' do?"
                    >
                      <HelpCircle size={14} className="text-dark-400 hover:text-white" />
                    </button>
                  </div>
                  {showTokenTooltip && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-96 p-4 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 text-left">
                      <div className="flex items-start gap-2">
                        <HelpCircle size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-white mb-1">Ignore atomic task token limits</h4>
                          <p className="text-xs text-dark-300">Allows tasks to exceed their default token caps. Use sparingly as this increases cost and latency.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto scrollbar-thin px-8 py-6">
        <div className="flex gap-6">
          {/* Left Column - Stats and Projects */}
          <div className="flex-1">
            {/* Stats Cards Container */}
            <Card className="p-5 mb-6">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-dark-800 rounded-lg border border-dark-700 p-3 hover:bg-dark-750 hover:border-dark-600 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-yellow-500/20 rounded-lg">
                      <Clock className="text-yellow-400" size={20} />
                    </div>
                    <span className="text-xs text-yellow-500 uppercase tracking-wide">Queue</span>
                  </div>
                  <div className="text-xl font-bold text-yellow-400">{stats.queuedProjects}</div>
                  <div className="text-xs text-dark-400 mt-0.5">Queued</div>
                </div>
                
                <div className="bg-dark-800 rounded-lg border border-dark-700 p-3 hover:bg-dark-750 hover:border-dark-600 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-green-500/20 rounded-lg">
                      <Activity className="text-green-400" size={20} />
                    </div>
                    <span className="text-xs text-green-500 uppercase tracking-wide">Active</span>
                  </div>
                  <div className="text-xl font-bold text-green-400">{stats.runningProjects}</div>
                  <div className="text-xs text-dark-400 mt-0.5">Running</div>
                </div>

                <div className="bg-dark-800 rounded-lg border border-dark-700 p-3 hover:bg-dark-750 hover:border-dark-600 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                      <Folder className="text-blue-400" size={20} />
                    </div>
                    <span className="text-xs text-blue-500 uppercase tracking-wide">Saved</span>
                  </div>
                  <div className="text-xl font-bold text-blue-400">{stats.savedProjects}</div>
                  <div className="text-xs text-dark-400 mt-0.5">For Later</div>
                </div>

                <div className="bg-dark-800 rounded-lg border border-dark-700 p-3 hover:bg-dark-750 hover:border-dark-600 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 bg-brand-500/20 rounded-lg">
                      <Users className="text-brand-400" size={20} />
                    </div>
                    <span className="text-xs text-brand-500 uppercase tracking-wide">Ready</span>
                  </div>
                  <div className="text-xl font-bold text-brand-400">{stats.activeAgents}</div>
                  <div className="text-xs text-dark-400 mt-0.5">Agents</div>
                </div>
              </div>
            </Card>

            {/* Projects Section */}
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Recent Projects</h2>
                <button 
                  className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-all"
                  onClick={() => navigate('/projects')}
                >
                  View All
                  <ChevronRight size={16} />
                </button>
              </div>

              {projects.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {projects.slice(0, 4).map(project => {
                    const projectType = projectTypes.find(t => t.id === project.type)
                    const Icon = projectType?.icon || Bot
                    
                    return (
                      <div key={project.id} className="bg-dark-800 rounded-lg border border-dark-700 p-4 hover:border-dark-600 hover:bg-dark-750 transition-all group">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon size={16} className={projectType?.accent || 'text-dark-400'} />
                            <h3 className="text-sm font-medium text-white">{project.type.replace('_', ' ')}</h3>
                          </div>
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full border', getStatusColor(project.status))}>
                            {project.status}
                          </span>
                        </div>
                        
                        <p className="text-xs text-dark-400 mb-3 line-clamp-2">{project.prompt}</p>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-dark-500 flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(project.created_at)}
                          </span>
                          <div className="flex gap-1">
                            <button 
                              className="p-1.5 bg-dark-800 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-all"
                              onClick={() => handleProjectAction(project.id, 'workflow')}
                              title="Edit workflow"
                            >
                              <GitBranch size={14} />
                            </button>
                            <button 
                              className="p-1.5 bg-dark-800 hover:bg-dark-700 rounded text-dark-400 hover:text-white transition-all"
                              onClick={() => handleProjectAction(project.id, 'view')}
                              title="View details"
                            >
                              <Eye size={14} />
                            </button>
                            {project.status === 'queued' || project.status === 'paused' ? (
                              <button 
                                className="p-1.5 bg-dark-700 hover:bg-green-500/20 border border-dark-600 hover:border-green-500/50 rounded text-dark-400 hover:text-green-400 transition-all"
                                onClick={() => handleProjectAction(project.id, 'play')}
                                title="Start"
                              >
                                <Play size={14} />
                              </button>
                            ) : project.status === 'running' ? (
                              <button 
                                className="p-1.5 bg-dark-700 hover:bg-yellow-500/20 border border-dark-600 hover:border-yellow-500/50 rounded text-dark-400 hover:text-yellow-400 transition-all"
                                onClick={() => handleProjectAction(project.id, 'pause')}
                                title="Pause"
                              >
                                <Pause size={14} />
                              </button>
                            ) : null}
                            <button 
                              className="p-1.5 bg-dark-700 hover:bg-red-500/20 border border-dark-600 hover:border-red-500/50 rounded text-dark-400 hover:text-red-400 transition-all"
                              onClick={() => handleProjectAction(project.id, 'delete')}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-dark-800 rounded-lg border border-dark-700 p-12 text-center">
                  <Layers size={48} className="text-dark-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">No Projects Yet</h3>
                  <p className="text-sm text-dark-400 mb-6">Enter a prompt above to create your first project</p>
                  <button
                    onClick={() => document.querySelector('input')?.focus()}
                    className="px-6 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg text-white transition-all"
                  >
                    Get Started
                  </button>
                </div>
              )}
            </Card>

            {/* Activity Feed */}
            <div className="mb-6">
              <Card>
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowActivityDropdown(!showActivityDropdown)}
                >
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    Recent Activity
                    {showActivityDropdown ? 
                      <ChevronDown size={20} className="text-dark-500" /> : 
                      <ChevronRight size={20} className="text-dark-500" />
                    }
                  </h2>
                  <div className="flex items-center gap-3 text-sm">
                    <Zap size={18} className="text-yellow-500" />
                    <span className="text-dark-300">System initialized and ready</span>
                    <span className="text-xs text-dark-500">2m ago</span>
                  </div>
                </div>
                {showActivityDropdown && (
                  <div className="mt-3 rounded-xl border border-dark-800 overflow-hidden">
                    <div className="p-4 space-y-3 max-h-72 overflow-auto scrollbar-thin bg-dark-900 rounded-xl">
                      <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                        <Zap size={18} className="text-yellow-500" />
                        <span className="text-sm text-dark-300 flex-1">System initialized and ready</span>
                        <span className="text-xs text-dark-500">2m ago</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                        <Users size={18} className="text-brand-500" />
                        <span className="text-sm text-dark-300 flex-1">3 agents connected successfully</span>
                        <span className="text-xs text-dark-500">5m ago</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-800 transition-colors">
                        <CheckCircle size={18} className="text-green-500" />
                        <span className="text-sm text-dark-300 flex-1">Health check completed</span>
                        <span className="text-xs text-dark-500">10m ago</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Right Column - Running Queue */}
          <div className="w-96">
            <Card className="p-0 card-no-padding h-full overflow-hidden">
              <div className="px-6 py-4 border-b border-dark-800 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Running Queue</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-dark-500">Live</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {runningTasks.length > 0 ? (
                  runningTasks.map(task => {
                    const project = projects.find(p => p.id === task.project_id)
                    const typeId = (task.capability || '').toLowerCase().includes('image') ? 'image_generation' :
                      (task.capability || '').toLowerCase().includes('code') ? 'code_generation' :
                      (task.capability || '').toLowerCase().includes('text') ? 'text_generation' : 'multi_modal'
                    const projectType = projectTypes.find(t => t.id === typeId)
                    const Icon = projectType?.icon || Bot
                    const label = task.task_type || 'task'
                    const projectName = project?.prompt || project?.type || task.project_id
                    const updated = task.updated_at ? new Date(task.updated_at) : null
                    const age = updated ? `${Math.max(1, Math.floor((Date.now() - updated.getTime())/60000))}m ago` : ''
                    return (
                      <div key={task.id} className="bg-dark-800 rounded-lg border border-dark-700 p-4 hover:border-dark-600 transition-all">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon size={14} className={projectType?.accent || 'text-dark-400'} />
                            <div>
                              <h4 className="text-sm font-medium text-white">{label}</h4>
                              <p className="text-xs text-dark-500">{projectName}</p>
                            </div>
                          </div>
                          <span className="text-xs text-dark-500">{age}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-green-400">Running</span>
                          <button 
                            className="p-1 text-dark-400 hover:text-yellow-400 transition-colors"
                            title="Pause task"
                          >
                            <Pause size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-12">
                    <Activity size={32} className="text-dark-600 mx-auto mb-3" />
                    <p className="text-sm text-dark-400">No tasks running</p>
                    <p className="text-xs text-dark-500 mt-1">Start a project to see tasks here</p>
                  </div>
                )}
              </div>

              {runningTasks.length > 0 && (
                <div className="px-6 pb-6 pt-4 border-t border-dark-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-dark-500">Total Active Tasks</span>
                    <span className="text-brand-400 font-medium">{runningTasks.length}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}