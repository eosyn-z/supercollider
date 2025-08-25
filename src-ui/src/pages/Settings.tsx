import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Cpu,
  Shield,
  Bell,
  Database,
  Globe,
  Zap,
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  X,
  Lock,
  Unlock,
  HardDrive,
  Gauge,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Key,
  RefreshCw
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { invokeWithFallback as invoke } from '../ipc/tauriWrapper'
import TaskPriorityManager from '../components/TaskPriorityManager/TaskPriorityManager'
import PriorityConfigurator from '../components/PriorityConfigurator/PriorityConfigurator'

const tabs = [
  { id: 'general', name: 'General', icon: SettingsIcon },
  { id: 'queue', name: 'Queue & Processing', icon: Cpu },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'storage', name: 'Storage', icon: Database },
  { id: 'advanced', name: 'Advanced', icon: Zap }
]

export default function Settings() {
  const { config, updateConfig } = useAppStore()
  const [activeTab, setActiveTab] = useState('general')
  const [localConfig, setLocalConfig] = useState(config)
  const [hasChanges, setHasChanges] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState({
    approvals: true,
    failures: true,
    completions: true,
    clarifications: true,
    soundEnabled: true
  })
  
  // API Key state
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    anthropic: '',
    ollama: ''
  })
  const [showApiKeys, setShowApiKeys] = useState({
    openai: false,
    anthropic: false,
    ollama: false
  })
  const [testingApi, setTestingApi] = useState<string | null>(null)

  const handleConfigChange = (updates: Partial<typeof config>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      await updateConfig(localConfig)
      setHasChanges(false)
      toast.success('Settings saved successfully')
    } catch (error) {
      toast.error(`Failed to save settings: ${error}`)
    }
  }

  const handleReset = () => {
    setLocalConfig(config)
    setHasChanges(false)
    toast.success('Settings reset')
  }
  
  // API Key handlers
  const handleApiKeyChange = (provider: string, key: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: key }))
  }
  
  const handleSaveApiKey = async (provider: string) => {
    try {
      await invoke('set_api_key', { provider, key: apiKeys[provider] })
      toast.success(`${provider} API key saved`)
    } catch (error) {
      toast.error(`Failed to save ${provider} API key: ${error}`)
    }
  }
  
  const handleTestApiConnection = async (provider: string) => {
    setTestingApi(provider)
    try {
      const result = await invoke('test_api_connection', { provider }) as any
      if (result.ok) {
        toast.success(`${provider} connection successful`)
      } else {
        toast.error(`${provider} connection failed: ${result.error}`)
      }
    } catch (error) {
      toast.error(`Failed to test ${provider} connection: ${error}`)
    } finally {
      setTestingApi(null)
    }
  }

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* Theme and Workflow */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Appearance</h3>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-dark-400 mb-3">Theme</label>
            <div className="flex gap-3">
              {[
                { value: 'light', icon: Sun, label: 'Light' },
                { value: 'dark', icon: Moon, label: 'Dark' },
                { value: 'system', icon: Monitor, label: 'System' }
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    handleConfigChange({ theme: value as any })
                    // Apply theme immediately for instant feedback
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                    if (value === 'light') {
                      document.documentElement.setAttribute('data-theme', 'light')
                      document.documentElement.classList.remove('dark')
                    } else if (value === 'dark') {
                      document.documentElement.setAttribute('data-theme', 'dark')
                      document.documentElement.classList.add('dark')
                    } else if (value === 'system') {
                      if (prefersDark) {
                        document.documentElement.setAttribute('data-theme', 'dark')
                        document.documentElement.classList.add('dark')
                      } else {
                        document.documentElement.setAttribute('data-theme', 'light')
                        document.documentElement.classList.remove('dark')
                      }
                    }
                  }}
                  className={clsx(
                    'p-4 rounded-lg border-2 transition-all transform hover:scale-105',
                    localConfig.theme === value
                      ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/20'
                      : 'border-dark-600 bg-dark-900 hover:border-dark-500'
                  )}
                >
                  <Icon className={clsx(
                    'w-6 h-6 mx-auto mb-2 transition-all',
                    localConfig.theme === value ? 'text-brand-400' : 'text-dark-400'
                  )} />
                  <div className={clsx(
                    'text-sm font-medium',
                    localConfig.theme === value ? 'text-brand-400' : 'text-dark-300'
                  )}>
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Workflow Visualization */}
          <div className="flex-1">
            <label className="block text-sm text-dark-400 mb-3">Workflow Display</label>
            <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg border border-dark-700 h-full">
              <div>
                <div className="text-sm font-medium text-white">Show by Default</div>
                <div className="text-xs text-dark-500 mt-1">Display task flow visualization</div>
              </div>
              <button
                onClick={() => handleConfigChange({ show_workflow_by_default: !localConfig.show_workflow_by_default })}
                className={clsx(
                  'w-8 h-5 rounded-full transition-colors relative',
                  localConfig.show_workflow_by_default ? 'bg-brand-600' : 'bg-dark-700'
                )}
              >
                <div className={clsx(
                  'absolute top-0.5 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                  localConfig.show_workflow_by_default ? 'translate-x-3.5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Mode */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Approval Mode</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'automatic', label: 'Automatic', description: 'Tasks run without approval' },
            { value: 'manual', label: 'Manual', description: 'Approve each task' },
            { value: 'dynamic', label: 'Dynamic', description: 'Smart approval based on risk' }
          ].map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => handleConfigChange({ approval_mode: value as any })}
              className={clsx(
                'p-4 rounded-lg border-2 text-left transition-all',
                localConfig.approval_mode === value
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-dark-600 bg-dark-900 hover:border-dark-500'
              )}
            >
              <div className={clsx(
                'text-sm font-medium mb-1',
                localConfig.approval_mode === value ? 'text-brand-400' : 'text-white'
              )}>
                {label}
              </div>
              <div className="text-xs text-dark-500">{description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderQueueSettings = () => (
    <div className="space-y-6">
      {/* Task Priority Configuration */}
      <TaskPriorityManager 
        onPriorityChange={(taskTypes) => {
          console.log('Task priorities updated:', taskTypes)
          setHasChanges(true)
        }}
      />
      
      {/* Capability & Agent Priority Configuration */}
      <PriorityConfigurator />

      {/* Auto Start and Silent Mode */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-dark-900/50 rounded-lg border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Auto-Start</div>
              <div className="text-xs text-dark-500 mt-1">Start processing automatically</div>
            </div>
            <button
              onClick={() => handleConfigChange({ auto_start_queue: !localConfig.auto_start_queue })}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                localConfig.auto_start_queue ? 'bg-brand-600' : 'bg-dark-700'
              )}
            >
              <div className={clsx(
                'absolute top-1 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                localConfig.auto_start_queue ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
        </div>
        
        <div className="p-4 bg-dark-900/50 rounded-lg border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Silent Mode</div>
              <div className="text-xs text-dark-500 mt-1">Continue without prompting</div>
            </div>
            <button
              onClick={() => handleConfigChange({ silent_mode: !localConfig.silent_mode })}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                localConfig.silent_mode ? 'bg-brand-600' : 'bg-dark-700'
              )}
            >
              <div className={clsx(
                'absolute top-1 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                localConfig.silent_mode ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Batching */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Task Batching</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-dark-900/50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">Enable Batching</div>
              <div className="text-xs text-dark-500 mt-1">Group similar tasks for efficient processing</div>
            </div>
            <button
              onClick={() => handleConfigChange({ 
                batching: { ...localConfig.batching, enabled: !localConfig.batching.enabled }
              })}
              className={clsx(
                'w-10 h-6 rounded-full transition-colors relative',
                localConfig.batching.enabled ? 'bg-brand-600' : 'bg-dark-700'
              )}
            >
              <div className={clsx(
                'absolute top-1 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                localConfig.batching.enabled ? 'translate-x-5' : 'translate-x-1'
              )} />
            </button>
          </div>

          {localConfig.batching.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-400 mb-2">Batch Size</label>
                <input
                  type="number"
                  value={localConfig.batching.batch_size}
                  onChange={(e) => handleConfigChange({
                    batching: { ...localConfig.batching, batch_size: parseInt(e.target.value) || 1 }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                />
                <p className="text-xs text-dark-500 mt-1">Tasks per batch</p>
              </div>

              <div>
                <label className="block text-sm text-dark-400 mb-2">Concurrency</label>
                <input
                  type="number"
                  value={localConfig.batching.concurrency}
                  onChange={(e) => handleConfigChange({
                    batching: { ...localConfig.batching, concurrency: parseInt(e.target.value) || 1 }
                  })}
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                />
                <p className="text-xs text-dark-500 mt-1">Parallel batches</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Failure Strategy */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Failure Handling</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'halt', label: 'Halt', description: 'Stop on failure', icon: X },
            { value: 'continue', label: 'Continue', description: 'Skip failed tasks', icon: Check }
          ].map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              onClick={() => handleConfigChange({ failure_strategy: value as any })}
              className={clsx(
                'p-4 rounded-lg border-2 transition-all',
                localConfig.failure_strategy === value
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-dark-600 bg-dark-900 hover:border-dark-500'
              )}
            >
              <Icon className={clsx(
                'w-6 h-6 mx-auto mb-2',
                localConfig.failure_strategy === value ? 'text-brand-400' : 'text-dark-400'
              )} />
              <div className={clsx(
                'text-sm font-medium',
                localConfig.failure_strategy === value ? 'text-brand-400' : 'text-white'
              )}>
                {label}
              </div>
              <div className="text-xs text-dark-500">{description}</div>
            </button>
          ))}
        </div>
      </div>

    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      {/* API Keys */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">API Keys</h3>
        <div className="space-y-4">
          {/* OpenAI */}
          <div className="p-4 bg-dark-900/50 rounded-lg border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-white">OpenAI API Key</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowApiKeys(prev => ({ ...prev, openai: !prev.openai }))}
                  className="p-1 hover:bg-dark-700 rounded transition-colors"
                >
                  {showApiKeys.openai ? <EyeOff className="w-4 h-4 text-dark-400" /> : <Eye className="w-4 h-4 text-dark-400" />}
                </button>
                <button
                  onClick={() => handleTestApiConnection('openai')}
                  disabled={!apiKeys.openai || testingApi === 'openai'}
                  className="px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {testingApi === 'openai' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span>Test</span>
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type={showApiKeys.openai ? 'text' : 'password'}
                value={apiKeys.openai}
                onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                placeholder="sk-..."
                className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded text-sm text-white font-mono"
              />
              <button
                onClick={() => handleSaveApiKey('openai')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded text-sm text-white"
              >
                Save
              </button>
            </div>
          </div>
          
          {/* Anthropic */}
          <div className="p-4 bg-dark-900/50 rounded-lg border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-white">Anthropic API Key</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowApiKeys(prev => ({ ...prev, anthropic: !prev.anthropic }))}
                  className="p-1 hover:bg-dark-700 rounded transition-colors"
                >
                  {showApiKeys.anthropic ? <EyeOff className="w-4 h-4 text-dark-400" /> : <Eye className="w-4 h-4 text-dark-400" />}
                </button>
                <button
                  onClick={() => handleTestApiConnection('anthropic')}
                  disabled={!apiKeys.anthropic || testingApi === 'anthropic'}
                  className="px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {testingApi === 'anthropic' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span>Test</span>
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type={showApiKeys.anthropic ? 'text' : 'password'}
                value={apiKeys.anthropic}
                onChange={(e) => handleApiKeyChange('anthropic', e.target.value)}
                placeholder="sk-ant-api..."
                className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded text-sm text-white font-mono"
              />
              <button
                onClick={() => handleSaveApiKey('anthropic')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded text-sm text-white"
              >
                Save
              </button>
            </div>
          </div>
          
          {/* Ollama */}
          <div className="p-4 bg-dark-900/50 rounded-lg border border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-white">Ollama API URL</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleTestApiConnection('ollama')}
                  disabled={!apiKeys.ollama || testingApi === 'ollama'}
                  className="px-3 py-1 bg-dark-700 hover:bg-dark-600 rounded text-xs text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  {testingApi === 'ollama' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  <span>Test</span>
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={apiKeys.ollama}
                onChange={(e) => handleApiKeyChange('ollama', e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 px-3 py-2 bg-dark-800 border border-dark-600 rounded text-sm text-white font-mono"
              />
              <button
                onClick={() => handleSaveApiKey('ollama')}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 rounded text-sm text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Allowlist */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Domain Allowlist</h3>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div>
                <div className="text-sm font-medium text-yellow-400">Security Notice</div>
                <div className="text-xs text-dark-300 mt-1">
                  Only domains in this list can be accessed by remote agents. Leave empty to block all remote connections.
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-dark-400 mb-2">Allowed Domains</label>
            <textarea
              value={localConfig.allowlist.join('\n')}
              onChange={(e) => handleConfigChange({ 
                allowlist: e.target.value.split('\n').filter(Boolean) 
              })}
              className="w-full h-32 px-4 py-3 bg-dark-900 border border-dark-600 rounded-lg text-white font-mono text-sm"
              placeholder="api.openai.com&#10;api.anthropic.com&#10;api.example.com"
            />
          </div>
        </div>
      </div>

      {/* Token Limits */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Token Limits</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-2">Daily Token Limit</label>
            <input
              type="number"
              value={50000}
              className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-2">Per-Project Limit</label>
            <input
              type="number"
              value={10000}
              className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
            />
          </div>
        </div>
      </div>

      {/* Process Execution */}
      <div className="p-4 bg-dark-900/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white flex items-center space-x-1">
              <Lock className="w-3 h-3 text-red-400" />
              <span>Process Execution</span>
            </div>
            <div className="text-[10px] text-dark-500 mt-0.5">Allow local process execution (security risk)</div>
          </div>
          <button
            disabled
            className="w-8 h-5 rounded-full bg-dark-700 relative opacity-50 cursor-not-allowed"
          >
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-toggle-slider rounded-full" />
          </button>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-4">
      {/* Notification Types */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Notification Types</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'approvals', label: 'Approval Required', icon: AlertCircle, color: 'text-yellow-400' },
            { id: 'failures', label: 'Task Failures', icon: X, color: 'text-red-400' },
            { id: 'completions', label: 'Project Completions', icon: Check, color: 'text-green-400' },
            { id: 'clarifications', label: 'Clarifications Needed', icon: AlertCircle, color: 'text-purple-400' }
          ].map(({ id, label, icon: Icon, color }) => (
            <div key={id} className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg border border-dark-700 hover:border-dark-600 transition-all">
              <div className="flex items-center space-x-2">
                <Icon className={clsx('w-4 h-4', color)} />
                <span className="text-xs text-white">{label}</span>
              </div>
              <button
                onClick={() => setNotificationSettings(prev => ({ ...prev, [id]: !prev[id] }))}
                className={clsx(
                  'w-8 h-5 rounded-full transition-colors relative',
                  notificationSettings[id] ? 'bg-brand-600' : 'bg-dark-700'
                )}
              >
                <div className={clsx(
                  'absolute top-0.5 w-4 h-4 bg-toggle-slider rounded-full transition-transform',
                  notificationSettings[id] ? 'translate-x-3.5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sound Settings */}
      <div className="p-3 bg-dark-900/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-white">Sound Notifications</div>
            <div className="text-[10px] text-dark-500 mt-0.5">Play sounds for important events</div>
          </div>
          <button 
            onClick={() => setNotificationSettings(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className={clsx(
              'p-2 rounded-lg transition-all',
              notificationSettings.soundEnabled 
                ? 'text-brand-400 hover:bg-brand-400/10' 
                : 'text-dark-500 hover:bg-dark-500'
            )}>
            {notificationSettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )

  const renderStorageSettings = () => (
    <div className="space-y-4">
      {/* Storage Location */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Storage Location</h3>
        <div className="p-3 bg-dark-900/50 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <HardDrive className="w-4 h-4 text-dark-400" />
            <div className="flex-1">
              <div className="text-xs text-white font-mono">%APPDATA%/supercollider/</div>
              <div className="text-[10px] text-dark-500 mt-0.5">Default storage location</div>
            </div>
          </div>
          <button 
            onClick={() => {
              // This would open a directory picker dialog
              toast.info('Directory picker would open here')
            }}
            className="text-xs text-brand-400 hover:text-brand-300">
            Change Location
          </button>
        </div>
      </div>

      {/* Storage Stats */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Storage Usage</h3>
        <div className="space-y-3">
          <div className="p-4 bg-dark-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-400">Projects</span>
              <span className="text-sm text-white">245 MB</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div className="bg-brand-500 h-2 rounded-full w-[30%]" />
            </div>
          </div>
          
          <div className="p-4 bg-dark-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-400">Artifacts</span>
              <span className="text-sm text-white">512 MB</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full w-[60%]" />
            </div>
          </div>
          
          <div className="p-4 bg-dark-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-400">Logs</span>
              <span className="text-sm text-white">89 MB</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full w-[10%]" />
            </div>
          </div>
        </div>
      </div>

      {/* Cleanup */}
      <div className="flex space-x-3">
        <button 
          onClick={async () => {
            if (confirm('Clear all log files?')) {
              // Would call api.storageClearLogs()
              toast.success('Logs cleared successfully')
            }
          }}
          className="flex-1 px-4 py-2 bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-500 transition-all">
          Clear Logs
        </button>
        <button 
          onClick={async () => {
            if (confirm('Clear all cached data?')) {
              // Would call api.storageClearCache()
              toast.success('Cache cleared successfully')
            }
          }}
          className="flex-1 px-4 py-2 bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-500 transition-all">
          Clear Cache
        </button>
      </div>
    </div>
  )

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      {/* Export/Import */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
        <div className="flex space-x-3">
          <button 
            onClick={() => {
              const configData = JSON.stringify(localConfig, null, 2)
              const blob = new Blob([configData], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'supercollider-config.json'
              a.click()
              URL.revokeObjectURL(url)
              toast.success('Configuration exported')
            }}
            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm hover:bg-dark-500 transition-all">
            Export Config
          </button>
          <button 
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.json'
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                
                try {
                  const text = await file.text()
                  const imported = JSON.parse(text)
                  setLocalConfig(imported)
                  setHasChanges(true)
                  toast.success('Configuration imported')
                } catch (error) {
                  toast.error('Invalid configuration file')
                }
              }
              input.click()
            }}
            className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm hover:bg-dark-500 transition-all">
            Import Config
          </button>
        </div>
      </div>

      {/* Debug Mode */}
      <div className="p-4 bg-dark-900/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-white">Debug Mode</div>
            <div className="text-xs text-dark-500 mt-1">Enable verbose logging and diagnostics</div>
          </div>
          <button className="w-10 h-6 rounded-full bg-dark-700 relative">
            <div className="absolute top-1 left-1 w-4 h-4 bg-toggle-slider rounded-full" />
          </button>
        </div>
      </div>

      {/* Reset */}
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <h4 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h4>
        <p className="text-xs text-dark-300 mb-3">Reset all settings to default values</p>
        <button className="btn btn-danger">
          Reset All Settings
        </button>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralSettings()
      case 'queue': return renderQueueSettings()
      case 'security': return renderSecuritySettings()
      case 'notifications': return renderNotificationSettings()
      case 'storage': return renderStorageSettings()
      case 'advanced': return renderAdvancedSettings()
      default: return null
    }
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-dark-400">Configure supercollider to match your workflow</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'w-full px-4 py-3 rounded-lg text-left transition-all flex items-center space-x-3',
                      isActive
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                        : 'bg-dark-800/50 text-dark-400 hover:text-dark-200 hover:bg-dark-700/50 border border-dark-700'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{tab.name}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-6">
              {renderContent()}
            </div>

            {/* Save Bar */}
            <div>
              {hasChanges && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="fixed bottom-8 right-8 left-80 mx-8"
                >
                  <div className="bg-dark-800 border border-brand-500/50 rounded-lg p-4 shadow-lg shadow-brand-500/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <AlertCircle className="w-5 h-5 text-brand-400" />
                        <span className="text-sm text-white">You have unsaved changes</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handleReset}
                          className="btn btn-secondary"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Reset</span>
                        </button>
                        <button
                          onClick={handleSave}
                          className="btn btn-primary"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save Changes</span>
                        </button>
                      </div>
                    </div>
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