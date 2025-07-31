import React, { useState, useEffect } from 'react';
import { Agent, CapabilityCategory, ProficiencyLevel } from '../../../core/types/agentRegistry';
import { Subtask, SubtaskType, Priority } from '../types';

interface AgentAssignment {
  subtaskId: string;
  agentId: string;
  priority: number;
  estimatedDuration: number;
  confidence: number;
}

interface AgentAssignmentPanelProps {
  workflow: any;
  agents: Agent[];
  apiKeys: any[];
  onAssignmentChange: (assignments: AgentAssignment[]) => void;
  className?: string;
}

export const AgentAssignmentPanel: React.FC<AgentAssignmentPanelProps> = ({
  workflow,
  agents,
  apiKeys,
  onAssignmentChange,
  className = ''
}) => {
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [selectedSubtask, setSelectedSubtask] = useState<string | null>(null);
  const [autoAssign, setAutoAssign] = useState(true);

  // Initialize assignments when workflow changes
  useEffect(() => {
    if (workflow?.subtasks) {
      const initialAssignments = workflow.subtasks.map((subtask: Subtask) => ({
        subtaskId: subtask.id,
        agentId: subtask.assignedAgentId || '',
        priority: 1,
        estimatedDuration: subtask.estimatedDuration || 30000,
        confidence: 0.8
      }));
      setAssignments(initialAssignments);
    }
  }, [workflow]);

  // Auto-assign agents based on capabilities
  useEffect(() => {
    if (autoAssign && workflow?.subtasks) {
      const autoAssignments = workflow.subtasks.map((subtask: Subtask) => {
        const bestAgent = findBestAgentForTask(subtask, agents);
        return {
          subtaskId: subtask.id,
          agentId: bestAgent?.id || '',
          priority: 1,
          estimatedDuration: subtask.estimatedDuration || 30000,
          confidence: bestAgent ? 0.9 : 0.5
        };
      });
      setAssignments(autoAssignments);
      onAssignmentChange(autoAssignments);
    }
  }, [autoAssign, workflow, agents]);

  const findBestAgentForTask = (subtask: Subtask, availableAgents: Agent[]): Agent | null => {
    if (!availableAgents.length) return null;

    // Score agents based on capability match
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;
      
      // Check capability match
      agent.capabilities.forEach(capability => {
        if (capability.category.toLowerCase().includes(subtask.type.toLowerCase())) {
          score += capability.proficiencyLevel * 10;
        }
      });

      // Check availability
      if (agent.availability) score += 5;
      
      // Check performance metrics
      score += agent.performanceMetrics.successRate * 10;
      
      return { agent, score };
    });

    // Return the agent with highest score
    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0]?.agent || null;
  };

  const handleAssignmentChange = (subtaskId: string, agentId: string) => {
    const updatedAssignments = assignments.map(assignment => 
      assignment.subtaskId === subtaskId 
        ? { ...assignment, agentId, confidence: 0.7 }
        : assignment
    );
    setAssignments(updatedAssignments);
    onAssignmentChange(updatedAssignments);
  };

  const handlePriorityChange = (subtaskId: string, priority: number) => {
    const updatedAssignments = assignments.map(assignment => 
      assignment.subtaskId === subtaskId 
        ? { ...assignment, priority }
        : assignment
    );
    setAssignments(updatedAssignments);
    onAssignmentChange(updatedAssignments);
  };

  const getAgentForSubtask = (subtaskId: string) => {
    const assignment = assignments.find(a => a.subtaskId === subtaskId);
    return agents.find(a => a.id === assignment?.agentId);
  };

  const getApiKeyForAgent = (agentId: string) => {
    return apiKeys.find(key => key.agentId === agentId && key.isActive);
  };

  const calculateAssignmentScore = (subtask: Subtask, agent: Agent) => {
    let score = 0;
    
    // Capability match
    agent.capabilities.forEach(capability => {
      if (capability.category.toLowerCase().includes(subtask.type.toLowerCase())) {
        score += capability.proficiencyLevel * 10;
      }
    });

    // Availability
    if (agent.availability) score += 5;
    
    // Performance
    score += agent.performanceMetrics.successRate * 10;
    
    // API key availability
    const hasApiKey = apiKeys.some(key => key.agentId === agent.id && key.isActive);
    if (hasApiKey) score += 10;
    
    return score;
  };

  const getSubtaskTypeColor = (type: SubtaskType) => {
    const colors: Record<string, string> = {
      RESEARCH: 'bg-blue-100 text-blue-800',
      ANALYSIS: 'bg-purple-100 text-purple-800',
      CREATION: 'bg-green-100 text-green-800',
      VALIDATION: 'bg-yellow-100 text-yellow-800',
      EDITING: 'bg-orange-100 text-orange-800',
      GENERATION: 'bg-indigo-100 text-indigo-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (!workflow?.subtasks) {
    return (
      <div className={`agent-assignment-panel ${className}`}>
        <div className="text-center py-8 text-gray-500">
          <p>No workflow loaded</p>
          <p className="text-sm">Load a workflow to assign agents to tasks</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`agent-assignment-panel ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Agent Assignment</h2>
        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoAssign}
              onChange={(e) => setAutoAssign(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Auto-assign</span>
          </label>
        </div>
      </div>

      {/* Assignment Overview */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-3">Assignment Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Tasks:</span>
            <span className="ml-2 font-medium">{workflow.subtasks.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Assigned:</span>
            <span className="ml-2 font-medium">
              {assignments.filter(a => a.agentId).length}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Available Agents:</span>
            <span className="ml-2 font-medium">
              {agents.filter(a => a.availability).length}
            </span>
          </div>
        </div>
      </div>

      {/* Task Assignment List */}
      <div className="space-y-4">
        {workflow.subtasks.map((subtask: Subtask) => {
          const assignedAgent = getAgentForSubtask(subtask.id);
          const apiKey = assignedAgent ? getApiKeyForAgent(assignedAgent.id) : null;
          
          return (
            <div
              key={subtask.id}
              className={`p-4 border rounded-lg ${
                selectedSubtask === subtask.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-medium text-gray-900">{subtask.title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${getSubtaskTypeColor(subtask.type)}`}>
                      {subtask.type}
                    </span>
                                         <span className={`px-2 py-1 text-xs rounded-full ${
                       subtask.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                       subtask.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                       'bg-green-100 text-green-800'
                     }`}>
                       {subtask.priority}
                     </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{subtask.description}</p>
                  
                  {/* Agent Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Assign Agent:
                    </label>
                    <select
                      value={assignedAgent?.id || ''}
                      onChange={(e) => handleAssignmentChange(subtask.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an agent...</option>
                      {agents.map(agent => {
                        const score = calculateAssignmentScore(subtask, agent);
                        const hasApiKey = apiKeys.some(key => key.agentId === agent.id && key.isActive);
                        return (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} (Score: {score}, API: {hasApiKey ? '✓' : '✗'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Assignment Details */}
                  {assignedAgent && (
                    <div className="mt-3 p-3 bg-gray-50 rounded border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{assignedAgent.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          apiKey ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {apiKey ? 'API Key Available' : 'No API Key'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Capabilities:</span>
                          <span className="ml-1 font-medium">
                            {assignedAgent.capabilities.map(c => c.category).join(', ')}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Success Rate:</span>
                          <span className="ml-1 font-medium">
                            {(assignedAgent.performanceMetrics.successRate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Avg Response Time:</span>
                          <span className="ml-1 font-medium">
                            {assignedAgent.performanceMetrics.averageResponseTime}ms
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Cost per Minute:</span>
                          <span className="ml-1 font-medium">
                            ${assignedAgent.costPerMinute || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => setSelectedSubtask(selectedSubtask === subtask.id ? null : subtask.id)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    {selectedSubtask === subtask.id ? 'Hide Details' : 'Show Details'}
                  </button>
                  
                  <select
                    value={assignments.find(a => a.subtaskId === subtask.id)?.priority || 1}
                    onChange={(e) => handlePriorityChange(subtask.id, parseInt(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value={1}>Priority 1</option>
                    <option value={2}>Priority 2</option>
                    <option value={3}>Priority 3</option>
                  </select>
                </div>
              </div>

              {/* Detailed View */}
              {selectedSubtask === subtask.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h5 className="font-medium text-gray-900 mb-2">Agent Recommendations</h5>
                  <div className="space-y-2">
                    {agents
                      .map(agent => ({
                        agent,
                        score: calculateAssignmentScore(subtask, agent)
                      }))
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 3)
                      .map(({ agent, score }) => (
                        <div key={agent.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div>
                            <span className="font-medium">{agent.name}</span>
                            <span className="ml-2 text-sm text-gray-600">
                              Score: {score}
                            </span>
                          </div>
                          <button
                            onClick={() => handleAssignmentChange(subtask.id, agent.id)}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Assign
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assignment Actions */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => {
            const autoAssignments = workflow.subtasks.map((subtask: Subtask) => {
              const bestAgent = findBestAgentForTask(subtask, agents);
              return {
                subtaskId: subtask.id,
                agentId: bestAgent?.id || '',
                priority: 1,
                estimatedDuration: subtask.estimatedDuration || 30000,
                confidence: bestAgent ? 0.9 : 0.5
              };
            });
            setAssignments(autoAssignments);
            onAssignmentChange(autoAssignments);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Auto-Assign All
        </button>
        
        <button
          onClick={() => {
            const clearedAssignments = assignments.map(a => ({ ...a, agentId: '' }));
            setAssignments(clearedAssignments);
            onAssignmentChange(clearedAssignments);
          }}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Clear All Assignments
        </button>
      </div>
    </div>
  );
}; 