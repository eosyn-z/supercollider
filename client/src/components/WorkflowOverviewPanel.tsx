import React, { useState, useEffect, useCallback } from 'react';
import { Workflow, ExecutionState, BatchExecution, SubtaskExecution, ExecutionTimelineEvent } from '../types';
import { BatchGroup } from '../../../core/utils/taskSlicer';

interface WorkflowOverviewPanelProps {
  workflow: Workflow;
  executionState?: ExecutionState;
  onPauseExecution: () => void;
  onResumeExecution: () => void;
  onHaltExecution: (reason: string) => void;
  onRetryBatch: (batchId: string) => void;
  className?: string;
}

interface BatchVisualizationProps {
  batch: BatchExecution;
  subtaskExecutions: Record<string, SubtaskExecution>;
  onRetry: (batchId: string) => void;
}

const BatchVisualization: React.FC<BatchVisualizationProps> = ({ batch, subtaskExecutions, onRetry }) => {
  const batchSubtasks = batch.subtaskIds.map(id => subtaskExecutions[id]).filter(Boolean);
  const completedCount = batchSubtasks.filter(s => s.status === 'COMPLETED').length;
  const failedCount = batchSubtasks.filter(s => s.status === 'FAILED').length;
  const runningCount = batchSubtasks.filter(s => s.status === 'RUNNING').length;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'FAILED': return 'bg-red-500';
      case 'PENDING': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const estimatedTimeSavings = batch.subtaskIds.length > 1 
    ? Math.round((batch.subtaskIds.length - 1) * 15) // Assume 15 min saved per parallel task
    : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-gray-900">Batch {batch.batchId}</h4>
          <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(batch.status)}`}>
            {batch.status}
          </span>
          {estimatedTimeSavings > 0 && (
            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
              ~{estimatedTimeSavings}min saved
            </span>
          )}
        </div>
        
        {batch.status === 'FAILED' && (
          <button
            onClick={() => onRetry(batch.batchId)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry Batch
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{completedCount}/{batch.subtaskIds.length} completed</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / batch.subtaskIds.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">{runningCount}</div>
          <div className="text-xs text-gray-500">Running</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">{completedCount}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">{failedCount}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-600">{batch.subtaskIds.length - completedCount - failedCount - runningCount}</div>
          <div className="text-xs text-gray-500">Pending</div>
        </div>
      </div>

      {/* Subtask Pills */}
      <div className="flex flex-wrap gap-2">
        {batchSubtasks.map(subtask => (
          <div
            key={subtask.subtaskId}
            className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(subtask.status)}`}
            title={`${subtask.subtaskId} - ${subtask.status}`}
          >
            Task {subtask.subtaskId.slice(-4)}
          </div>
        ))}
      </div>

      {/* Execution Time */}
      {batch.startTime && (
        <div className="mt-3 text-sm text-gray-500">
          {batch.endTime ? (
            <span>Completed in {Math.round((batch.endTime.getTime() - batch.startTime.getTime()) / 1000)}s</span>
          ) : (
            <span>Running for {Math.round((Date.now() - batch.startTime.getTime()) / 1000)}s</span>
          )}
        </div>
      )}
    </div>
  );
};

interface TimelineEventProps {
  event: ExecutionTimelineEvent;
}

