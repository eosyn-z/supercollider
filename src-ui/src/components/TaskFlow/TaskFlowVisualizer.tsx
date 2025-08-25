import React, { useMemo, useCallback } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  getBezierPath,
  EdgeProps
} from 'reactflow'
import 'reactflow/dist/style.css'
import { 
  FileCode, 
  FileText, 
  Image, 
  Music, 
  Video, 
  Bot,
  CheckCircle,
  XCircle,
  Clock,
  PlayCircle,
  AlertCircle
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import clsx from 'clsx'

const capabilityIcons = {
  code: FileCode,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video,
  any: Bot
}

const statusColors = {
  queued: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400' },
  running: { bg: 'bg-brand-500/20', border: 'border-brand-500/50', text: 'text-brand-400' },
  completed: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400' },
  failed: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  blocked: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
  waiting_clarification: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400' },
  paused: { bg: 'bg-orange-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
  cancelled: { bg: 'bg-gray-600/20', border: 'border-gray-600/50', text: 'text-gray-500' }
}

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-400" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />
    case 'running':
      return <PlayCircle className="w-4 h-4 text-brand-400 animate-pulse" />
    case 'blocked':
    case 'waiting_clarification':
      return <AlertCircle className="w-4 h-4 text-yellow-400" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}

const CustomNode: React.FC<NodeProps> = ({ data }) => {
  const Icon = capabilityIcons[data.capability as keyof typeof capabilityIcons] || Bot
  const colors = statusColors[data.status as keyof typeof statusColors] || statusColors.queued
  const agent = data.agent || 'Auto-select'

  return (
    <div className={clsx(
      'px-4 py-3 rounded-lg border-2 min-w-[200px] transition-all',
      colors.bg,
      colors.border,
      'hover:scale-105 hover:shadow-lg'
    )}>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-2 h-2 bg-brand-500 border-2 border-dark-800"
      />
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={clsx('p-1.5 rounded', colors.bg)}>
            <Icon className={clsx('w-4 h-4', colors.text)} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">{data.label}</div>
            <div className="text-xs text-dark-400">{data.type}</div>
          </div>
        </div>
        <StatusIcon status={data.status} />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-dark-500">Agent:</span>
          <span className={clsx('font-medium', colors.text)}>{agent}</span>
        </div>
        {data.tokenLimit && (
          <div className="flex items-center justify-between">
            <span className="text-dark-500">Tokens:</span>
            <span className="text-dark-300">{data.tokenLimit}</span>
          </div>
        )}
        {data.priority && (
          <div className="flex items-center justify-between">
            <span className="text-dark-500">Priority:</span>
            <span className="text-dark-300">{data.priority}</span>
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom}
        className="w-2 h-2 bg-brand-500 border-2 border-dark-800"
      />
    </div>
  )
}

const CustomEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isActive = data?.isActive || false

  return (
    <>
      <path
        id={id}
        style={style}
        className={clsx(
          'react-flow__edge-path',
          isActive && 'animate-pulse'
        )}
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={2}
        stroke={isActive ? '#0ea5e9' : '#475569'}
      />
      {isActive && (
        <circle r="3" fill="#0ea5e9" className="animate-pulse">
          <animateMotion dur="2s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}
    </>
  )
}

const nodeTypes = {
  custom: CustomNode,
}

const edgeTypes = {
  custom: CustomEdge,
}

interface TaskFlowVisualizerProps {
  projectId: string
}

export default function TaskFlowVisualizer({ projectId }: TaskFlowVisualizerProps) {
  const { projects, agents } = useAppStore()
  const project = projects.find(p => p.id === projectId)

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!project?.tasks) {
      return { nodes: [], edges: [] }
    }

    // Use actual tasks from the project - no demo data
    const tasks = project.tasks || []

    // Calculate positions using a simple DAG layout
    const levels: { [key: string]: number } = {}
    const positions: { [key: string]: { x: number, y: number } } = {}
    
    // Assign levels based on dependencies
    const assignLevel = (taskId: string, visited = new Set<string>()): number => {
      if (levels[taskId] !== undefined) return levels[taskId]
      if (visited.has(taskId)) return 0
      visited.add(taskId)
      
      const task = tasks.find(t => t.id === taskId)
      if (!task || task.deps.length === 0) {
        levels[taskId] = 0
        return 0
      }
      
      const maxDepLevel = Math.max(...task.deps.map(depId => assignLevel(depId, visited)))
      levels[taskId] = maxDepLevel + 1
      return levels[taskId]
    }
    
    tasks.forEach(task => assignLevel(task.id))
    
    // Group tasks by level
    const tasksByLevel: { [level: number]: typeof tasks } = {}
    tasks.forEach(task => {
      const level = levels[task.id]
      if (!tasksByLevel[level]) tasksByLevel[level] = []
      tasksByLevel[level].push(task)
    })
    
    // Assign positions
    const levelCount = Object.keys(tasksByLevel).length
    const ySpacing = 120
    const xSpacing = 250
    
    Object.entries(tasksByLevel).forEach(([level, levelTasks]) => {
      const levelNum = parseInt(level)
      const tasksInLevel = levelTasks.length
      const startX = -(tasksInLevel - 1) * xSpacing / 2
      
      levelTasks.forEach((task, index) => {
        positions[task.id] = {
          x: startX + index * xSpacing,
          y: levelNum * ySpacing
        }
      })
    })

    // Create nodes
    const nodes: Node[] = tasks.map(task => ({
      id: task.id,
      type: 'custom',
      position: positions[task.id] || { x: 0, y: 0 },
      data: {
        label: task.id.replace('task-', 'Task '),
        type: task.type,
        capability: task.capability,
        status: task.status,
        tokenLimit: task.token_limit,
        priority: task.priority_override,
        agent: task.manual_agent_override || agents.find(a => 
          a.capabilities.includes(task.capability as any) && a.enabled
        )?.name
      }
    }))

    // Create edges
    const edges: Edge[] = []
    tasks.forEach(task => {
      task.deps.forEach(depId => {
        edges.push({
          id: `${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'custom',
          animated: tasks.find(t => t.id === depId)?.status === 'completed' && 
                    task.status === 'running',
          data: {
            isActive: task.status === 'running'
          }
        })
      })
    })

    return { nodes, edges }
  }, [project, agents])

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges)

  React.useEffect(() => {
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [flowNodes, flowEdges, setNodes, setEdges])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node)
    // Here you could open a modal to edit the task or view details
  }, [])

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center text-dark-500">
        <p>Project not found</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-dark-700/50 bg-dark-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Workflow Visualization</h3>
            <p className="text-sm text-dark-400 mt-1">
              {project.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - {project.tasks?.length || 0} Tasks
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-dark-400">Completed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-brand-500 animate-pulse"></div>
              <span className="text-dark-400">Running</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
              <span className="text-dark-400">Queued</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-dark-400">Failed</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-dark-900"
        >
          <Background color="#1e293b" gap={16} />
          <Controls className="bg-dark-800 border border-dark-700" />
          <MiniMap 
            className="bg-dark-800 border border-dark-700"
            nodeColor={(node) => {
              const status = node.data?.status
              const colors = statusColors[status as keyof typeof statusColors]
              return colors?.border.replace('border-', '').replace('/50', '') || '#475569'
            }}
          />
        </ReactFlow>
      </div>
    </div>
  )
}