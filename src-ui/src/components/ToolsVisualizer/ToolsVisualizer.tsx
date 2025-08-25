import React, { useState } from 'react'
import {
  Wrench,
  Code,
  FileText,
  Image,
  Music,
  Video,
  Database,
  Globe,
  Terminal,
  Package,
  GitBranch,
  Layers,
  Cpu,
  HardDrive,
  Cloud,
  Lock,
  Zap,
  Settings,
  Check,
  X
} from 'lucide-react'
import clsx from 'clsx'
import './ToolsVisualizer.css'

// Tool categories with their associated capabilities
const toolCategories = {
  'Code Generation': {
    icon: Code,
    color: 'blue',
    tools: ['GitHub Copilot', 'Tabnine', 'Codeium', 'Amazon CodeWhisperer'],
    capabilities: ['code', 'debug', 'refactor', 'test']
  },
  'Text Processing': {
    icon: FileText,
    color: 'green',
    tools: ['GPT-4', 'Claude', 'Gemini', 'LLaMA'],
    capabilities: ['text', 'translate', 'summarize', 'analyze']
  },
  'Image Generation': {
    icon: Image,
    color: 'purple',
    tools: ['DALL-E 3', 'Midjourney', 'Stable Diffusion', 'Adobe Firefly'],
    capabilities: ['image', 'edit', 'enhance', 'style']
  },
  'Audio Processing': {
    icon: Music,
    color: 'yellow',
    tools: ['ElevenLabs', 'Whisper', 'Murf AI', 'Resemble AI'],
    capabilities: ['audio', 'voice', 'transcribe', 'synthesize']
  },
  'Video Processing': {
    icon: Video,
    color: 'red',
    tools: ['Runway', 'Synthesia', 'D-ID', 'Pika Labs'],
    capabilities: ['video', 'animate', 'edit', 'generate']
  },
  'Data Processing': {
    icon: Database,
    color: 'indigo',
    tools: ['Apache Spark', 'Pandas', 'NumPy', 'TensorFlow'],
    capabilities: ['data', 'analyze', 'transform', 'visualize']
  },
  'Web Scraping': {
    icon: Globe,
    color: 'teal',
    tools: ['Puppeteer', 'Playwright', 'Selenium', 'BeautifulSoup'],
    capabilities: ['scrape', 'automate', 'extract', 'monitor']
  },
  'System Tools': {
    icon: Terminal,
    color: 'gray',
    tools: ['Docker', 'Kubernetes', 'Git', 'npm'],
    capabilities: ['execute', 'deploy', 'version', 'package']
  }
}

interface Tool {
  name: string
  category: string
  enabled: boolean
  capabilities: string[]
  icon?: React.ElementType
}

interface ToolsVisualizerProps {
  selectedTools?: string[]
  onToolsChange?: (tools: string[]) => void
  mode?: 'select' | 'view' | 'compact'
  taskType?: string
  showCategories?: boolean
}

