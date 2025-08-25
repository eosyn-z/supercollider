import React, { useEffect, useState } from 'react'

export default function ThemeDebug() {
  const [themeInfo, setThemeInfo] = useState({
    dataTheme: '',
    hasDarkClass: false,
    bgColor: '',
    textColor: ''
  })

  useEffect(() => {
    const updateThemeInfo = () => {
      const root = document.documentElement
      const computed = getComputedStyle(root)
      
      setThemeInfo({
        dataTheme: root.getAttribute('data-theme') || 'none',
        hasDarkClass: root.classList.contains('dark'),
        bgColor: computed.getPropertyValue('--bg-primary').trim(),
        textColor: computed.getPropertyValue('--text-primary').trim()
      })
    }

    updateThemeInfo()
    
    // Watch for changes
    const observer = new MutationObserver(updateThemeInfo)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      padding: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      fontSize: '12px',
      zIndex: 9999,
      borderRadius: '5px'
    }}>
      <div>Theme: {themeInfo.dataTheme}</div>
      <div>Dark class: {themeInfo.hasDarkClass ? 'yes' : 'no'}</div>
      <div>BG: {themeInfo.bgColor}</div>
      <div>Text: {themeInfo.textColor}</div>
    </div>
  )
}