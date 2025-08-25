import React, { useState, useRef, useEffect } from 'react'
import { 
  Bot, 
  Code, 
  FileText, 
  Image, 
  Music, 
  Video,
  Edit2,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Settings,
  Link2,
  Zap
} from 'lucide-react'
import { invokeWithFallback as invoke } from '../../ipc/tauriWrapper'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import './WorkflowVisualizer.css'

interface Task {
  id: string
  task_id: string
  task_type: string
  capability: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked'
  dependencies: string[]
  input: any
  output?: any
  preamble?: string
  metadata?: any
  agent?: string
  tool?: string
  position?: { x: number; y: number }
  level?: number
}

interface WorkflowVisualizerProps {
  projectId: string
  tasks: Task[]
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void
  onTaskReorder?: (taskId: string, newPosition: number) => void
  editable?: boolean
}

const capabilityIcons = {
  text: FileText,
  code: Code,
  image: Image,
  sound: Music,
  video: Video,
  default: Bot
}

const statusColors = {
  queued: 'border-gray-500 bg-gray-500/10',
  running: 'border-yellow-500 bg-yellow-500/10 animate-pulse',
  completed: 'border-green-500 bg-green-500/10',
  failed: 'border-red-500 bg-red-500/10',
  blocked: 'border-orange-500 bg-orange-500/10'
}

