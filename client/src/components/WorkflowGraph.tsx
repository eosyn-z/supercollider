import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Subtask, SubtaskType, Agent, ExecutionStatus } from '../types';
import { api } from '../services/api';

interface WorkflowGraphProps {
  subtasks: Subtask[];
  agents: Agent[];
  executionStatus: Record<string, ExecutionStatus>;
  onSubtaskUpdate: (subtaskId: string, updates: Partial<Subtask>) => void;
  onDependencyAdd: (fromId: string, toId: string) => void;
  onDependencyRemove: (fromId: string, toId: string) => void;
  isExecuting: boolean;
  className?: string;
}

// Custom Node Component
const SubtaskNode: React.FC<{
  data: {
    subtask: Subtask;
    agent?: Agent;
    status: ExecutionStatus;
    isExecuting: boolean;
  };
}> = ({ data }) => {
  const { subtask, agent, status, isExecuting } = data;
  const [microPrompts, setMicroPrompts] = useState<string[]>([]);
  const [showMicroPrompts, setShowMicroPrompts] = useState(false);
  const [loadingMicroPrompts, setLoadingMicroPrompts] = useState(false);

  const loadMicroPrompts = async () => {
    if (microPrompts.length > 0) {
      setShowMicroPrompts(!showMicroPrompts);
      return;
    }

    setLoadingMicroPrompts(true);
    try {
      // Try to get existing micro prompts first
      let result = await api.getMicroPrompts(subtask.id);
      
      // If no existing prompts, generate them
      if (!result || result.prompts.length === 0) {
        result = await api.generateMicroPrompts(subtask.id, subtask.description);
      }

      if (result && result.prompts.length > 0) {
        setMicroPrompts(result.prompts);
        setShowMicroPrompts(true);
      }
    } catch (error) {
      console.error('Failed to load micro prompts:', error);
    } finally {
      setLoadingMicroPrompts(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case ExecutionStatus.COMPLETED:
        return 'bg-green-500';
      case ExecutionStatus.RUNNING:
        return 'bg-blue-500 animate-pulse';
      case ExecutionStatus.FAILED:
        return 'bg-red-500';
      case ExecutionStatus.HALTED:
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getTypeColor = () => {
    switch (subtask.type) {
      case SubtaskType.RESEARCH:
        return 'border-blue-300 bg-blue-50 shadow-blue-100';
      case SubtaskType.ANALYSIS:
        return 'border-purple-300 bg-purple-50 shadow-purple-100';
      case SubtaskType.CREATION:
        return 'border-green-300 bg-green-50 shadow-green-100';
      case SubtaskType.VALIDATION:
        return 'border-orange-300 bg-orange-50 shadow-orange-100';
      default:
        return 'border-gray-300 bg-gray-50 shadow-gray-100';
    }
  };

  const getModelProvider = () => {
    if (agent) {
      switch (agent.provider) {
        case 'openai':
          return { name: 'GPT', color: 'bg-green-100 text-green-800', icon: '🤖' };
        case 'anthropic':
          return { name: 'Claude', color: 'bg-orange-100 text-orange-800', icon: '🧠' };
        case 'google':
          return { name: 'Gemini', color: 'bg-blue-100 text-blue-800', icon: '⭐' };
        case 'groq':
          return { name: 'Groq', color: 'bg-purple-100 text-purple-800', icon: '⚡' };
        default:
          return { name: 'Custom', color: 'bg-gray-100 text-gray-800', icon: '🔧' };
      }
    }
    return null;
  };

  const model = getModelProvider();

  return (
    <div className={`p-4 rounded-lg border-2 ${getTypeColor()} min-w-[220px] shadow-md hover:shadow-lg transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm truncate pr-2">{subtask.title}</h3>
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} title={status} />
      </div>
      
      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
        {subtask.description}
      </p>
      
      {/* Task Type and Priority Tags */}
      <div className="flex items-center justify-between text-xs mb-2">
        <span className={`px-2 py-1 rounded-full font-medium ${
          subtask.type === 'RESEARCH' ? 'bg-blue-200 text-blue-800' :
          subtask.type === 'ANALYSIS' ? 'bg-purple-200 text-purple-800' :
          subtask.type === 'CREATION' ? 'bg-green-200 text-green-800' :
          subtask.type === 'VALIDATION' ? 'bg-orange-200 text-orange-800' :
          'bg-gray-200 text-gray-800'
        }`}>
          {subtask.type}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          subtask.priority === 'HIGH' ? 'bg-red-200 text-red-800' :
          subtask.priority === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' :
          'bg-gray-200 text-gray-800'
        }`}>
          {subtask.priority}
        </span>
      </div>
      
      {/* Agent and Model Information */}
      {agent && model && (
        <div className="mt-2 p-2 bg-white bg-opacity-50 rounded border">
          <div className="text-xs text-gray-700 font-medium mb-1">
            {agent.name}
          </div>
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${model.color}`}>
            <span className="mr-1">{model.icon}</span>
            {model.name}
          </div>
        </div>
      )}
      
      {/* Estimated Duration */}
      {subtask.estimatedDuration && (
        <div className="mt-2 text-xs text-gray-500">
          ~{Math.round(subtask.estimatedDuration / 60)}m
        </div>
      )}
      
      {/* Progress Bar for Running Tasks */}
      {isExecuting && status === ExecutionStatus.RUNNING && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <div className="text-xs text-blue-600 mt-1">Processing...</div>
        </div>
      )}

      {/* Micro Prompts Button */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <button
          onClick={loadMicroPrompts}
          disabled={loadingMicroPrompts}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400 flex items-center"
        >
          {loadingMicroPrompts ? (
            <>
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
              Loading...
            </>
          ) : (
            <>
              <span className="mr-1">🔍</span>
              {microPrompts.length > 0 
                ? (showMicroPrompts ? 'Hide' : 'Show') + ' Micro Prompts' 
                : 'Load Micro Prompts'
              }
            </>
          )}
        </button>
      </div>

      {/* Micro Prompts Display */}
      {showMicroPrompts && microPrompts.length > 0 && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
          <div className="font-medium text-blue-800 mb-1">Micro Prompts:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {microPrompts.map((prompt, index) => (
              <div key={index} className="text-blue-700 text-xs leading-relaxed">
                {index + 1}. {prompt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  subtask: SubtaskNode,
};

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({
  subtasks,
  agents,
  executionStatus,
  onDependencyAdd,
  isExecuting,
  className = ''
}) => {
  // Convert subtasks to React Flow nodes with improved layout
  const nodes: Node[] = useMemo(() => {
    // Create a simple hierarchical layout based on dependencies
    const nodePositions = new Map<string, { x: number; y: number; level: number }>();
    const visited = new Set<string>();
    const levels: string[][] = [];

    // Helper function to calculate node levels based on dependencies
    const calculateLevel = (subtaskId: string, currentLevel: number = 0): number => {
      if (visited.has(subtaskId)) {
        return nodePositions.get(subtaskId)?.level || currentLevel;
      }

      visited.add(subtaskId);
      const subtask = subtasks.find(s => s.id === subtaskId);
      if (!subtask) return currentLevel;

      let maxDepLevel = currentLevel;
      subtask.dependencies.forEach(dep => {
        const depLevel = calculateLevel(dep.subtaskId, currentLevel + 1);
        maxDepLevel = Math.max(maxDepLevel, depLevel + 1);
      });

      nodePositions.set(subtaskId, {
        x: 0, // Will be calculated later
        y: maxDepLevel * 200,
        level: maxDepLevel
      });

      if (!levels[maxDepLevel]) levels[maxDepLevel] = [];
      levels[maxDepLevel].push(subtaskId);

      return maxDepLevel;
    };

    // Calculate levels for all subtasks
    subtasks.forEach(subtask => calculateLevel(subtask.id));

    // Position nodes within their levels
    levels.forEach((levelNodes, level) => {
      levelNodes.forEach((nodeId, index) => {
        const totalNodesInLevel = levelNodes.length;
        const spacing = 280; // Horizontal spacing between nodes
        const startX = -(totalNodesInLevel - 1) * spacing / 2;
        
        const position = nodePositions.get(nodeId);
        if (position) {
          position.x = startX + index * spacing;
        }
      });
    });

    return subtasks.map((subtask, index) => {
      const agent = agents.find(a => a.id === subtask.assignedAgentId);
      const status = executionStatus[subtask.id] || ExecutionStatus.PENDING;
      const position = nodePositions.get(subtask.id) || { x: index * 250, y: index * 150 };
      
      return {
        id: subtask.id,
        type: 'subtask',
        position: { x: position.x, y: position.y },
        data: {
          subtask,
          agent,
          status,
          isExecuting
        }
      };
    });
  }, [subtasks, agents, executionStatus, isExecuting]);

  // Convert dependencies to React Flow edges
  const edges: Edge[] = useMemo(() => {
    const edgeList: Edge[] = [];
    
    subtasks.forEach(subtask => {
      subtask.dependencies.forEach(dependency => {
        const dependencyType = dependency.type;
        const getEdgeStyle = () => {
          switch (dependencyType) {
            case 'BLOCKING':
              return {
                stroke: '#dc2626', // red-600
                strokeWidth: 3,
                strokeDasharray: undefined,
              };
            case 'SOFT':
              return {
                stroke: '#f59e0b', // amber-500
                strokeWidth: 2,
                strokeDasharray: '5,5',
              };
            case 'REFERENCE':
              return {
                stroke: '#6b7280', // gray-500
                strokeWidth: 1,
                strokeDasharray: '2,2',
              };
            default:
              return {
                stroke: '#6b7280',
                strokeWidth: 2,
              };
          }
        };

        const getArrowColor = () => {
          switch (dependencyType) {
            case 'BLOCKING':
              return '#dc2626';
            case 'SOFT':
              return '#f59e0b';
            case 'REFERENCE':
              return '#6b7280';
            default:
              return '#6b7280';
          }
        };

        edgeList.push({
          id: `${dependency.subtaskId}-${subtask.id}`,
          source: dependency.subtaskId,
          target: subtask.id,
          type: 'smoothstep',
          style: getEdgeStyle(),
          markerEnd: {
            type: 'arrowclosed',
            color: getArrowColor(),
            width: 20,
            height: 20,
          },
          label: dependency.description || `${dependency.type} dependency`,
          labelStyle: { 
            fontSize: '10px',
            backgroundColor: '#ffffff',
            padding: '2px 4px',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
          },
          labelBgPadding: [8, 4],
          labelBgBorderRadius: 4,
          labelBgStyle: {
            fill: '#ffffff',
            fillOpacity: 0.9,
          }
        });
      });
    });
    
    return edgeList;
  }, [subtasks]);

  const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        onDependencyAdd(params.source, params.target);
      }
    },
    [onDependencyAdd]
  );

  // Update nodes when data changes
  React.useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  // Update edges when data changes
  React.useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  return (
    <div className={`w-full h-full ${className}`}>
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};