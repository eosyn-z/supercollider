import React, { useState, useEffect } from 'react';
import { Agent } from '../types';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  agentId: string;
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
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

  // Save keys to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('supercollider_api_keys', JSON.stringify(keys));
  }, [keys]);

  const handleAddKey = () => {
    if (!formData.name || !formData.key || !formData.agentId) {
      alert('Please fill in all fields');
      return;
    }

    const newKey: ApiKey = {
      id: `key-${Date.now()}`,
      name: formData.name,
      key: formData.key,
      agentId: formData.agentId,
      isActive: true,
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

  return (
    <div className={`api-key-manager ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">API Key Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add API Key
        </button>
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
          <li>• Add API keys for each AI service you want to use</li>
          <li>• Assign each key to a specific agent based on their capabilities</li>
          <li>• The system will automatically use the appropriate key for each task</li>
          <li>• Keys are stored locally and never sent to external servers</li>
        </ul>
      </div>
    </div>
  );
}; 