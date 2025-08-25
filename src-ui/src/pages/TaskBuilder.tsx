import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  Bot,
  Sparkles,
  Save,
  Copy,
  ChevronRight,
  AlertCircle,
  BookOpen,
  Cpu,
  GitBranch,
  Link,
  Settings,
  Check,
  X,
  Zap,
  Tag
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import * as api from '../ipc/commands'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import ToolSelector, { type ToolOption } from '../components/TaskBuilder/ToolSelector'
import { TOOL_OPTIONS_BY_CAPABILITY } from '../components/TaskBuilder/toolCatalog'

const capabilityIcons = {
  code: FileCode,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video,
  any: Bot
}

const CAP_STYLES: Record<string, { icon: string; label: string; hoverBorder: string; selectedBorder: string; selectedBg: string; }> = {
  code: { icon: 'text-indigo-300', label: 'text-indigo-300', hoverBorder: 'hover:border-indigo-500', selectedBorder: 'border-indigo-500', selectedBg: 'bg-indigo-500/20' },
  text: { icon: 'text-emerald-300', label: 'text-emerald-300', hoverBorder: 'hover:border-emerald-500', selectedBorder: 'border-emerald-500', selectedBg: 'bg-emerald-500/20' },
  image: { icon: 'text-fuchsia-300', label: 'text-fuchsia-300', hoverBorder: 'hover:border-fuchsia-500', selectedBorder: 'border-fuchsia-500', selectedBg: 'bg-fuchsia-500/20' },
  sound: { icon: 'text-amber-300', label: 'text-amber-300', hoverBorder: 'hover:border-amber-500', selectedBorder: 'border-amber-500', selectedBg: 'bg-amber-500/20' },
  video: { icon: 'text-rose-300', label: 'text-rose-300', hoverBorder: 'hover:border-rose-500', selectedBorder: 'border-rose-500', selectedBg: 'bg-rose-500/20' },
  any: { icon: 'text-slate-300', label: 'text-slate-300', hoverBorder: 'hover:border-slate-500', selectedBorder: 'border-slate-500', selectedBg: 'bg-slate-500/20' },
}

const CAP_COLORS: Record<string, string> = {
  code: '#a78bfa',
  text: '#6ee7b7',
  image: '#f0abfc',
  sound: '#fbbf24',
  video: '#f43f5e',
  any: '#94a3b8',
}

