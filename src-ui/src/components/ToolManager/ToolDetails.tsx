import React from 'react'
import type { Tool } from './ToolManager'

type Props = {
  tool: Tool
  onClose: () => void
}

export const ToolDetails: React.FC<Props> = ({ tool, onClose }) => {
  return (
    <div className="tool-details">
      <div className="tool-details-header">
        <h3>{tool.name}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      <div className="tool-details-body">
        <div className="row">
          <span className="label">ID</span>
          <span className="value">{tool.id}</span>
        </div>
        <div className="row">
          <span className="label">Category</span>
          <span className="value">{tool.category}</span>
        </div>
        <div className="row">
          <span className="label">Version</span>
          <span className="value">{tool.version || 'unknown'}</span>
        </div>
        <div className="row">
          <span className="label">Executable</span>
          <span className="value">{tool.executable_path || 'not set'}</span>
        </div>
        <div className="row">
          <span className="label">Capabilities</span>
          <span className="value">{tool.capabilities.join(', ') || 'none'}</span>
        </div>
        <div className="row">
          <span className="label">Input Formats</span>
          <span className="value">{tool.input_formats.join(', ') || 'n/a'}</span>
        </div>
        <div className="row">
          <span className="label">Output Formats</span>
          <span className="value">{tool.output_formats.join(', ') || 'n/a'}</span>
        </div>
        <div className="row">
          <span className="label">Requires GPU</span>
          <span className="value">{tool.requires_gpu ? 'yes' : 'no'}</span>
        </div>
        <div className="row">
          <span className="label">Requires Network</span>
          <span className="value">{tool.requires_network ? 'yes' : 'no'}</span>
        </div>
        {tool.documentation_url && (
          <div className="row">
            <span className="label">Docs</span>
            <a className="value link" href={tool.documentation_url} target="_blank" rel="noreferrer">
              {tool.documentation_url}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}


