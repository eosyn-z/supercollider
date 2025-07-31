import React, { useState, useCallback, useEffect } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Agent, ApiKeyInfo, AgentPreferences, SubtaskType, ApiKeyValidationResult } from '../types';

export type AgentTag = 'CREATION' | 'RESEARCH' | 'TTS' | 'CODEGEN' | 'IMAGE_GEN' | 'ANALYSIS' | 'TRANSLATION';

export interface UserAgent extends Agent {
  tags: AgentTag[];
  enabled: boolean;
  lastUsed?: Date;
  usageCount: number;
}

interface AgentKeysManagerProps {
  agents: UserAgent[];
  onAgentUpdate: (agent: UserAgent) => void;
  onAgentDelete: (agentId: string) => void;
  onBulkImport: (agents: UserAgent[]) => void;
  className?: string;
}

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: (key: string) => Promise<ApiKeyValidationResult>;
  placeholder: string;
  provider?: string;
  isValidating?: boolean;
  validationResult?: ApiKeyValidationResult;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  value,
  onChange,
  onValidate,
  placeholder,
  provider,
  isValidating = false,
  validationResult
}) => {
  const [showKey, setShowKey] = useState(false);

  const handleValidate = async () => {
    if (value.trim()) {
      await onValidate(value.trim());
    }
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
    if (validationResult?.isValid) {
      return <span className="text-green-500">✓</span>;
    }
    if (validationResult && !validationResult.isValid) {
      return <span className="text-red-500">✗</span>;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showKey ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleValidate}
          disabled={!value.trim() || isValidating}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Validate
        </button>
        <div className="flex items-center justify-center w-8">
          {getValidationIcon()}
        </div>
      </div>
      
      {validationResult && (
        <div className={`text-sm p-2 rounded ${validationResult.isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {validationResult.isValid ? (
            <div>
              <div>✓ API key validated successfully</div>
              {validationResult.provider && <div>Provider: {validationResult.provider}</div>}
              {validationResult.model && <div>Model: {validationResult.model}</div>}
              {validationResult.rateLimits && (
                <div>Rate Limits: {validationResult.rateLimits.requestsPerMinute} req/min, {validationResult.rateLimits.tokensPerMinute} tokens/min</div>
              )}
            </div>
          ) : (
            <div>✗ {validationResult.error || 'API key validation failed'}</div>
          )}
        </div>
      )}
    </div>
  );
};

interface TagSelectorProps {
  selectedTags: AgentTag[];
  onTagsChange: (tags: AgentTag[]) => void;
  availableTags: AgentTag[];
}

const TagSelector: React.FC<TagSelectorProps> = ({ selectedTags, onTagsChange, availableTags }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleTag = (tag: AgentTag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <div className="flex flex-wrap gap-1">
          {selectedTags.length === 0 ? (
            <span className="text-gray-500">Select tags...</span>
          ) : (
            selectedTags.map(tag => (
              <span key={tag} className={`px-2 py-1 text-xs rounded-full ${getTagColor(tag)}`}>
                {tag}
              </span>
            ))
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2 space-y-1">
            {availableTags.map(tag => (
              <label key={tag} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(tag)}
                  onChange={() => toggleTag(tag)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={`px-2 py-1 text-xs rounded-full ${getTagColor(tag)}`}>
                  {tag}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface SortableAgentItemProps {
  agent: UserAgent;
  subtaskType: SubtaskType;
  onCapabilityToggle: (agentId: string, subtaskType: SubtaskType, enabled: boolean) => void;
}

const SortableAgentItem: React.FC<SortableAgentItemProps> = ({ agent, subtaskType, onCapabilityToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasCapability = agent.capabilities.some(cap => cap.category === subtaskType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move text-gray-400 hover:text-gray-600"
        >
          ⋮⋮
        </div>
        <div>
          <div className="font-medium text-gray-900">{agent.name}</div>
          <div className="text-sm text-gray-500">{agent.provider}</div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-600">
          Priority: {agent.priority[subtaskType] || 'Not set'}
        </div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={hasCapability}
            onChange={(e) => onCapabilityToggle(agent.id, subtaskType, e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Enable</span>
        </label>
      </div>
    </div>
  );
};

export const AgentKeysManager: React.FC<AgentKeysManagerProps> = ({
  agents,
  onAgentUpdate,
  onAgentDelete,
  onBulkImport,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'keys' | 'priorities' | 'tags'>('keys');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentProvider, setNewAgentProvider] = useState<'openai' | 'anthropic' | 'google' | 'groq' | 'custom'>('openai');
  const [newAgentTags, setNewAgentTags] = useState<AgentTag[]>([]);
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<Record<string, ApiKeyValidationResult>>({});
  const [validatingKeys, setValidatingKeys] = useState<Set<string>>(new Set());
  const [priorityOrders, setPriorityOrders] = useState<Record<SubtaskType, string[]>>({
    [SubtaskType.RESEARCH]: [],
    [SubtaskType.ANALYSIS]: [],
    [SubtaskType.CREATION]: [],
    [SubtaskType.VALIDATION]: []
  });
  const [importData, setImportData] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);

  const availableTags: AgentTag[] = ['CREATION', 'RESEARCH', 'TTS', 'CODEGEN', 'IMAGE_GEN', 'ANALYSIS', 'TRANSLATION'];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Initialize priority orders from agents
    const newPriorityOrders: Record<SubtaskType, string[]> = {
      [SubtaskType.RESEARCH]: [],
      [SubtaskType.ANALYSIS]: [],
      [SubtaskType.CREATION]: [],
      [SubtaskType.VALIDATION]: []
    };

    Object.values(SubtaskType).forEach(type => {
      newPriorityOrders[type] = agents
        .filter(agent => agent.capabilities.some(cap => cap.category === type))
        .sort((a, b) => (a.priority[type] || 999) - (b.priority[type] || 999))
        .map(agent => agent.id);
    });

    setPriorityOrders(newPriorityOrders);

    // Initialize API key inputs
    const keyInputs: Record<string, string> = {};
    agents.forEach(agent => {
      keyInputs[agent.id] = agent.apiKeyInfo?.apiKey || '';
    });
    setApiKeyInputs(keyInputs);
  }, [agents]);

  const detectProviderFromKey = (apiKey: string): 'openai' | 'anthropic' | 'google' | 'groq' | 'custom' => {
    // Enhanced pattern matching for better auto-detection
    if (apiKey.startsWith('sk-') || apiKey.includes('openai')) return 'openai';
    if (apiKey.startsWith('sk-ant-') || apiKey.startsWith('claude-')) return 'anthropic';
    if (apiKey.startsWith('AIza') || apiKey.includes('google')) return 'google';
    if (apiKey.startsWith('gsk_') || apiKey.includes('groq')) return 'groq';
    return 'custom';
  };

  const validateApiKey = useCallback(async (agentId: string, apiKey: string): Promise<ApiKeyValidationResult> => {
    setValidatingKeys(prev => new Set(prev).add(agentId));
    
    try {
      // Mock validation - in real implementation, this would call the actual APIs
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      
      const provider = detectProviderFromKey(apiKey);
      const isValid = apiKey.length > 10; // Basic validation
      
      const result: ApiKeyValidationResult = {
        isValid,
        provider,
        model: isValid ? 'gpt-4' : undefined,
        rateLimits: isValid ? {
          requestsPerMinute: 60,
          tokensPerMinute: 10000
        } : undefined,
        error: isValid ? undefined : 'Invalid API key format'
      };

      setValidationResults(prev => ({ ...prev, [agentId]: result }));
      return result;
    } finally {
      setValidatingKeys(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  }, []);

  const handleAddAgent = useCallback(() => {
    if (!newAgentName.trim()) return;

    const newAgent: UserAgent = {
      id: `agent-${Date.now()}`,
      name: newAgentName.trim(),
      provider: newAgentProvider,
      capabilities: [],
      performanceMetrics: {
        averageCompletionTime: 60,
        successRate: 85,
        qualityScore: 80,
        totalTasksCompleted: 0,
        lastUpdated: new Date()
      },
      availability: true,
      costPerMinute: 0.10,
      priority: {
        [SubtaskType.RESEARCH]: 999,
        [SubtaskType.ANALYSIS]: 999,
        [SubtaskType.CREATION]: 999,
        [SubtaskType.VALIDATION]: 999
      },
      fallbackOrder: agents.length,
      tags: newAgentTags,
      enabled: true,
      usageCount: 0
    };

    onAgentUpdate(newAgent);
    setNewAgentName('');
    setNewAgentTags([]);
  }, [newAgentName, newAgentProvider, newAgentTags, onAgentUpdate]);

  const handleBulkImport = useCallback(() => {
    try {
      const importedAgents: UserAgent[] = JSON.parse(importData);
      onBulkImport(importedAgents);
      setImportData('');
      setShowImportModal(false);
    } catch (error) {
      alert('Invalid JSON format. Please check your data.');
    }
  }, [importData, onBulkImport]);

  const handleExport = useCallback(() => {
    const exportData = JSON.stringify(agents, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supercollider-agents.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [agents]);

  const handleApiKeyUpdate = useCallback((agentId: string, apiKey: string) => {
    setApiKeyInputs(prev => ({ ...prev, [agentId]: apiKey }));
    
    const updatedAgents = agents.map(agent => {
      if (agent.id === agentId) {
        const provider = detectProviderFromKey(apiKey);
        return {
          ...agent,
          provider,
          apiKeyInfo: {
            keyId: `key-${agentId}`,
            provider,
            apiKey,
            isValid: false,
            lastValidated: undefined
          }
        };
      }
      return agent;
    });
    
    onAgentsUpdate(updatedAgents);
  }, [agents, onAgentsUpdate]);

  const handleCapabilityToggle = useCallback((agentId: string, subtaskType: SubtaskType, enabled: boolean) => {
    const updatedAgents = agents.map(agent => {
      if (agent.id === agentId) {
        let capabilities = [...agent.capabilities];
        
        if (enabled) {
          if (!capabilities.some(cap => cap.category === subtaskType)) {
            capabilities.push({
              name: subtaskType.toLowerCase(),
              category: subtaskType,
              proficiency: 'INTERMEDIATE'
            });
          }
        } else {
          capabilities = capabilities.filter(cap => cap.category !== subtaskType);
        }
        
        return { ...agent, capabilities };
      }
      return agent;
    });
    
    onAgentsUpdate(updatedAgents);
  }, [agents, onAgentsUpdate]);

  const handleDragEnd = useCallback((event: any, subtaskType: SubtaskType) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = priorityOrders[subtaskType].indexOf(active.id);
      const newIndex = priorityOrders[subtaskType].indexOf(over.id);
      
      const newOrder = arrayMove(priorityOrders[subtaskType], oldIndex, newIndex);
      
      setPriorityOrders(prev => ({ ...prev, [subtaskType]: newOrder }));
      
      // Update agent priorities
      const updatedAgents = agents.map(agent => {
        const newPriorityIndex = newOrder.indexOf(agent.id);
        if (newPriorityIndex !== -1) {
          return {
            ...agent,
            priority: { ...agent.priority, [subtaskType]: newPriorityIndex + 1 }
          };
        }
        return agent;
      });
      
      onAgentsUpdate(updatedAgents);
    }
  }, [priorityOrders, agents, onAgentsUpdate]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('keys')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'keys'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            API Keys
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tags'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tags & Management
          </button>
          <button
            onClick={() => setActiveTab('priorities')}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'priorities'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Agent Priorities
          </button>
        </nav>
      </div>

      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Add New Agent */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add New Agent</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Import
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Export
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex gap-4">
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Agent name (e.g., GPT-4, Claude-3)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newAgentProvider}
                  onChange={(e) => setNewAgentProvider(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                  <option value="groq">Groq</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <TagSelector
                    selectedTags={newAgentTags}
                    onTagsChange={setNewAgentTags}
                    availableTags={availableTags}
                  />
                </div>
                <button
                  onClick={handleAddAgent}
                  disabled={!newAgentName.trim()}
                  className="self-end px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
                >
                  Add Agent
                </button>
              </div>
            </div>
          </div>

          {/* Existing Agents */}
          <div className="space-y-4">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white p-6 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{agent.name}</h4>
                    <p className="text-sm text-gray-600">Provider: {agent.provider}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.apiKeyInfo?.isValid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {agent.apiKeyInfo?.isValid ? 'Verified' : 'Not Verified'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.availability 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {agent.availability ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
                
                <ApiKeyInput
                  value={apiKeyInputs[agent.id] || ''}
                  onChange={(value) => handleApiKeyUpdate(agent.id, value)}
                  onValidate={(key) => validateApiKey(agent.id, key)}
                  placeholder={`Enter ${agent.provider} API key`}
                  provider={agent.provider}
                  isValidating={validatingKeys.has(agent.id)}
                  validationResult={validationResults[agent.id]}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tags' && (
        <div className="space-y-6">
          {/* Agent Management Overview */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Agent Management Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{agents.length}</div>
                <div className="text-sm text-gray-600">Total Agents</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{agents.filter(a => a.enabled).length}</div>
                <div className="text-sm text-gray-600">Active Agents</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{agents.filter(a => a.apiKeyInfo?.isValid).length}</div>
                <div className="text-sm text-gray-600">Verified Keys</div>
              </div>
            </div>
          </div>

          {/* Tag Management */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Agents by Tags</h3>
            <div className="space-y-4">
              {availableTags.map(tag => {
                const tagAgents = agents.filter(agent => agent.tags.includes(tag));
                return (
                  <div key={tag} className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 text-sm rounded-full ${
                        tag === 'CREATION' ? 'bg-blue-100 text-blue-800' :
                        tag === 'RESEARCH' ? 'bg-green-100 text-green-800' :
                        tag === 'TTS' ? 'bg-purple-100 text-purple-800' :
                        tag === 'CODEGEN' ? 'bg-yellow-100 text-yellow-800' :
                        tag === 'IMAGE_GEN' ? 'bg-pink-100 text-pink-800' :
                        tag === 'ANALYSIS' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-teal-100 text-teal-800'
                      }`}>
                        {tag}
                      </span>
                      <span className="text-sm text-gray-600">({tagAgents.length} agents)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tagAgents.map(agent => (
                        <div key={agent.id} className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full text-sm">
                          <span>{agent.name}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${agent.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs text-gray-500">Used {agent.usageCount}x</span>
                            <button
                              onClick={() => onAgentDelete(agent.id)}
                              className="text-red-500 hover:text-red-700 ml-1"
                              title="Delete agent"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Usage Analytics */}
          <div className="bg-white p-6 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Analytics</h3>
            <div className="space-y-3">
              {agents
                .sort((a, b) => b.usageCount - a.usageCount)
                .slice(0, 5)
                .map(agent => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${agent.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium">{agent.name}</div>
                        <div className="text-sm text-gray-500">
                          {agent.lastUsed ? `Last used: ${new Date(agent.lastUsed).toLocaleDateString()}` : 'Never used'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{agent.usageCount} uses</div>
                      <div className="text-sm text-gray-500">
                        {agent.performanceMetrics.successRate.toFixed(1)}% success
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {activeTab === 'priorities' && (
        <div className="space-y-6">
          {Object.values(SubtaskType).map(subtaskType => (
            <div key={subtaskType} className="bg-white p-6 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {subtaskType} Priority Order
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Drag agents to reorder their priority for {subtaskType.toLowerCase()} tasks. Higher priority agents will be tried first.
              </p>
              
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, subtaskType)}
              >
                <SortableContext
                  items={priorityOrders[subtaskType]}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {priorityOrders[subtaskType].map(agentId => {
                      const agent = agents.find(a => a.id === agentId);
                      if (!agent) return null;
                      
                      return (
                        <SortableAgentItem
                          key={agent.id}
                          agent={agent}
                          subtaskType={subtaskType}
                          onCapabilityToggle={handleCapabilityToggle}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Import Agents</h3>
            <p className="text-sm text-gray-600 mb-4">
              Import agents from JSON format. The data should be an array of agent objects.
            </p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste your JSON data here..."
              className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={!importData.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};