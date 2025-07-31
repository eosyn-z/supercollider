import React, { useState } from 'react';
import { Workflow, SubtaskType, Priority, SubtaskStatus, SubtaskDependency } from '../types';
import { api } from '../services/api';

interface WorkflowCreatorProps {
  onCreateWorkflow: (workflow: Workflow) => void;
  onLoadWorkflow: (workflowId: string) => void;
  className?: string;
}

export const WorkflowCreator: React.FC<WorkflowCreatorProps> = ({
  onCreateWorkflow,
  onLoadWorkflow,
  className = ''
}) => {
  const [prompt, setPrompt] = useState('');
  const [workflowName, setWorkflowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'load'>('create');
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);

  // Load saved workflows when switching to load tab
  React.useEffect(() => {
    if (activeTab === 'load' && savedWorkflows.length === 0) {
      loadSavedWorkflows();
    }
  }, [activeTab]);

  const loadSavedWorkflows = async () => {
    setIsLoadingWorkflows(true);
    try {
      const workflows = await api.listWorkflows();
      setSavedWorkflows(workflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setIsLoadingWorkflows(false);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!prompt.trim() || !workflowName.trim()) {
      alert('Please enter both a workflow name and a prompt');
      return;
    }

    setIsCreating(true);
    
    try {
      // Create workflow with atomic decomposition
      const newWorkflow: Workflow = {
        id: `workflow-${Date.now()}`,
        prompt: prompt.trim(),
        subtasks: [], // Will be populated by task slicer
        status: 'DRAFT',
        agentAssignments: []
      };

      // Use the API to create and decompose workflow
      const result = await api.createAndDecomposeWorkflow(newWorkflow);
      
      if (result) {
        // The API has handled task slicing and atomic decomposition
        // Now load the complete workflow with subtasks
        const completeWorkflow = await api.getWorkflow(newWorkflow.id);
        
        if (completeWorkflow) {
          // Create agent assignments based on subtask types
          const agentAssignments = completeWorkflow.subtasks.map(subtask => {
            // Simple assignment logic - assign to first available agent for each type
            const agentId = subtask.type === SubtaskType.RESEARCH || subtask.type === SubtaskType.ANALYSIS 
              ? 'agent-1' 
              : 'agent-2';
            return { agentId, subtaskId: subtask.id };
          });

          const workflowWithAssignments = {
            ...completeWorkflow,
            agentAssignments
          };

          onCreateWorkflow(workflowWithAssignments);
          setPrompt('');
          setWorkflowName('');
          
          // Reload saved workflows
          await loadSavedWorkflows();
        } else {
          throw new Error('Failed to load complete workflow');
        }
      } else {
        throw new Error('Failed to create workflow');
      }
    } catch (error) {
      console.error('Failed to create workflow:', error);
      alert('Failed to create workflow. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoadWorkflow = async (workflowId: string) => {
    try {
      const workflow = await api.getWorkflow(workflowId);
      if (workflow) {
        onLoadWorkflow(workflowId);
      } else {
        alert('Failed to load workflow');
      }
    } catch (error) {
      console.error('Failed to load workflow:', error);
      alert('Failed to load workflow');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      try {
        const success = await api.deleteWorkflow(workflowId);
        if (success) {
          await loadSavedWorkflows();
        } else {
          alert('Failed to delete workflow');
        }
      } catch (error) {
        console.error('Failed to delete workflow:', error);
        alert('Failed to delete workflow');
      }
    }
  };

  const handleBackupWorkflow = async (workflowId: string) => {
    try {
      const success = await api.backupWorkflow(workflowId);
      if (success) {
        alert('Workflow backed up successfully');
      } else {
        alert('Failed to backup workflow');
      }
    } catch (error) {
      console.error('Failed to backup workflow:', error);
      alert('Failed to backup workflow');
    }
  };

  const samplePrompts = [
    {
      name: 'AI Safety Protocol',
      prompt: 'Create a comprehensive AI safety protocol for our organization that includes risk assessment, monitoring procedures, and emergency response plans.'
    },
    {
      name: 'Market Research Report',
      prompt: 'Conduct market research on the latest trends in artificial intelligence and machine learning, including competitor analysis and future predictions.'
    },
    {
      name: 'Technical Documentation',
      prompt: 'Write comprehensive technical documentation for a new API that includes setup instructions, usage examples, and troubleshooting guides.'
    },
    {
      name: 'Content Strategy',
      prompt: 'Develop a content marketing strategy for a B2B SaaS company, including content themes, publishing schedule, and performance metrics.'
    }
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Workflow Manager</h2>
        <p className="text-gray-600">Create new workflows or load existing ones</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create New
        </button>
        <button
          onClick={() => setActiveTab('load')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'load'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Load Existing
        </button>
      </div>

      {activeTab === 'create' && (
        <div className="space-y-6">
          {/* Workflow Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workflow Name
            </label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Enter workflow name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to accomplish. The AI will break this down into subtasks and assign the best agents to handle each part..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Sample Prompts - Only suggestions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Sample Prompts</h3>
            <p className="text-xs text-gray-500 mb-3">Click to use as a starting point (you can modify them above)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {samplePrompts.map((sample, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setWorkflowName(sample.name);
                    setPrompt(sample.prompt);
                  }}
                  className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-sm text-gray-900">{sample.name}</div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">{sample.prompt}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateWorkflow}
            disabled={isCreating || !prompt.trim() || !workflowName.trim()}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Creating Workflow...
              </div>
            ) : (
              'Create Workflow'
            )}
          </button>
        </div>
      )}

      {activeTab === 'load' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Saved Workflows</h3>
            <button
              onClick={loadSavedWorkflows}
              disabled={isLoadingWorkflows}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              {isLoadingWorkflows ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          {isLoadingWorkflows ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Loading workflows...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedWorkflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{workflow.name}</div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date(workflow.createdAt).toLocaleDateString()} • 
                        Size: {(workflow.size / 1024).toFixed(1)}KB • 
                        Status: {workflow.status}
                      </div>
                      {workflow.tags && workflow.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {workflow.tags.map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-gray-100 text-xs text-gray-600 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleLoadWorkflow(workflow.id)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleBackupWorkflow(workflow.id)}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                      >
                        Backup
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {savedWorkflows.length === 0 && !isLoadingWorkflows && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No saved workflows found</p>
              <p className="text-xs mt-1">Create a new workflow to get started</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 