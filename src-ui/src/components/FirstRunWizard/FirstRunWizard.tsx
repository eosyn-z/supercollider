import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Bot,
  Key,
  Settings,
  Bell,
  Check,
  Cpu,
  Zap,
  Shield,
  Globe,
  Server,
  FileCode,
  FileText,
  Image,
  Music,
  Video,
  Rocket
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import './FirstRunWizard.css'

const steps = [
  { id: 'welcome', title: 'Welcome', icon: Sparkles },
  { id: 'agents', title: 'Configure Agents', icon: Bot },
  { id: 'settings', title: 'Preferences', icon: Settings },
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'complete', title: 'Ready!', icon: Rocket }
]

const capabilityIcons = {
  code: FileCode,
  text: FileText,
  image: Image,
  sound: Music,
  video: Video
}

interface WizardData {
  agents: Array<{
    name: string
    capabilities: string[]
    apiKey?: string
    enabled: boolean
    priority: number
  }>
  settings: {
    approval_mode: 'automatic' | 'manual' | 'dynamic'
    auto_start_queue: boolean
    theme: 'light' | 'dark' | 'system'
  }
  notifications: {
    enabled: boolean
    types: string[]
  }
}

export default function FirstRunWizard() {
  const { completeFirstRun, addAgent, updateConfig } = useAppStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [wizardData, setWizardData] = useState<WizardData>({
    agents: [],
    settings: {
      approval_mode: 'dynamic',
      auto_start_queue: false,
      theme: 'dark'
    },
    notifications: {
      enabled: true,
      types: ['failures', 'completions', 'approvals']
    }
  })

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    try {
      // Save all the wizard data
      for (const agent of wizardData.agents) {
        await addAgent({
          name: agent.name,
          capabilities: agent.capabilities as any[],
          enabled: agent.enabled,
          priority: agent.priority,
          health: 'unknown',
          local: false
        })
      }

      await updateConfig({
        approval_mode: wizardData.settings.approval_mode,
        auto_start_queue: wizardData.settings.auto_start_queue,
        theme: wizardData.settings.theme
      })

      completeFirstRun()
      toast.success('Setup complete! Welcome to supercollider')
    } catch (error) {
      toast.error(`Failed to complete setup: ${error}`)
    }
  }

  const renderWelcome = () => (
    <>
      <div className="wizard-icon">
        <Cpu size={40} />
      </div>
      <h2 className="wizard-title">Welcome to supercollider</h2>
      
      <div className="features-list">
        <div className="feature-item">
          <div className="feature-icon">
            <Zap size={20} />
          </div>
          <div className="feature-content">
            <div className="feature-title">Multi-Agent</div>
            <div className="feature-desc">Coordinate multiple AI models</div>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon">
            <Shield size={20} />
          </div>
          <div className="feature-content">
            <div className="feature-title">Secure</div>
            <div className="feature-desc">Local-first with privacy</div>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon">
            <Globe size={20} />
          </div>
          <div className="feature-content">
            <div className="feature-title">Flexible</div>
            <div className="feature-desc">Custom workflows & tasks</div>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon">
            <Rocket size={20} />
          </div>
          <div className="feature-content">
            <div className="feature-title">Efficient</div>
            <div className="feature-desc">Smart token management</div>
          </div>
        </div>
      </div>
      
      <p className="text-center text-dark-400 text-sm mt-6">
        Let's get you set up in just a few steps
      </p>
    </>
  )

  const renderAgents = () => {
    const quickAgents = [
      { name: 'Claude Code', capabilities: ['code'], icon: '', defaultPriority: 100 },
      { name: 'GPT-4 Text', capabilities: ['text'], icon: '', defaultPriority: 90 },
      { name: 'DALL-E 3', capabilities: ['image'], icon: '', defaultPriority: 80 },
      { name: 'ElevenLabs', capabilities: ['sound'], icon: '', defaultPriority: 70 }
    ]

    const toggleAgent = (agentName: string) => {
      setWizardData(prev => {
        const existing = prev.agents.find(a => a.name === agentName)
        if (existing) {
          return {
            ...prev,
            agents: prev.agents.filter(a => a.name !== agentName)
          }
        } else {
          const template = quickAgents.find(a => a.name === agentName)!
          return {
            ...prev,
            agents: [...prev.agents, {
              name: agentName,
              capabilities: template.capabilities,
              enabled: true,
              priority: template.defaultPriority
            }]
          }
        }
      })
    }

    return (
      <div className="wizard-form">
        <div className="wizard-icon">
          <Bot size={40} />
        </div>
        <h2 className="wizard-title">Configure AI Agents</h2>
        <p className="wizard-subtitle">Select the AI agents you want to use. You can add more later.</p>
        
        <div className="checkbox-group" style={{ marginTop: '2rem' }}>
          {quickAgents.map((agent) => {
            const isSelected = wizardData.agents.some(a => a.name === agent.name)
            return (
              <button
                key={agent.name}
                onClick={() => toggleAgent(agent.name)}
                className="checkbox-item"
                style={{
                  padding: '1.5rem',
                  border: isSelected ? '2px solid #667eea' : '2px solid transparent',
                  background: isSelected ? 'rgba(102, 126, 234, 0.1)' : '#f7fafc',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>{agent.icon}</div>
                  {isSelected && (
                    <Check size={20} className="text-brand-500" />
                  )}
                </div>
                <div className="text-sm font-semibold text-dark-700">{agent.name}</div>
                <div className="text-xs text-dark-400 mt-1">
                  {agent.capabilities.join(', ')}
                </div>
              </button>
            )
          })}
        </div>

        {wizardData.agents.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div className="p-4 bg-dark-600 rounded-lg mb-4">
              <div className="text-sm text-dark-500 mb-3 font-semibold">Agent Priorities</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {wizardData.agents.map((agent) => (
                  <div key={agent.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-sm text-dark-700">{agent.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="text-xs text-dark-400">Priority:</span>
                      <input
                        type="number"
                        value={agent.priority}
                        onChange={(e) => {
                          setWizardData(prev => ({
                            ...prev,
                            agents: prev.agents.map(a => 
                              a.name === agent.name 
                                ? { ...a, priority: parseInt(e.target.value) || 0 }
                                : a
                            )
                          }))
                        }}
                        className="w-[60px] px-2 py-1 bg-dark-600 border border-dark-500 rounded-md text-sm text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-dark-400 mt-3">Higher priority agents are preferred when multiple agents can handle the same task</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPriorities = () => (
    <div className="wizard-form">
      <div className="wizard-icon">
        <Settings size={40} />
      </div>
      <h2 className="wizard-title">Set Capability Priorities</h2>
      <p className="wizard-subtitle">Adjust how tasks are distributed across different capabilities</p>
      
      <div style={{ display: 'grid', gap: '1rem', marginTop: '2rem' }}>
        {Object.entries(capabilityIcons).map(([capability, Icon]) => (
          <div key={capability} className="checkbox-item" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '32px', height: '32px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} className="text-brand-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-dark-700 capitalize">{capability}</div>
                  <div className="text-xs text-dark-400">Priority weight for {capability} tasks</div>
                </div>
              </div>
              <input
                type="number"
                value={100}
                onChange={(e) => {}}
                className="w-[60px] px-2 py-1 bg-dark-600 border border-dark-500 rounded-md text-sm text-center"
              />
            </div>
            <div className="w-full h-[6px] bg-dark-500 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
                style={{ width: '75%' }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-dark-400 mt-4 text-center">Higher values mean higher priority when selecting agents</p>
    </div>
  )

  const renderSettings = () => (
    <div className="wizard-form">
      <div className="wizard-icon">
        <Settings size={40} />
      </div>
      <h2 className="wizard-title">Preferences</h2>
      <p className="wizard-subtitle">Configure how supercollider behaves</p>
      
      <div style={{ marginTop: '2rem' }}>
        {/* Approval Mode */}
        <div className="form-group">
          <label className="form-label">Approval Mode</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { value: 'automatic', label: 'Automatic', description: 'Run without approvals' },
              { value: 'manual', label: 'Manual', description: 'Approve each task' },
              { value: 'dynamic', label: 'Dynamic', description: 'Smart approval' }
            ].map((mode) => (
              <button
                key={mode.value}
                onClick={() => {
                  setWizardData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, approval_mode: mode.value as any }
                  }))
                }}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  border: wizardData.settings.approval_mode === mode.value ? '2px solid #667eea' : '2px solid #e2e8f0',
                  background: wizardData.settings.approval_mode === mode.value ? 'rgba(102, 126, 234, 0.1)' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  marginBottom: '0.25rem',
                  color: wizardData.settings.approval_mode === mode.value ? '#667eea' : '#2d3748'
                }}>
                  {mode.label}
                </div>
                <div className="text-xs text-dark-400">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto Start */}
        <div className="checkbox-item" style={{ marginTop: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div>
              <div className="text-sm font-semibold text-dark-700">Auto-Start Queue</div>
              <div className="text-xs text-dark-400 mt-1">Automatically start processing new projects</div>
            </div>
            <button
              onClick={() => {
                setWizardData(prev => ({
                  ...prev,
                  settings: { ...prev.settings, auto_start_queue: !prev.settings.auto_start_queue }
                }))
              }}
              style={{
                width: '40px',
                height: '24px',
                borderRadius: '12px',
                background: wizardData.settings.auto_start_queue ? '#667eea' : '#cbd5e0',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.3s ease'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '2px',
                left: wizardData.settings.auto_start_queue ? '18px' : '2px',
                width: '20px',
                height: '20px',
                background: 'var(--bg-secondary)',
                borderRadius: '50%',
                transition: 'left 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }} />
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label className="form-label">Theme</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' }
            ].map((theme) => (
              <button
                key={theme.value}
                onClick={() => {
                  setWizardData(prev => ({
                    ...prev,
                    settings: { ...prev.settings, theme: theme.value as any }
                  }))
                }}
                style={{
                  padding: '0.75rem',
                  borderRadius: '12px',
                  border: wizardData.settings.theme === theme.value ? '2px solid #667eea' : '2px solid #e2e8f0',
                  background: wizardData.settings.theme === theme.value ? 'rgba(102, 126, 234, 0.1)' : 'white',
                  color: wizardData.settings.theme === theme.value ? '#667eea' : '#2d3748',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotifications = () => (
    <div className="wizard-form">
      <div className="wizard-icon">
        <Bell size={40} />
      </div>
      <h2 className="wizard-title">Notifications</h2>
      <p className="wizard-subtitle">Choose what events you want to be notified about</p>
      
      <div className="checkbox-item" style={{ marginTop: '2rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <div className="text-sm font-semibold text-dark-700">Enable Notifications</div>
            <div className="text-xs text-dark-400 mt-1">Get alerts for important events</div>
          </div>
          <button
            onClick={() => {
              setWizardData(prev => ({
                ...prev,
                notifications: { ...prev.notifications, enabled: !prev.notifications.enabled }
              }))
            }}
            style={{
              width: '40px',
              height: '24px',
              borderRadius: '12px',
              background: wizardData.notifications.enabled ? '#667eea' : '#cbd5e0',
              border: 'none',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background 0.3s ease'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: wizardData.notifications.enabled ? '18px' : '2px',
              width: '20px',
              height: '20px',
              background: 'white',
              borderRadius: '50%',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }} />
          </button>
        </div>
      </div>

      {wizardData.notifications.enabled && (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
          {[
            { id: 'failures', label: 'Task Failures', description: 'When tasks fail to complete' },
            { id: 'completions', label: 'Project Completions', description: 'When projects finish' },
            { id: 'approvals', label: 'Approval Required', description: 'When manual approval is needed' },
            { id: 'clarifications', label: 'Clarifications', description: 'When more information is needed' }
          ].map((type) => {
            const isEnabled = wizardData.notifications.types.includes(type.id)
            return (
              <button
                key={type.id}
                onClick={() => {
                  setWizardData(prev => ({
                    ...prev,
                    notifications: {
                      ...prev.notifications,
                      types: isEnabled
                        ? prev.notifications.types.filter(t => t !== type.id)
                        : [...prev.notifications.types, type.id]
                    }
                  }))
                }}
                className="checkbox-item"
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: isEnabled ? '2px solid #667eea' : '2px solid transparent',
                  background: isEnabled ? 'rgba(102, 126, 234, 0.1)' : '#f7fafc',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="text-sm font-semibold text-dark-700">{type.label}</div>
                    <div className="text-xs text-dark-400">{type.description}</div>
                  </div>
                  {isEnabled && <Check size={20} className="text-brand-500" />}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderComplete = () => (
    <>
      <div className="success-animation">
        <Check size={50} />
      </div>
      <h2 className="wizard-title">You're All Set!</h2>
      
      <div className="bg-dark-600 rounded-xl p-6 max-w-[400px] mx-auto mt-6">
        <h3 className="text-sm font-semibold text-dark-700 mb-3">Quick Start Tips:</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ChevronRight size={16} className="text-brand-500 mt-[2px]" />
            <span className="text-xs text-dark-500">Create your first project from the Dashboard</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ChevronRight size={16} className="text-brand-500 mt-[2px]" />
            <span className="text-xs text-dark-500">Add more agents in the Agent Manager</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ChevronRight size={16} className="text-brand-500 mt-[2px]" />
            <span className="text-xs text-dark-500">Customize workflows with the Task Builder</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <ChevronRight size={16} className="text-brand-500 mt-[2px]" />
            <span className="text-xs text-dark-500">Adjust settings anytime from the Settings page</span>
          </li>
        </ul>
      </div>
    </>
  )

  const renderStep = () => {
    switch (steps[currentStep].id) {
      case 'welcome': return renderWelcome()
      case 'agents': return renderAgents()
      // case 'priorities': return renderPriorities() // Removed as it references non-existent wizardData.priorities
      case 'settings': return renderSettings()
      case 'notifications': return renderNotifications()
      case 'complete': return renderComplete()
      default: return null
    }
  }

  return (
    <div className="wizard-container">
      <div className="wizard-bg" />
      <div className="wizard-card">
        {/* Progress */}
        <div className="wizard-progress">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep
            
            return (
              <div key={step.id} className="progress-step">
                <div className={`step-circle ${isActive ? 'active' : isCompleted ? 'completed' : ''}`}>
                  {isCompleted ? (
                    <Check size={20} />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className={`step-label ${isActive ? 'active' : ''}`}>
                  {step.title}
                </div>
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="wizard-content">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderStep()}
          </motion.div>
        </div>

        {/* Actions */}
        <div className="wizard-actions">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="wizard-btn btn-secondary"
            style={{ opacity: currentStep === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={20} />
            Previous
          </button>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleComplete}
              className="wizard-btn btn-success"
            >
              <Rocket size={20} />
              Launch supercollider
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="wizard-btn btn-primary"
            >
              Next
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}