const taskTemplates = [
  {
    id: 'code-function',
    name: 'Code Function',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Implement the function named [FUNCTION] in [LANGUAGE] [VERSION]. Follow the provided signature and constraints. Ensure tests in [TEST_FILE] pass and build succeeds with [BUILD_COMMAND]. Keep the function pure and deterministic.',
      token_limit: 1500,
      metadata: { template: 'code-function' }
    }
  },
  {
    id: 'unit-test',
    name: 'Unit Tests',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Write unit tests for [FUNCTION/MODULE] using [TEST_FRAMEWORK]. Cover happy paths, edge cases, and error handling. Tests must be deterministic and fast.',
      token_limit: 1200,
      metadata: { template: 'unit-test' }
    }
  },
  {
    id: 'refactor',
    name: 'Refactor',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Refactor [FUNCTION] to improve [GOAL: readability|performance] without changing its public behavior. Preserve API and existing tests.',
      token_limit: 1500,
      metadata: { template: 'refactor' }
    }
  },
  {
    id: 'bugfix',
    name: 'Bug Fix',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Reproduce and fix the defect in [FUNCTION/FILE] causing [SYMPTOM]. Add a failing test first, then make it pass. Keep the change minimal.',
      token_limit: 1500,
      metadata: { template: 'bugfix' }
    }
  },
  {
    id: 'lint-format',
    name: 'Lint & Format',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Apply linting and formatting to [PATH] using [LINTER]/[FORMATTER]. Fix safe, non-behavioral issues. Do not alter public APIs or logic.',
      token_limit: 800,
      metadata: { template: 'lint-format' }
    }
  },
  {
    id: 'schema-migration',
    name: 'Schema Migration',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Create a migration to [ADD|ALTER|DROP] [TABLE.COLUMN] from [FROM] to [TO]. Provide forward/backward steps and a test.',
      token_limit: 1200,
      metadata: { template: 'schema-migration' }
    }
  },
  {
    id: 'openapi-path',
    name: 'OpenAPI Path Spec',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Write an OpenAPI path spec for [METHOD] [ROUTE]. Define request params, body, responses, and error schemas with examples. Validate with [TOOL].',
      token_limit: 1200,
      metadata: { template: 'openapi-path' }
    }
  },
  {
    id: 'api-client-gen',
    name: 'Generate API Client',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Generate a typed API client in [LANGUAGE] from [OPENAPI_SPEC]. Include a minimal usage example and basic retries/timeouts.',
      token_limit: 1200,
      metadata: { template: 'api-client-gen' }
    }
  },
  {
    id: 'observability-function',
    name: 'Instrument Function',
    category: 'code',
    icon: FileCode,
    template: {
      type: 'code',
      capability: 'code',
      preamble: 'Instrument [FUNCTION] with a trace span and structured logs per [STANDARD]. Tag errors and key metrics. Keep overhead minimal.',
      token_limit: 800,
      metadata: { template: 'observability-function' }
    }
  },
  {
    id: 'text-summary',
    name: 'Text Summary',
    category: 'text',
    icon: FileText,
    template: {
      type: 'text',
      capability: 'text',
      preamble: 'Write a [WORD_COUNT]-word summary with [BULLET_COUNT] bullet points and a concluding sentence. Use neutral, precise tone.',
      token_limit: 800,
      metadata: { template: 'text-summary' }
    }
  },
  {
    id: 'rewrite-clarity',
    name: 'Rewrite for Clarity',
    category: 'text',
    icon: FileText,
    template: {
      type: 'text',
      capability: 'text',
      preamble: 'Rewrite the provided text to be clearer and more concise. Preserve meaning; fix grammar and reduce redundancy.',
      token_limit: 900,
      metadata: { template: 'rewrite-clarity' }
    }
  },
  {
    id: 'translate',
    name: 'Translate',
    category: 'text',
    icon: FileText,
    template: {
      type: 'text',
      capability: 'text',
      preamble: 'Translate the text to [LANGUAGE_VARIANT], preserving tone and technical accuracy. Output only the translation.',
      token_limit: 700,
      metadata: { template: 'translate' }
    }
  },
  {
    id: 'acceptance-criteria',
    name: 'Acceptance Criteria',
    category: 'text',
    icon: FileText,
    template: {
      type: 'text',
      capability: 'text',
      preamble: 'Convert the feature description into atomic Given/When/Then acceptance criteria. Each criterion must be testable and unambiguous.',
      token_limit: 800,
      metadata: { template: 'acceptance-criteria' }
    }
  },
  {
    id: 'image-diagram',
    name: 'Diagram',
    category: 'image',
    icon: Image,
    template: {
      type: 'image',
      capability: 'image',
      preamble: 'Create a [DIAGRAM_TYPE] of [SUBJECT] with clear labels and hierarchy in [STYLE] and [COLOR_SCHEME].',
      token_limit: 800,
      metadata: { template: 'image-diagram' }
    }
  },
  {
    id: 'evaluation',
    name: 'Evaluation',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Evaluate outputs against acceptance criteria: [CRITERIA]. Return pass/fail per criterion with a one-sentence justification.',
      token_limit: 1000,
      metadata: { template: 'evaluation' }
    }
  },
  {
    id: 'safety-check',
    name: 'Safety Check',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Evaluate the content for safety policy violations. Flag and justify any violations and suggest safe alternatives.',
      token_limit: 900,
      metadata: { template: 'safety-check' }
    }
  },
  {
    id: 'pii-scrub',
    name: 'PII Scrub',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Redact personally identifiable information (PII) per [PII_POLICY]. Return the redacted text and a list of redactions with reasons.',
      token_limit: 800,
      metadata: { template: 'pii-scrub' }
    }
  },
  {
    id: 'schema-validate',
    name: 'Schema Validate',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Validate the output against [SCHEMA]. Report failing JSON paths and propose minimal fixes.',
      token_limit: 800,
      metadata: { template: 'schema-validate' }
    }
  },
  {
    id: 'clarify-questions',
    name: 'Clarification Questions',
    category: 'clarify',
    icon: Bot,
    template: {
      type: 'clarify',
      capability: 'any',
      preamble: 'Ask up to [N] targeted questions to resolve ambiguities blocking execution. Focus on highest-impact unknowns; be concise.',
      token_limit: 600,
      metadata: { template: 'clarify-questions' }
    }
  },
  {
    id: 'schema-infer',
    name: 'Infer JSON Schema',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Infer a JSON Schema from the provided samples. Tighten constraints where safe and document assumptions.',
      token_limit: 1000,
      metadata: { template: 'schema-infer' }
    }
  },
  {
    id: 'sample-data-generate',
    name: 'Generate Sample Data',
    category: 'any',
    icon: Check,
    template: {
      type: 'eval',
      capability: 'any',
      preamble: 'Generate realistic synthetic data conforming to [SCHEMA] with representative edge cases. Provide a reproducible seed.',
      token_limit: 900,
      metadata: { template: 'sample-data-generate' }
    }
  },
  // Sound capability templates
  {
    id: 'tts-generate',
    name: 'Text to Speech',
    category: 'sound',
    icon: Music,
    template: {
      type: 'sound',
      capability: 'sound',
      preamble: 'Synthesize speech from the provided text with [VOICE] voice and [STYLE] style. Output high-quality audio at [SAMPLE_RATE] Hz.',
      token_limit: 600,
      metadata: { template: 'tts-generate' }
    }
  },
  {
    id: 'sound-effects',
    name: 'Sound Effects',
    category: 'sound',
    icon: Music,
    template: {
      type: 'sound',
      capability: 'sound',
      preamble: 'Generate short sound effects for [SCENARIO] with [DURATION]s duration. Provide WAV/MP3 output and brief description.',
      token_limit: 700,
      metadata: { template: 'sound-effects' }
    }
  },
  // Video capability templates
  {
    id: 'scene-storyboard',
    name: 'Scene Storyboard',
    category: 'video',
    icon: Video,
    template: {
      type: 'video',
      capability: 'video',
      preamble: 'Create a storyboard with [NUM_SCENES] scenes for [TOPIC]. Describe visuals, transitions, and audio cues per scene.',
      token_limit: 1200,
      metadata: { template: 'scene-storyboard' }
    }
  },
  {
    id: 'video-compose',
    name: 'Video Composition',
    category: 'video',
    icon: Video,
    template: {
      type: 'video',
      capability: 'video',
      preamble: 'Compose a short video from provided assets with [RESOLUTION] resolution and [DURATION] length. Include basic transitions and subtitles if provided.',
      token_limit: 1000,
      metadata: { template: 'video-compose' }
    }
  }
]

