import React, { useState, useEffect } from 'react'
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
  RefreshCw,
  Download,
  Upload,
  ChevronRight,
  GitBranch,
  Settings,
  Layers
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as api from '../ipc/commands'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import WorkflowVisualizer from '../components/WorkflowVisualizer/WorkflowVisualizer'

interface Project {
  id: string
  project_type: string
  prompt: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  created_at: string
  updated_at: string
  clarity_score: number
  tasks_count: number
  completed_tasks: number
}

interface Task {
  id: string
  task_id: string
  task_type: string
  capability: string
  status: string
  dependencies: string[]
  input: any
  output?: any
  preamble?: string
  metadata?: any
  agent?: string
  tool?: string
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectTasks, setProjectTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all')

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      fetchProjectTasks(selectedProject.id)
    }
  }, [selectedProject])

  const fetchProjects = async () => {
    setIsLoading(true)
    try {
      const result = await api.projectsList() as any
      if (result.ok) {
        setProjects(result.projects || [])
      }
    } catch (error) {
      toast.error(`Failed to fetch projects: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProjectTasks = async (projectId: string) => {
    try {
      const result = await api.tasksList(projectId) as any
      if (result.ok) {
        setProjectTasks(result.tasks || [])
      }
    } catch (error) {
      toast.error(`Failed to fetch tasks: ${error}`)
    }
  }

  const handleProjectAction = async (projectId: string, action: string) => {
    try {
      switch (action) {
        case 'run':
          await api.executeProject(projectId)
          toast.success('Project execution started')
          break
        case 'pause':
          await api.queuePause()
          toast.success('Project paused')
          break
        case 'cancel':
          await api.projectsCancel(projectId)
          toast.success('Project cancelled')
          break
        case 'delete':
          if (confirm('Are you sure you want to delete this project?')) {
            await api.projectsDelete(projectId)
            toast.success('Project deleted')
          }
          break
      }
      await fetchProjects()
    } catch (error) {
      toast.error(`Action failed: ${error}`)
    }
  }

  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    if (!selectedProject) return
    
    try {
      await api.tasksUpdate(selectedProject.id, taskId, updates)
      await fetchProjectTasks(selectedProject.id)
      toast.success('Task updated')
    } catch (error) {
      toast.error(`Failed to update task: ${error}`)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="animate-spin text-yellow-500" size={16} />
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />
      case 'failed':
        return <XCircle className="text-red-500" size={16} />
      case 'paused':
        return <Pause className="text-orange-500" size={16} />
      default:
        return <Clock className="text-gray-500" size={16} />
    }
  }

  const filteredProjects = projects.filter(project => {
    if (filter === 'all') return true
    if (filter === 'active') return ['queued', 'running', 'paused'].includes(project.status)
    if (filter === 'completed') return project.status === 'completed'
    if (filter === 'failed') return project.status === 'failed'
    return true
  })

  return (
    <div className="h-full flex flex-col bg-dark-950">
      {/* Header */}
      <div className="bg-dark-900 border-b border-dark-800 px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Projects</h1>
            <p className="text-sm text-dark-400 mt-1">Manage and monitor your AI projects</p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/task-builder')}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-white flex items-center gap-2"
            >
              <Plus size={18} />
              New Project
            </button>
            
            <button
              onClick={fetchProjects}
              disabled={isLoading}
              className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-white"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="flex gap-2 mt-4">
          {(['all', 'active', 'completed', 'failed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-dark-800 text-dark-400 hover:text-white hover:bg-dark-700'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Projects list */}
        <div className="w-1/3 border-r border-dark-800 overflow-y-auto">
          {filteredProjects.length > 0 ? (
            <div className="p-4 space-y-2">
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className={clsx(
                    'p-4 rounded-lg border cursor-pointer transition-all',
                    selectedProject?.id === project.id
                      ? 'bg-dark-800 border-brand-500'
                      : 'bg-dark-900 border-dark-700 hover:bg-dark-800 hover:border-dark-600'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(project.status)}
                      <span className="text-sm font-medium text-white">
                        {project.project_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-dark-500">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-xs text-dark-400 line-clamp-2 mb-3">
                    {project.prompt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-dark-500">
                        Tasks: {project.completed_tasks}/{project.tasks_count}
                      </span>
                      <span className="text-xs text-dark-500">
                        Score: {(project.clarity_score * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="flex gap-1">
                      {project.status === 'queued' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleProjectAction(project.id, 'run')
                          }}
                          className="p-1 hover:bg-dark-700 rounded text-green-400"
                        >
                          <Play size={14} />
                        </button>
                      )}
                      {project.status === 'running' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleProjectAction(project.id, 'pause')
                          }}
                          className="p-1 hover:bg-dark-700 rounded text-yellow-400"
                        >
                          <Pause size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleProjectAction(project.id, 'delete')
                        }}
                        className="p-1 hover:bg-dark-700 rounded text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Layers size={48} className="text-dark-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No Projects</h3>
              <p className="text-sm text-dark-400 mb-4">
                {filter !== 'all' ? `No ${filter} projects` : 'Create your first project to get started'}
              </p>
              {filter !== 'all' && (
                <button
                  onClick={() => setFilter('all')}
                  className="text-sm text-brand-400 hover:text-brand-300"
                >
                  Show all projects
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Project details */}
        <div className="flex-1 overflow-hidden">
          {selectedProject ? (
            <div className="h-full flex flex-col">
              {/* Project header */}
              <div className="bg-dark-900 border-b border-dark-800 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">
                      {selectedProject.project_type.replace('_', ' ')}
                    </h2>
                    <p className="text-sm text-dark-400 mt-1">
                      {selectedProject.prompt}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowWorkflow(!showWorkflow)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-sm flex items-center gap-2',
                        showWorkflow
                          ? 'bg-brand-600 text-white'
                          : 'bg-dark-800 text-dark-400 hover:text-white'
                      )}
                    >
                      <GitBranch size={14} />
                      {showWorkflow ? 'Hide' : 'Show'} Workflow
                    </button>
                    
                    <button
                      className="px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm text-white flex items-center gap-2"
                    >
                      <Settings size={14} />
                      Configure
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Content area */}
              <div className="flex-1 overflow-hidden">
                {showWorkflow ? (
                  <WorkflowVisualizer
                    projectId={selectedProject.id}
                    tasks={projectTasks}
                    onTaskUpdate={handleTaskUpdate}
                    editable={selectedProject.status !== 'running'}
                  />
                ) : (
                  <div className="p-6 overflow-y-auto">
                    <h3 className="text-lg font-semibold text-white mb-4">Tasks</h3>
                    {projectTasks.length > 0 ? (
                      <div className="space-y-3">
                        {projectTasks.map(task => (
                          <div
                            key={task.id}
                            className="p-4 bg-dark-900 rounded-lg border border-dark-700"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(task.status)}
                                <span className="text-sm font-medium text-white">
                                  {task.task_type}
                                </span>
                                <span className="text-xs text-dark-500">
                                  ({task.capability})
                                </span>
                              </div>
                              
                              {task.agent && (
                                <span className="text-xs text-dark-400">
                                  Agent: {task.agent}
                                </span>
                              )}
                            </div>
                            
                            {task.preamble && (
                              <p className="text-xs text-dark-400 mb-2">
                                {task.preamble}
                              </p>
                            )}
                            
                            {task.dependencies.length > 0 && (
                              <div className="text-xs text-dark-500">
                                Dependencies: {task.dependencies.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="text-dark-600 mx-auto mb-3" size={32} />
                        <p className="text-sm text-dark-400">No tasks defined for this project</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Eye className="text-dark-600 mx-auto mb-4" size={48} />
                <h3 className="text-lg font-medium text-white mb-2">Select a Project</h3>
                <p className="text-sm text-dark-400">
                  Choose a project from the list to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}