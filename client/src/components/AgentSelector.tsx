import React, { useState, useEffect, useMemo } from 'react';
import { Agent, SubtaskType } from '../types';
import { AgentTag, UserAgent } from './AgentKeysManager';

interface AgentSelectorProps {
  agents: UserAgent[];
  taskType?: SubtaskType;
  requiredTags?: AgentTag[];
  onAgentSelect: (agent: UserAgent) => void;
  onFallbackConfig: (agentIds: string[]) => void;
  selectedAgentId?: string;
  className?: string;
}

interface AgentCardProps {
  agent: UserAgent;
  isSelected: boolean;
  isRecommended: boolean;
  taskType?: SubtaskType;
  onSelect: (agent: UserAgent) => void;
  showPerformanceMetrics?: boolean;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isSelected,
  isRecommended,
  taskType,
  onSelect,
  showPerformanceMetrics = true
}) => {
  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      openai: 'bg-green-100 text-green-800',
      anthropic: 'bg-blue-100 text-blue-800',
      google: 'bg-red-100 text-red-800',
      groq: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[provider] || colors.custom;
  };

  const getTagColor = (tag: AgentTag): string => {
    const colors: Record<AgentTag, string> = {
      'CREATION': 'bg-blue-100 text-blue-800',
      'RESEARCH': 'bg-green-100 text-green-800',
      'TTS': 'bg-purple-100 text-purple-800',
      'CODEGEN': 'bg-yellow-100 text-yellow-800',
      'IMAGE_GEN': 'bg-pink-100 text-pink-800',
      'ANALYSIS': 'bg-indigo-100 text-indigo-800',
      'TRANSLATION': 'bg-teal-100 text-teal-800'
    };
    return colors[tag] || 'bg-gray-100 text-gray-800';
  };

  const getAvailabilityStatus = () => {
    if (!agent.enabled) return { color: 'bg-gray-400', text: 'Disabled' };
    if (!agent.availability) return { color: 'bg-red-400', text: 'Busy' };
    if (!agent.apiKeyInfo?.isValid) return { color: 'bg-yellow-400', text: 'Key Invalid' };
    return { color: 'bg-green-400', text: 'Available' };
  };

  const availability = getAvailabilityStatus();

  return (
    <div
      onClick={() => onSelect(agent)}
      className={`relative p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : isRecommended
          ? 'border-green-300 bg-green-50 hover:border-green-400'
          : 'border-gray-200 bg-white hover:border-gray-300'
      } ${!agent.enabled || !agent.availability ? 'opacity-60' : ''}`}
    >
      {/* Recommended Badge */}
      {isRecommended && !isSelected && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
          Recommended
        </div>
      )}

      {/* Selected Badge */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
          Selected
        </div>
      )}

      {/* Agent Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{agent.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-1 text-xs rounded-full ${getProviderColor(agent.provider)}`}>
              {agent.provider}
            </span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${availability.color}`} />
              <span className="text-xs text-gray-500">{availability.text}</span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">${agent.costPerMinute.toFixed(3)}/min</div>
          <div className="text-xs text-gray-500">Used {agent.usageCount}x</div>
        </div>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {agent.tags.map(tag => (
            <span key={tag} className={`px-2 py-1 text-xs rounded-full ${getTagColor(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Performance Metrics */}
      {showPerformanceMetrics && (
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <div className="font-medium text-gray-900">{agent.performanceMetrics.successRate.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{agent.performanceMetrics.qualityScore}</div>
            <div className="text-xs text-gray-500">Quality Score</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">{agent.performanceMetrics.averageCompletionTime}m</div>
            <div className="text-xs text-gray-500">Avg Time</div>
          </div>
        </div>
      )}

      {/* Task Type Compatibility */}
      {taskType && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Capability for {taskType}</span>
            {agent.capabilities.some(cap => cap.category === taskType) ? (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600">Compatible</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-xs text-gray-500">General Use</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface FallbackConfigProps {
  agents: UserAgent[];
  selectedFallbacks: string[];
  onFallbacksChange: (agentIds: string[]) => void;
}

const FallbackConfig: React.FC<FallbackConfigProps> = ({
  agents,
  selectedFallbacks,
  onFallbacksChange
}) => {
  const availableAgents = agents.filter(a => a.enabled && a.availability);

  const handleToggleFallback = (agentId: string) => {
    if (selectedFallbacks.includes(agentId)) {
      onFallbacksChange(selectedFallbacks.filter(id => id !== agentId));
    } else {
      onFallbacksChange([...selectedFallbacks, agentId]);
    }
  };

  const moveFallback = (agentId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedFallbacks.indexOf(agentId);
    if (currentIndex === -1) return;

    const newFallbacks = [...selectedFallbacks];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < selectedFallbacks.length) {
      [newFallbacks[currentIndex], newFallbacks[newIndex]] = [newFallbacks[newIndex], newFallbacks[currentIndex]];
      onFallbacksChange(newFallbacks);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Fallback Configuration</h4>
        <p className="text-sm text-gray-600 mb-4">
          Select agents to use as fallbacks if the primary agent fails. Order matters - higher agents will be tried first.
        </p>
      </div>

      {/* Selected Fallbacks (Ordered) */}
      {selectedFallbacks.length > 0 && (
        <div>
          <h5 className="text-sm font-medium text-gray-700 mb-2">Fallback Order</h5>
          <div className="space-y-2">
            {selectedFallbacks.map((agentId, index) => {
              const agent = agents.find(a => a.id === agentId);
              if (!agent) return null;

              return (
                <div key={agentId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <div className="flex-1">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-sm text-gray-500 ml-2">({agent.provider})</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveFallback(agentId, 'up')}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveFallback(agentId, 'down')}
                      disabled={index === selectedFallbacks.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleToggleFallback(agentId)}
                      className="p-1 text-red-400 hover:text-red-600 ml-2"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Agents */}
      <div>
        <h5 className="text-sm font-medium text-gray-700 mb-2">Available Agents</h5>
        <div className="grid grid-cols-1 gap-2">
          {availableAgents
            .filter(agent => !selectedFallbacks.includes(agent.id))
            .map(agent => (
              <label key={agent.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFallbacks.includes(agent.id)}
                  onChange={() => handleToggleFallback(agent.id)}
                  className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <span className="font-medium">{agent.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({agent.provider} • {agent.performanceMetrics.successRate.toFixed(1)}% success)
                  </span>
                </div>
              </label>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  agents,
  taskType,
  requiredTags,
  onAgentSelect,
  onFallbackConfig,
  selectedAgentId,
  className = ''
}) => {
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<AgentTag[]>([]);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);
  const [showFallbackConfig, setShowFallbackConfig] = useState(false);
  const [fallbackAgents, setFallbackAgents] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'success' | 'cost' | 'usage' | 'recommended'>('recommended');

  // Get unique providers and tags
  const availableProviders = useMemo(() => {
    const providers = new Set(agents.map(a => a.provider));
    return Array.from(providers);
  }, [agents]);

  const availableTags = useMemo(() => {
    const tags = new Set<AgentTag>();
    agents.forEach(agent => agent.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [agents]);

  // Filter and sort agents
  const processedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      // Provider filter
      if (filterProvider !== 'all' && agent.provider !== filterProvider) return false;
      
      // Tag filter
      if (filterTags.length > 0 && !filterTags.some(tag => agent.tags.includes(tag))) return false;
      
      // Availability filter
      if (showOnlyAvailable && (!agent.enabled || !agent.availability)) return false;

      return true;
    });

    // Calculate recommendation scores
    const scoredAgents = filtered.map(agent => {
      let score = 0;
      
      // Base performance score
      score += agent.performanceMetrics.successRate * 0.4;
      score += agent.performanceMetrics.qualityScore * 0.3;
      
      // Task type compatibility
      if (taskType && agent.capabilities.some(cap => cap.category === taskType)) {
        score += 20;
      }
      
      // Required tags matching
      if (requiredTags) {
        const matchingTags = requiredTags.filter(tag => agent.tags.includes(tag));
        score += matchingTags.length * 10;
      }
      
      // Usage frequency (slight bonus for proven agents)
      score += Math.min(agent.usageCount * 0.1, 5);
      
      // Cost efficiency (lower cost = higher score)
      score += Math.max(0, 10 - agent.costPerMinute * 10);
      
      return { agent, score };
    });

    // Sort based on selected criteria
    scoredAgents.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.agent.name.localeCompare(b.agent.name);
        case 'success':
          return b.agent.performanceMetrics.successRate - a.agent.performanceMetrics.successRate;
        case 'cost':
          return a.agent.costPerMinute - b.agent.costPerMinute;
        case 'usage':
          return b.agent.usageCount - a.agent.usageCount;
        case 'recommended':
        default:
          return b.score - a.score;
      }
    });

    return scoredAgents;
  }, [agents, filterProvider, filterTags, showOnlyAvailable, taskType, requiredTags, sortBy]);

  const recommendedAgent = processedAgents.length > 0 ? processedAgents[0].agent : null;

  const handleFallbacksChange = (agentIds: string[]) => {
    setFallbackAgents(agentIds);
    onFallbackConfig(agentIds);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Select Agent</h3>
          {taskType && (
            <p className="text-sm text-gray-600">For {taskType.toLowerCase()} task</p>
          )}
        </div>
        <button
          onClick={() => setShowFallbackConfig(!showFallbackConfig)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          {showFallbackConfig ? 'Hide' : 'Configure'} Fallbacks
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        {/* Provider Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Providers</option>
            {availableProviders.map(provider => (
              <option key={provider} value={provider}>
                {provider.charAt(0).toUpperCase() + provider.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="recommended">Recommended</option>
            <option value="name">Name</option>
            <option value="success">Success Rate</option>
            <option value="cost">Cost</option>
            <option value="usage">Usage Count</option>
          </select>
        </div>

        {/* Availability Filter */}
        <div>
          <label className="flex items-center mt-6">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Available only</span>
          </label>
        </div>
      </div>

      {/* Fallback Configuration */}
      {showFallbackConfig && (
        <div className="p-4 border border-gray-200 rounded-lg bg-white">
          <FallbackConfig
            agents={agents}
            selectedFallbacks={fallbackAgents}
            onFallbacksChange={handleFallbacksChange}
          />
        </div>
      )}

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {processedAgents.length > 0 ? (
          processedAgents.map(({ agent, score }) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              isRecommended={agent.id === recommendedAgent?.id}
              taskType={taskType}
              onSelect={onAgentSelect}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500">
            No agents match the current filters
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedAgentId && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Selected Agent</h4>
              <p className="text-blue-700">
                {agents.find(a => a.id === selectedAgentId)?.name} 
                {fallbackAgents.length > 0 && (
                  <span className="text-blue-600"> (+ {fallbackAgents.length} fallback{fallbackAgents.length > 1 ? 's' : ''})</span>
                )}
              </p>
            </div>
            <div className="text-right text-blue-700">
              <div className="text-sm">Estimated cost</div>
              <div className="font-medium">
                ${(agents.find(a => a.id === selectedAgentId)?.costPerMinute || 0).toFixed(3)}/min
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};