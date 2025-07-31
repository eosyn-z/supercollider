import React from 'react';
import { ExecutionState } from '../types';

interface ExecutionStatusPanelProps {
  executionState: ExecutionState | null;
  onHaltExecution: (reason?: string) => void;
  onResumeExecution: () => void;
  onHaltSubtask: (subtaskId: string) => void;
}

export const ExecutionStatusPanel: React.FC<ExecutionStatusPanelProps> = ({
  executionState,
  onHaltExecution,
  onResumeExecution,
  onHaltSubtask
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'text-green-600 bg-green-100';
      case 'COMPLETED':
        return 'text-blue-600 bg-blue-100';
      case 'FAILED':
        return 'text-red-600 bg-red-100';
      case 'HALTED':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressPercentage = () => {
    if (!executionState) return 0;
    const { total, completed, failed } = executionState.progress;
    return total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}m ${diffSecs}s`;
  };

  if (!executionState) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-lg font-semibold mb-4">Execution Status</h3>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No active execution</p>
          <p className="text-xs mt-1">Start a workflow to see status here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Execution Status</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(executionState.status)}`}>
          {executionState.status}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span>Progress</span>
          <span>{getProgressPercentage()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {executionState.progress.completed}
          </div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {executionState.progress.inProgress}
          </div>
          <div className="text-xs text-gray-500">Running</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">
            {executionState.progress.failed}
          </div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600">
            {executionState.progress.total - executionState.progress.completed - executionState.progress.failed - executionState.progress.inProgress}
          </div>
          <div className="text-xs text-gray-500">Pending</div>
        </div>
      </div>

      {/* Duration */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-sm font-medium mb-1">Duration</div>
        <div className="text-lg font-mono">
          {formatDuration(executionState.startTime, executionState.endTime)}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="space-y-2 mb-4">
        {executionState.status === 'RUNNING' && (
          <button
            onClick={() => onHaltExecution('User requested halt')}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors"
          >
            Halt Execution
          </button>
        )}
        
        {executionState.status === 'HALTED' && (
          <button
            onClick={onResumeExecution}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
          >
            Resume Execution
          </button>
        )}
      </div>

      {/* Running Subtasks */}
      {executionState.runningSubtasks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Currently Running</h4>
          <div className="space-y-2">
            {executionState.runningSubtasks.map(subtaskId => (
              <div key={subtaskId} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">{subtaskId}</span>
                <button
                  onClick={() => onHaltSubtask(subtaskId)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Halt
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {executionState.errors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 text-red-600">Errors</h4>
          <div className="space-y-2">
            {executionState.errors.slice(0, 3).map((error, index) => (
              <div key={index} className="p-2 bg-red-50 rounded-lg">
                <div className="text-xs text-red-800 font-medium">
                  {error.subtaskId || 'System'}
                </div>
                <div className="text-xs text-red-600 mt-1">
                  {error.message}
                </div>
              </div>
            ))}
            {executionState.errors.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{executionState.errors.length - 3} more errors
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retry Info */}
      {Object.keys(executionState.retryCount).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Retry Attempts</h4>
          <div className="space-y-1">
            {Object.entries(executionState.retryCount).map(([subtaskId, count]) => (
              <div key={subtaskId} className="flex justify-between text-xs">
                <span>{subtaskId}</span>
                <span className="text-orange-600">{count} retries</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};