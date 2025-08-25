import React from 'react';
import { Tool } from './ToolManager';
import '../ToolsVisualizer/ToolsVisualizer.css';

interface ToolListProps {
  tools: Tool[];
  selectedTool: Tool | null;
  onSelectTool: (tool: Tool) => void;
  onInstallTool: (toolId: string) => void;
  onValidateTool: (toolId: string) => void;
  isLoading: boolean;
}

export const ToolList: React.FC<ToolListProps> = ({
  tools,
  selectedTool,
  onSelectTool,
  onInstallTool,
  onValidateTool,
  isLoading
}) => {
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      'VideoProcessing': '',
      'AudioProcessing': '',
      'ImageProcessing': '',
      'ThreeDModeling': '',
      'CodeExecution': '',
      'DocumentProcessing': '',
      'DataVisualization': '',
      'Containerization': '',
      'VersionControl': '',
    };
    return icons[category] || '';
  };

  const getStatusBadge = (tool: Tool) => {
    if (tool.is_available) {
      return (
        <span className="status-badge available">
          Available {tool.version && `(v${tool.version})`}
        </span>
      );
    }
    return <span className="status-badge not-available">Not Installed</span>;
  };

  return (
    <div className="tool-list">
      {tools.length === 0 ? (
        <div className="no-tools">
          <p>No tools found matching your criteria</p>
        </div>
      ) : (
        tools.map(tool => (
          <div
            key={tool.id}
            className={`tool-item ${selectedTool?.id === tool.id ? 'selected' : ''}`}
            onClick={() => onSelectTool(tool)}
          >
            <div className="tool-item-header">
              <span className="tool-icon">{getCategoryIcon(tool.category)}</span>
              <div className="tool-info">
                <h3 className="tool-name">{tool.name}</h3>
                <span className="tool-id">{tool.id}</span>
              </div>
              {getStatusBadge(tool)}
            </div>

            <div className="tool-item-details">
              <div className="tool-category">
                <span className="label">Category:</span>
                <span className="value">{tool.category}</span>
              </div>

              <div className="tool-capabilities">
                <span className="label">Capabilities:</span>
                <div className="capability-tags">
                  {tool.capabilities.slice(0, 3).map(cap => (
                    <span key={cap} className="capability-tag">
                      {cap}
                    </span>
                  ))}
                  {tool.capabilities.length > 3 && (
                    <span className="capability-tag more">
                      +{tool.capabilities.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <div className="tool-formats">
                <div className="formats-group">
                  <span className="label">Input:</span>
                  <span className="formats">
                    {tool.input_formats.slice(0, 3).join(', ')}
                    {tool.input_formats.length > 3 && '...'}
                  </span>
                </div>
                <div className="formats-group">
                  <span className="label">Output:</span>
                  <span className="formats">
                    {tool.output_formats.slice(0, 3).join(', ')}
                    {tool.output_formats.length > 3 && '...'}
                  </span>
                </div>
              </div>

              <div className="tool-requirements">
                {tool.requires_gpu && (
                  <span className="requirement gpu">GPU Required</span>
                )}
                {tool.requires_network && (
                  <span className="requirement network">Network Required</span>
                )}
              </div>
            </div>

            <div className="tool-item-actions">
              {!tool.is_available && (
                <button
                  className="btn-install"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInstallTool(tool.id);
                  }}
                  disabled={isLoading}
                >
                  Install
                </button>
              )}
              {tool.is_available && (
                <button
                  className="btn-validate"
                  onClick={(e) => {
                    e.stopPropagation();
                    onValidateTool(tool.id);
                  }}
                  disabled={isLoading}
                >
                  Validate
                </button>
              )}
              {tool.documentation_url && (
                <a
                  href={tool.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-docs"
                  onClick={(e) => e.stopPropagation()}
                >
                  Docs
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};