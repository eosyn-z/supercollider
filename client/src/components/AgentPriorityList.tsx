import React from 'react';
import { SubtaskType, Agent } from '../types';

interface AgentPriorityListProps {
  subtaskType: SubtaskType;
  agents: Agent[];
  priorityOrder: string[];
  onPriorityChange: (subtaskType: SubtaskType, newOrder: string[]) => void;
}

export const AgentPriorityList: React.FC<AgentPriorityListProps> = ({
  subtaskType,
  agents,
  priorityOrder,
  onPriorityChange
}) => {
  const handleDragStart = (e: React.DragEvent, agentId: string) => {
    e.dataTransfer.setData('text/plain', agentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedAgentId = e.dataTransfer.getData('text/plain');
    const newOrder = [...priorityOrder];
    
    // Remove from current position
    const currentIndex = newOrder.indexOf(draggedAgentId);
    if (currentIndex > -1) {
      newOrder.splice(currentIndex, 1);
    }
    
    // Insert at new position
    newOrder.splice(targetIndex, 0, draggedAgentId);
    
    onPriorityChange(subtaskType, newOrder);
  };

  const getAgentById = (agentId: string) => {
    return agents.find(agent => agent.id === agentId);
  };

  const getCapabilityScore = (agent: Agent, type: SubtaskType) => {
    const capability = agent.capabilities.find(cap => cap.category === type);
    if (!capability) return 0;
    
    switch (capability.proficiency) {
      case 'EXPERT': return 4;
      case 'ADVANCED': return 3;
      case 'INTERMEDIATE': return 2;
      case 'BEGINNER': return 1;
      default: return 0;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-lg font-semibold mb-4 capitalize">{subtaskType} Agents</h3>
      
      <div className="space-y-2">
        {priorityOrder.map((agentId, index) => {
          const agent = getAgentById(agentId);
          if (!agent) return null;
          
          const capabilityScore = getCapabilityScore(agent, subtaskType);
          
          return (
            <div
              key={agentId}
              draggable
              onDragStart={(e) => handleDragStart(e, agentId)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="text-sm font-medium text-gray-500">#{index + 1}</div>
                <div>
                  <div className="font-medium text-sm">{agent.name}</div>
                  <div className="text-xs text-gray-500">
                    Score: {capabilityScore}/4 • {agent.availability ? 'Available' : 'Unavailable'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  agent.availability ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div className="text-xs text-gray-500">
                  {agent.performanceMetrics.qualityScore}/100
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {priorityOrder.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No agents assigned</p>
          <p className="text-xs mt-1">Drag agents here to set priority</p>
        </div>
      )}
    </div>
  );
};