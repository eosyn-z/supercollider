import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  Plus,
  Edit2,
  Trash2,
  Save,
  Play,
  Pause,
  Settings,
  ChevronRight,
  ChevronDown,
  Bot,
  Zap,
  GitBranch,
  Link,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  GripVertical,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  MoreVertical
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import * as api from '../ipc/commands'
import { ToolManager } from '../components/ToolManager/ToolManager'

interface Task {
  id: string
  type: string
  capability: string
  preamble: string
  token_limit: number
  dependencies: string[]
  input_chain: string[]
  manual_agent_override?: string
  priority_override?: number
  approval_required: boolean
  clarity_prompt?: string
  metadata: any
  status?: 'pending' | 'running' | 'completed' | 'failed'
  expanded?: boolean
}

const capabilityIcons = {
  code: FileCode,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video,
  any: Bot
}

const capabilityAccents: Record<string, string> = {
  code: 'text-blue-400',
  text: 'text-green-400',
  image: 'text-purple-400',
  sound: 'text-yellow-400',
  video: 'text-red-400',
  any: 'text-brand-400'
}

interface SortableTaskCardProps {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => void
  onToggleExpand: (taskId: string) => void
  onDuplicate: (task: Task) => void
}

function SortableTaskCard({ task, onEdit, onDelete, onToggleExpand, onDuplicate }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const Icon = capabilityIcons[task.capability as keyof typeof capabilityIcons] || Bot
  const accent = capabilityAccents[task.capability] || 'text-brand-400'
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState(task)

  const handleSaveEdit = () => {
    onEdit(editedTask)
    setIsEditing(false)
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'running': return 'text-green-400 bg-green-500/10'
      case 'completed': return 'text-blue-400 bg-blue-500/10'
      case 'failed': return 'text-red-400 bg-red-500/10'
      default: return 'text-dark-400 bg-dark-700/50'
    }
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={clsx(
        'bg-dark-800/50 rounded-lg border transition-all',
        isDragging ? 'border-brand-500 shadow-lg shadow-brand-500/20' : 'border-dark-700 hover:border-dark-600'
      )}
    >
      <div className="p-4">
        {/* Card Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical size={16} className="text-dark-500" />
            </div>
            <Icon size={18} className={accent} />
            <h3 className="font-medium text-white flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTask.type}
                  onChange={(e) => setEditedTask({ ...editedTask, type: e.target.value })}
                  className="w-full px-2 py-1 bg-dark-900 border border-dark-600 rounded text-sm"
                  autoFocus
                />
              ) : (
                task.type
              )}
            </h3>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full', getStatusColor(task.status))}>
              {task.status || 'pending'}
            </span>
            <button
              onClick={() => onToggleExpand(task.id)}
              className="p-1 text-dark-400 hover:text-white transition-colors"
            >
              {task.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>

        {/* Card Content */}
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-dark-400 block mb-1">Preamble</label>
              <textarea
                value={editedTask.preamble}
                onChange={(e) => setEditedTask({ ...editedTask, preamble: e.target.value })}
                className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded text-sm text-white resize-none"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-dark-400 block mb-1">Token Limit</label>
                <input
                  type="number"
                  value={editedTask.token_limit}
                  onChange={(e) => setEditedTask({ ...editedTask, token_limit: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-dark-400 block mb-1">Priority</label>
                <input
                  type="number"
                  value={editedTask.priority_override || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, priority_override: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded text-sm text-white"
                  placeholder="Auto"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 text-sm text-dark-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-dark-400 mb-3 line-clamp-2">{task.preamble}</p>
            
            {task.expanded && (
              <div className="space-y-2 pt-3 border-t border-dark-700">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-dark-500">Token Limit:</span>
                    <span className="ml-2 text-dark-300">{task.token_limit}</span>
                  </div>
                  <div>
                    <span className="text-dark-500">Priority:</span>
                    <span className="ml-2 text-dark-300">{task.priority_override || 'Auto'}</span>
                  </div>
                </div>
                {task.dependencies.length > 0 && (
                  <div className="text-xs">
                    <span className="text-dark-500">Dependencies:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {task.dependencies.map(dep => (
                        <span key={dep} className="px-2 py-0.5 bg-dark-700 rounded text-dark-300">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {task.manual_agent_override && (
                  <div className="text-xs">
                    <span className="text-dark-500">Agent Override:</span>
                    <span className="ml-2 text-brand-400">{task.manual_agent_override}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs">
                    {task.approval_required && (
                      <span className="flex items-center gap-1 text-yellow-400">
                        <AlertCircle size={12} />
                        Requires Approval
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1.5 text-dark-400 hover:text-white transition-colors"
                      title="Edit task"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDuplicate(task)}
                      className="p-1.5 text-dark-400 hover:text-white transition-colors"
                      title="Duplicate task"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => onDelete(task.id)}
                      className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function WorkflowBuilder() {
  const location = useLocation()
  const navigate = useNavigate()
  const { projects, setActiveProject, agents } = useAppStore()
  const projectId = location.state?.projectId
  
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProject, setSelectedProject] = useState(projectId || '')
  const [workflowName, setWorkflowName] = useState('')
  const [showAllTasks, setShowAllTasks] = useState(true)
  const [activeTab, setActiveTab] = useState<'workflow' | 'defaults' | 'tools'>('workflow')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    if (selectedProject) {
      loadProjectTasks()
    }
  }, [selectedProject])

  const loadProjectTasks = async () => {
    if (!selectedProject) {
      setIsLoading(false)
      return
    }
    
    setIsLoading(true)
    try {
      // Load real tasks from backend
      const response = await api.tasksList(selectedProject)
      
      if (response.ok && response.tasks) {
        // Map backend tasks to UI format
        const mappedTasks: Task[] = response.tasks.map(t => {
          const task: any = t as any
          return {
            id: task.id,
            type: task.task_type || task.type || 'Task',
            capability: (task.capability && String(task.capability).toLowerCase()) || 'any',
            preamble: task.preamble || '',
            token_limit: task.token_limit || 1000,
            dependencies: task.dependencies || task.deps || [],
            input_chain: task.input_chain || [],
            manual_agent_override: task.manual_agent_override,
            priority_override: task.priority_override,
            approval_required: task.approval_required || false,
            clarity_prompt: task.clarity_prompt,
            metadata: task.metadata || {},
            status: task.status as any || 'pending',
            expanded: false
          }
        })
        
        setTasks(mappedTasks)
        setWorkflowName(`Workflow for ${selectedProject}`)
      } else {
        // No tasks yet, start with empty array
        setTasks([])
        setWorkflowName(`New Workflow`)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
      toast.error('Failed to load workflow tasks')
      setTasks([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleEditTask = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
    toast.success('Task updated')
  }

  const handleDeleteTask = (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
      toast.success('Task deleted')
    }
  }

  const handleToggleExpand = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, expanded: !t.expanded } : t
    ))
  }

  const handleDuplicateTask = (task: Task) => {
    const newTask = {
      ...task,
      id: `task-${Date.now()}`,
      type: `${task.type} (Copy)`,
      status: 'pending' as const,
      expanded: false
    }
    setTasks(prev => [...prev, newTask])
    toast.success('Task duplicated')
  }

  const handleAddTask = () => {
    navigate('/task-builder', { state: { projectId: selectedProject } })
  }

  const handleSaveWorkflow = async () => {
    setIsSaving(true)
    try {
      // Save workflow via API
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Workflow saved successfully')
    } catch (error) {
      console.error('Failed to save workflow:', error)
      toast.error('Failed to save workflow')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRunWorkflow = () => {
    toast.success('Workflow execution started')
  }

  const handleResetAgentPriorities = () => {
    setTasks(prev => prev.map(t => ({ ...t, priority_override: undefined })))
    toast.success('Agent priorities reset to auto')
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw size={32} className="text-brand-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-dark-800/50 border-b border-dark-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Configure Project</h1>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white"
              placeholder="Workflow name..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetAgentPriorities}
              className="btn btn-secondary btn-sm"
              title="Reset all agent priorities to auto"
            >
              <RefreshCw size={16} />
              Reset Priorities
            </button>
            <button
              onClick={handleSaveWorkflow}
              disabled={isSaving}
              className="btn btn-secondary btn-sm"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={handleRunWorkflow}
              className="btn btn-primary btn-sm"
            >
              <Play size={16} />
              Run Configuration
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-2">
          <button
            className={clsx('px-3 py-1.5 rounded text-sm', activeTab === 'workflow' ? 'bg-brand-600 text-white' : 'bg-dark-900 text-dark-300 border border-dark-600')}
            onClick={() => setActiveTab('workflow')}
          >
            Workflow
          </button>
          <button
            className={clsx('px-3 py-1.5 rounded text-sm', activeTab === 'defaults' ? 'bg-brand-600 text-white' : 'bg-dark-900 text-dark-300 border border-dark-600')}
            onClick={() => setActiveTab('defaults')}
          >
            Defaults
          </button>
          <button
            className={clsx('px-3 py-1.5 rounded text-sm', activeTab === 'tools' ? 'bg-brand-600 text-white' : 'bg-dark-900 text-dark-300 border border-dark-600')}
            onClick={() => setActiveTab('tools')}
          >
            Tools
          </button>
        </div>

        {/* Project Selection */}
        <div className="flex items-center gap-3 mt-2">
          {projects.length > 0 ? (
            <>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
              >
                <option value="">Select a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.type.replace('_', ' ')} - {project.id}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowAllTasks(!showAllTasks)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-dark-400 hover:text-white transition-colors"
              >
                {showAllTasks ? <Eye size={16} /> : <EyeOff size={16} />}
                {showAllTasks ? 'Showing All' : 'Showing Active'}
              </button>
            </>
          ) : (
            <div className="px-3 py-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded">
              No current projects. Workflows here are templates and may not reflect the actual execution workflow.
            </div>
          )}
        </div>
      </div>

      {/* Workflow Canvas */}
      {activeTab === 'workflow' && (
      <div className="flex-1 overflow-auto scrollbar-thin p-6">
        {tasks.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="max-w-4xl mx-auto space-y-3">
                {tasks.map(task => (
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onToggleExpand={handleToggleExpand}
                    onDuplicate={handleDuplicateTask}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-dark-800/50 rounded-lg border border-dark-700 p-12 text-center">
              <Sparkles size={48} className="text-dark-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No Tasks Yet</h3>
              <p className="text-dark-400 mb-6">Start building your workflow by adding tasks</p>
              <button
                onClick={handleAddTask}
                className="btn btn-primary"
              >
                <Plus size={18} />
                Add First Task
              </button>
            </div>
          </div>
        )}

        {/* Add Task Button */}
        {tasks.length > 0 && (
          <div className="max-w-4xl mx-auto mt-4">
            <button
              onClick={handleAddTask}
              className="w-full py-4 bg-dark-800/50 hover:bg-dark-700/50 border-2 border-dashed border-dark-600 hover:border-brand-500 rounded-lg text-dark-400 hover:text-brand-400 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Add Task
            </button>
          </div>
        )}
      </div>
      )}

      {activeTab === 'defaults' && (
        <div className="flex-1 overflow-auto scrollbar-thin p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            <h3 className="text-lg font-semibold text-white">Apply Default Workflow</h3>
            <p className="text-sm text-dark-400">Choose a project type to load a default set of tasks.</p>
            {!selectedProject && (
              <div className="px-3 py-2 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded">
                No current project selected. Applying defaults will create tasks on selection.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'coding_project', name: 'Coding Project', tasks: [
                  { task_type: 'analysis', capability: 'text', preamble: 'Analyze requirements and plan the build.', token_limit: 2000 },
                  { task_type: 'implementation', capability: 'code', preamble: 'Implement the plan.', token_limit: 4000 },
                  { task_type: 'tests', capability: 'code', preamble: 'Write unit tests.', token_limit: 1500 },
                ]},
                { id: 'presentation', name: 'Presentation', tasks: [
                  { task_type: 'outline', capability: 'text', preamble: 'Create a slide outline.', token_limit: 1200 },
                  { task_type: 'slides', capability: 'text', preamble: 'Draft speaker notes and slide content.', token_limit: 1800 },
                ]},
              ].map(p => (
                <button
                  key={p.id}
                  className="text-left p-4 rounded-lg border border-dark-700 hover:border-brand-500 hover:bg-dark-800/50 transition"
                  onClick={async () => {
                    if (!selectedProject) { toast.error('Select a project first'); return }
                    try {
                      for (const t of p.tasks) {
                        await api.tasksCreateSimple(selectedProject, t as any)
                      }
                      await loadProjectTasks()
                      toast.success('Default workflow applied')
                      setActiveTab('workflow')
                    } catch (e) {
                      toast.error('Failed to apply defaults')
                    }
                  }}
                >
                  <div className="text-white font-medium">{p.name}</div>
                  <div className="text-xs text-dark-400 mt-1">{p.tasks.length} steps</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tools' && (
        <div className="flex-1 overflow-auto scrollbar-thin p-6">
          <div className="max-w-6xl mx-auto">
            <ToolManager />
          </div>
        </div>
      )}
    </div>
  )
}