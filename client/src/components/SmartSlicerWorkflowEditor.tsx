/**
 * Smart Slicer Workflow Editor
 * Interactive editor for atomic task workflows with drag-and-drop, dependency management, and execution
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SmartSlicerIntegrationService, WorkflowGraph, AtomicTask, SlicerProgress } from '../services/SmartSlicerIntegrationService';

interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  preamble: string;
}

interface SmartSlicerWorkflowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkflowComplete: (results: any[]) => void;
  availableAgents: Agent[];
}

const SmartSlicerWorkflowEditor: React.FC<SmartSlicerWorkflowEditorProps> = ({
  isOpen,
  onClose,
  onWorkflowComplete,
  availableAgents
}) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [workflow, setWorkflow] = useState<WorkflowGraph | null>(null);
  const [slicerProgress, setSlicerProgress] = useState<SlicerProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [executionResults, setExecutionResults] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<'input' | 'review' | 'execute' | 'results'>('input');

  const slicerService = new SmartSlicerIntegrationService();

  useEffect(() => {
    slicerService.setAvailableAgents(availableAgents);
  }, [availableAgents]);

  const handleGenerateWorkflow = async () => {
    if (!userPrompt.trim()) return;

    setIsGenerating(true);
    setSlicerProgress(null);
    
    try {
      const generatedWorkflow = await slicerService.processUserPrompt(
        userPrompt,
        {
          targetTokenSize: 2000,
          maxTasks: 15,
          enableBatching: true,
          autoAssignAgents: true
        },
        (progress) => setSlicerProgress(progress)
      );

      setWorkflow(generatedWorkflow);
      setCurrentPhase('review');
    } catch (error) {
      console.error('Failed to generate workflow:', error);
      alert('Failed to generate workflow. Please try again.');
    } finally {
      setIsGenerating(false);
      setSlicerProgress(null);
    }
  };

  const handleTaskModification = useCallback((taskId: string, changes: Partial<AtomicTask>) => {
    if (!workflow) return;

    const updatedWorkflow = slicerService.modifyWorkflow(workflow, [{ taskId, changes }]);
    setWorkflow(updatedWorkflow);
  }, [workflow]);

  const handleExecuteWorkflow = async () => {
    if (!workflow) return;

    setIsExecuting(true);
    setCurrentPhase('execute');
    const results: any[] = [];

    try {
      // Execute tasks in order, respecting dependencies
      for (const batch of workflow.executionOrder) {
        const batchResults = await Promise.allSettled(
          batch.map(async (taskId) => {
            const task = workflow.atomicTasks.find(t => t.id === taskId);
            if (!task) return null;

            // Update task status
            handleTaskModification(taskId, { status: 'executing' });

            const result = await slicerService.executeAtomicTask(task);
            
            // Update task with result
            handleTaskModification(taskId, {
              status: result.status,
              executionResult: result.executionResult,
              error: result.error
            });

            return {
              taskId,
              title: task.title,
              result: result.executionResult,
              error: result.error,
              success: result.status === 'completed'
            };
          })
        );

        // Add batch results
        for (const settledResult of batchResults) {
          if (settledResult.status === 'fulfilled' && settledResult.value) {
            results.push(settledResult.value);
          }
        }
      }

      setExecutionResults(results);
      setCurrentPhase('results');
      onWorkflowComplete(results);
    } catch (error) {
      console.error('Workflow execution failed:', error);
      alert('Workflow execution failed. Check the console for details.');
    } finally {
      setIsExecuting(false);
    }
  };

  const renderInputPhase = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Describe Your Complex Task</h3>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Enter a complex task that should be broken down into atomic steps. For example: 'Create a web application with user authentication, data visualization, and API integration. Include proper testing and documentation.'"
          rows={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How Smart Slicing Works:</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li><strong>Atomic Task Detection:</strong> AI identifies distinct task types (Research, Analysis, Creation, Validation)</li>
          <li><strong>Clean Prompt Generation:</strong> Creates focused prompts without preambles for each task</li>
          <li><strong>Agent Assignment:</strong> Matches tasks to best-suited agents based on capabilities</li>
          <li><strong>Preamble Attachment:</strong> Adds agent-specific context and instructions</li>
          <li><strong>Batch Optimization:</strong> Groups similar tasks for parallel execution</li>
          <li><strong>Workflow Visualization:</strong> Shows dependencies and execution order</li>
        </ol>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onClose}
          className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleGenerateWorkflow}
          disabled={!userPrompt.trim() || isGenerating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isGenerating ? 'Generating...' : 'Generate Atomic Workflow'}
        </button>
      </div>
    </div>
  );

  const renderProgressIndicator = () => {
    if (!slicerProgress) return null;

    const progressSteps = [
      { key: 'slicing', label: 'Smart Slicing', icon: '🔍' },
      { key: 'generating_clean', label: 'Clean Prompts', icon: '✨' },
      { key: 'adding_preambles', label: 'Agent Assignment', icon: '🤖' },
      { key: 'optimizing', label: 'Batch Optimization', icon: '⚡' },
      { key: 'ready', label: 'Ready', icon: '✅' }
    ];

    return (
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">{slicerProgress.message}</span>
          <span className="text-sm text-gray-500">{slicerProgress.progress}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${slicerProgress.progress}%` }}
          />
        </div>

        <div className="flex justify-between">
          {progressSteps.map((step, index) => (
            <div key={step.key} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                step.key === slicerProgress.phase 
                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                  : progressSteps.findIndex(s => s.key === slicerProgress.phase) > index
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {step.icon}
              </div>
              <span className="text-xs text-gray-600 mt-1">{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTaskCard = (task: AtomicTask) => {
    const statusColors = {
      pending: 'bg-gray-100 text-gray-800',
      ready: 'bg-blue-100 text-blue-800',
      executing: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };

    const typeIcons = {
      'RESEARCH': '🔍',
      'ANALYSIS': '📊',
      'CREATION': '🛠️',
      'VALIDATION': '✅',
      'PLANNING': '📋',
      'OPTIMIZATION': '⚡',
      'DOCUMENTATION': '📝',
      'INTEGRATION': '🔗'
    };

    return (
      <div
        key={task.id}
        className={`p-4 border rounded-lg cursor-pointer transition-all ${
          selectedTask === task.id 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-lg">{typeIcons[task.type as keyof typeof typeIcons] || '📄'}</span>
            <h4 className="font-medium text-gray-900">{task.title}</h4>
          </div>
          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[task.status]}`}>
            {task.status}
          </span>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          <div className="flex items-center space-x-4">
            <span>Type: {task.type}</span>
            <span>Duration: {task.estimatedDuration}min</span>
            {task.batchGroup && <span>Batch: {task.batchGroup.slice(-8)}</span>}
          </div>
        </div>

        {task.assignedAgent && (
          <div className="text-sm text-gray-600 mb-2">
            Agent: {task.assignedAgent.name} ({task.assignedAgent.type})
          </div>
        )}

        {task.dependencies.length > 0 && (
          <div className="text-sm text-gray-600 mb-2">
            Dependencies: {task.dependencies.length} task(s)
          </div>
        )}

        {selectedTask === task.id && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clean Prompt:</label>
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {task.cleanPrompt}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Prompt (with preamble):</label>
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                {task.agentPrompt}
              </div>
            </div>

            {task.executionResult && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Result:</label>
                <div className="text-sm text-gray-600 bg-green-50 p-2 rounded max-h-32 overflow-y-auto">
                  {typeof task.executionResult === 'string' 
                    ? task.executionResult 
                    : JSON.stringify(task.executionResult, null, 2)}
                </div>
              </div>
            )}

            {task.error && (
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1">Error:</label>
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {task.error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReviewPhase = () => {
    if (!workflow) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Review Atomic Workflow</h3>
          <div className="text-sm text-gray-600">
            {workflow.atomicTasks.length} tasks • {Math.ceil(workflow.estimatedDuration)}min estimated
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Workflow Generated Successfully!</h4>
          <div className="text-sm text-green-800 space-y-1">
            <div>• {workflow.atomicTasks.length} atomic tasks identified</div>
            <div>• {workflow.batchGroups.length} batch groups for parallel execution</div>
            <div>• {workflow.executionOrder.length} execution phases</div>
            <div>• Estimated completion: {Math.ceil(workflow.estimatedDuration)} minutes</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {workflow.atomicTasks.map(renderTaskCard)}
        </div>

        {workflow.batchGroups.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Batch Groups (Parallel Execution)</h4>
            <div className="space-y-2">
              {workflow.batchGroups.map(group => (
                <div key={group.groupId} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-blue-900">
                      {group.workflowType} Batch ({group.tasks.length} tasks)
                    </span>
                    <span className="text-sm text-blue-700">
                      {Math.ceil(group.estimatedExecutionTime)}min
                    </span>
                  </div>
                  <div className="text-sm text-blue-800 mt-1">
                    {group.batchingReason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentPhase('input')}
            className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Edit
          </button>
          <button
            onClick={handleExecuteWorkflow}
            disabled={isExecuting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {isExecuting ? 'Executing...' : 'Execute Workflow'}
          </button>
        </div>
      </div>
    );
  };

  const renderExecutePhase = () => {
    if (!workflow) return null;

    const completedTasks = workflow.atomicTasks.filter(t => t.status === 'completed').length;
    const totalTasks = workflow.atomicTasks.length;
    const progress = (completedTasks / totalTasks) * 100;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Executing Workflow</h3>
          <div className="text-sm text-gray-600">
            {completedTasks} / {totalTasks} tasks completed
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {workflow.atomicTasks.map(renderTaskCard)}
        </div>
      </div>
    );
  };

  const renderResultsPhase = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Workflow Results</h3>
        <div className="text-sm text-gray-600">
          {executionResults.filter(r => r.success).length} / {executionResults.length} tasks successful
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto">
        {executionResults.map((result, index) => (
          <div key={index} className={`p-4 border rounded-lg ${
            result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">{result.title}</h4>
              <span className={`px-2 py-1 text-xs rounded-full ${
                result.success 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? 'Success' : 'Failed'}
              </span>
            </div>
            
            {result.success ? (
              <div className="text-sm text-gray-700">
                {typeof result.result === 'string' 
                  ? result.result.slice(0, 200) + (result.result.length > 200 ? '...' : '')
                  : JSON.stringify(result.result, null, 2).slice(0, 200) + '...'
                }
              </div>
            ) : (
              <div className="text-sm text-red-700">
                {result.error}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => {
            setCurrentPhase('input');
            setWorkflow(null);
            setExecutionResults([]);
            setUserPrompt('');
          }}
          className="px-6 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Start New Workflow
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold">Smart Slicer Workflow</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isGenerating && renderProgressIndicator()}
          
          {currentPhase === 'input' && renderInputPhase()}
          {currentPhase === 'review' && renderReviewPhase()}
          {currentPhase === 'execute' && renderExecutePhase()}
          {currentPhase === 'results' && renderResultsPhase()}
        </div>
      </div>
    </div>
  );
};

export default SmartSlicerWorkflowEditor;