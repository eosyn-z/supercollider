import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  Home, 
  Plus, 
  Bot, 
  Wrench, 
  Settings, 
  Play, 
  Pause, 
  Square,
  ChevronRight,
  Sparkles,
  Cpu,
  Activity,
  GitBranch
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import './Layout.css'
import './QueueStatus.css'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { queueStatus, setQueueStatus, projects } = useAppStore()
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Create Project', href: '/create-project', icon: Plus },
    { name: 'Configure Project', href: '/workflow-builder', icon: GitBranch },
    { name: 'Agents', href: '/agents', icon: Bot },
    { name: 'Tool Configuration', href: '/tools', icon: Wrench },
    { name: 'Task Builder', href: '/task-builder', icon: Wrench },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Performance', href: '/performance', icon: Activity },
  ]

  const handleQueueControl = async (action: 'start' | 'pause' | 'stop') => {
    try {
      switch (action) {
        case 'start':
          await setQueueStatus('running')
          break
        case 'pause':
          await setQueueStatus('paused')
          break
        case 'stop':
          await setQueueStatus('idle')
          break
      }
    } catch (error) {
      console.error(`Failed to ${action} queue:`, error)
    }
  }

  const runningProjects = projects.filter(p => p.status === 'running').length
  const queuedProjects = projects.filter(p => p.status === 'queued').length

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Cpu size={28} />
            </div>
            <div className="logo-text">
              <div className="logo-title">supercollider</div>
            </div>
          </div>
        </div>

        {/* Queue Status */}
        <div className="queue-status">
          <div className="queue-status-card">
            <div className="queue-status-header">
              <span className="queue-status-label">Queue Status</span>
              <div className="queue-status-indicator">
                <div className={`status-dot ${queueStatus}`} />
                <span className="status-text">{queueStatus}</span>
              </div>
            </div>
            
            <div className="queue-controls">
              <button
                onClick={() => handleQueueControl('start')}
                disabled={queueStatus === 'running'}
                className={`queue-btn queue-btn-start ${queueStatus === 'running' ? 'disabled' : ''}`}
              >
                <Play size={14} />
                <span>Start</span>
              </button>
              <button
                onClick={() => handleQueueControl('pause')}
                disabled={queueStatus !== 'running'}
                className={`queue-btn queue-btn-pause ${queueStatus !== 'running' ? 'disabled' : ''}`}
              >
                <Pause size={14} />
                <span>Pause</span>
              </button>
              <button
                onClick={() => handleQueueControl('stop')}
                disabled={queueStatus === 'idle'}
                className={`queue-btn queue-btn-stop ${queueStatus === 'idle' ? 'disabled' : ''}`}
              >
                <Square size={14} />
                <span>Stop</span>
              </button>
            </div>

            {/* Queue Stats */}
            <div className="queue-stats">
              <div className="queue-stat">
                <div className="queue-stat-value">{runningProjects}</div>
                <div className="queue-stat-label">Running</div>
              </div>
              <div className="queue-stat">
                <div className="queue-stat-value">{queuedProjects}</div>
                <div className="queue-stat-label">Queued</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="nav">
          <div className="nav-section">
            <div className="nav-section-title">Main</div>
            <div className="nav-links">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">
                      <Icon size={20} />
                    </span>
                    <span className="nav-text">{item.name}</span>
                    {isActive && (
                      <ChevronRight size={16} />
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </nav>

        {/* Activity Monitor */}
        <div className="sidebar-footer">
          <div className="activity-monitor">
            <div className="activity-header">
              <span className="activity-title">System Activity</span>
              <Activity size={16} className="activity-icon" />
            </div>
            {/* Token usage UI removed until real metrics are wired */}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  )
}