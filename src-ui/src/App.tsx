import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAppStore } from './store/appStore'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import ProjectCreator from './pages/ProjectCreator'
import AgentManager from './pages/AgentManager'
import TaskBuilder from './pages/TaskBuilder'
import WorkflowBuilder from './pages/WorkflowBuilder'
import Settings from './pages/Settings'
import Projects from './pages/Projects'
import Performance from './pages/Performance'
import ToolConfiguration from './pages/ToolConfiguration'
import FirstRunWizard from './components/FirstRunWizard/FirstRunWizard'
import { isDevMode } from './ipc/tauriWrapper'
import './styles/theme.css'
import './App.css'

export default function App() {
  console.log('App component rendering...')
  const { showFirstRunWizard, config, fetchProjects, fetchAgents } = useAppStore()
  const particlesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    console.log('App mounted, fetching initial data...')
    // Initialize data on app load
    fetchProjects().catch(err => console.error('Failed to fetch projects:', err))
    fetchAgents().catch(err => console.error('Failed to fetch agents:', err))
    
    // Create particle effects
    if (particlesRef.current && !particlesRef.current.hasChildNodes()) {
      for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div')
        particle.className = 'particle'
        particle.style.left = `${Math.random() * 100}%`
        particle.style.animationDelay = `${Math.random() * 10}s`
        particle.style.animationDuration = `${10 + Math.random() * 20}s`
        particlesRef.current.appendChild(particle)
      }
    }
  }, [])

  useEffect(() => {
    // Apply theme
    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      
      if (config.theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
        document.documentElement.classList.remove('dark')
      } else if (config.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
        document.documentElement.classList.add('dark')
      } else if (config.theme === 'system') {
        if (prefersDark) {
          document.documentElement.setAttribute('data-theme', 'dark')
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.setAttribute('data-theme', 'light')
          document.documentElement.classList.remove('dark')
        }
      }
    }
    
    applyTheme()
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (config.theme === 'system') {
        applyTheme()
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [config.theme])

  console.log('ShowFirstRunWizard:', showFirstRunWizard)
  
  if (showFirstRunWizard) {
    console.log('Showing first run wizard')
    return <FirstRunWizard />
  }

  return (
    <Router>
      <div className="app">
        {/* Theme debug overlay removed */}
        <div className="app-background" />
        <div className="particles" ref={particlesRef} />
        <div className="app-content">
          {isDevMode() && (
            <div className="dev-banner">
              <span>Warning: </span>
              <span>Development Mode - Running in browser without Tauri backend</span>
            </div>
          )}
          <div className="layout-wrapper">
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/create-project" element={<ProjectCreator />} />
                <Route path="/agents" element={<AgentManager />} />
                <Route path="/tools" element={<ToolConfiguration />} />
                <Route path="/task-builder" element={<TaskBuilder />} />
                <Route path="/workflow-builder" element={<WorkflowBuilder />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/performance" element={<Performance />} />
              </Routes>
            </Layout>
          </div>
        </div>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
              backdropFilter: 'blur(10px)',
            },
            duration: 4000,
          }}
        />
      </div>
    </Router>
  )
}