import React, { useState, useEffect } from 'react';
import './TaskEditor.css';

interface Task {
  task_id: string;
  type: string;
  capability: string;
  description: string;
  preamble: string;
  token_limit: number;
  dependencies?: string[];
  input_chain?: string[];
  metadata?: Record<string, any>;
  default_priority?: number;
  priority_override?: number;
  manual_agent_override?: string;
  approval_required?: boolean;
  clarity_prompt?: string;
  template_source?: string;
  modified?: boolean;
  last_modified?: string;
  oneshot_count?: number;
}

interface TaskEditorProps {
  task: Task | null;
  mode: 'create' | 'edit';
  projectId?: string;
  onSave: (task: Task) => void;
  onCancel: () => void;
  availableTasks: Task[];
  isLoading?: boolean;
}

const TASK_TYPES = ['analysis', 'generation', 'transformation', 'validation', 'integration', 'optimization', 'research'];

const CAPABILITIES = [
  'code', 'text', 'image', 'sound', 'video',
  'data_analysis', 'system_analysis', 'security_analysis', 'content_analysis', 'financial_analysis',
  'data_transformation', 'format_conversion', 'language_translation', 'code_transpilation', 'media_conversion',
  'test_execution', 'quality_check', 'compliance_validation', 'schema_validation', 'accessibility_check',
  'api_integration', 'database_ops', 'deployment', 'monitoring', 'version_control',
  'notification', 'reporting', 'documentation', 'presentation',
  'web_research', 'technical_research', 'market_research', 'literature_review',
  'performance_optimization', 'resource_optimization', 'workflow_optimization', 'seo_optimization'
];

