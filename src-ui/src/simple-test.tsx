import React from 'react'
import ReactDOM from 'react-dom/client'

console.log('Simple test starting...')

function SimpleApp() {
  console.log('SimpleApp rendering')
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)'
      }}>
        <h1 style={{ fontSize: '3em', margin: '0 0 20px 0' }}>supercollider</h1>
        <div style={{
          marginTop: '30px',
          padding: '15px',
          background: 'rgba(34, 197, 94, 0.3)',
          borderRadius: '10px'
        }}>
          React is working!
        </div>
        <div style={{
          marginTop: '10px',
          padding: '15px',
          background: 'rgba(59, 130, 246, 0.3)',
          borderRadius: '10px'
        }}>
          Check console for debug information
        </div>
      </div>
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  console.log('Root element found, mounting React...')
  ReactDOM.createRoot(root).render(<SimpleApp />)
  console.log('React mounted!')
} else {
  console.error('No root element found!')
  document.body.innerHTML = '<h1 style="color:red">Error: No root element</h1>'
}