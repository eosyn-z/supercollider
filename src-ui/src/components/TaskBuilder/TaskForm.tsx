import React, { useState } from 'react'
import { TaskSchema, type TaskInput } from './validators'

type Props = { onSubmit: (task: TaskInput) => void }

export default function TaskForm({ onSubmit }: Props) {
  const [task, setTask] = useState<TaskInput>({
    type: 'text',
    capability: 'text',
    deps: [],
    input_chain: [],
    input: { content: '' },
    preamble: '',
    token_limit: 800,
    approval_required: false,
    clarity_prompt: '',
  })
  const [error, setError] = useState<string | null>(null)

  function handleChange<K extends keyof TaskInput>(key: K, value: TaskInput[K]) {
    setTask(prev => ({ ...prev, [key]: value }))
  }

  function submit() {
    const parsed = TaskSchema.safeParse(task)
    if (!parsed.success) {
      setError(parsed.error.errors.map(e => e.message).join(', '))
      return
    }
    setError(null)
    onSubmit(parsed.data)
  }

  return (
    <div className="bg-dark-800/50 border border-dark-600 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Create Atomic Task</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-2">Type:</label>
            <select 
              value={task.type} 
              onChange={e => handleChange('type', e.target.value as TaskInput['type'])}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
            >
              {['code','text','image','sound','video','clarify','eval'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-dark-400 mb-2">Capability:</label>
            <select 
              value={task.capability} 
              onChange={e => handleChange('capability', e.target.value as TaskInput['capability'])}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
            >
              {['code','text','image','sound','video','any'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-dark-400 mb-2">Preamble:</label>
          <textarea 
            value={task.preamble ?? ''} 
            onChange={e => handleChange('preamble', e.target.value)}
            className="w-full h-24 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white resize-none"
            placeholder="Describe what the task should accomplish..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-2">Token limit:</label>
            <input 
              type="number" 
              value={task.token_limit ?? 0} 
              onChange={e => handleChange('token_limit', Number(e.target.value))}
              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-dark-400 mb-2">Clarity prompt (optional):</label>
            <textarea 
              value={task.clarity_prompt ?? ''} 
              onChange={e => handleChange('clarity_prompt', e.target.value)}
              className="w-full h-[42px] px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white resize-none"
              placeholder="Validation criteria..."
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-dark-400 mb-2">Input content:</label>
          <textarea 
            value={(task.input as any).content ?? ''} 
            onChange={e => handleChange('input', { ...(task.input as any), content: e.target.value })}
            className="w-full h-24 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white resize-none"
            placeholder="Task input data..."
          />
        </div>
        
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div className="flex justify-end pt-4">
          <button 
            onClick={submit}
            className="px-6 py-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg font-semibold hover:shadow-brand-500/25 transition-all"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  )
}