const TimelineEvent: React.FC<TimelineEventProps> = ({ event }) => {
  const getEventIcon = (type: string) => {
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
      default: return '•';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'batch-completed':
      case 'subtask-completed': return 'text-green-600';
      case 'subtask-failed': return 'text-red-600';
      case 'execution-halted': return 'text-yellow-600';
      case 'retry-attempted': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-lg">{getEventIcon(event.type)}</span>
      <div className="flex-1">
        <div className={`text-sm font-medium ${getEventColor(event.type)}`}>
          {event.message}
        </div>
        <div className="text-xs text-gray-500">
          {new Date(event.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export const WorkflowOverviewPanel: React.FC<WorkflowOverviewPanelProps> = ({
  workflow,
  executionState,
  onPauseExecution,
  onResumeExecution,
  onHaltExecution,
  onRetryBatch,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'batches' | 'timeline'>('overview');
  const [haltReason, setHaltReason] = useState('');
  const [showHaltDialog, setShowHaltDialog] = useState(false);

  const handleHalt = useCallback(() => {
    if (haltReason.trim()) {
      onHaltExecution(haltReason.trim());
      setShowHaltDialog(false);
      setHaltReason('');
    }
  }, [haltReason, onHaltExecution]);

  const getOverallProgress = () => {
    if (!executionState) return 0;
    const total = executionState.progress.total;
    const completed = executionState.progress.completed;
    return total > 0 ? (completed / total) * 100 : 0;
  };

  const getEstimatedTimeRemaining = () => {
    if (!executionState || executionState.status !== 'RUNNING') return 0;
    
    const elapsed = Date.now() - executionState.startTime.getTime();
    const progress = getOverallProgress();
    
    if (progress > 10) { // Only estimate after 10% completion
      const totalEstimated = (elapsed / progress) * 100;
      return Math.max(0, totalEstimated - elapsed);
    }
    
    return 0;
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className={`bg-gray-50 rounded-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Workflow Execution</h3>
            <p className="text-sm text-gray-600">{workflow.subtasks.length} subtasks total</p>
          </div>
          
          {/* Execution Controls */}
          <div className="flex items-center gap-2">
            {executionState && (
              <>
                {executionState.status === 'RUNNING' && (
                  <>
                    <button
                      onClick={onPauseExecution}
                      className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                    >
                      Pause
                    </button>
                    <button
                      onClick={() => setShowHaltDialog(true)}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Halt
                    </button>
                  </>
                )}
                
                {executionState.status === 'PAUSED' && (
                  <button
                    onClick={onResumeExecution}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Resume
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Overall Progress */}
        {executionState && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Overall Progress</span>
              <span>{Math.round(getOverallProgress())}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${getOverallProgress()}%` }}
              />
            </div>
            
            {/* Status Info */}
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className={`px-2 py-1 rounded-full text-xs ${
                executionState.status === 'RUNNING' ? 'bg-blue-100 text-blue-800' :
                executionState.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                executionState.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                executionState.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {executionState.status}
              </span>
              
              {getEstimatedTimeRemaining() > 0 && (
                <span className="text-gray-500">
                  ~{formatDuration(getEstimatedTimeRemaining())} remaining
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {['overview', 'batches', 'timeline'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Status Summary */}
            {executionState && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{executionState.progress.inProgress}</div>
                  <div className="text-sm text-gray-600">Running</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{executionState.progress.completed}</div>
                  <div className="text-sm text-gray-600">Completed</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{executionState.progress.failed}</div>
                  <div className="text-sm text-gray-600">Failed</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{executionState.progress.halted}</div>
                  <div className="text-sm text-gray-600">Halted</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{executionState.progress.queued}</div>
                  <div className="text-sm text-gray-600">Queued</div>
                </div>
              </div>
            )}

            {/* Recent Errors */}
            {executionState && executionState.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Recent Errors</h4>
                <div className="space-y-2">
                  {executionState.errors.slice(-3).map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      <span className="font-medium">{error.type}:</span> {error.message}
                      {error.subtaskId && <span className="text-red-500"> (Task: {error.subtaskId})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batches' && (
          <div className="space-y-4">
            {executionState && executionState.batches.length > 0 ? (
              executionState.batches.map(batch => (
                <BatchVisualization
                  key={batch.batchId}
                  batch={batch}
                  subtaskExecutions={executionState.subtaskExecutions}
                  onRetry={onRetryBatch}
                />
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                No batch execution data available
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-2">
            {executionState && executionState.timeline.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {executionState.timeline
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(event => (
                    <TimelineEvent key={event.id} event={event} />
                  ))
                }
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No timeline events available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Halt Dialog */}
      {showHaltDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Halt Execution</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for halting the workflow execution:
            </p>
            <textarea
              value={haltReason}
              onChange={(e) => setHaltReason(e.target.value)}
              placeholder="Reason for halting..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowHaltDialog(false);
                  setHaltReason('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleHalt}
                disabled={!haltReason.trim()}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-300"
              >
                Halt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};