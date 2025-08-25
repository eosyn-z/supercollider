import React, { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  GripVertical, 
  Code, 
  FileText, 
  Image, 
  Music, 
  Video, 
  Bot,
  Zap,
  Settings,
  ChevronRight,
  AlertCircle,
  Layers
} from 'lucide-react'
import clsx from 'clsx'
import { useAppStore } from '../../store/appStore'
import * as api from '../../ipc/commands'
import toast from 'react-hot-toast'

interface CapabilityPriority {
  capability: 'code' | 'text' | 'image' | 'sound' | 'video'
  priority: number
  agents: {
    name: string
    priority: number
    enabled: boolean
    health: string
  }[]
}

const capabilityIcons = {
  code: Code,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video
}

const capabilityColors = {
  code: 'from-blue-500 to-cyan-500',
  text: 'from-green-500 to-emerald-500',
  image: 'from-pink-500 to-rose-500',
  sound: 'from-purple-500 to-indigo-500',
  video: 'from-red-500 to-orange-500'
}

interface SortableCapabilityItemProps {
  capability: CapabilityPriority
  index: number
  expanded: boolean
  onToggleExpand: () => void
}

function SortableCapabilityItem({ capability, index, expanded, onToggleExpand }: SortableCapabilityItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: capability.capability })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = capabilityIcons[capability.capability]
  const activeAgents = capability.agents.filter(a => a.enabled).length

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'bg-dark-800/50 rounded-lg border transition-all',
        isDragging ? 'border-brand-500 shadow-lg shadow-brand-500/20 opacity-50' : 'border-dark-700/50',
        'hover:border-dark-600'
      )}
    >
      <div className="p-4">
        <div className="flex items-center space-x-4">
          <button
            {...attributes}
            {...listeners}
            className="p-2 rounded hover:bg-dark-500 transition-colors cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-5 h-5 text-dark-400" />
          </button>

          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${capabilityColors[capability.capability]}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white capitalize">{capability.capability}</h3>
            <p className="text-xs text-dark-400">
              {activeAgents} active agent{activeAgents !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs text-dark-500 mb-1">Priority</div>
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-brand-400">{index + 1}</span>
              </div>
            </div>
            
            <button
              onClick={onToggleExpand}
              className="p-2 rounded hover:bg-dark-500 transition-colors"
            >
              <ChevronRight className={clsx(
                'w-4 h-4 text-dark-400 transition-transform',
                expanded && 'rotate-90'
              )} />
            </button>
          </div>
        </div>

        {expanded && capability.agents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dark-700/50 space-y-2">
            <div className="text-xs text-dark-500 mb-2">Agent Priority Within Capability</div>
            {capability.agents.map((agent, agentIndex) => (
              <div
                key={agent.name}
                className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center">
                    <span className="text-xs text-dark-400">{agentIndex + 1}</span>
                  </div>
                  <Bot className={clsx(
                    'w-4 h-4',
                    agent.enabled ? 'text-brand-400' : 'text-dark-500'
                  )} />
                  <div>
                    <div className="text-sm text-white">{agent.name}</div>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className={clsx(
                        'text-xs',
                        agent.enabled ? 'text-green-400' : 'text-red-400'
                      )}>
                        {agent.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <span className="text-xs text-dark-500">•</span>
                      <span className={clsx(
                        'text-xs',
                        agent.health === 'healthy' ? 'text-green-400' :
                        agent.health === 'degraded' ? 'text-yellow-400' :
                        agent.health === 'unreachable' ? 'text-red-400' :
                        'text-gray-400'
                      )}>
                        {agent.health}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Zap className="w-3 h-3 text-brand-400" />
                  <span className="text-xs text-white font-medium">{agent.priority}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PriorityConfigurator() {
  const { agents } = useAppStore()
  const [expandedCapabilities, setExpandedCapabilities] = useState<Set<string>>(new Set())
  
  // Group agents by capability and sort
  const [capabilityPriorities, setCapabilityPriorities] = useState<CapabilityPriority[]>(() => {
    const capabilities: CapabilityPriority[] = []
    const capabilityMap = new Map<string, CapabilityPriority>()
    
    // Initialize all capabilities
    ;(['code', 'text', 'image', 'sound', 'video'] as const).forEach((cap, index) => {
      capabilityMap.set(cap, {
        capability: cap,
        priority: index + 1,
        agents: []
      })
    })
    
    // Group agents by capability
    agents.forEach(agent => {
      agent.capabilities.forEach(cap => {
        const capPriority = capabilityMap.get(cap)
        if (capPriority) {
          capPriority.agents.push({
            name: agent.name,
            priority: agent.priority,
            enabled: agent.enabled,
            health: agent.health
          })
        }
      })
    })
    
    // Sort agents within each capability by priority
    capabilityMap.forEach(cap => {
      cap.agents.sort((a, b) => b.priority - a.priority)
      capabilities.push(cap)
    })
    
    return capabilities.sort((a, b) => a.priority - b.priority)
  })
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setCapabilityPriorities((items) => {
        const oldIndex = items.findIndex((item) => item.capability === active.id)
        const newIndex = items.findIndex((item) => item.capability === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          priority: index + 1
        }))
        
        // Save priorities to backend
        const priorities: Record<string, number> = {}
        newItems.forEach(item => {
          priorities[item.capability] = item.priority
        })
        
        api.configUpdate({ priorities }).catch(err => {
          console.error('Failed to update capability priorities:', err)
          toast.error('Failed to save priority changes')
        })
        
        return newItems
      })
    }
  }

  const toggleExpand = (capability: string) => {
    setExpandedCapabilities(prev => {
      const next = new Set(prev)
      if (next.has(capability)) {
        next.delete(capability)
      } else {
        next.add(capability)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Capability & Agent Priority</h3>
          <p className="text-sm text-dark-400">
            Configure execution priority by capability and agent distribution
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/30 rounded-lg">
          <Settings className="w-4 h-4 text-brand-400" />
          <span className="text-xs text-brand-400 font-medium">Advanced Config</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={capabilityPriorities.map(c => c.capability)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {capabilityPriorities.map((capability, index) => (
              <SortableCapabilityItem
                key={capability.capability}
                capability={capability}
                index={index}
                expanded={expandedCapabilities.has(capability.capability)}
                onToggleExpand={() => toggleExpand(capability.capability)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="p-4 bg-dark-800/30 rounded-lg border border-dark-700/50">
          <div className="flex items-start space-x-3">
            <Layers className="w-5 h-5 text-brand-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">Capability Priority</h4>
              <p className="text-xs text-dark-400">
                Higher priority capabilities get first access to available agents when multiple 
                task types are queued.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-dark-800/30 rounded-lg border border-dark-700/50">
          <div className="flex items-start space-x-3">
            <Bot className="w-5 h-5 text-brand-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-white mb-1">Agent Distribution</h4>
              <p className="text-xs text-dark-400">
                Within each capability, agents are selected based on their individual priority 
                and availability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}