import React, { useState, useEffect, useMemo } from 'react';
import { SubtaskProgressTracker } from './SubtaskProgressTracker';
import { SubtaskTodoList, ProgressUpdate } from '../../../server/core/utils/progressParser';
import { EnhancedExecutionState, ExecutionTimelineEvent, BatchVisualization } from '../../../shared/types/enhanced';

interface WorkflowProgressDashboardProps {
  workflowId: string;
  executionState: EnhancedExecutionState;
  todoLists: Map<string, SubtaskTodoList>;
  onSubtaskSelect?: (subtaskId: string) => void;
  onRetrySubtask?: (subtaskId: string) => void;
  onPauseWorkflow?: () => void;
  onResumeWorkflow?: () => void;
  onHaltWorkflow?: () => void;
  showDetailedView?: boolean;
  className?: string;
}

interface WorkflowStatsProps {
  executionState: EnhancedExecutionState;
  todoLists: Map<string, SubtaskTodoList>;
}

interface TimelineProps {
  events: ExecutionTimelineEvent[];
  maxEvents?: number;
}

interface BatchVisualizationProps {
  batches: BatchVisualization[];
  onBatchClick?: (batchId: string) => void;
}

const WorkflowStats: React.FC<WorkflowStatsProps> = ({ executionState, todoLists }) => {
  const stats = useMemo(() => {
    const totalTodos = Array.from(todoLists.values()).reduce((sum, list) => sum + list.totalItems, 0);
    const completedTodos = Array.from(todoLists.values()).reduce((sum, list) => sum + list.completedItems, 0);
    
    const totalEstimatedDuration = Array.from(todoLists.values())
      .reduce((sum, list) => sum + list.estimatedTotalDuration, 0);
    
    const totalActualDuration = Array.from(todoLists.values())
      .filter(list => list.actualDuration)
      .reduce((sum, list) => sum + (list.actualDuration || 0), 0);

    const overallProgress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
    
    const avgSuccessRate = executionState.progress.total > 0 
      ? Math.round((executionState.progress.completed / executionState.progress.total) * 100)
      : 0;

    return {
      totalTodos,
      completedTodos,
      totalEstimatedDuration,
      totalActualDuration,
      overallProgress,
      avgSuccessRate,
      activeSubtasks: executionState.runningSubtasks.length,
      failedSubtasks: executionState.failedSubtasks.length
    };
  }, [executionState, todoLists]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      case 'halted': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className={`text-lg font-semibold px-2 py-1 rounded-full text-center ${getStatusColor(executionState.status)}`}>
              {executionState.status.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Overall Progress</p>
            <p className="text-2xl font-bold text-gray-900">{stats.overallProgress}%</p>
          </div>
          <div className="w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-300"
                fill="none"
                strokeWidth="3"
                stroke="currentColor"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-600"
                fill="none"
                strokeWidth="3"
                stroke="currentColor"
                strokeDasharray={`${stats.overallProgress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Subtasks</p>
        <p className="text-2xl font-bold text-gray-900">
          {executionState.progress.completed}/{executionState.progress.total}
        </p>
        <p className="text-xs text-gray-500">
          {stats.activeSubtasks} active, {stats.failedSubtasks} failed
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Todo Items</p>
        <p className="text-2xl font-bold text-gray-900">
          {stats.completedTodos}/{stats.totalTodos}
        </p>
        <p className="text-xs text-gray-500">Individual tasks</p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Duration</p>
        <p className="text-lg font-bold text-gray-900">
          {executionState.endTime 
            ? formatDuration(executionState.endTime.getTime() - executionState.startTime.getTime())
            : formatDuration(Date.now() - executionState.startTime.getTime())
          }
        </p>
        <p className="text-xs text-gray-500">
          Est: {formatDuration(stats.totalEstimatedDuration)}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">Success Rate</p>
        <p className="text-2xl font-bold text-gray-900">{stats.avgSuccessRate}%</p>
        <p className="text-xs text-gray-500">Completed tasks</p>
      </div>
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({ events, maxEvents = 10 }) => {
  const recentEvents = useMemo(() => {
    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, maxEvents);
  }, [events, maxEvents]);

  const getEventIcon = (type: ExecutionTimelineEvent['type']) => {
    switch (type) {
      case 'batch-started': return '🚀';
      case 'batch-completed': return '✅';
      case 'subtask-started': return '▶️';
      case 'subtask-completed': return '✓';
      case 'subtask-failed': return '❌';
      case 'agent-switched': return '🔄';
      case 'retry-attempted': return '↻';
      case 'execution-halted': return '⏸️';
      case 'execution-resumed': return '▶️';
      default: return '📝';
    }
  };

  const getEventColor = (type: ExecutionTimelineEvent['type']) => {
    switch (type) {
      case 'batch-completed':
      case 'subtask-completed':
        return 'text-green-600 bg-green-50';
      case 'subtask-failed':
      case 'execution-halted':
        return 'text-red-600 bg-red-50';
      case 'batch-started':
      case 'subtask-started':
      case 'execution-resumed':
        return 'text-blue-600 bg-blue-50';
      case 'agent-switched':
      case 'retry-attempted':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
      
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {recentEvents.length > 0 ? (
          recentEvents.map(event => (
            <div key={event.id} className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.type)}`}>
                <span className="text-sm">{getEventIcon(event.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{event.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                  {event.subtaskId && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {event.subtaskId}
                    </span>
                  )}
                  {event.agentId && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                      {event.agentId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">No recent activity</p>
        )}
      </div>
    </div>
  );
};

const BatchVisualization: React.FC<BatchVisualizationProps> = ({ batches, onBatchClick }) => {
  const getBatchStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'paused': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Execution</h3>
      
      <div className="space-y-3">
        {batches.length > 0 ? (
          batches.map(batch => (
            <div
              key={batch.batchId}
              onClick={() => onBatchClick?.(batch.batchId)}
              className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getBatchStatusColor(batch.status)}`} />
                  <span className="font-medium">Batch {batch.batchId}</span>
                  <span className="text-sm text-gray-500">
                    ({batch.subtasks.length} subtasks)
                  </span>
                </div>
                <span className="text-sm text-gray-600 capitalize">{batch.status}</span>
              </div>

              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>
                    {batch.progress.completed}/{batch.progress.total} completed
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getBatchStatusColor(batch.status)}`}
                    style={{ 
                      width: `${batch.progress.total > 0 ? (batch.progress.completed / batch.progress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-600">
                <div className="flex gap-4">
                  <span>✓ {batch.progress.completed}</span>
                  <span>▶️ {batch.progress.running}</span>
                  <span>❌ {batch.progress.failed}</span>
                </div>
                {batch.actualExecutionTime && (
                  <span>
                    {Math.round(batch.actualExecutionTime / 60000)}m elapsed
                  </span>
                )}
              </div>

              {batch.estimatedTimeSavings > 0 && (
                <div className="mt-2 text-xs text-green-600">
                  ⚡ ~{Math.round(batch.estimatedTimeSavings / 60000)}m saved by batching
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-4">No batches running</p>
        )}
      </div>
    </div>
  );
};

export const WorkflowProgressDashboard: React.FC<WorkflowProgressDashboardProps> = ({
  workflowId,
  executionState,
  todoLists,
  onSubtaskSelect,
  onRetrySubtask,
  onPauseWorkflow,
  onResumeWorkflow,
  onHaltWorkflow,
  showDetailedView = true,
  className = ''
}) => {
  const [selectedSubtask, setSelectedSubtask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'timeline'>('overview');
  const [batchVisualizations, setBatchVisualizations] = useState<BatchVisualization[]>([]);

  // Convert execution state batches to visualizations
  useEffect(() => {
    const visualizations: BatchVisualization[] = executionState.batches.map(batch => {
      const batchSubtasks = batch.subtaskIds.map(id => 
        Array.from(todoLists.values()).find(list => list.subtaskId === id)
      ).filter(Boolean);

      const totalTodos = batchSubtasks.reduce((sum, list) => sum + (list?.totalItems || 0), 0);
      const completedTodos = batchSubtasks.reduce((sum, list) => sum + (list?.completedItems || 0), 0);
      const failedSubtasks = batch.subtaskIds.filter(id => 
        executionState.failedSubtasks.includes(id)
      ).length;
      const runningSubtasks = batch.subtaskIds.filter(id => 
        executionState.runningSubtasks.includes(id)
      ).length;

      return {
        batchId: batch.batchId,
        subtasks: [], // TODO: Map to BatchableSubtask if needed
        status: batch.status as any,
        progress: {
          completed: completedTodos,
          failed: failedSubtasks,
          running: runningSubtasks,
          total: totalTodos
        },
        estimatedTimeSavings: 0, // TODO: Calculate based on parallel vs sequential
        actualExecutionTime: batch.endTime && batch.startTime 
          ? batch.endTime.getTime() - batch.startTime.getTime()
          : undefined
      };
    });

    setBatchVisualizations(visualizations);
  }, [executionState.batches, todoLists, executionState.failedSubtasks, executionState.runningSubtasks]);

  const handleSubtaskSelect = (subtaskId: string) => {
    setSelectedSubtask(selectedSubtask === subtaskId ? null : subtaskId);
    onSubtaskSelect?.(subtaskId);
  };

  const getWorkflowActions = () => {
    switch (executionState.status) {
      case 'running':
        return (
          <div className="flex gap-2">
            <button
              onClick={onPauseWorkflow}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
            >
              Pause
            </button>
            <button
              onClick={onHaltWorkflow}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              Halt
            </button>
          </div>
        );
      case 'paused':
        return (
          <div className="flex gap-2">
            <button
              onClick={onResumeWorkflow}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Resume
            </button>
            <button
              onClick={onHaltWorkflow}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              Halt
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflow Progress</h2>
          <p className="text-gray-600">
            {workflowId} • Started {executionState.startTime.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'overview' ? 'bg-white shadow' : 'text-gray-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode('detailed')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'detailed' ? 'bg-white shadow' : 'text-gray-600'
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'timeline' ? 'bg-white shadow' : 'text-gray-600'
              }`}
            >
              Timeline
            </button>
          </div>
          {getWorkflowActions()}
        </div>
      </div>

      {/* Stats */}
      <WorkflowStats executionState={executionState} todoLists={todoLists} />

      {/* Main Content */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BatchVisualization 
            batches={batchVisualizations}
            onBatchClick={(batchId) => console.log('Batch clicked:', batchId)}
          />
          <Timeline events={executionState.timeline} />
        </div>
      )}

      {viewMode === 'detailed' && (
        <div className="space-y-6">
          {Array.from(todoLists.entries()).map(([subtaskId, todoList]) => (
            <SubtaskProgressTracker
              key={subtaskId}
              subtaskId={subtaskId}
              todoList={todoList}
              onTodoItemClick={(todo) => console.log('Todo clicked:', todo)}
              showTimeEstimates={true}
              showDependencies={false}
              compactView={false}
            />
          ))}
        </div>
      )}

      {viewMode === 'timeline' && (
        <div className="grid grid-cols-1 gap-6">
          <Timeline events={executionState.timeline} maxEvents={50} />
        </div>
      )}

      {/* Error Summary */}
      {executionState.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Errors ({executionState.errors.length})
          </h3>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {executionState.errors.map((error, index) => (
              <div key={index} className="text-sm text-red-700">
                <span className="font-medium">{error.type}:</span> {error.message}
                {error.subtaskId && (
                  <span className="text-red-600 ml-2">({error.subtaskId})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};