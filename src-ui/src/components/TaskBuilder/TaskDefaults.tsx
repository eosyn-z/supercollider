import React, { useState } from 'react';
import './TaskDefaults.css';

interface Task {
  task_id: string;
  type: string;
  capability: string;
  description: string;
  preamble: string;
  token_limit: number;
  metadata?: Record<string, any>;
  default_priority?: number;
  approval_required?: boolean;
}

interface TaskDefaultsProps {
  templates: Record<string, Task>;
  onSelectTemplate: (template: Task) => void;
}

export const TaskDefaults: React.FC<TaskDefaultsProps> = ({ templates, onSelectTemplate }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Group templates by category
  const groupedTemplates = Object.entries(templates).reduce((acc, [key, template]) => {
    const category = template.metadata?.category || template.type || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ key, ...template });
    return acc;
  }, {} as Record<string, Array<Task & { key: string }>>);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredGroups = Object.entries(groupedTemplates).reduce((acc, [category, items]) => {
    const filtered = items.filter(item => 
      item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.capability.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as typeof groupedTemplates);

  const handleResetToDefaults = async () => {
    if (window.confirm('This will reload all default templates from TASKDEFAULTS folder. Continue?')) {
      // This would trigger a reload of templates from the parent component
      window.location.reload();
    }
  };

  return (
    <div className="task-defaults">
      <div className="task-defaults-header">
        <h3>Default Templates</h3>
        <button 
          className="btn-reset"
          onClick={handleResetToDefaults}
          title="Reset all templates to defaults"
        >
          Reset All to Defaults
        </button>
      </div>

      <div className="task-defaults-search">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="task-defaults-list">
        {Object.entries(filteredGroups).map(([category, items]) => (
          <div key={category} className="task-category">
            <div 
              className="task-category-header"
              onClick={() => toggleCategory(category)}
            >
              <span className="category-toggle">
                {expandedCategories.has(category) ? '▼' : '▶'}
              </span>
              <span className="category-name">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
              <span className="category-count">({items.length})</span>
            </div>

            {expandedCategories.has(category) && (
              <div className="task-category-items">
                {items.map(template => (
                  <div 
                    key={template.key}
                    className="task-template-item"
                    onClick={() => onSelectTemplate(template)}
                  >
                    <div className="template-header">
                      <span className="template-name">{template.description}</span>
                      <span className="template-capability">{template.capability}</span>
                    </div>
                    <div className="template-meta">
                      <span className="template-type">{template.type}</span>
                      <span className="template-tokens">Tokens: {template.token_limit}</span>
                      {template.approval_required && (
                        <span className="template-approval">Approval Required</span>
                      )}
                    </div>
                    <div className="template-preamble">
                      {template.preamble.substring(0, 100)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};