export default function ToolsVisualizer({
  selectedTools = [],
  onToolsChange,
  mode = 'view',
  taskType,
  showCategories = true
}: ToolsVisualizerProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [hoveredTool, setHoveredTool] = useState<string | null>(null)

  const getRecommendedTools = (type?: string): string[] => {
    if (!type) return []
    
    const recommendations: Record<string, string[]> = {
      'code_generation': ['GitHub Copilot', 'GPT-4', 'Git', 'Docker'],
      'text_generation': ['GPT-4', 'Claude', 'Gemini'],
      'image_generation': ['DALL-E 3', 'Stable Diffusion', 'Adobe Firefly'],
      'audio_generation': ['ElevenLabs', 'Whisper', 'Murf AI'],
      'video_generation': ['Runway', 'Synthesia', 'D-ID'],
      'data_processing': ['Apache Spark', 'Pandas', 'TensorFlow'],
      'web_automation': ['Puppeteer', 'Playwright', 'Selenium'],
      'multi_modal': ['GPT-4', 'DALL-E 3', 'ElevenLabs', 'Docker']
    }
    
    return recommendations[type] || []
  }

  const recommendedTools = getRecommendedTools(taskType)

  const toggleTool = (toolName: string) => {
    if (mode === 'view') return
    
    const newSelection = selectedTools.includes(toolName)
      ? selectedTools.filter(t => t !== toolName)
      : [...selectedTools, toolName]
    
    onToolsChange?.(newSelection)
  }

  const toggleCategory = (category: string) => {
    if (mode === 'view') return
    
    const categoryTools = toolCategories[category].tools
    const allSelected = categoryTools.every(tool => selectedTools.includes(tool))
    
    const newSelection = allSelected
      ? selectedTools.filter(t => !categoryTools.includes(t))
      : [...new Set([...selectedTools, ...categoryTools])]
    
    onToolsChange?.(newSelection)
  }

  const renderCompactView = () => {
    const selectedCount = selectedTools.length
    const totalTools = Object.values(toolCategories).reduce((acc, cat) => acc + cat.tools.length, 0)
    
    return (
      <div className="tools-compact">
        <div className="tools-compact-header">
          <Wrench size={16} className="text-dark-400" />
          <span className="text-sm text-white">
            {selectedCount} / {totalTools} tools selected
          </span>
        </div>
        <div className="tools-compact-icons">
          {Object.entries(toolCategories).map(([category, config]) => {
            const Icon = config.icon
            const categoryTools = config.tools
            const selectedInCategory = categoryTools.filter(t => selectedTools.includes(t)).length
            const allSelected = selectedInCategory === categoryTools.length
            const someSelected = selectedInCategory > 0
            
            return (
              <div
                key={category}
                className={clsx(
                  'tool-icon-badge',
                  allSelected && `active-${config.color}`,
                  someSelected && !allSelected && 'partial'
                )}
                title={`${category}: ${selectedInCategory}/${categoryTools.length} selected`}
              >
                <Icon size={14} />
                {selectedInCategory > 0 && (
                  <span className="badge-count">{selectedInCategory}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (mode === 'compact') {
    return renderCompactView()
  }

  return (
    <div className="tools-visualizer">
      {showCategories && (
        <div className="tools-header">
          <h3 className="text-lg font-semibold text-white mb-2">Available Tools</h3>
          {taskType && recommendedTools.length > 0 && (
            <div className="recommended-badge">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-xs text-yellow-400">
                Recommended for {taskType.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="tools-grid">
        {Object.entries(toolCategories).map(([category, config]) => {
          const Icon = config.icon
          const isExpanded = expandedCategory === category
          const categoryTools = config.tools
          const selectedInCategory = categoryTools.filter(t => selectedTools.includes(t)).length
          const allSelected = selectedInCategory === categoryTools.length
          
          return (
            <div
              key={category}
              className={clsx(
                'tool-category',
                `category-${config.color}`,
                isExpanded && 'expanded'
              )}
            >
              <div
                className="category-header"
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
              >
                <div className="category-info">
                  <Icon size={20} className={`text-${config.color}-400`} />
                  <span className="category-name">{category}</span>
                  <span className="category-count">
                    {selectedInCategory}/{categoryTools.length}
                  </span>
                </div>
                {mode === 'select' && (
                  <button
                    className={clsx(
                      'category-toggle',
                      allSelected && 'selected'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCategory(category)
                    }}
                  >
                    {allSelected ? <Check size={14} /> : <X size={14} />}
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="category-tools">
                  {categoryTools.map(tool => {
                    const isSelected = selectedTools.includes(tool)
                    const isRecommended = recommendedTools.includes(tool)
                    
                    return (
                      <div
                        key={tool}
                        className={clsx(
                          'tool-item',
                          isSelected && 'selected',
                          isRecommended && 'recommended',
                          hoveredTool === tool && 'hovered'
                        )}
                        onMouseEnter={() => setHoveredTool(tool)}
                        onMouseLeave={() => setHoveredTool(null)}
                        onClick={() => mode === 'select' && toggleTool(tool)}
                      >
                        <div className="tool-content">
                          <span className="tool-name">{tool}</span>
                          {isRecommended && (
                            <Zap size={12} className="text-yellow-400" />
                          )}
                        </div>
                        {mode === 'select' && (
                          <div className={clsx('tool-checkbox', isSelected && 'checked')}>
                            {isSelected && <Check size={12} />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {!isExpanded && selectedInCategory > 0 && (
                <div className="category-preview">
                  {categoryTools
                    .filter(t => selectedTools.includes(t))
                    .slice(0, 3)
                    .map(tool => (
                      <span key={tool} className="preview-tool">{tool}</span>
                    ))}
                  {selectedInCategory > 3 && (
                    <span className="preview-more">+{selectedInCategory - 3}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mode === 'select' && (
        <div className="tools-footer">
          <div className="selection-summary">
            <span className="text-sm text-dark-400">
              {selectedTools.length} tools selected
            </span>
            {selectedTools.length > 0 && (
              <button
                className="clear-button"
                onClick={() => onToolsChange?.([])}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}