export const TaskEditor: React.FC<TaskEditorProps> = ({
  task,
  mode,
  projectId,
  onSave,
  onCancel,
  availableTasks,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<Task>({
    task_id: '',
    type: 'analysis',
    capability: 'data_analysis',
    description: '',
    preamble: '',
    token_limit: 1500,
    dependencies: [],
    input_chain: [],
    metadata: {},
    default_priority: 5,
    priority_override: undefined,
    manual_agent_override: undefined,
    approval_required: false,
    clarity_prompt: undefined,
    template_source: undefined,
    modified: false,
    last_modified: undefined
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [metadataJson, setMetadataJson] = useState('{}');

  useEffect(() => {
    if (task) {
      setFormData(task);
      setMetadataJson(JSON.stringify(task.metadata || {}, null, 2));
      setShowAdvanced(!!task.priority_override || !!task.manual_agent_override || !!task.clarity_prompt);
    } else {
      setFormData({
        task_id: `task_${Date.now()}`,
        type: 'analysis',
        capability: 'data_analysis',
        description: '',
        preamble: '',
        token_limit: 1500,
        dependencies: [],
        input_chain: [],
        metadata: {},
        default_priority: 5,
        priority_override: undefined,
        manual_agent_override: undefined,
        approval_required: false,
        clarity_prompt: undefined,
        template_source: undefined,
        modified: false,
        last_modified: undefined
      });
      setMetadataJson('{}');
    }
  }, [task]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.preamble.trim()) {
      newErrors.preamble = 'Preamble is required';
    }
    if (formData.token_limit < 100) {
      newErrors.token_limit = 'Token limit must be at least 100';
    }
    if (formData.token_limit > 10000) {
      newErrors.token_limit = 'Token limit cannot exceed 10000';
    }

    try {
      JSON.parse(metadataJson);
    } catch (e) {
      newErrors.metadata = 'Invalid JSON format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const metadata = JSON.parse(metadataJson);
      const taskToSave: Task = {
        ...formData,
        metadata,
        modified: mode === 'edit' || !!formData.template_source,
        last_modified: new Date().toISOString()
      };

      onSave(taskToSave);
    } catch (err) {
      setErrors({ ...errors, metadata: 'Failed to parse metadata JSON' });
    }
  };

  const handleFieldChange = (field: keyof Task, value: any) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleDependencyToggle = (taskId: string) => {
    const deps = formData.dependencies || [];
    if (deps.includes(taskId)) {
      handleFieldChange('dependencies', deps.filter(id => id !== taskId));
    } else {
      handleFieldChange('dependencies', [...deps, taskId]);
    }
  };

  const handleInputChainToggle = (taskId: string) => {
    const chain = formData.input_chain || [];
    if (chain.includes(taskId)) {
      handleFieldChange('input_chain', chain.filter(id => id !== taskId));
    } else {
      handleFieldChange('input_chain', [...chain, taskId]);
    }
  };

  return (
    <div className="task-editor">
      <div className="task-editor-header">
        <h3>{mode === 'create' ? 'Create New Task' : 'Edit Task'}</h3>
        {formData.template_source && (
          <span className="template-badge">Based on: {formData.template_source}</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="task-editor-form">
        <div className="form-section">
          <h4>Basic Information</h4>
          
          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Brief description of the task"
              className={errors.description ? 'error' : ''}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Task Type</label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => handleFieldChange('type', e.target.value)}
              >
                {TASK_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="capability">Capability</label>
              <select
                id="capability"
                value={formData.capability}
                onChange={(e) => handleFieldChange('capability', e.target.value)}
              >
                {CAPABILITIES.map(cap => (
                  <option key={cap} value={cap}>{cap}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="preamble">Preamble *</label>
            <textarea
              id="preamble"
              value={formData.preamble}
              onChange={(e) => handleFieldChange('preamble', e.target.value)}
              placeholder="Instructions and context for the agent..."
              rows={4}
              className={errors.preamble ? 'error' : ''}
            />
            {errors.preamble && <span className="error-message">{errors.preamble}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="token_limit">Token Limit</label>
              <input
                id="token_limit"
                type="number"
                value={formData.token_limit}
                onChange={(e) => handleFieldChange('token_limit', parseInt(e.target.value))}
                min={100}
                max={10000}
                className={errors.token_limit ? 'error' : ''}
              />
              {errors.token_limit && <span className="error-message">{errors.token_limit}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="default_priority">Default Priority</label>
              <input
                id="default_priority"
                type="number"
                value={formData.default_priority}
                onChange={(e) => handleFieldChange('default_priority', parseInt(e.target.value))}
                min={1}
                max={10}
              />
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.approval_required}
                  onChange={(e) => handleFieldChange('approval_required', e.target.checked)}
                />
                Approval Required
              </label>
            </div>
          </div>
        </div>

        {availableTasks.length > 0 && (
          <div className="form-section">
            <h4>Dependencies & Input Chain</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label>Dependencies</label>
                <div className="task-selector">
                  {availableTasks.filter(t => t.task_id !== formData.task_id).map(task => (
                    <label key={task.task_id} className="task-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.dependencies?.includes(task.task_id) || false}
                        onChange={() => handleDependencyToggle(task.task_id)}
                      />
                      <span>{task.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Input Chain</label>
                <div className="task-selector">
                  {availableTasks.filter(t => t.task_id !== formData.task_id).map(task => (
                    <label key={task.task_id} className="task-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.input_chain?.includes(task.task_id) || false}
                        onChange={() => handleInputChainToggle(task.task_id)}
                      />
                      <span>{task.description}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="form-section">
          <h4>
            Advanced Settings
            <button
              type="button"
              className="toggle-btn"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '▼' : '▶'}
            </button>
          </h4>
          
          {showAdvanced && (
            <>
              <div className="form-group">
                <label htmlFor="priority_override">Priority Override</label>
                <input
                  id="priority_override"
                  type="number"
                  value={formData.priority_override || ''}
                  onChange={(e) => handleFieldChange('priority_override', e.target.value ? parseInt(e.target.value) : undefined)}
                  min={1}
                  max={10}
                  placeholder="Leave empty to use default"
                />
              </div>

              <div className="form-group">
                <label htmlFor="manual_agent_override">Manual Agent Override</label>
                <input
                  id="manual_agent_override"
                  type="text"
                  value={formData.manual_agent_override || ''}
                  onChange={(e) => handleFieldChange('manual_agent_override', e.target.value || undefined)}
                  placeholder="Agent name (optional)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="clarity_prompt">Clarity Prompt</label>
                <textarea
                  id="clarity_prompt"
                  value={formData.clarity_prompt || ''}
                  onChange={(e) => handleFieldChange('clarity_prompt', e.target.value || undefined)}
                  placeholder="Optional validation prompt for output..."
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label htmlFor="metadata">Metadata (JSON)</label>
                <textarea
                  id="metadata"
                  value={metadataJson}
                  onChange={(e) => setMetadataJson(e.target.value)}
                  placeholder="Additional metadata in JSON format"
                  rows={5}
                  className={errors.metadata ? 'error' : ''}
                />
                {errors.metadata && <span className="error-message">{errors.metadata}</span>}
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Task'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};