export default function WorkflowVisualizer({ 
  projectId, 
  tasks: initialTasks, 
  onTaskUpdate, 
  onTaskReorder,
  editable = true 
}: WorkflowVisualizerProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [showReorderWarning, setShowReorderWarning] = useState(false)
  const [taskPositions, setTaskPositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate task positions based on dependencies
  useEffect(() => {
    calculateTaskPositions()
  }, [tasks])

  const calculateTaskPositions = () => {
    const positions = new Map<string, { x: number; y: number }>()
    const levels = new Map<string, number>()
    const TILE_WIDTH = 200
    const TILE_HEIGHT = 120
    const H_SPACING = 50
    const V_SPACING = 80

    // Calculate levels (depth in dependency graph)
    const calculateLevel = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0
      visited.add(taskId)
      
      const task = tasks.find(t => t.id === taskId)
      if (!task || task.dependencies.length === 0) return 0
      
      const depLevels = task.dependencies.map(depId => calculateLevel(depId, visited))
      return Math.max(...depLevels) + 1
    }

    // Group tasks by level
    const tasksByLevel = new Map<number, Task[]>()
    tasks.forEach(task => {
      const level = calculateLevel(task.id)
      levels.set(task.id, level)
      if (!tasksByLevel.has(level)) {
        tasksByLevel.set(level, [])
      }
      tasksByLevel.get(level)!.push(task)
    })

    // Position tasks
    tasksByLevel.forEach((levelTasks, level) => {
      const totalWidth = levelTasks.length * (TILE_WIDTH + H_SPACING) - H_SPACING
      const startX = -totalWidth / 2

      levelTasks.forEach((task, index) => {
        positions.set(task.id, {
          x: startX + index * (TILE_WIDTH + H_SPACING) + TILE_WIDTH / 2,
          y: level * (TILE_HEIGHT + V_SPACING) + TILE_HEIGHT / 2
        })
      })
    })

    setTaskPositions(positions)
  }

  const renderConnections = () => {
    const connections: JSX.Element[] = []
    
    tasks.forEach(task => {
      task.dependencies.forEach(depId => {
        const fromPos = taskPositions.get(depId)
        const toPos = taskPositions.get(task.id)
        
        if (fromPos && toPos) {
          // Calculate connection points (bottom of source to top of target)
          const x1 = fromPos.x
          const y1 = fromPos.y + 60 // Bottom of tile
          const x2 = toPos.x
          const y2 = toPos.y - 60 // Top of tile
          
          // Create curved path
          const midY = (y1 + y2) / 2
          const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
          
          connections.push(
            <g key={`${depId}-${task.id}`}>
              <path
                d={path}
                stroke="rgba(139, 92, 246, 0.3)"
                strokeWidth="2"
                fill="none"
                className="connection-line"
              />
              <circle
                cx={x2}
                cy={y2}
                r="4"
                fill="rgb(139, 92, 246)"
                className="connection-dot"
              />
            </g>
          )
        }
      })
    })
    
    return connections
  }

  const handleTaskClick = (task: Task) => {
    if (selectedTask?.id === task.id) {
      setSelectedTask(null)
    } else {
      setSelectedTask(task)
    }
  }

  const handleTaskEdit = (task: Task, field: string, value: any) => {
    const updatedTask = { ...task, [field]: value }
    const updatedTasks = tasks.map(t => t.id === task.id ? updatedTask : t)
    setTasks(updatedTasks)
    
    if (onTaskUpdate) {
      onTaskUpdate(task.id, { [field]: value })
    }
    
    // Save to backend
    invoke('tasks_update', {
      projectId,
      taskId: task.id,
      partial: { [field]: value }
    }).catch(err => {
      toast.error(`Failed to update task: ${err}`)
    })
  }

  const handleReorder = (task: Task, newPosition: number) => {
    setShowReorderWarning(true)
  }

  const confirmReorder = () => {
    setShowReorderWarning(false)
    toast.info('Branch recalculation required - dependencies may change')
    // Trigger recalculation
    calculateTaskPositions()
  }

  const renderTaskTile = (task: Task) => {
    const position = taskPositions.get(task.id) || { x: 0, y: 0 }
    const Icon = capabilityIcons[task.capability as keyof typeof capabilityIcons] || capabilityIcons.default
    const isEditing = editingTask === task.id
    const isSelected = selectedTask?.id === task.id

    return (
      <g
        key={task.id}
        transform={`translate(${position.x - 100}, ${position.y - 60})`}
        className="task-tile"
        onClick={() => handleTaskClick(task)}
      >
        {/* Tile background */}
        <rect
          x="0"
          y="0"
          width="200"
          height="120"
          rx="8"
          className={clsx(
            'task-tile-bg',
            statusColors[task.status],
            isSelected && 'stroke-brand-500 stroke-2'
          )}
          fill="rgba(17, 24, 39, 0.9)"
        />
        
        {/* Task header */}
        <g className="task-header">
          <Icon 
            x="10" 
            y="10" 
            size={20}
            className={`text-${task.capability === 'code' ? 'blue' : task.capability === 'text' ? 'green' : 'purple'}-400`}
          />
          <text
            x="35"
            y="25"
            className="text-sm font-medium fill-white"
          >
            {task.task_type}
          </text>
          
          {editable && (
            <g
              transform="translate(170, 10)"
              onClick={(e) => {
                e.stopPropagation()
                setEditingTask(isEditing ? null : task.id)
              }}
              className="cursor-pointer"
            >
              <Edit2 size={16} className="text-dark-400 hover:text-white" />
            </g>
          )}
        </g>
        
        {/* Task content */}
        {!isEditing ? (
          <>
            <text
              x="10"
              y="50"
              className="text-xs fill-dark-300"
            >
              Agent: {task.agent || 'Auto'}
            </text>
            {task.tool && (
              <text
                x="10"
                y="70"
                className="text-xs fill-dark-400"
              >
                Tool: {task.tool}
              </text>
            )}
            <text
              x="10"
              y="90"
              className="text-xs fill-dark-500"
            >
              {task.dependencies.length > 0 
                ? `Deps: ${task.dependencies.length}` 
                : 'Independent'}
            </text>
          </>
        ) : (
          <foreignObject x="5" y="40" width="190" height="75">
            <div className="task-edit-form">
              <select
                value={task.agent || 'auto'}
                onChange={(e) => handleTaskEdit(task, 'agent', e.target.value)}
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white mb-1"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="auto">Auto Select</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
              </select>
              
              <select
                value={task.capability}
                onChange={(e) => handleTaskEdit(task, 'capability', e.target.value)}
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white mb-1"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="text">Text</option>
                <option value="code">Code</option>
                <option value="image">Image</option>
                <option value="sound">Sound</option>
                <option value="video">Video</option>
              </select>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingTask(null)
                }}
                className="px-2 py-1 bg-brand-600 hover:bg-brand-700 rounded text-xs text-white w-full"
              >
                Done
              </button>
            </div>
          </foreignObject>
        )}
        
        {/* Status indicator */}
        <circle
          cx="190"
          cy="110"
          r="4"
          className={clsx(
            task.status === 'completed' && 'fill-green-500',
            task.status === 'failed' && 'fill-red-500',
            task.status === 'running' && 'fill-yellow-500 animate-pulse',
            task.status === 'queued' && 'fill-gray-500',
            task.status === 'blocked' && 'fill-orange-500'
          )}
        />
      </g>
    )
  }

  return (
    <div className="workflow-visualizer" ref={containerRef}>
      <div className="workflow-header">
        <h3 className="text-lg font-semibold text-white">Workflow Visualization</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={calculateTaskPositions}
            className="px-3 py-1 bg-dark-800 hover:bg-dark-700 rounded text-sm text-white flex items-center gap-1"
          >
            <Shuffle size={14} />
            Reorganize
          </button>
          <button
            className="px-3 py-1 bg-dark-800 hover:bg-dark-700 rounded text-sm text-white flex items-center gap-1"
          >
            <Settings size={14} />
            Settings
          </button>
        </div>
      </div>
      
      <div className="workflow-canvas">
        <svg
          ref={svgRef}
          width="100%"
          height="600"
          viewBox="-400 -50 800 700"
          className="workflow-svg"
        >
          {/* Render connections first (behind tiles) */}
          <g className="connections">
            {renderConnections()}
          </g>
          
          {/* Render task tiles */}
          <g className="tasks">
            {tasks.map(task => renderTaskTile(task))}
          </g>
        </svg>
      </div>
      
      {/* Selected task details */}
      {selectedTask && (
        <div className="task-details">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Task Details</h4>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-1 hover:bg-dark-700 rounded"
            >
              <X size={14} className="text-dark-400" />
            </button>
          </div>
          
          <div className="space-y-2">
            <div>
              <label className="text-xs text-dark-400">Preamble</label>
              <textarea
                value={selectedTask.preamble || ''}
                onChange={(e) => handleTaskEdit(selectedTask, 'preamble', e.target.value)}
                className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white"
                rows={3}
                disabled={!editable}
              />
            </div>
            
            <div>
              <label className="text-xs text-dark-400">Input</label>
              <pre className="text-xs text-dark-300 bg-dark-900 p-2 rounded overflow-auto max-h-32">
                {JSON.stringify(selectedTask.input, null, 2)}
              </pre>
            </div>
            
            {selectedTask.output && (
              <div>
                <label className="text-xs text-dark-400">Output</label>
                <pre className="text-xs text-dark-300 bg-dark-900 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(selectedTask.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Reorder warning modal */}
      {showReorderWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 max-w-md">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="text-yellow-500 mt-1" size={20} />
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Branch Recalculation Required</h3>
                <p className="text-sm text-dark-300">
                  Reordering tasks will require recalculating the dependency branch. 
                  This may affect task execution order and dependencies.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReorderWarning(false)}
                className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded text-sm text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmReorder}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded text-sm text-white"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}