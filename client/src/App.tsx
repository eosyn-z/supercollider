import React, { useState, useEffect, useCallback, ErrorInfo } from 'react';
import { WorkflowGraph } from './components/WorkflowGraph';
import { AgentPriorityList } from './components/AgentPriorityList';
import { ExecutionStatusPanel } from './components/ExecutionStatusPanel';
import { ValidationSettingsEditor } from './components/ValidationSettingsEditor';
import { WorkflowCreator } from './components/WorkflowCreator';
import { ApiKeyManager } from './components/ApiKeyManager';
import { AgentAssignmentPanel } from './components/AgentAssignmentPanel';
import { 
  Workflow, 
  Subtask, 
  SubtaskType, 
  Agent, 
  ExecutionState, 
  ValidationConfig, 
  ExecutionStatus,
  Priority,
  SubtaskStatus
} from './types';
import './App.css';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <svg className="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            </div>
            <p className="text-gray-600 mb-4">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App Component
function App() {
  // State management
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [executionState, setExecutionState] = useState<ExecutionState | null>(null);
  const [executionStatus, setExecutionStatus] = useState<Record<string, ExecutionStatus>>({});
  const [agentPriorities, setAgentPriorities] = useState<Record<SubtaskType, string[]>>({
    [SubtaskType.RESEARCH]: [],
    [SubtaskType.ANALYSIS]: [],
    [SubtaskType.CREATION]: [],
    [SubtaskType.VALIDATION]: []
  });
  const [selectedSubtask, setSelectedSubtask] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'agents' | 'validation' | 'keys' | 'assignment'>('graph');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [agentAssignments, setAgentAssignments] = useState<any[]>([]);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      
      // Mock data - in real app, this would come from API
      const mockAgents: Agent[] = [
        {
          id: 'agent-1',
          name: 'Claude-3 Opus',
          apiKey: 'mock-key-1',
          capabilities: [
            { name: 'Research', category: SubtaskType.RESEARCH, proficiency: 'EXPERT' },
            { name: 'Analysis', category: SubtaskType.ANALYSIS, proficiency: 'ADVANCED' }
          ],
          performanceMetrics: {
            averageCompletionTime: 45,
            successRate: 92,
            qualityScore: 88,
            totalTasksCompleted: 156,
            lastUpdated: new Date()
          },
          availability: true,
          costPerMinute: 0.15
        },
        {
          id: 'agent-2',
          name: 'GPT-4',
          apiKey: 'mock-key-2',
          capabilities: [
            { name: 'Creation', category: SubtaskType.CREATION, proficiency: 'EXPERT' },
            { name: 'Validation', category: SubtaskType.VALIDATION, proficiency: 'ADVANCED' }
          ],
          performanceMetrics: {
            averageCompletionTime: 38,
            successRate: 89,
            qualityScore: 85,
            totalTasksCompleted: 243,
            lastUpdated: new Date()
          },
          availability: true,
          costPerMinute: 0.12
        },
        {
          id: 'agent-3',
          name: 'Gemini Pro',
          apiKey: 'mock-key-3',
          capabilities: [
            { name: 'Research', category: SubtaskType.RESEARCH, proficiency: 'ADVANCED' },
            { name: 'Creation', category: SubtaskType.CREATION, proficiency: 'INTERMEDIATE' }
          ],
          performanceMetrics: {
            averageCompletionTime: 52,
            successRate: 86,
            qualityScore: 82,
            totalTasksCompleted: 98,
            lastUpdated: new Date()
          },
          availability: false,
          costPerMinute: 0.08
        }
      ];

      setAgents(mockAgents);
      
      // Set initial agent priorities
      setAgentPriorities({
        [SubtaskType.RESEARCH]: ['agent-1', 'agent-3', 'agent-2'],
        [SubtaskType.ANALYSIS]: ['agent-1', 'agent-2', 'agent-3'],
        [SubtaskType.CREATION]: ['agent-2', 'agent-1', 'agent-3'],
        [SubtaskType.VALIDATION]: ['agent-2', 'agent-1', 'agent-3']
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle workflow creation
  const handleCreateWorkflow = useCallback(async (newWorkflow: Workflow) => {
    try {
      // Simulate task slicing - in real app, this would call the task slicer
      const mockSubtasks: Subtask[] = [
        {
          id: 'subtask-1',
          title: 'Research AI Safety',
          description: 'Conduct comprehensive research on current AI safety measures and best practices',
          type: SubtaskType.RESEARCH,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: newWorkflow.id,
          estimatedDuration: 30,
          assignedAgentId: 'agent-1'
        },
        {
          id: 'subtask-2',
          title: 'Analyze Safety Gaps',
          description: 'Analyze the research findings to identify potential safety gaps',
          type: SubtaskType.ANALYSIS,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-1', type: 'BLOCKING', description: 'Needs research data' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: newWorkflow.id,
          estimatedDuration: 25,
          assignedAgentId: 'agent-1'
        },
        {
          id: 'subtask-3',
          title: 'Create Safety Protocol',
          description: 'Design a comprehensive safety protocol based on the analysis',
          type: SubtaskType.CREATION,
          priority: 'MEDIUM' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-2', type: 'BLOCKING', description: 'Needs analysis results' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: newWorkflow.id,
          estimatedDuration: 45,
          assignedAgentId: 'agent-2'
        },
        {
          id: 'subtask-4',
          title: 'Validate Protocol',
          description: 'Review and validate the safety protocol for completeness',
          type: SubtaskType.VALIDATION,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-3', type: 'BLOCKING', description: 'Needs protocol draft' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: newWorkflow.id,
          estimatedDuration: 20,
          assignedAgentId: 'agent-2'
        }
      ];

      const workflowWithSubtasks: Workflow = {
        ...newWorkflow,
        subtasks: mockSubtasks,
        agentAssignments: [
          { agentId: 'agent-1', subtaskId: 'subtask-1' },
          { agentId: 'agent-1', subtaskId: 'subtask-2' },
          { agentId: 'agent-2', subtaskId: 'subtask-3' },
          { agentId: 'agent-2', subtaskId: 'subtask-4' }
        ]
      };

      setWorkflow(workflowWithSubtasks);
    } catch (error) {
      console.error('Failed to create workflow:', error);
      alert('Failed to create workflow. Please try again.');
    }
  }, []);

  // Handle workflow loading
  const handleLoadWorkflow = useCallback((workflowId: string) => {
    // In real app, this would load from API
    // For now, we'll create a mock workflow
    const mockWorkflow: Workflow = {
      id: workflowId,
      prompt: 'Create a comprehensive AI safety protocol for our organization',
      subtasks: [
        {
          id: 'subtask-1',
          title: 'Research AI Safety',
          description: 'Conduct comprehensive research on current AI safety measures and best practices',
          type: SubtaskType.RESEARCH,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflowId,
          estimatedDuration: 30,
          assignedAgentId: 'agent-1'
        },
        {
          id: 'subtask-2',
          title: 'Analyze Safety Gaps',
          description: 'Analyze the research findings to identify potential safety gaps',
          type: SubtaskType.ANALYSIS,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-1', type: 'BLOCKING', description: 'Needs research data' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflowId,
          estimatedDuration: 25,
          assignedAgentId: 'agent-1'
        },
        {
          id: 'subtask-3',
          title: 'Create Safety Protocol',
          description: 'Design a comprehensive safety protocol based on the analysis',
          type: SubtaskType.CREATION,
          priority: 'MEDIUM' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-2', type: 'BLOCKING', description: 'Needs analysis results' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflowId,
          estimatedDuration: 45,
          assignedAgentId: 'agent-2'
        },
        {
          id: 'subtask-4',
          title: 'Validate Protocol',
          description: 'Review and validate the safety protocol for completeness',
          type: SubtaskType.VALIDATION,
          priority: 'HIGH' as Priority,
          status: SubtaskStatus.PENDING,
          dependencies: [
            { subtaskId: 'subtask-3', type: 'BLOCKING', description: 'Needs protocol draft' }
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflowId,
          estimatedDuration: 20,
          assignedAgentId: 'agent-2'
        }
      ],
      status: 'DRAFT',
      agentAssignments: [
        { agentId: 'agent-1', subtaskId: 'subtask-1' },
        { agentId: 'agent-1', subtaskId: 'subtask-2' },
        { agentId: 'agent-2', subtaskId: 'subtask-3' },
        { agentId: 'agent-2', subtaskId: 'subtask-4' }
      ]
    };

    setWorkflow(mockWorkflow);
  }, []);

  // Handle creating a new workflow (reset to creator)
  const handleNewWorkflow = useCallback(() => {
    setWorkflow(null);
    setExecutionState(null);
    setExecutionStatus({});
    setSelectedSubtask(null);
  }, []);

  // Subtask update handler
  const handleSubtaskUpdate = useCallback((subtaskId: string, updates: Partial<Subtask>) => {
    if (!workflow) return;

    const updatedSubtasks = workflow.subtasks.map(subtask =>
      subtask.id === subtaskId
        ? { ...subtask, ...updates, updatedAt: new Date() }
        : subtask
    );

    setWorkflow({ ...workflow, subtasks: updatedSubtasks });
  }, [workflow]);

  // Dependency management
  const handleDependencyAdd = useCallback((fromId: string, toId: string) => {
    if (!workflow) return;

    const updatedSubtasks = workflow.subtasks.map(subtask =>
      subtask.id === toId
        ? {
            ...subtask,
            dependencies: [
              ...subtask.dependencies,
              { subtaskId: fromId, type: 'BLOCKING' as const, description: 'User-added dependency' }
            ]
          }
        : subtask
    );

    setWorkflow({ ...workflow, subtasks: updatedSubtasks });
  }, [workflow]);

  const handleDependencyRemove = useCallback((fromId: string, toId: string) => {
    if (!workflow) return;

    const updatedSubtasks = workflow.subtasks.map(subtask =>
      subtask.id === toId
        ? {
            ...subtask,
            dependencies: subtask.dependencies.filter(dep => dep.subtaskId !== fromId)
          }
        : subtask
    );

    setWorkflow({ ...workflow, subtasks: updatedSubtasks });
  }, [workflow]);

  // Agent priority management
  const handleAgentPriorityChange = useCallback((subtaskType: SubtaskType, newOrder: string[]) => {
    setAgentPriorities(prev => ({
      ...prev,
      [subtaskType]: newOrder
    }));
  }, []);

  // Validation settings update
  const handleValidationUpdate = useCallback((subtaskId: string, config: ValidationConfig) => {
    if (!workflow) return;

    const updatedSubtasks = workflow.subtasks.map(subtask =>
      subtask.id === subtaskId
        ? {
            ...subtask,
            metadata: {
              ...subtask.metadata,
              validation: config
            }
          }
        : subtask
    );

    setWorkflow({ ...workflow, subtasks: updatedSubtasks });
  }, [workflow]);

  // Execution control
  const handleStartExecution = useCallback(async () => {
    if (!workflow) return;

    try {
      // Mock execution start
      const mockExecutionState: ExecutionState = {
        workflowId: workflow.id,
        status: ExecutionStatus.RUNNING,
        startTime: new Date(),
        runningSubtasks: ['subtask-1'],
        completedSubtasks: [],
        failedSubtasks: [],
        retryCount: {},
        errors: [],
        progress: {
          total: workflow.subtasks.length,
          completed: 0,
          failed: 0,
          inProgress: 1
        }
      };

      setExecutionState(mockExecutionState);
      setExecutionStatus({ 'subtask-1': ExecutionStatus.RUNNING });

      // Simulate progress updates
      setTimeout(() => {
        setExecutionStatus(prev => ({
          ...prev,
          'subtask-1': ExecutionStatus.COMPLETED,
          'subtask-2': ExecutionStatus.RUNNING
        }));
        setExecutionState(prev => prev ? {
          ...prev,
          runningSubtasks: ['subtask-2'],
          completedSubtasks: ['subtask-1'],
          progress: { ...prev.progress, completed: 1, inProgress: 1 }
        } : null);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start execution');
    }
  }, [workflow]);

  const handleHaltExecution = useCallback((reason?: string) => {
    setExecutionState(prev => prev ? {
      ...prev,
      status: ExecutionStatus.HALTED,
      haltReason: reason || 'User requested halt',
      endTime: new Date()
    } : null);
  }, []);

  const handleResumeExecution = useCallback(() => {
    setExecutionState(prev => prev ? {
      ...prev,
      status: ExecutionStatus.RUNNING
    } : null);
  }, []);

  // API Key management handlers
  const handleKeyAdded = useCallback((key: any) => {
    setApiKeys(prev => [...prev, key]);
  }, []);

  const handleKeyUpdated = useCallback((key: any) => {
    setApiKeys(prev => prev.map(k => k.id === key.id ? key : k));
  }, []);

  const handleKeyDeleted = useCallback((keyId: string) => {
    setApiKeys(prev => prev.filter(k => k.id !== keyId));
  }, []);

  // Agent assignment handlers
  const handleAssignmentChange = useCallback((assignments: any[]) => {
    setAgentAssignments(assignments);
  }, []);

  const handleHaltSubtask = useCallback((subtaskId: string) => {
    setExecutionStatus(prev => ({
      ...prev,
      [subtaskId]: ExecutionStatus.HALTED
    }));
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Supercollider...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center mb-4">
            <svg className="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Error</h2>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadInitialData();
            }}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show workflow creator if no workflow is loaded
  if (!workflow) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Supercollider</h1>
                <p className="text-sm text-gray-600">AI Workflow Orchestration Platform</p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-4xl mx-auto py-12 px-6">
            <WorkflowCreator
              onCreateWorkflow={handleCreateWorkflow}
              onLoadWorkflow={handleLoadWorkflow}
            />
          </main>
        </div>
      </ErrorBoundary>
    );
  }

  const selectedSubtaskData = selectedSubtask ? 
    workflow.subtasks.find(s => s.id === selectedSubtask) : null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supercollider</h1>
              <p className="text-sm text-gray-600">AI Workflow Orchestration Platform</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Workflow: <span className="font-medium">{workflow.id}</span>
              </div>
              
              <button
                onClick={handleNewWorkflow}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                New Workflow
              </button>
              
              {!executionState && (
                <button
                  onClick={handleStartExecution}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Start Execution
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex h-[calc(100vh-80px)]">
          {/* Left Panel - Navigation */}
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('graph')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'graph'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Workflow Graph
              </button>
              <button
                onClick={() => setActiveTab('assignment')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'assignment'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Agent Assignment
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'agents'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Agent Priorities
              </button>
              <button
                onClick={() => setActiveTab('keys')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'keys'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                API Keys
              </button>
              <button
                onClick={() => setActiveTab('validation')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'validation'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Validation Settings
              </button>
            </nav>

            {/* Subtask List */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Subtasks</h3>
              <div className="space-y-1">
                {workflow.subtasks.map(subtask => (
                  <button
                    key={subtask.id}
                    onClick={() => setSelectedSubtask(subtask.id)}
                    className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                      selectedSubtask === subtask.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium truncate">{subtask.title}</div>
                    <div className="text-gray-500">{subtask.type}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex">
            {/* Center Panel - Main View */}
            <div className="flex-1 p-6">
              {activeTab === 'graph' && (
                <WorkflowGraph
                  subtasks={workflow.subtasks}
                  agents={agents}
                  executionStatus={executionStatus}
                  onSubtaskUpdate={handleSubtaskUpdate}
                  onDependencyAdd={handleDependencyAdd}
                  onDependencyRemove={handleDependencyRemove}
                  isExecuting={!!executionState}
                  className="h-full"
                />
              )}

              {activeTab === 'agents' && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">Agent Priority Configuration</h2>
                    <p className="text-gray-600">
                      Configure agent priority for each subtask type. Higher priority agents will be tried first.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Object.values(SubtaskType).map(type => (
                      <AgentPriorityList
                        key={type}
                        subtaskType={type}
                        agents={agents}
                        priorityOrder={agentPriorities[type]}
                        onPriorityChange={handleAgentPriorityChange}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'validation' && selectedSubtaskData && (
                <ValidationSettingsEditor
                  subtask={selectedSubtaskData}
                  onValidationUpdate={handleValidationUpdate}
                  className="h-full"
                />
              )}

              {activeTab === 'validation' && !selectedSubtaskData && (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p className="text-lg">Select a subtask to configure validation settings</p>
                    <p className="text-sm mt-2">Choose a subtask from the left panel</p>
                  </div>
                </div>
              )}

              {activeTab === 'keys' && (
                <ApiKeyManager
                  agents={agents}
                  onKeyAdded={handleKeyAdded}
                  onKeyUpdated={handleKeyUpdated}
                  onKeyDeleted={handleKeyDeleted}
                  className="h-full"
                />
              )}

              {activeTab === 'assignment' && (
                <AgentAssignmentPanel
                  workflow={workflow}
                  agents={agents}
                  apiKeys={apiKeys}
                  onAssignmentChange={handleAssignmentChange}
                  className="h-full"
                />
              )}
            </div>

            {/* Right Panel - Execution Status */}
            <div className="w-80 p-6 border-l border-gray-200">
              <ExecutionStatusPanel
                executionState={executionState}
                onHaltExecution={handleHaltExecution}
                onResumeExecution={handleResumeExecution}
                onHaltSubtask={handleHaltSubtask}
              />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;