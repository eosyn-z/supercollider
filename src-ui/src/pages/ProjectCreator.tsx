import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  FileCode, 
  FileText, 
  Video, 
  Layers,
  ArrowRight,
  Sparkles,
  Clock,
  Cpu,
  Check,
  AlertCircle,
  ChevronRight,
  Settings,
  Eye,
  EyeOff,
  Palette,
  Box,
  Music,
  Gamepad2,
  BookOpen,
  Briefcase,
  Database,
  Globe,
  Podcast,
  Camera,
  PenTool,
  Film
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import clsx from 'clsx'

const projectTypes = [
  {
    id: 'coding_project',
    name: 'Coding Project',
    icon: FileCode,
    description: 'Build software with multiple modules, tests, and documentation',
    color: 'from-blue-500 to-cyan-500',
    estimatedTime: '15-30 mins',
    defaultWorkflow: [
      { name: 'Architecture Planning', capability: 'text', tokens: 1500 },
      { name: 'Module Generation', capability: 'code', tokens: 2000 },
      { name: 'Unit Testing', capability: 'code', tokens: 1500 },
      { name: 'Documentation', capability: 'text', tokens: 1200 },
      { name: 'Packaging', capability: 'code', tokens: 800 }
    ],
    requiredFields: ['language', 'framework', 'modules', 'test_framework']
  },
  {
    id: 'presentation',
    name: 'Presentation',
    icon: FileText,
    description: 'Create slides with text, graphics, and structured content',
    color: 'from-purple-500 to-pink-500',
    estimatedTime: '10-20 mins',
    defaultWorkflow: [
      { name: 'Outline Creation', capability: 'text', tokens: 1000 },
      { name: 'Content Generation', capability: 'text', tokens: 1500 },
      { name: 'Graphics Creation', capability: 'image', tokens: 800 },
      { name: 'Layout & Formatting', capability: 'text', tokens: 600 },
      { name: 'Review & Polish', capability: 'text', tokens: 500 }
    ],
    requiredFields: ['slide_count', 'audience', 'theme', 'key_points']
  },
  {
    id: 'report',
    name: 'Report',
    icon: FileText,
    description: 'Research and compile data with charts, tables, and analysis',
    color: 'from-green-500 to-emerald-500',
    estimatedTime: '20-40 mins',
    defaultWorkflow: [
      { name: 'Research', capability: 'text', tokens: 2000 },
      { name: 'Data Analysis', capability: 'text', tokens: 1500 },
      { name: 'Chart Generation', capability: 'image', tokens: 800 },
      { name: 'Writing', capability: 'text', tokens: 2000 },
      { name: 'Formatting', capability: 'text', tokens: 500 }
    ],
    requiredFields: ['data_sources', 'outline', 'figures_count', 'citation_style']
  },
  {
    id: 'video',
    name: 'Video Project',
    icon: Video,
    description: 'Create multi-modal videos with scenes, audio, and effects',
    color: 'from-red-500 to-orange-500',
    estimatedTime: '30-60 mins',
    defaultWorkflow: [
      { name: 'Storyboarding', capability: 'text', tokens: 1500 },
      { name: 'Scene Generation', capability: 'video', tokens: 3000 },
      { name: 'Audio Creation', capability: 'sound', tokens: 2000 },
      { name: 'Video Composition', capability: 'video', tokens: 2500 },
      { name: 'Final Review', capability: 'video', tokens: 1000 }
    ],
    requiredFields: ['duration', 'resolution', 'style', 'audio_type']
  },
  {
    id: 'animation_2d',
    name: '2D Animation',
    icon: Palette,
    description: 'Create 2D animations with characters, backgrounds, and motion graphics',
    color: 'from-pink-500 to-rose-500',
    estimatedTime: '25-45 mins',
    defaultWorkflow: [
      { name: 'Concept Art', capability: 'image', tokens: 1200 },
      { name: 'Character Design', capability: 'image', tokens: 1500 },
      { name: 'Background Design', capability: 'image', tokens: 1000 },
      { name: 'Animation Frames', capability: 'image', tokens: 2500 },
      { name: 'Compositing', capability: 'image', tokens: 800 }
    ],
    requiredFields: ['fps', 'duration', 'style', 'character_count']
  },
  {
    id: 'animation_3d',
    name: '3D Animation',
    icon: Box,
    description: 'Produce 3D animations with modeling, rigging, lighting, and rendering',
    color: 'from-indigo-500 to-purple-500',
    estimatedTime: '40-90 mins',
    defaultWorkflow: [
      { name: '3D Modeling', capability: 'code', tokens: 2000 },
      { name: 'Texturing', capability: 'image', tokens: 1500 },
      { name: 'Rigging & Animation', capability: 'code', tokens: 2500 },
      { name: 'Lighting Setup', capability: 'code', tokens: 1000 },
      { name: 'Rendering', capability: 'video', tokens: 3000 }
    ],
    requiredFields: ['polygon_count', 'render_quality', 'animation_type', 'scene_complexity']
  },
  {
    id: 'music_production',
    name: 'Music Production',
    icon: Music,
    description: 'Compose and produce original music tracks with multiple instruments',
    color: 'from-violet-500 to-fuchsia-500',
    estimatedTime: '20-40 mins',
    defaultWorkflow: [
      { name: 'Composition', capability: 'sound', tokens: 2000 },
      { name: 'Arrangement', capability: 'sound', tokens: 1500 },
      { name: 'Sound Design', capability: 'sound', tokens: 1200 },
      { name: 'Mixing', capability: 'sound', tokens: 1000 },
      { name: 'Mastering', capability: 'sound', tokens: 800 }
    ],
    requiredFields: ['genre', 'tempo', 'duration', 'instruments']
  },
  {
    id: 'game_design',
    name: 'Game Design',
    icon: Gamepad2,
    description: 'Design game concepts with mechanics, levels, assets, and narratives',
    color: 'from-amber-500 to-yellow-500',
    estimatedTime: '30-60 mins',
    defaultWorkflow: [
      { name: 'Game Concept', capability: 'text', tokens: 1500 },
      { name: 'Mechanics Design', capability: 'code', tokens: 2000 },
      { name: 'Level Design', capability: 'code', tokens: 1800 },
      { name: 'Asset Creation', capability: 'image', tokens: 2000 },
      { name: 'Sound Effects', capability: 'sound', tokens: 1000 }
    ],
    requiredFields: ['game_type', 'platform', 'player_count', 'difficulty']
  },
  {
    id: 'ebook',
    name: 'E-Book Creation',
    icon: BookOpen,
    description: 'Write and format complete e-books with chapters, images, and metadata',
    color: 'from-emerald-500 to-teal-500',
    estimatedTime: '45-120 mins',
    defaultWorkflow: [
      { name: 'Outline', capability: 'text', tokens: 1000 },
      { name: 'Chapter Writing', capability: 'text', tokens: 5000 },
      { name: 'Cover Design', capability: 'image', tokens: 800 },
      { name: 'Formatting', capability: 'text', tokens: 600 },
      { name: 'Proofreading', capability: 'text', tokens: 1500 }
    ],
    requiredFields: ['chapter_count', 'word_count', 'genre', 'target_audience']
  },
  {
    id: 'business_plan',
    name: 'Business Plan',
    icon: Briefcase,
    description: 'Develop comprehensive business plans with market analysis and financials',
    color: 'from-slate-500 to-zinc-500',
    estimatedTime: '30-60 mins',
    defaultWorkflow: [
      { name: 'Executive Summary', capability: 'text', tokens: 1000 },
      { name: 'Market Analysis', capability: 'text', tokens: 2000 },
      { name: 'Financial Projections', capability: 'text', tokens: 1500 },
      { name: 'Strategy Development', capability: 'text', tokens: 1800 },
      { name: 'Presentation Deck', capability: 'image', tokens: 1200 }
    ],
    requiredFields: ['industry', 'business_model', 'target_market', 'funding_needed']
  },
  {
    id: 'data_analysis',
    name: 'Data Analysis',
    icon: Database,
    description: 'Analyze datasets with visualizations, statistics, and insights',
    color: 'from-cyan-500 to-blue-500',
    estimatedTime: '20-45 mins',
    defaultWorkflow: [
      { name: 'Data Cleaning', capability: 'code', tokens: 1000 },
      { name: 'Statistical Analysis', capability: 'code', tokens: 2000 },
      { name: 'Visualization Creation', capability: 'image', tokens: 1500 },
      { name: 'Insights Generation', capability: 'text', tokens: 1200 },
      { name: 'Report Writing', capability: 'text', tokens: 1000 }
    ],
    requiredFields: ['dataset_size', 'analysis_type', 'visualization_count', 'output_format']
  },
  {
    id: 'website',
    name: 'Website Design',
    icon: Globe,
    description: 'Design and develop complete websites with frontend and backend',
    color: 'from-blue-500 to-indigo-500',
    estimatedTime: '30-60 mins',
    defaultWorkflow: [
      { name: 'UI/UX Design', capability: 'image', tokens: 1500 },
      { name: 'Frontend Development', capability: 'code', tokens: 2500 },
      { name: 'Backend Development', capability: 'code', tokens: 2000 },
      { name: 'Content Creation', capability: 'text', tokens: 1000 },
      { name: 'Testing & Optimization', capability: 'code', tokens: 800 }
    ],
    requiredFields: ['page_count', 'features', 'responsive', 'cms_type']
  },
  {
    id: 'podcast',
    name: 'Podcast Episode',
    icon: Podcast,
    description: 'Produce podcast episodes with scripts, audio editing, and show notes',
    color: 'from-orange-500 to-red-500',
    estimatedTime: '25-45 mins',
    defaultWorkflow: [
      { name: 'Script Writing', capability: 'text', tokens: 1500 },
      { name: 'Voice Generation', capability: 'sound', tokens: 2000 },
      { name: 'Audio Editing', capability: 'sound', tokens: 1000 },
      { name: 'Show Notes', capability: 'text', tokens: 600 },
      { name: 'Thumbnail Design', capability: 'image', tokens: 400 }
    ],
    requiredFields: ['episode_length', 'guest_count', 'topic', 'format']
  },
  {
    id: 'photography',
    name: 'Photo Project',
    icon: Camera,
    description: 'Create and edit photo collections with themes, filters, and compositions',
    color: 'from-rose-500 to-pink-500',
    estimatedTime: '15-30 mins',
    defaultWorkflow: [
      { name: 'Concept Development', capability: 'text', tokens: 500 },
      { name: 'Image Generation', capability: 'image', tokens: 2500 },
      { name: 'Photo Editing', capability: 'image', tokens: 1500 },
      { name: 'Collection Curation', capability: 'image', tokens: 600 },
      { name: 'Metadata & Captions', capability: 'text', tokens: 400 }
    ],
    requiredFields: ['photo_count', 'style', 'aspect_ratio', 'theme']
  },
  {
    id: 'illustration',
    name: 'Illustration Set',
    icon: PenTool,
    description: 'Design illustration sets for books, websites, or marketing materials',
    color: 'from-purple-500 to-indigo-500',
    estimatedTime: '20-40 mins',
    defaultWorkflow: [
      { name: 'Style Development', capability: 'image', tokens: 800 },
      { name: 'Sketching', capability: 'image', tokens: 1200 },
      { name: 'Illustration Creation', capability: 'image', tokens: 2000 },
      { name: 'Color & Refinement', capability: 'image', tokens: 1000 },
      { name: 'Export & Optimization', capability: 'image', tokens: 500 }
    ],
    requiredFields: ['illustration_count', 'style', 'color_palette', 'usage']
  },
  {
    id: 'documentary',
    name: 'Documentary Film',
    icon: Film,
    description: 'Produce documentary films with research, interviews, and narration',
    color: 'from-gray-600 to-gray-700',
    estimatedTime: '60-120 mins',
    defaultWorkflow: [
      { name: 'Research & Planning', capability: 'text', tokens: 1500 },
      { name: 'Script Writing', capability: 'text', tokens: 2000 },
      { name: 'Video Production', capability: 'video', tokens: 3500 },
      { name: 'Narration', capability: 'sound', tokens: 1500 },
      { name: 'Post-Production', capability: 'video', tokens: 2000 }
    ],
    requiredFields: ['length', 'subject', 'interview_count', 'narration_style']
  },
  {
    id: 'custom',
    name: 'Custom Project',
    icon: Layers,
    description: 'Define your own workflow with custom tasks and dependencies',
    color: 'from-gray-500 to-gray-600',
    estimatedTime: 'Variable',
    defaultWorkflow: [],
    requiredFields: []
  }
]

