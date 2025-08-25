import React, { useState, useEffect } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Code, FileText, Image, Music, Video, Layers, Sparkles, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import * as api from '../../ipc/commands'
import toast from 'react-hot-toast'

interface TaskType {
  id: string
  name: string
  icon: React.ElementType
  description: string
  capability: 'code' | 'text' | 'image' | 'sound' | 'video' | 'any'
  color: string
  priority: number
}

const defaultTaskTypes: TaskType[] = [
  {
    id: 'architecture',
    name: 'Architecture Planning',
    icon: Layers,
    description: 'System design and module planning',
    capability: 'text',
    color: 'from-purple-500 to-pink-500',
    priority: 1
  },
  {
    id: 'code_generation',
    name: 'Code Generation',
    icon: Code,
    description: 'Writing and generating code',
    capability: 'code',
    color: 'from-blue-500 to-cyan-500',
    priority: 2
  },
  {
    id: 'documentation',
    name: 'Documentation',
    icon: FileText,
    description: 'Creating docs and comments',
    capability: 'text',
    color: 'from-green-500 to-emerald-500',
    priority: 3
  },
  {
    id: 'testing',
    name: 'Unit Testing',
    icon: AlertCircle,
    description: 'Writing and running tests',
    capability: 'code',
    color: 'from-yellow-500 to-orange-500',
    priority: 4
  },
  {
    id: 'image_generation',
    name: 'Image Generation',
    icon: Image,
    description: 'Creating graphics and diagrams',
    capability: 'image',
    color: 'from-pink-500 to-rose-500',
    priority: 5
  },
  {
    id: 'audio_generation',
    name: 'Audio Generation',
    icon: Music,
    description: 'Creating sound and music',
    capability: 'sound',
    color: 'from-indigo-500 to-purple-500',
    priority: 6
  },
  {
    id: 'video_generation',
    name: 'Video Generation',
    icon: Video,
    description: 'Creating video content',
    capability: 'video',
    color: 'from-red-500 to-pink-500',
    priority: 7
  }
]

interface SortableTaskItemProps {
  task: TaskType
  index: number
}

function SortableTaskItem({ task, index }: SortableTaskItemProps) {
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
  }

  const Icon = task.icon

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
      <div className="p-4 flex items-center space-x-4">
        <button
          {...attributes}
          {...listeners}
          className="p-2 rounded hover:bg-dark-500 transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-5 h-5 text-dark-400" />
        </button>

        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br opacity-80">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${task.color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white mb-1">{task.name}</h3>
          <p className="text-xs text-dark-400">{task.description}</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-xs text-dark-500 mb-1">Priority</div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center">
                <span className="text-sm font-bold text-brand-400">{index + 1}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-dark-500 mb-1">Capability</div>
            <span className={clsx(
              'px-2 py-0.5 rounded text-xs font-medium capitalize',
              task.capability === 'code' && 'bg-blue-500/20 text-blue-400',
              task.capability === 'text' && 'bg-green-500/20 text-green-400',
              task.capability === 'image' && 'bg-pink-500/20 text-pink-400',
              task.capability === 'sound' && 'bg-purple-500/20 text-purple-400',
              task.capability === 'video' && 'bg-red-500/20 text-red-400',
              task.capability === 'any' && 'bg-gray-500/20 text-gray-400'
            )}>
              {task.capability}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface TaskPriorityManagerProps {
  onPriorityChange?: (taskTypes: TaskType[]) => void
}

export default function TaskPriorityManager({ onPriorityChange }: TaskPriorityManagerProps) {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>(defaultTaskTypes)
  
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
      setTaskTypes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          priority: index + 1
        }))
        
        if (onPriorityChange) {
          onPriorityChange(newItems)
        }
        
        // Save priorities to backend
        const priorities = newItems.map(item => ({
          id: item.id,
          priority: item.priority
        }))
        
        api.tasksUpdatePriorities(priorities).catch(err => {
          console.error('Failed to update task priorities:', err)
          toast.error('Failed to save priority changes')
        })
        
        return newItems
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Task Type Priority</h3>
          <p className="text-sm text-dark-400">
            Drag and drop to reorder task types. Higher priority tasks will be executed first when resources are available.
          </p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 bg-brand-500/10 border border-brand-500/30 rounded-lg">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <span className="text-xs text-brand-400 font-medium">Auto-optimized</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={taskTypes.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {taskTypes.map((task, index) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                index={index}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-6 p-4 bg-dark-800/30 rounded-lg border border-dark-700/50">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-brand-400 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-white mb-1">Priority System</h4>
            <p className="text-xs text-dark-400">
              Task priorities determine execution order when multiple tasks are ready. Tasks with higher priority 
              (lower numbers) will be allocated to available agents first. This ensures critical path tasks like 
              architecture planning complete before dependent tasks.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}