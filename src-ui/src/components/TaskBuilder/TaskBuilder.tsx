import React from 'react'
import TaskForm from './TaskForm'
import { tasksCreate } from '../../ipc/commands'
import { useAppStore } from '../../store/appStore'
import toast from 'react-hot-toast'
import type { TaskInput } from './validators'

export default function TaskBuilder() {
  const { activeProjectId } = useAppStore()
  async function handleSubmit(task: TaskInput) {
    if (!activeProjectId) {
      toast.error('Select a project before creating tasks')
      return
    }
    try {
      await tasksCreate(activeProjectId, task as any)
      toast.success('Task created')
    } catch (e) {
      toast.error('Failed to create task')
    }
  }
  return (
    <div>
      <TaskForm onSubmit={handleSubmit} />
    </div>
  )
}