interface TaskFormData {
  id?: string
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
}

export default function TaskBuilder() {
  const { projects, agents, addNotification } = useAppStore()
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [templateCapabilityFilter, setTemplateCapabilityFilter] = useState<'all'|'code'|'text'|'image'|'sound'|'video'|'any'>('all')
  const [templateSearch, setTemplateSearch] = useState('')
  const [formData, setFormData] = useState<TaskFormData>({
    type: '',
    capability: 'any',
    preamble: '',
    token_limit: 1500,
    dependencies: [],
    input_chain: [],
    approval_required: false,
    metadata: {}
  })
  const [selectedTool, setSelectedTool] = useState<ToolOption | null>(null)

  const handleTemplateSelect = (templateId: string) => {
    const template = taskTemplates.find(t => t.id === templateId)
    if (template) {
      setFormData({
        ...formData,
        ...template.template,
        type: template.name
      })
      setSelectedTemplate(templateId)
      toast.success(`Template "${template.name}" loaded`)
    }
  }

  const handleSaveTask = async () => {
    if (!selectedProject) {
      toast.error('Please select a project')
      return
    }
    if (!formData.type || !formData.preamble) {
      toast.error('Task type and preamble are required')
      return
    }

    try {
      const task = {
        type: formData.type,
        capability: formData.capability,
        preamble: formData.preamble,
        token_limit: formData.token_limit,
        deps: formData.dependencies,
        input_chain: formData.input_chain,
        manual_agent_override: formData.manual_agent_override,
        priority_override: formData.priority_override,
        approval_required: formData.approval_required,
        clarity_prompt: formData.clarity_prompt,
        metadata: {
          ...formData.metadata,
          tool: selectedTool ? { name: selectedTool.name, command: selectedTool.command, argsTemplate: selectedTool.argsTemplate } : undefined
        }
      }
      
      await api.tasksCreate(selectedProject, task)
      toast.success('Task created successfully')
      
      // Reset form
      setFormData({
        type: '',
        capability: 'any',
        preamble: '',
        token_limit: 1500,
        dependencies: [],
        input_chain: [],
        approval_required: false,
        metadata: {}
      })
      setSelectedTool(null)
      setSelectedTemplate(null)
    } catch (error) {
      toast.error(`Failed to create task: ${error}`)
    }
  }

  const handleDuplicateTask = () => {
    if (!formData.type) {
      toast.error('No task to duplicate')
      return
    }
    
    const duplicatedTask = {
      ...formData,
      type: `${formData.type} (Copy)`,
      metadata: { ...formData.metadata, duplicated: true }
    }
    
    setFormData(duplicatedTask)
    toast.success('Task duplicated - modify and save as new')
  }

  const handleSaveAsTemplate = () => {
    if (!formData.type || !formData.preamble) {
      toast.error('Complete the task before saving as template')
      return
    }
    
    // Store template in local storage for now
    const customTemplates = JSON.parse(localStorage.getItem('customTaskTemplates') || '[]')
    const newTemplate = {
      id: `custom-${Date.now()}`,
      name: formData.type,
      category: 'custom',
      icon: Bot,
      template: {
        type: formData.type,
        capability: formData.capability,
        preamble: formData.preamble,
        token_limit: formData.token_limit,
        metadata: formData.metadata
      }
    }
    
    customTemplates.push(newTemplate)
    localStorage.setItem('customTaskTemplates', JSON.stringify(customTemplates))
    toast.success('Task saved as template')
  }

  // Clarity Score UI removed; clarity is evaluated in the shredding step

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-screen-2xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Atomic Task Builder</h1>
          <p className="text-dark-400">Create and configure individual tasks with templates and validation</p>
        </div>

        <div className="flex flex-row gap-6 lg:gap-8">
          {/* Templates Sidebar */}
          <div className="w-[48rem] flex-shrink-0">
            <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Task Templates</h2>
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex flex-wrap gap-2">
                  {(['all','code','text','image','sound','video','any'] as const).map(cap => (
                    <button
                      key={cap}
                      onClick={() => setTemplateCapabilityFilter(cap)}
                      className={clsx(
                        'px-2.5 py-1 rounded border text-xs',
                        templateCapabilityFilter === cap ? 'border-brand-500 text-white' : 'border-dark-600 text-dark-300 hover:border-dark-500'
                      )}
                    >
                      {cap === 'all' ? 'All' : cap.charAt(0).toUpperCase()+cap.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500"
                  />
                  <button
                    onClick={() => setTemplateSearch(templateSearch.trim())}
                    className="px-2.5 py-1.5 rounded border border-dark-600 text-sm text-dark-300 hover:border-dark-500"
                  >
                    Search
                  </button>
                </div>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
                {taskTemplates
                  .filter(t => (templateCapabilityFilter === 'all' ? true : t.template.capability === templateCapabilityFilter))
                  .filter(t => {
                    const q = templateSearch.toLowerCase().trim()
                    if (!q) return true
                    return t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
                  })
                  .map((template) => {
                  const Icon = template.icon
                  const isSelected = selectedTemplate === template.id
                  
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template.id)}
                      className={clsx(
                        'p-4 rounded-xl border-2 text-center transition-all hover:scale-[1.02] aspect-square',
                        isSelected
                          ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20'
                          : 'border-dark-600 bg-dark-900/50 hover:border-dark-500'
                      )}
                      style={{ aspectRatio: '1 / 1' }}
                    >
                      <div className="flex flex-col items-center">
                        <div
                          className={clsx(
                            'p-3 rounded-lg mb-3',
                            {
                              code: 'bg-indigo-500/15 text-indigo-300',
                              text: 'bg-emerald-500/15 text-emerald-300',
                              image: 'bg-fuchsia-500/15 text-fuchsia-300',
                              sound: 'bg-amber-500/15 text-amber-300',
                              video: 'bg-rose-500/15 text-rose-300',
                              any: 'bg-slate-500/15 text-slate-300'
                            }[template.template.capability as keyof typeof capabilityIcons] || 'bg-dark-800 text-dark-400'
                          )}
                        >
                          <Icon className={clsx('w-6 h-6')} color={CAP_COLORS[template.template.capability as keyof typeof CAP_COLORS] || CAP_COLORS.any} />
                        </div>
                        <div className="text-sm font-medium text-white">{template.name}</div>
                        <div
                          className={clsx(
                            'text-xs capitalize mt-1',
                            {
                              code: 'text-indigo-300',
                              text: 'text-emerald-300',
                              image: 'text-fuchsia-300',
                              sound: 'text-amber-300',
                              video: 'text-rose-300',
                              any: 'text-slate-300'
                            }[template.template.capability as keyof typeof capabilityIcons] || 'text-dark-500'
                          )}
                        >
                          {template.category}
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-brand-400 mt-2" />
                        )}
                      </div>
                    </button>
                  )
                  })}
              </div>
              
              {/* Clarity Score intentionally removed; handled in shredding step */}
            </div>
          </div>

          {/* Task Form */}
          <div className="flex-1 min-w-0">
            <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              {/* Project Selection and Task Type - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm text-dark-400 mb-2">Select Project *</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                  >
                    <option value="">Choose a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} - {project.id}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-dark-400 mb-2">Task Type *</label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                    placeholder="e.g., Generate Module, Write Tests"
                  />
                </div>
              </div>

              {/* Capability */}
              <div className="mb-6">
                <label className="block text-sm text-dark-400 mb-3">Capability *</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {Object.entries(capabilityIcons).map(([capability, Icon]) => {
                    const styles = CAP_STYLES[capability] || CAP_STYLES.any;
                    const selected = formData.capability === capability;
                    return (
                      <button
                        key={capability}
                        onClick={() => setFormData(prev => ({ ...prev, capability }))}
                        className={clsx(
                          'p-4 md:p-5 rounded-lg border-2 transition-all hover:scale-105 aspect-square flex flex-col justify-center',
                          selected ? `${styles.selectedBorder} ${styles.selectedBg} shadow-lg` : `border-dark-600 bg-dark-900 ${styles.hoverBorder}`
                        )}
                        style={{ aspectRatio: '1 / 1' }}
                      >
                        <Icon className={clsx('w-7 h-7 mx-auto mb-2', styles.icon)} color={CAP_COLORS[capability as keyof typeof CAP_COLORS] || CAP_COLORS.any} />
                        <div className={clsx('text-xs capitalize', styles.label)}>
                          {capability}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Preamble and Token Limit */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-dark-400 mb-1">
                    Preamble (Instructions) *
                    <span className="ml-2 text-[10px] text-dark-500">Be specific about requirements</span>
                  </label>
                  <textarea
                    value={formData.preamble}
                    onChange={(e) => setFormData(prev => ({ ...prev, preamble: e.target.value }))}
                    className="w-full h-24 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500 resize-none"
                    placeholder="Describe what the task should accomplish..."
                  />
                </div>
                
                <div className="flex flex-col items-end">
                  <label className="block text-xs text-dark-400 mb-1">Token Limit</label>
                  <input
                    type="number"
                    value={formData.token_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, token_limit: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm mb-1"
                  />
                  <div className="text-[10px] text-dark-400 text-right w-full">
                    <Cpu className="w-3 h-3 inline mr-0.5" />
                    ≈ {Math.round(formData.token_limit * 0.75)} words
                  </div>
                </div>
              </div>
              {/* Advanced Settings moved near action buttons */}

              {/* Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-dark-700">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={handleDuplicateTask}
                    className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-dark-300 hover:text-white transition-all flex items-center gap-2">
                    <Copy className="w-4 h-4" />
                    <span>Duplicate</span>
                  </button>
                  <button 
                    onClick={handleSaveAsTemplate}
                    className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-dark-300 hover:text-white transition-all flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    <span>Save as Template</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center space-x-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-700 rounded-lg text-sm text-dark-300 hover:text-white transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Advanced Settings</span>
                    <ChevronRight className={clsx(
                      'w-4 h-4 transition-transform',
                      showAdvanced && 'rotate-90'
                    )} />
                  </button>

                  <button
                    onClick={handleSaveTask}
                    disabled={!selectedProject || !formData.type || !formData.preamble}
                    className={clsx(
                      'px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
                      selectedProject && formData.type && formData.preamble
                        ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-dark-800 text-dark-500 cursor-not-allowed border border-dark-700'
                    )}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Create Task</span>
                  </button>
                </div>
              </div>

              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 overflow-hidden mt-4"
                >
                    {/* Tool Selector */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">Link Capability to Tool</label>
                      <ToolSelector
                        capability={formData.capability as any}
                        options={TOOL_OPTIONS_BY_CAPABILITY[formData.capability] || []}
                        value={selectedTool}
                        onChange={setSelectedTool}
                      />
                    </div>

                    {/* Dependencies */}
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">
                        <GitBranch className="w-3 h-3 inline mr-0.5" />
                        Dependencies (Task IDs)
                      </label>
                      <input
                        type="text"
                        value={formData.dependencies.join(', ')}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          dependencies: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }))}
                        className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
                        placeholder="task-1, task-2"
                      />
                    </div>

                    {/* Input Chain */}
                    <div>
                      <label className="block text-xs text-dark-400 mb-1">
                        <Link className="w-3 h-3 inline mr-0.5" />
                        Input Chain (Task IDs)
                      </label>
                      <input
                        type="text"
                        value={formData.input_chain.join(', ')}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          input_chain: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        }))}
                        className="w-full px-3 py-1.5 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
                        placeholder="task-1, task-2"
                      />
                    </div>

                    {/* Manual Agent Override */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">
                        <Bot className="w-4 h-4 inline mr-1" />
                        Manual Agent Override
                      </label>
                      <select
                        value={formData.manual_agent_override || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          manual_agent_override: e.target.value || undefined 
                        }))}
                        className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                      >
                        <option value="">Auto-select</option>
                        {agents
                          .filter(a => a.capabilities.includes(formData.capability as any))
                          .map(agent => (
                            <option key={agent.name} value={agent.name}>{agent.name}</option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Priority Override */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">
                        <Zap className="w-4 h-4 inline mr-1" />
                        Priority Override
                      </label>
                      <input
                        type="number"
                        value={formData.priority_override || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          priority_override: e.target.value ? parseInt(e.target.value) : undefined
                        }))}
                        className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                        placeholder="Default priority"
                      />
                    </div>

                    {/* Clarity Prompt */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Clarity Prompt (Validation)
                      </label>
                      <textarea
                        value={formData.clarity_prompt || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, clarity_prompt: e.target.value }))}
                        className="w-full h-20 px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white placeholder-dark-500 resize-none"
                        placeholder="Optional validation criteria for the task output..."
                      />
                    </div>

                    {/* Approval Required */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-dark-300">Require Approval</label>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, approval_required: !prev.approval_required }))}
                        className={clsx(
                          'w-12 h-6 rounded-full transition-all relative border',
                          formData.approval_required ? 'bg-brand-600 border-brand-500' : 'bg-dark-700 border-dark-600'
                        )}
                      >
                        <div className={clsx(
                          'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-lg',
                          formData.approval_required ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>

                    {/* Metadata */}
                    <div>
                      <label className="block text-sm text-dark-400 mb-2">
                        <Tag className="w-4 h-4 inline mr-1" />
                        Metadata (JSON)
                      </label>
                      <textarea
                        value={JSON.stringify(formData.metadata, null, 2)}
                        onChange={(e) => {
                          try {
                            setFormData(prev => ({ ...prev, metadata: JSON.parse(e.target.value) }))
                          } catch {}
                        }}
                        className="w-full h-20 px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono text-xs resize-none"
                        placeholder="{}"
                      />
                    </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}