export default function ProjectCreator() {
  const navigate = useNavigate()
  const location = useLocation() as any
  const { addProject, config } = useAppStore()
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [showWorkflowPreview, setShowWorkflowPreview] = useState(true)
  const [advancedSettings, setAdvancedSettings] = useState({
    autoStart: false,
    requireApproval: config.approval_mode === 'manual',
    tokenLimit: 10000,
    priority: 'normal'
  })
  const [additionalFields, setAdditionalFields] = useState<Record<string, string>>({})

  const selectedProjectType = projectTypes.find(pt => pt.id === selectedType)

  // Prefill prompt, type, and potential hasty flag from navigation state
  useEffect(() => {
    const state = location?.state || {}
    if (state?.type && projectTypes.some(pt => pt.id === state.type)) {
      setSelectedType(state.type)
    }
    if (state?.prompt) {
      setPrompt(state.prompt)
    }
    if (state?.hasty) {
      setAdvancedSettings(prev => ({ ...prev, autoStart: true }))
    }
  }, [location])

  const handleCreate = async () => {
    if (!selectedType || !prompt.trim()) {
      return
    }

    try {
      await addProject({
        type: selectedType as any,
        prompt,
        tasks: [] // Tasks will be generated by the backend
      })
      navigate('/dashboard')
    } catch (error) {
      console.error('Failed to create project:', error)
      // Could add toast notification here for error feedback
    }
  }

  const calculateTotalTokens = () => {
    if (!selectedProjectType) return 0
    return selectedProjectType.defaultWorkflow.reduce((sum, task) => sum + task.tokens, 0)
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create New Project</h1>
          <p className="text-dark-400">Choose a project type and describe what you want to build</p>
        </div>

        {/* Project Type Selection */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">1. Select Project Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[400px] overflow-y-auto p-1 scrollbar-thin">
            {projectTypes.map((type) => {
              const Icon = type.icon
              const isSelected = selectedType === type.id
              
              return (
                <motion.button
                  key={type.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedType(type.id)}
                  className={clsx(
                    'relative p-3 rounded-xl border text-left transition-all',
                    isSelected 
                      ? 'border-brand-500 bg-brand-500/10' 
                      : 'border-dark-700 bg-dark-800/50 hover:border-dark-600'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-brand-400" />
                    </div>
                  )}
                  
                  <div className="flex flex-col items-center text-center">
                    <div className={`inline-flex p-2 rounded-lg bg-gradient-to-br ${type.color} mb-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    
                    <h3 className="text-xs font-semibold text-white mb-1">{type.name}</h3>
                    <p className="text-[10px] text-dark-400 mb-2 line-clamp-2">{type.description}</p>
                    
                    <div className="mt-auto pt-2 border-t border-dark-700 w-full">
                      <div className="flex items-center justify-center space-x-1 text-[10px] text-dark-500">
                        <Clock className="w-3 h-3" />
                        <span>{type.estimatedTime}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Project Prompt */}
        <div>
          {selectedType && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4"
            >
              <h2 className="text-sm font-semibold text-white mb-3">2. Describe Your Project</h2>
              <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe what you want to create. Be specific about requirements, features, and constraints...`}
                  className="w-full h-24 px-3 py-2 bg-dark-900/50 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
                />
                
                <div className="flex flex-wrap gap-3 mt-3">
                  {/* Required Fields */}
                  {selectedProjectType && selectedProjectType.requiredFields.length > 0 && (
                    <div className="flex-1 min-w-[250px] p-3 bg-dark-900/50 rounded-lg border border-dark-700">
                      <div className="flex items-center space-x-1.5 mb-2">
                        <AlertCircle className="w-3 h-3 text-brand-400" />
                        <span className="text-xs font-medium text-brand-400">Additional Info</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedProjectType.requiredFields.map((field) => (
                          <div key={field} className="flex-1 min-w-[150px]">
                            <label className="block text-[10px] text-dark-400 mb-0.5 capitalize">
                              {field.replace('_', ' ')}
                            </label>
                            <input
                              type="text"
                              value={additionalFields[field] || ''}
                              onChange={(e) => setAdditionalFields(prev => ({
                                ...prev,
                                [field]: e.target.value
                              }))}
                              className="w-full px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white placeholder-dark-500 focus:outline-none focus:border-brand-500"
                              placeholder={`Enter ${field.replace('_', ' ')}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Settings - Horizontal Layout */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex items-center space-x-3 px-4 py-3 bg-dark-900/50 rounded-lg border border-dark-700">
                      <Settings className="w-4 h-4 text-dark-400" />
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-dark-400">Auto-start</label>
                        <button
                          onClick={() => setAdvancedSettings(prev => ({ ...prev, autoStart: !prev.autoStart }))}
                          className={clsx(
                            'w-8 h-5 rounded-full transition-colors relative',
                            advancedSettings.autoStart ? 'bg-brand-600' : 'bg-dark-700'
                          )}>
                          <div className={clsx(
                            'absolute top-0.5 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                            advancedSettings.autoStart ? 'translate-x-4' : 'translate-x-0.5'
                          )} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 px-4 py-3 bg-dark-900/50 rounded-lg border border-dark-700">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs text-dark-400">Approval</label>
                        <button
                          onClick={() => setAdvancedSettings(prev => ({ ...prev, requireApproval: !prev.requireApproval }))}
                          className={clsx(
                            'w-8 h-5 rounded-full transition-colors relative',
                            advancedSettings.requireApproval ? 'bg-brand-600' : 'bg-dark-700'
                          )}>
                          <div className={clsx(
                            'absolute top-0.5 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                            advancedSettings.requireApproval ? 'translate-x-4' : 'translate-x-0.5'
                          )} />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 px-4 py-3 bg-dark-900/50 rounded-lg border border-dark-700">
                      <label className="text-xs text-dark-400">Tokens:</label>
                      <input
                        type="number"
                        value={advancedSettings.tokenLimit}
                        onChange={(e) => setAdvancedSettings(prev => ({ 
                          ...prev, 
                          tokenLimit: parseInt(e.target.value) || 0 
                        }))}
                        className="w-20 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div className="mt-4">
                  <button
                    onClick={() => setAdvancedSettings(prev => ({ ...prev, showAdvanced: !prev.showAdvanced }))}
                    className="flex items-center space-x-2 text-sm text-dark-400 hover:text-dark-200 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Advanced Settings</span>
                    <ChevronRight className={clsx(
                      'w-4 h-4 transition-transform',
                      advancedSettings.showAdvanced && 'rotate-90'
                    )} />
                  </button>
                  
                  <div>
                    {advancedSettings.showAdvanced && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-4 space-y-3 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-dark-300">Auto-start on creation</label>
                          <button
                            onClick={() => setAdvancedSettings(prev => ({ ...prev, autoStart: !prev.autoStart }))}
                            className={clsx(
                              'w-10 h-6 rounded-full transition-colors relative',
                              advancedSettings.autoStart ? 'bg-brand-600' : 'bg-dark-700'
                            )}
                          >
                            <div className={clsx(
                              'absolute top-1 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                              advancedSettings.autoStart ? 'translate-x-5' : 'translate-x-1'
                            )} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-dark-300">Require approval for tasks</label>
                          <button
                            onClick={() => setAdvancedSettings(prev => ({ ...prev, requireApproval: !prev.requireApproval }))}
                            className={clsx(
                              'w-10 h-6 rounded-full transition-colors relative',
                              advancedSettings.requireApproval ? 'bg-brand-600' : 'bg-dark-700'
                            )}
                          >
                            <div className={clsx(
                              'absolute top-1 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                              advancedSettings.requireApproval ? 'translate-x-5' : 'translate-x-1'
                            )} />
                          </button>
                        </div>
                        
                        <div>
                          <label className="text-sm text-dark-300 mb-2 block">Token Limit</label>
                          <input
                            type="number"
                            value={advancedSettings.tokenLimit}
                            onChange={(e) => setAdvancedSettings(prev => ({ 
                              ...prev, 
                              tokenLimit: parseInt(e.target.value) || 0 
                            }))}
                            className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm text-dark-300 mb-2 block">Priority</label>
                          <select
                            value={advancedSettings.priority}
                            onChange={(e) => setAdvancedSettings(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-dark-800 border border-dark-600 rounded text-sm text-white"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Workflow Preview */}
        <div>
          {selectedType && selectedProjectType && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">3. Workflow Preview</h2>
                <button
                  onClick={() => setShowWorkflowPreview(!showWorkflowPreview)}
                  className="flex items-center space-x-2 text-sm text-dark-400 hover:text-dark-200 transition-colors"
                >
                  {showWorkflowPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showWorkflowPreview ? 'Hide' : 'Show'} Preview</span>
                </button>
              </div>
              
              <div>
                {showWorkflowPreview && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-dark-800/50 rounded-xl border border-dark-700 p-6 overflow-hidden"
                  >
                    {selectedProjectType.defaultWorkflow.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <Cpu className="w-5 h-5 text-brand-400" />
                            <span className="text-sm text-dark-300">
                              Estimated tokens: <span className="text-brand-400 font-semibold">{calculateTotalTokens()}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <Clock className="w-5 h-5 text-dark-400" />
                            <span className="text-sm text-dark-300">{selectedProjectType.estimatedTime}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {selectedProjectType.defaultWorkflow.map((task, index) => (
                            <motion.div
                              key={index}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: index * 0.05 }}
                              className="flex items-center space-x-3 p-3 bg-dark-900/50 rounded-lg"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 text-sm font-semibold">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-white">{task.name}</div>
                                <div className="text-xs text-dark-500 capitalize">{task.capability}</div>
                              </div>
                              <div className="text-xs text-dark-400">{task.tokens} tokens</div>
                              <ArrowRight className="w-4 h-4 text-dark-600" />
                            </motion.div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-dark-500">
                        <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Custom workflow will be defined after creation</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          
          <button
            onClick={handleCreate}
            disabled={!selectedType || !prompt.trim()}
            className={clsx(
              'btn',
              selectedType && prompt.trim()
                ? 'btn-primary'
                : 'btn-secondary'
            )}
          >
            <Sparkles className="w-5 h-5" />
            <span>Create Project</span>
          </button>
        </div>
      </div>
    </div>
  )
}