import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus,
  Bot,
  Cpu,
  Zap,
  Settings,
  Trash2,
  Edit,
  Check,
  X,
  Activity,
  Globe,
  Server,
  Key,
  TestTube,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import * as api from '../ipc/commands'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const capabilityIcons = {
  code: FileCode,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video
}

const healthColors = {
  unknown: 'text-gray-400 bg-gray-400/10',
  healthy: 'text-green-400 bg-green-400/10',
  degraded: 'text-yellow-400 bg-yellow-400/10',
  unreachable: 'text-red-400 bg-red-400/10'
}

const healthIcons = {
  unknown: Clock,
  healthy: CheckCircle,
  degraded: AlertCircle,
  unreachable: XCircle
}

interface AgentFormData {
  name: string
  capabilities: string[]
  endpoint_url: string
  auth_type: 'none' | 'bearer' | 'api_key'
  auth_token: string
  priority: number
  local: boolean
}

export default function AgentManager() {
  const { agents, addAgent, updateAgent, removeAgent } = useAppStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const [formData, setFormData] = useState<AgentFormData>({
    name: '',
    capabilities: [],
    endpoint_url: '',
    auth_type: 'bearer',
    auth_token: '',
    priority: 100,
    local: false
  })
  const [testingAgent, setTestingAgent] = useState<string | null>(null)

  const handleAddAgent = async () => {
    if (!formData.name || formData.capabilities.length === 0) {
      toast.error('Name and at least one capability are required')
      return
    }

    try {
      const newAgent = {
        name: formData.name,
        capabilities: formData.capabilities as any[],
        endpoint_url: formData.local ? undefined : formData.endpoint_url,
        enabled: true,
        priority: formData.priority,
        health: 'unknown' as const,
        local: formData.local
      }

      await addAgent(newAgent)
      toast.success(`Agent "${formData.name}" added successfully`)
      setShowAddForm(false)
      resetForm()
    } catch (error) {
      toast.error(`Failed to add agent: ${error}`)
    }
  }

  const handleTestAgent = async (agentName: string) => {
    setTestingAgent(agentName)
    
    try {
      const result = await api.agentsTest(agentName)
      const health = result.latency_ms > 0 ? 'healthy' : 'unreachable'
      
      await updateAgent(agentName, { health })
      
      if (health === 'healthy') {
        toast.success(`Agent "${agentName}" is healthy (${result.latency_ms}ms)`)
      } else {
        toast.error(`Agent "${agentName}" is unreachable`)
      }
    } catch (error) {
      toast.error(`Failed to test agent: ${error}`)
    } finally {
      setTestingAgent(null)
    }
  }

  const handleToggleAgent = async (agentName: string, enabled: boolean) => {
    try {
      await updateAgent(agentName, { enabled })
      toast.success(`Agent "${agentName}" ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toast.error(`Failed to toggle agent: ${error}`)
    }
  }

  const handleDeleteAgent = async (agentName: string) => {
    if (confirm(`Are you sure you want to delete agent "${agentName}"?`)) {
      try {
        await removeAgent(agentName)
        toast.success(`Agent "${agentName}" deleted`)
      } catch (error) {
        toast.error(`Failed to delete agent: ${error}`)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      capabilities: [],
      endpoint_url: '',
      auth_type: 'bearer',
      auth_token: '',
      priority: 100,
      local: false
    })
  }

  const toggleCapability = (capability: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capability)
        ? prev.capabilities.filter(c => c !== capability)
        : [...prev.capabilities, capability]
    }))
  }

  // Pre-configured agents for quick setup
  const preConfiguredAgents = [
    {
      name: 'Claude Code',
      capabilities: ['code'],
      icon: '',
      description: 'Anthropic Claude for code generation'
    },
    {
      name: 'GPT-4 Text',
      capabilities: ['text'],
      icon: '',
      description: 'OpenAI GPT-4 for text generation'
    },
    {
      name: 'DALL-E 3',
      capabilities: ['image'],
      icon: '',
      description: 'OpenAI DALL-E 3 for image generation'
    },
    {
      name: 'ElevenLabs',
      capabilities: ['sound'],
      icon: '',
      description: 'ElevenLabs for voice synthesis'
    }
  ]

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto px-4 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-white mb-0.5">Agent Manager</h1>
            <p className="text-xs text-dark-400">Configure AI agents and their capabilities</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            <span>Add Agent</span>
          </button>
        </div>

        {/* Quick Setup */}
        {agents.length === 0 && (
          <div className="mb-4 p-3 bg-dark-800/50 rounded-xl border border-dark-700">
            <h2 className="text-sm font-semibold text-white mb-2">Quick Setup</h2>
            <p className="text-xs text-dark-400 mb-2">Add pre-configured agents to get started quickly</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {preConfiguredAgents.map((agent) => (
                <button
                  key={agent.name}
                  onClick={() => {
                    setFormData({
                      name: agent.name,
                      capabilities: agent.capabilities,
                      endpoint_url: '',
                      auth_type: 'bearer',
                      auth_token: '',
                      priority: 100,
                      local: false
                    })
                    setShowAddForm(true)
                  }}
                  className="p-2 bg-dark-900/50 rounded-lg border border-dark-700 hover:border-brand-500/50 transition-all text-left"
                >
                  <div className="text-lg mb-1">{agent.icon}</div>
                  <div className="text-xs font-medium text-white">{agent.name}</div>
                  <div className="text-[10px] text-dark-500 mt-0.5">{agent.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Agent List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {agents.map((agent) => {
            const HealthIcon = healthIcons[agent.health]
            const isEditing = editingAgent === agent.name
            const isTesting = testingAgent === agent.name
            
            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dark-800/50 rounded-xl border border-dark-700 p-4"
              >
                <div>
                  <div className="flex items-start space-x-2">
                    <div className={clsx(
                      'p-2 rounded-lg flex-shrink-0',
                      agent.enabled ? 'bg-brand-500/20' : 'bg-dark-700'
                    )}>
                      <Bot className={clsx(
                        'w-5 h-5',
                        agent.enabled ? 'text-brand-400' : 'text-dark-500'
                      )} />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                          <span className={clsx(
                            'px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center space-x-0.5',
                            healthColors[agent.health]
                          )}>
                            <HealthIcon className="w-3 h-3" />
                            <span>{agent.health}</span>
                          </span>
                          {agent.local && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400 flex items-center space-x-0.5">
                              <Server className="w-3 h-3" />
                              <span>Local</span>
                            </span>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={() => handleTestAgent(agent.name)}
                            disabled={isTesting}
                            className={clsx(
                              'btn-icon',
                              isTesting && 'btn-loading'
                            )}
                          >
                            {isTesting ? (
                              <Activity className="w-4 h-4 animate-pulse" />
                            ) : (
                              <TestTube className="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => handleToggleAgent(agent.name, !agent.enabled)}
                            className={clsx(
                              'btn-icon',
                              agent.enabled ? 'btn-success' : 'btn-danger'
                            )}
                          >
                            {agent.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          </button>
                          
                          <button
                            onClick={() => setEditingAgent(isEditing ? null : agent.name)}
                            className="btn-icon"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteAgent(agent.name)}
                            className="btn-icon btn-danger"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {agent.capabilities.map((capability) => {
                          const Icon = capabilityIcons[capability]
                          return (
                            <div
                              key={capability}
                              className="px-2 py-0.5 bg-dark-900/50 rounded-lg border border-dark-600 flex items-center space-x-1"
                            >
                              <Icon className="w-3 h-3 text-dark-400" />
                              <span className="text-[10px] text-dark-300 capitalize">{capability}</span>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Stats */}
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div className="flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-brand-400" />
                          <span className="text-dark-500">Priority:</span>
                          <span className="text-white font-medium">{agent.priority}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-green-400" />
                          <span className="text-dark-500">Status:</span>
                          <span className={clsx(
                            'font-medium',
                            agent.enabled ? 'text-green-400' : 'text-red-400'
                          )}>
                            {agent.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        {agent.endpoint_url && (
                          <div className="flex items-center space-x-1">
                            <Globe className="w-3 h-3 text-blue-400" />
                            <span className="text-dark-400 text-[10px] truncate max-w-[150px]">{agent.endpoint_url}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Edit Form */}
                <div>
                  {isEditing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 pt-4 border-t border-dark-700 overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-dark-400 mb-2">Priority</label>
                          <input
                            type="number"
                            value={agent.priority}
                            onChange={(e) => updateAgent(agent.name, { priority: parseInt(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                          />
                        </div>
                        {!agent.local && (
                          <div>
                            <label className="block text-sm text-dark-400 mb-2">Endpoint URL</label>
                            <input
                              type="text"
                              value={agent.endpoint_url || ''}
                              onChange={(e) => updateAgent(agent.name, { endpoint_url: e.target.value })}
                              className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Add Agent Modal */}
        <div>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8"
              onClick={() => setShowAddForm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-dark-800 rounded-xl border border-dark-700 p-4 max-w-lg w-full max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold text-white mb-3 flex-shrink-0">Add New Agent</h2>
                
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {/* Name */}
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Agent Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-white text-sm"
                      placeholder="e.g., Claude Code, GPT-4"
                    />
                  </div>
                  
                  {/* Capabilities */}
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Capabilities *</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(capabilityIcons).map(([capability, Icon]) => (
                        <button
                          key={capability}
                          onClick={() => toggleCapability(capability)}
                          className={clsx(
                            'px-2 py-1 rounded border flex items-center space-x-1 transition-all text-sm',
                            formData.capabilities.includes(capability)
                              ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                              : 'border-dark-600 bg-dark-900 text-dark-400 hover:border-dark-500'
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="capitalize text-xs">{capability}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Local vs Remote */}
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Agent Type</label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, local: true }))}
                        className={clsx(
                          'flex-1 px-2 py-1 rounded border transition-all text-sm',
                          formData.local
                            ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                            : 'border-dark-600 bg-dark-900 text-dark-400'
                        )}
                      >
                        <Server className="w-3 h-3 inline mr-1" />
                        Local
                      </button>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, local: false }))}
                        className={clsx(
                          'flex-1 px-2 py-1 rounded border transition-all text-sm',
                          !formData.local
                            ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                            : 'border-dark-600 bg-dark-900 text-dark-400'
                        )}
                      >
                        <Globe className="w-3 h-3 inline mr-1" />
                        Remote
                      </button>
                    </div>
                  </div>
                  
                  {/* Remote Settings */}
                  {!formData.local && (
                    <>
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Endpoint URL</label>
                        <input
                          type="text"
                          value={formData.endpoint_url}
                          onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
                          className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-white text-sm"
                          placeholder="https://api.example.com/v1/complete"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs text-dark-400 mb-1">Authentication</label>
                        <select
                          value={formData.auth_type}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_type: e.target.value as any }))}
                          className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-white text-sm mb-1"
                        >
                          <option value="none">None</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="api_key">API Key</option>
                        </select>
                        
                        {formData.auth_type !== 'none' && (
                          <div className="relative">
                            <Key className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-500" />
                            <input
                              type="password"
                              value={formData.auth_token}
                              onChange={(e) => setFormData(prev => ({ ...prev, auth_token: e.target.value }))}
                              className="w-full pl-7 pr-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-white text-sm"
                              placeholder={formData.auth_type === 'bearer' ? 'Bearer token' : 'API key'}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  {/* Priority */}
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2 py-1.5 bg-dark-900 border border-dark-600 rounded text-white text-sm"
                      placeholder="100"
                    />
                    <p className="text-[10px] text-dark-500 mt-0.5">Higher priority agents are preferred for task execution</p>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex justify-end space-x-2 mt-3 pt-3 border-t border-dark-700 flex-shrink-0">
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      resetForm()
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAgent}
                    className="btn btn-primary"
                  >
                    Add Agent
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}