import React from 'react'
import clsx from 'clsx'

export type ToolOption = {
  name: string
  command: string
  argsTemplate?: string
}

type Props = {
  capability: 'code' | 'text' | 'image' | 'sound' | 'video' | 'any'
  options: ToolOption[]
  value?: ToolOption | null
  onChange: (tool: ToolOption | null) => void
}

export default function ToolSelector({ capability, options, value, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm text-dark-400 mb-2">Tool (optional)</label>
      <div className="grid grid-cols-3 gap-3">
        <select
          value={value?.name || ''}
          onChange={(e) => {
            const selected = options.find(o => o.name === e.target.value) || null
            onChange(selected)
          }}
          className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white col-span-1"
        >
          <option value="">None</option>
          {options.map(o => (
            <option key={o.name} value={o.name}>{o.name}</option>
          ))}
        </select>

        <input
          type="text"
          value={value?.command || ''}
          onChange={(e) => onChange(value ? { ...value, command: e.target.value } : { name: '', command: e.target.value })}
          placeholder="Command (e.g., cargo, npm, ffmpeg)"
          className={clsx("w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white col-span-1")}
        />

        <input
          type="text"
          value={value?.argsTemplate || ''}
          onChange={(e) => onChange(value ? { ...value, argsTemplate: e.target.value } : { name: '', command: '', argsTemplate: e.target.value })}
          placeholder="Args template (e.g., test -- -k [FILTER])"
          className={clsx("w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white col-span-1")}
        />
      </div>
      <p className="text-[10px] text-dark-500 mt-1">Capability: {capability}</p>
    </div>
  )
}


