import React, { useState, useEffect, useMemo } from 'react';
import { TodoItem, SubtaskTodoList, ProgressUpdate } from '../../../server/core/utils/progressParser';

interface SubtaskProgressTrackerProps {
  subtaskId: string;
  todoList: SubtaskTodoList;
  onTodoItemClick?: (todoItem: TodoItem) => void;
  showTimeEstimates?: boolean;
  showDependencies?: boolean;
  compactView?: boolean;
  className?: string;
}

interface TodoItemCardProps {
  todo: TodoItem;
  onClick?: (todo: TodoItem) => void;
  showTimeEstimates: boolean;
  showDependencies: boolean;
  compact: boolean;
}

const TodoItemCard: React.FC<TodoItemCardProps> = ({
  todo,
  onClick,
  showTimeEstimates,
  showDependencies,
  compact
}) => {
  const getStatusIcon = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return <span className="text-green-500">✓</span>;
      case 'in_progress':
        return <span className="text-blue-500">🔄</span>;
      case 'failed':
        return <span className="text-red-500">❌</span>;
      case 'skipped':
        return <span className="text-yellow-500">⏭️</span>;
      default:
        return <span className="text-gray-400">⏸️</span>;
    }
  };

  const getStatusColor = (status: TodoItem['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'in_progress':
        return 'border-blue-200 bg-blue-50';
      case 'failed':
        return 'border-red-200 bg-red-50';
      case 'skipped':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const getElapsedTime = () => {
    if (!todo.startTime) return null;
    const elapsed = todo.completionTime 
      ? todo.completionTime - todo.startTime
      : Date.now() - todo.startTime;
    return elapsed;
  };

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(todo)}
        className={`flex items-center p-2 border rounded cursor-pointer transition-colors ${getStatusColor(todo.status)} ${
          onClick ? 'hover:shadow-sm' : ''
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getStatusIcon(todo.status)}
          <span className="font-medium truncate">{todo.title}</span>
          {todo.status === 'in_progress' && (
            <div className="flex-shrink-0 w-16 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${todo.progressPercentage}%` }}
              />
            </div>
          )}
        </div>
        {showTimeEstimates && (
          <div className="text-xs text-gray-500 flex-shrink-0">
            {formatDuration(todo.estimatedDurationMs)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(todo)}
      className={`p-4 border rounded-lg transition-all duration-200 ${getStatusColor(todo.status)} ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon(todo.status)}
          <h4 className="font-medium text-gray-900">{todo.title}</h4>
        </div>
        <div className="text-xs text-gray-500">
          {todo.progressPercentage}%
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-3">{todo.description}</p>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress</span>
          <span>{todo.progressPercentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              todo.status === 'completed' ? 'bg-green-500' :
              todo.status === 'failed' ? 'bg-red-500' :
              todo.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'
            }`}
            style={{ width: `${todo.progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Time Information */}
      {showTimeEstimates && (
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
          <div>
            <span className="font-medium">Estimated:</span>
            <div>{formatDuration(todo.estimatedDurationMs)}</div>
          </div>
          {getElapsedTime() && (
            <div>
              <span className="font-medium">Elapsed:</span>
              <div>{formatDuration(getElapsedTime()!)}</div>
            </div>
          )}
        </div>
      )}

      {/* Dependencies */}
      {showDependencies && todo.dependencies.length > 0 && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">Dependencies:</span>
          <div className="mt-1">
            {todo.dependencies.map(depId => (
              <span key={depId} className="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded mr-1">
                {depId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {todo.status === 'failed' && todo.errorMessage && (
        <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-700">
          <span className="font-medium">Error:</span> {todo.errorMessage}
        </div>
      )}
    </div>
  );
};

export const SubtaskProgressTracker: React.FC<SubtaskProgressTrackerProps> = ({
  subtaskId,
  todoList,
  onTodoItemClick,
  showTimeEstimates = true,
  showDependencies = false,
  compactView = false,
  className = ''
}) => {
  const [selectedTodo, setSelectedTodo] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'order' | 'status' | 'progress'>('order');
  const [filterStatus, setFilterStatus] = useState<TodoItem['status'] | 'all'>('all');

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = todoList.todos.length;
    const completed = todoList.todos.filter(t => t.status === 'completed').length;
    const inProgress = todoList.todos.filter(t => t.status === 'in_progress').length;
    const failed = todoList.todos.filter(t => t.status === 'failed').length;
    const pending = todoList.todos.filter(t => t.status === 'pending').length;
    
    const overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const estimatedTimeRemaining = todoList.todos
      .filter(t => t.status === 'pending' || t.status === 'in_progress')
      .reduce((sum, todo) => {
        if (todo.status === 'in_progress' && todo.startTime) {
          const elapsed = Date.now() - todo.startTime;
          const remaining = Math.max(0, todo.estimatedDurationMs - elapsed);
          return sum + remaining;
        }
        return sum + todo.estimatedDurationMs;
      }, 0);

    return {
      total,
      completed,
      inProgress,
      failed,
      pending,
      overallProgress,
      estimatedTimeRemaining
    };
  }, [todoList.todos]);

  // Filter and sort todos
  const processedTodos = useMemo(() => {
    let filtered = todoList.todos;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(todo => todo.status === filterStatus);
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'status':
        sorted.sort((a, b) => {
          const statusOrder = { completed: 3, in_progress: 2, failed: 1, pending: 0, skipped: 0 };
          return statusOrder[b.status] - statusOrder[a.status];
        });
        break;
      case 'progress':
        sorted.sort((a, b) => b.progressPercentage - a.progressPercentage);
        break;
      case 'order':
      default:
        // Keep original order (already sorted)
        break;
    }

    return sorted;
  }, [todoList.todos, sortBy, filterStatus]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleTodoClick = (todo: TodoItem) => {
    setSelectedTodo(selectedTodo === todo.id ? null : todo.id);
    onTodoItemClick?.(todo);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Subtask Progress
          </h3>
          <p className="text-sm text-gray-600">
            {subtaskId} • {summary.completed}/{summary.total} completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{summary.overallProgress}%</div>
          {showTimeEstimates && (
            <div className="text-xs text-gray-500">
              ~{formatDuration(summary.estimatedTimeRemaining)} remaining
            </div>
          )}
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${summary.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-bold text-green-600">{summary.completed}</div>
          <div className="text-xs text-gray-600">Completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-blue-600">{summary.inProgress}</div>
          <div className="text-xs text-gray-600">In Progress</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-red-600">{summary.failed}</div>
          <div className="text-xs text-gray-600">Failed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-600">{summary.pending}</div>
          <div className="text-xs text-gray-600">Pending</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="order">Original Order</option>
            <option value="status">By Status</option>
            <option value="progress">By Progress</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Last updated: {new Date(todoList.lastUpdated).toLocaleTimeString()}
        </div>
      </div>

      {/* Todo Items */}
      <div className={`space-y-3 ${compactView ? 'space-y-2' : ''}`}>
        {processedTodos.length > 0 ? (
          processedTodos.map(todo => (
            <TodoItemCard
              key={todo.id}
              todo={todo}
              onClick={handleTodoClick}
              showTimeEstimates={showTimeEstimates}
              showDependencies={showDependencies}
              compact={compactView}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            {filterStatus === 'all' ? 'No todo items' : `No ${filterStatus} items`}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {todoList.actualDuration && (
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Estimated duration: {formatDuration(todoList.estimatedTotalDuration)}</span>
            <span>Actual duration: {formatDuration(todoList.actualDuration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};