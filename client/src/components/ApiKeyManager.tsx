import React, { useState, useEffect } from 'react';
import { Agent } from '../types';
import ApiKeyModal from './ApiKeyModal';

interface ApiKey {
  id: string;
  name: string;
  service: string;
  key: string;
  agentId: string;
  isActive: boolean;
  isValid?: boolean;
  createdAt: Date;
  lastUsed?: Date;
  isPublic?: boolean; // For auto-populated public keys
  metadata?: {
    description?: string;
    rate_limit?: string;
    free_tier?: boolean;
    task_tags?: string[];
  };
}

interface ApiKeyManagerProps {
  agents: Agent[];
  onKeyAdded: (key: ApiKey) => void;
  onKeyUpdated: (key: ApiKey) => void;
  onKeyDeleted: (keyId: string) => void;
  className?: string;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({
  agents,
  onKeyAdded,
  onKeyUpdated,
  onKeyDeleted,
  className = ''
}) => {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [publicApiList, setPublicApiList] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    agentId: ''
  });

  // Load saved keys from localStorage
  useEffect(() => {
    const savedKeys = localStorage.getItem('supercollider_api_keys');
    if (savedKeys) {
      try {
        const parsedKeys = JSON.parse(savedKeys);
        setKeys(parsedKeys);
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    }
  }, []);

  // Load public API list
  useEffect(() => {
    const loadPublicApiList = async () => {
      try {
        // Convert the file structure to match our modal interface
        const response = await fetch('/TODO_CLAUDE/publickeylist.json');
        const publicKeys = await response.json();
        
        const formattedList = publicKeys.map((api: any) => ({
          name: api.service,
          service: api.service,
          description: api.notes,
          requires_key: api.key !== 'public' && api.key !== 'DEMO_KEY',
          free_tier: true, // Assume all public APIs are free tier
          key: api.key === 'public' ? '' : api.key,
          task_tags: api.task_tags || [],
          rate_limit: api.rate_limit,
          notes: api.notes
        }));
        
        setPublicApiList(formattedList);
        
        // Auto-populate keys that don't require user input
        const autoKeys = formattedList
          .filter((api: any) => !api.requires_key || api.key)
          .map((api: any) => ({
            id: `auto-${api.service.toLowerCase().replace(/\s+/g, '-')}`,
            name: api.service,
            service: api.service,
            key: api.key || 'public',
            agentId: '', // Will be assigned later
            isActive: true,
            isValid: true,
            isPublic: true,
            createdAt: new Date(),
            metadata: {
              description: api.description,
              rate_limit: api.rate_limit,
              free_tier: api.free_tier,
              task_tags: api.task_tags
            }
          }));
        
        // Only add auto keys that don't already exist
        const existingServices = keys.map(k => k.service);
        const newAutoKeys = autoKeys.filter((ak: ApiKey) => !existingServices.includes(ak.service));
        
        if (newAutoKeys.length > 0) {
          setKeys(prev => [...prev, ...newAutoKeys]);
        }
        
      } catch (error) {
        console.error('Failed to load public API list:', error);
      }
    };
    
    loadPublicApiList();
  }, []);

  // Save keys to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('supercollider_api_keys', JSON.stringify(keys));
  }, [keys]);

  const handleApiModalSave = (data: { api: any; key: string }) => {
    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: data.api.name || data.api.service,
      service: data.api.service || data.api.name,
      key: data.key,
      agentId: '', // Will be assigned later
      isActive: true,
      isValid: false, // Will be validated
      createdAt: new Date(),
      metadata: {
        description: data.api.description || data.api.notes,
        rate_limit: data.api.rate_limit,
        free_tier: data.api.free_tier,
        task_tags: data.api.task_tags
      }
    };

    setKeys([...keys, newKey]);
    onKeyAdded(newKey);
  };

  const handleAddKey = () => {
    if (!formData.name || !formData.key || !formData.agentId) {
      alert('Please fill in all fields');
      return;
    }

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: formData.name,
      service: formData.name,
      key: formData.key,
      agentId: formData.agentId,
      isActive: true,
      isValid: false,
      createdAt: new Date()
    };

    setKeys([...keys, newKey]);
    onKeyAdded(newKey);
    
    // Reset form
    setFormData({ name: '', key: '', agentId: '' });
    setShowAddForm(false);
  };

  const handleUpdateKey = () => {
    if (!editingKey) return;

    const updatedKey: ApiKey = {
      ...editingKey,
      name: formData.name,
      key: formData.key,
      agentId: formData.agentId
    };

    setKeys(keys.map(k => k.id === editingKey.id ? updatedKey : k));
    onKeyUpdated(updatedKey);
    
    setEditingKey(null);
    setFormData({ name: '', key: '', agentId: '' });
  };

  const handleDeleteKey = (keyId: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      setKeys(keys.filter(k => k.id !== keyId));
      onKeyDeleted(keyId);
    }
  };

  const handleEditKey = (key: ApiKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      key: key.key,
      agentId: key.agentId
    });
  };

  const toggleKeyActive = (keyId: string) => {
    const updatedKeys = keys.map(k => 
      k.id === keyId ? { ...k, isActive: !k.isActive } : k
    );
    setKeys(updatedKeys);
  };

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.name : 'Unknown Agent';
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.substring(0, 4) + '*'.repeat(key.length - 8) + key.substring(key.length - 4);
  };

  const validateApiKey = async (key: ApiKey) => {
    if (key.isPublic && (key.key === 'public' || key.key === 'DEMO_KEY')) {
      // Public keys are assumed valid
      const updatedKey = { ...key, isValid: true };
      setKeys(prev => prev.map(k => k.id === key.id ? updatedKey : k));
      return;
    }

    try {
      // Basic validation - just check if key has proper format
      let isValid = false;
      
      if (key.service.toLowerCase().includes('openai') && key.key.startsWith('sk-')) {
        isValid = true; // Basic OpenAI format check
      } else if (key.service.toLowerCase().includes('hugging') && key.key.startsWith('hf_')) {
        isValid = true; // Basic Hugging Face format check
      } else if (key.key && key.key.length > 10) {
        isValid = true; // Basic length check for other services
      }

      const updatedKey = { ...key, isValid };
      setKeys(prev => prev.map(k => k.id === key.id ? updatedKey : k));
      
    } catch (error) {
      console.error('Validation error:', error);
      const updatedKey = { ...key, isValid: false };
      setKeys(prev => prev.map(k => k.id === key.id ? updatedKey : k));
    }
  };

  return (
    <div className={`api-key-manager ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">API Key Management</h2>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowApiModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Add from Public APIs
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Custom Key
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingKey) && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-medium mb-4">
            {editingKey ? 'Edit API Key' : 'Add New API Key'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., OpenAI Production Key"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign to Agent
              </label>
              <select
                value={formData.agentId}
                onChange={(e) => setFormData({ ...formData, agentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an agent...</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} - {agent.capabilities.map(c => c.category).join(', ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={editingKey ? handleUpdateKey : handleAddKey}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingKey ? 'Update Key' : 'Add Key'}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingKey(null);
                  setFormData({ name: '', key: '', agentId: '' });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Keys List */}
      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No API keys configured</p>
            <p className="text-sm">Add your first API key to get started</p>
          </div>
        ) : (
          keys.map(key => (
            <div
              key={key.id}
              className={`p-4 border rounded-lg ${
                key.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{key.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      key.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {key.isPublic && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        Public
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      key.isValid === false 
                        ? 'bg-red-100 text-red-800' 
                        : key.isValid === true
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {key.isValid === false ? 'Invalid' : key.isValid === true ? 'Valid' : 'Unvalidated'}
                    </span>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Key:</span> {maskApiKey(key.key)}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Agent:</span> {getAgentName(key.agentId)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Created: {key.createdAt.toLocaleDateString()}
                      {key.lastUsed && (
                        <span className="ml-4">
                          Last used: {key.lastUsed.toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => validateApiKey(key)}
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  >
                    Validate
                  </button>
                  
                  <button
                    onClick={() => toggleKeyActive(key.id)}
                    className={`px-3 py-1 text-sm rounded ${
                      key.isActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {key.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  
                  <button
                    onClick={() => handleEditKey(key)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Edit
                  </button>
                  
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">How to use API Keys</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Add API keys from public APIs or add custom keys</li>
          <li>• Public APIs with open keys are auto-populated</li>
          <li>• Assign each key to a specific agent based on their capabilities</li>
          <li>• Only validated keys can be used for atomic task assignment</li>
          <li>• Keys are stored locally and never sent to external servers</li>
        </ul>
      </div>

      {/* API Key Selection Modal */}
      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSave={handleApiModalSave}
        apiList={publicApiList}
      />
    </div>
  );
}; 