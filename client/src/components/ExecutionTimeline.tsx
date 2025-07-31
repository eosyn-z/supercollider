import React, { useMemo } from 'react';
import { ExecutionState, ExecutionTimelineEvent, SubtaskExecution, BatchExecution, ExecutionStatus, Subtask, Agent } from '../types';

interface ExecutionTimelineProps {
  executionState: ExecutionState;
  subtasks: Subtask[];
  agents: Agent[];
  className?: string;
}

interface TimelineItemProps {
  event: ExecutionTimelineEvent;
  subtask?: Subtask;
  agent?: Agent;
  batch?: BatchExecution;
  subtaskExecution?: SubtaskExecution;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ event, subtask, agent, batch, subtaskExecution }) => {
  const getEventIcon = () => {
    switch (event.type) {
      case 'batch-started':
        return <div className="w-3 h-3 bg-blue-500 rounded-full" />;
      case 'batch-completed':
        return <div className="w-3 h-3 bg-green-500 rounded-full" />;
      case 'subtask-started':
        return <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
      case 'subtask-completed':
        return <span className="text-green-500 text-sm">✓</span>;
      case 'subtask-failed':
        return <span className="text-red-500 text-sm">✗</span>;
      case 'agent-switched':
        return <div className="w-3 h-3 bg-orange-500 rounded-full" />;
      case 'retry-attempted':
        return <span className="text-yellow-500 text-sm">⟲</span>;
      case 'execution-halted':
        return <span className="text-red-500 text-sm">⏸</span>;
      case 'execution-resumed':
        return <span className="text-blue-500 text-sm">▶</span>;
      default:
        return <div className="w-3 h-3 bg-gray-400 rounded-full" />;
    }
  };

  const getEventColor = () => {
    switch (event.type) {
      case 'subtask-completed':
      case 'batch-completed':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'subtask-failed':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'subtask-started':
      case 'batch-started':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'retry-attempted':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'execution-halted':
        return 'text-red-700 bg-red-50 border-red-200';
      case 'execution-resumed':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-1">
        {getEventIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-900">
            {event.timestamp.toLocaleTimeString()}
          </span>
          {subtask && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
              {subtask.title}
            </span>
          )}
          {agent && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
              {agent.name}
            </span>
          )}
          {batch && (
            <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
              Batch {batch.batchId}
            </span>
          )}
        </div>
        <div className={`mt-1 p-2 rounded border text-sm ${getEventColor()}`}>
          {event.message}
          {subtaskExecution && (
            <div className="mt-1 text-xs opacity-75">
              Duration: {subtaskExecution.actualDuration || subtaskExecution.estimatedDuration || 'Unknown'}s
              {subtaskExecution.confidence && ` | Confidence: ${Math.round(subtaskExecution.confidence * 100)}%`}
              {subtaskExecution.retryCount > 0 && ` | Retries: ${subtaskExecution.retryCount}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BatchViewProps {
  batch: BatchExecution;
  subtasks: Subtask[];
  agents: Agent[];
  subtaskExecutions: Record<string, SubtaskExecution>;
}

const BatchView: React.FC<BatchViewProps> = ({ batch, subtasks, agents, subtaskExecutions }) => {
  const batchSubtasks = subtasks.filter(s => batch.subtaskIds.includes(s.id));
  const duration = batch.endTime && batch.startTime 
    ? Math.round((batch.endTime.getTime() - batch.startTime.getTime()) / 1000)
    : null;

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case ExecutionStatus.COMPLETED:
        return 'bg-green-100 text-green-800 border-green-200';
      case ExecutionStatus.RUNNING:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case ExecutionStatus.FAILED:
        return 'bg-red-100 text-red-800 border-red-200';
      case ExecutionStatus.HALTED:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-gray-900">Batch {batch.batchId}</h4>
          <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(batch.status)}`}>
            {batch.status}
          </span>
          {duration && (
            <span className="text-sm text-gray-600">
              {duration}s
            </span>
          )}
        </div>
        <div className="text-sm text-gray-600">
          {batch.subtaskIds.length} subtasks
          {batch.retryCount > 0 && ` | ${batch.retryCount} retries`}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {batchSubtasks.map(subtask => {
          const execution = subtaskExecutions[subtask.id];
          const agent = execution?.assignedAgentId ? agents.find(a => a.id === execution.assignedAgentId) : null;
          
          return (
            <div key={subtask.id} className="bg-gray-50 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <h5 className="font-medium text-sm text-gray-900 truncate">
                  {subtask.title}
                </h5>
                <span className={`px-2 py-0.5 rounded text-xs border ${getStatusColor(execution?.status || ExecutionStatus.PENDING)}`}>
                  {execution?.status || 'PENDING'}
                </span>
              </div>
              
              {agent && (
                <div className="text-xs text-gray-600 mb-1">
                  Agent: {agent.name}
                </div>
              )}
              
              {execution && (
                <div className="space-y-1">
                  {execution.actualDuration && (
                    <div className="text-xs text-gray-600">
                      Duration: {execution.actualDuration}s
                    </div>
                  )}
                  {execution.confidence && (
                    <div className="text-xs text-gray-600">
                      Confidence: {Math.round(execution.confidence * 100)}%
                    </div>
                  )}
                  {execution.retryCount > 0 && (
                    <div className="text-xs text-yellow-600">
                      Retries: {execution.retryCount}
                    </div>
                  )}
                  {execution.lastError && (
                    <div className="text-xs text-red-600 truncate">
                      Error: {execution.lastError.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  executionState,
  subtasks,
  agents,
  className = ''
}) => {
  const { sortedEvents, totalDuration, estimatedCompletion } = useMemo(() => {
    const events = [...executionState.timeline].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const duration = executionState.endTime && executionState.startTime
      ? Math.round((executionState.endTime.getTime() - executionState.startTime.getTime()) / 1000)
      : Math.round((Date.now() - executionState.startTime.getTime()) / 1000);

    // Estimate completion time based on current progress
    const completed = executionState.progress.completed;
    const total = executionState.progress.total;
    const estimated = completed > 0 
      ? Math.round((duration / completed) * (total - completed))
      : null;

    return {
      sortedEvents: events,
      totalDuration: duration,
      estimatedCompletion: estimated
    };
  }, [executionState]);

  const progressPercentage = (executionState.progress.completed / executionState.progress.total) * 100;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Execution Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Execution Progress</h3>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm ${
              executionState.status === ExecutionStatus.COMPLETED ? 'bg-green-100 text-green-800' :
              executionState.status === ExecutionStatus.RUNNING ? 'bg-blue-100 text-blue-800' :
              executionState.status === ExecutionStatus.FAILED ? 'bg-red-100 text-red-800' :
              executionState.status === ExecutionStatus.HALTED ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {executionState.status}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">
              {executionState.progress.completed}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">
              {executionState.progress.inProgress}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-600">
              {executionState.progress.queued}
            </div>
            <div className="text-sm text-gray-600">Queued</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-600">
              {executionState.progress.failed}
            </div>
            <div className="text-sm text-gray-600">Failed</div>
          </div>
        </div>

        {/* Time Info */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Runtime: {Math.floor(totalDuration / 60)}m {totalDuration % 60}s
          </div>
          {estimatedCompletion && executionState.status === ExecutionStatus.RUNNING && (
            <div>
              Est. completion: {Math.floor(estimatedCompletion / 60)}m {estimatedCompletion % 60}s
            </div>
          )}
        </div>
      </div>

      {/* Batch Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Execution</h3>
        <div className="space-y-4">
          {executionState.batches.map(batch => (
            <BatchView
              key={batch.batchId}
              batch={batch}
              subtasks={subtasks}
              agents={agents}
              subtaskExecutions={executionState.subtaskExecutions}
            />
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Timeline</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {sortedEvents.map(event => {
            const subtask = event.subtaskId ? subtasks.find(s => s.id === event.subtaskId) : undefined;
            const agent = event.agentId ? agents.find(a => a.id === event.agentId) : undefined;
            const batch = event.batchId ? executionState.batches.find(b => b.batchId === event.batchId) : undefined;
            const subtaskExecution = event.subtaskId ? executionState.subtaskExecutions[event.subtaskId] : undefined;

            return (
              <TimelineItem
                key={event.id}
                event={event}
                subtask={subtask}
                agent={agent}
                batch={batch}
                subtaskExecution={subtaskExecution}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};