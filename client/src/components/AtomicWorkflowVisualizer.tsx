/**
 * Atomic Workflow Visualizer Component
 * Displays atomic workflows with interactive graph visualization
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  AtomicWorkflow, 
  AtomicTask, 
  ExecutionGraph, 
  ExecutionNode,
  ExecutionEdge
} from '../../../shared/types/atomicWorkflow';

interface AtomicWorkflowVisualizerProps {
  workflow: AtomicWorkflow;
  executionState: ExecutionState;
  onTaskClick: (taskId: string) => void;
  onWorkflowModify: (modifications: WorkflowModification[]) => void;
  className?: string;
  showMetrics?: boolean;
  interactive?: boolean;
}

interface ExecutionState {
  currentTask?: string;
  completedTasks: string[];
  failedTasks: string[];
  taskProgress: Record<string, number>;
  overallProgress: number;
  startTime?: number;
  estimatedEndTime?: number;
}

interface WorkflowModification {
  type: 'add_task' | 'remove_task' | 'modify_task' | 'reorder_tasks';
  taskId?: string;
  data?: any;
}

const AtomicWorkflowVisualizer: React.FC<AtomicWorkflowVisualizerProps> = ({
  workflow,
  executionState,
  onTaskClick,
  onWorkflowModify,
  className = '',
  showMetrics = true,
  interactive = true
}) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline' | 'list'>('graph');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTask(taskId);
    onTaskClick(taskId);
  }, [onTaskClick]);

  const getTaskStatus = useCallback((taskId: string): 'pending' | 'running' | 'completed' | 'failed' => {
    if (executionState.failedTasks.includes(taskId)) return 'failed';
    if (executionState.completedTasks.includes(taskId)) return 'completed';
    if (executionState.currentTask === taskId) return 'running';
    return 'pending';
  }, [executionState]);

  const getCurrentBatch = useCallback((): number => {
    const { parallelBatches } = workflow.executionGraph;
    
    for (let i = 0; i < parallelBatches.length; i++) {
      const batch = parallelBatches[i];
      const allCompleted = batch.every(taskId => 
        executionState.completedTasks.includes(taskId)
      );
      
      if (!allCompleted) {
        return i;
      }
    }
    
    return parallelBatches.length;
  }, [workflow.executionGraph, executionState]);

  const workflowMetrics = useMemo(() => {
    const totalTasks = workflow.atomicTasks.length;
    const completedTasks = executionState.completedTasks.length;
    const failedTasks = executionState.failedTasks.length;
    const remainingTasks = totalTasks - completedTasks - failedTasks;
    
    const estimatedDuration = workflow.estimatedDuration;
    const elapsedTime = executionState.startTime ? Date.now() - executionState.startTime : 0;
    const progressRatio = completedTasks / totalTasks;
    const estimatedRemainingTime = progressRatio > 0 ? 
      (elapsedTime / progressRatio) - elapsedTime : estimatedDuration;

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      remainingTasks,
      progressPercentage: Math.round((completedTasks / totalTasks) * 100),
      elapsedTime,
      estimatedRemainingTime,
      estimatedDuration
    };
  }, [workflow, executionState]);

  return (
    <div className={`atomic-workflow-visualizer ${className}`}>
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {workflow.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {workflow.description}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['graph', 'timeline', 'list'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            
            {/* Zoom Controls */}
            {viewMode === 'graph' && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-xs text-gray-600 min-w-[3rem] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(2, prev + 0.1))}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics */}
        {showMetrics && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Progress</p>
              <p className="text-lg font-semibold text-gray-900">
                {workflowMetrics.progressPercentage}%
              </p>
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${workflowMetrics.progressPercentage}%` }}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Tasks</p>
              <p className="text-lg font-semibold text-gray-900">
                {workflowMetrics.completedTasks}/{workflowMetrics.totalTasks}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {workflowMetrics.failedTasks > 0 && `${workflowMetrics.failedTasks} failed`}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Elapsed</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDuration(workflowMetrics.elapsedTime)}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">Remaining</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDuration(workflowMetrics.estimatedRemainingTime)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'graph' && (
          <WorkflowGraph
            workflow={workflow}
            executionState={executionState}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
            zoomLevel={zoomLevel}
            panOffset={panOffset}
            onPanChange={setPanOffset}
          />
        )}

        {viewMode === 'timeline' && (
          <WorkflowTimeline
            workflow={workflow}
            executionState={executionState}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
          />
        )}

        {viewMode === 'list' && (
          <WorkflowList
            workflow={workflow}
            executionState={executionState}
            onTaskClick={handleTaskClick}
            selectedTask={selectedTask}
          />
        )}
      </div>

      {/* Parallel Batch Indicator */}
      <ParallelBatchIndicator
        batches={workflow.executionGraph.parallelBatches}
        currentBatch={getCurrentBatch()}
        executionState={executionState}
      />

      {/* Critical Path Highlight */}
      <CriticalPathHighlight
        criticalPath={workflow.executionGraph.criticalPath}
        executionState={executionState}
      />

      {/* Task Detail Panel */}
      {selectedTask && (
        <TaskDetailPanel
          task={workflow.atomicTasks.find(t => t.id === selectedTask)!}
          status={getTaskStatus(selectedTask)}
          progress={executionState.taskProgress[selectedTask] || 0}
          onClose={() => setSelectedTask(null)}
          onModify={(modifications) => onWorkflowModify(modifications)}
          interactive={interactive}
        />
      )}
    </div>
  );
};

// Sub-components

interface WorkflowGraphProps {
  workflow: AtomicWorkflow;
  executionState: ExecutionState;
  onTaskClick: (taskId: string) => void;
  selectedTask: string | null;
  zoomLevel: number;
  panOffset: { x: number; y: number };
  onPanChange: (offset: { x: number; y: number }) => void;
}

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  workflow,
  executionState,
  onTaskClick,
  selectedTask,
  zoomLevel,
  panOffset,
  onPanChange
}) => {
  const svgRef = React.useRef<SVGSVGElement>(null);

  const getTaskColor = (taskId: string) => {
    if (executionState.failedTasks.includes(taskId)) return '#EF4444';
    if (executionState.completedTasks.includes(taskId)) return '#10B981';
    if (executionState.currentTask === taskId) return '#F59E0B';
    return '#6B7280';
  };

  const getTaskPosition = (task: AtomicTask, index: number) => {
    // Simple grid layout - in production would use force-directed layout
    const cols = Math.ceil(Math.sqrt(workflow.atomicTasks.length));
    const x = (index % cols) * 200 + 100;
    const y = Math.floor(index / cols) * 150 + 100;
    return { x, y };
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-50">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="cursor-move"
        style={{ transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)` }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
          </marker>
        </defs>

        {/* Edges */}
        {workflow.executionGraph.edges.map((edge: any, index) => {
          const sourceTask = workflow.atomicTasks.find(t => t.id === edge.sourceTaskId);
          const targetTask = workflow.atomicTasks.find(t => t.id === edge.targetTaskId);
          
          if (!sourceTask || !targetTask) return null;

          const sourcePos = getTaskPosition(sourceTask, workflow.atomicTasks.indexOf(sourceTask));
          const targetPos = getTaskPosition(targetTask, workflow.atomicTasks.indexOf(targetTask));

          return (
            <line
              key={edge.id || index}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke="#6B7280"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
              className="transition-opacity duration-200"
            />
          );
        })}

        {/* Nodes */}
        {workflow.atomicTasks.map((task, index) => {
          const position = getTaskPosition(task, index);
          const isSelected = selectedTask === task.id;
          const color = getTaskColor(task.id);

          return (
            <g
              key={task.id}
              transform={`translate(${position.x - 60}, ${position.y - 30})`}
              onClick={() => onTaskClick(task.id)}
              className="cursor-pointer"
            >
              {/* Task Node */}
              <rect
                width="120"
                height="60"
                rx="8"
                fill={color}
                stroke={isSelected ? '#3B82F6' : 'transparent'}
                strokeWidth={isSelected ? '3' : '0'}
                className="transition-all duration-200 hover:brightness-110"
              />

              {/* Task Name */}
              <text
                x="60"
                y="25"
                textAnchor="middle"
                className="fill-white text-sm font-medium pointer-events-none"
              >
                {task.name.length > 15 ? `${task.name.substring(0, 15)}...` : task.name}
              </text>

              {/* Task Type */}
              <text
                x="60"
                y="40"
                textAnchor="middle"
                className="fill-white text-xs opacity-80 pointer-events-none"
              >
                {task.type}
              </text>

              {/* Progress Indicator */}
              {executionState.taskProgress[task.id] && (
                <rect
                  x="5"
                  y="50"
                  width={`${(executionState.taskProgress[task.id] / 100) * 110}`}
                  height="3"
                  fill="white"
                  fillOpacity="0.8"
                  rx="1.5"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3">
        <h4 className="text-xs font-medium text-gray-900 mb-2">Status</h4>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-gray-500"></div>
            <span className="text-xs text-gray-600">Pending</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-xs text-gray-600">Running</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-xs text-gray-600">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-xs text-gray-600">Failed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WorkflowTimelineProps {
  workflow: AtomicWorkflow;
  executionState: ExecutionState;
  onTaskClick: (taskId: string) => void;  
  selectedTask: string | null;
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  workflow,
  executionState,
  onTaskClick,
  selectedTask
}) => {
  // Calculate timeline positions based on execution order
  const timelineData = workflow.executionGraph.executionOrder.map((taskId, index) => {
    const task = workflow.atomicTasks.find(t => t.id === taskId)!;
    const startTime = index * (task.estimatedDuration + 1000); // Add 1s buffer
    const endTime = startTime + task.estimatedDuration;
    
    return {
      task,
      startTime,
      endTime,
      position: (startTime / workflow.estimatedDuration) * 100,
      width: (task.estimatedDuration / workflow.estimatedDuration) * 100
    };
  });

  const getStatusColor = (taskId: string) => {
    if (executionState.failedTasks.includes(taskId)) return 'bg-red-500';
    if (executionState.completedTasks.includes(taskId)) return 'bg-green-500';
    if (executionState.currentTask === taskId) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="p-6 bg-white">
      <div className="space-y-4">
        {timelineData.map(({ task, position, width }) => (
          <div
            key={task.id}
            className={`relative cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
              selectedTask === task.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onTaskClick(task.id)}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="text-sm font-medium text-gray-900">{task.name}</h4>
                <p className="text-xs text-gray-600">{task.type}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">
                  {formatDuration(task.estimatedDuration)}
                </p>
              </div>
            </div>
            
            {/* Timeline Bar */}
            <div className="mt-2 bg-gray-200 rounded-full h-2 relative">
              <div
                className={`absolute h-2 rounded-full ${getStatusColor(task.id)}`}
                style={{ width: `${width}%`, left: `${position}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface WorkflowListProps {
  workflow: AtomicWorkflow;
  executionState: ExecutionState;
  onTaskClick: (taskId: string) => void;
  selectedTask: string | null;
}

const WorkflowList: React.FC<WorkflowListProps> = ({
  workflow,
  executionState,
  onTaskClick,
  selectedTask
}) => {
  const getStatusIcon = (taskId: string) => {
    if (executionState.failedTasks.includes(taskId)) {
      return (
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      );
    }
    
    if (executionState.completedTasks.includes(taskId)) {
      return (
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    
    if (executionState.currentTask === taskId) {
      return (
        <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
        </div>
      );
    }
    
    return (
      <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gray-500"></div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-white">
      <div className="space-y-3">
        {workflow.atomicTasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center space-x-4 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              selectedTask === task.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onTaskClick(task.id)}
          >
            {getStatusIcon(task.id)}
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {task.name}
              </h4>
              <p className="text-xs text-gray-600 mt-1">
                {task.description}
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <span className="text-xs text-gray-500">
                  Type: {task.type}
                </span>
                <span className="text-xs text-gray-500">
                  Complexity: {task.complexity}
                </span>
                <span className="text-xs text-gray-500">
                  Duration: {formatDuration(task.estimatedDuration)}
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            {executionState.taskProgress[task.id] && (
              <div className="w-20">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${executionState.taskProgress[task.id]}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center mt-1">
                  {executionState.taskProgress[task.id]}%
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Additional sub-components would be implemented here...

const ParallelBatchIndicator: React.FC<{
  batches: string[][];
  currentBatch: number;
  executionState: ExecutionState;
}> = ({ batches, currentBatch, executionState }) => {
  if (batches.length === 0) return null;

  return (
    <div className="bg-white border-t p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">Parallel Execution Batches</h4>
      <div className="flex space-x-2 overflow-x-auto">
        {batches.map((batch, index) => (
          <div
            key={index}
            className={`flex-shrink-0 px-3 py-2 rounded-lg border ${
              index === currentBatch 
                ? 'border-blue-500 bg-blue-50' 
                : index < currentBatch
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <p className="text-xs font-medium">Batch {index + 1}</p>
            <p className="text-xs text-gray-600">
              {batch.length} tasks
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const CriticalPathHighlight: React.FC<{
  criticalPath: string[];
  executionState: ExecutionState;
}> = ({ criticalPath, executionState }) => {
  if (criticalPath.length === 0) return null;

  const completedInPath = criticalPath.filter(taskId => 
    executionState.completedTasks.includes(taskId)
  ).length;
  
  const progress = (completedInPath / criticalPath.length) * 100;

  return (
    <div className="bg-orange-50 border-t border-orange-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-orange-900">Critical Path</h4>
          <p className="text-xs text-orange-700">
            {criticalPath.length} tasks determine overall completion time
          </p>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-orange-900">
            {Math.round(progress)}% Complete
          </p>
          <div className="w-24 bg-orange-200 rounded-full h-2 mt-1">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface TaskDetailPanelProps {
  task: AtomicTask;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  onClose: () => void;
  onModify: (modifications: WorkflowModification[]) => void;
  interactive: boolean;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  status,
  progress,
  onClose,
  onModify,
  interactive
}) => {
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l z-50">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Task Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 space-y-4 overflow-y-auto">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{task.name}</h4>
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-600">Type</p>
            <p className="text-sm font-medium">{task.type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Complexity</p>
            <p className="text-sm font-medium">{task.complexity}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Duration</p>
            <p className="text-sm font-medium">{formatDuration(task.estimatedDuration)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Status</p>
            <p className={`text-sm font-medium ${
              status === 'completed' ? 'text-green-600' :
              status === 'running' ? 'text-yellow-600' :
              status === 'failed' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </p>
          </div>
        </div>
        
        {progress > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Inputs */}
        {task.inputs.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-2">Inputs</h5>
            <div className="space-y-2">
              {task.inputs.map((input) => (
                <div key={input.id} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium">{input.name}</p>
                  <p className="text-xs text-gray-600">{input.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {input.dataType} • {input.required ? 'Required' : 'Optional'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Outputs */}
        {task.outputs.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-2">Outputs</h5>
            <div className="space-y-2">
              {task.outputs.map((output) => (
                <div key={output.id} className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium">{output.name}</p>
                  <p className="text-xs text-gray-600">{output.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {output.dataType} • Format: {output.format}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-2">Dependencies</h5>
            <div className="space-y-1">
              {task.dependencies.map((depId) => (
                <div key={depId} className="text-sm text-gray-600">
                  • {depId}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Required Capabilities */}
        {task.requiredCapabilities.length > 0 && (
          <div>
            <h5 className="text-sm font-medium text-gray-900 mb-2">Required Capabilities</h5>
            <div className="flex flex-wrap gap-1">
              {task.requiredCapabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Utility functions
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

export default AtomicWorkflowVisualizer;