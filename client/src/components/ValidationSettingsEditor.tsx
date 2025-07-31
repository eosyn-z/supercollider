import React, { useState } from 'react';
import { Subtask, ValidationConfig, ValidationRule } from '../types';

interface ValidationSettingsEditorProps {
  subtask: Subtask;
  onValidationUpdate: (subtaskId: string, config: ValidationConfig) => void;
  className?: string;
}

export const ValidationSettingsEditor: React.FC<ValidationSettingsEditorProps> = ({
  subtask,
  onValidationUpdate,
  className = ''
}) => {
  const [config, setConfig] = useState<ValidationConfig>({
    rules: [
      {
        id: 'default-schema',
        type: 'SCHEMA',
        config: { minLength: 10 },
        enabled: true,
        weight: 1.0
      }
    ],
    passingThreshold: 0.8,
    haltsOnFailure: false,
    retryOnFailure: true,
    maxRetries: 3
  });

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleType, setNewRuleType] = useState<'SCHEMA' | 'REGEX' | 'SEMANTIC' | 'CUSTOM'>('SCHEMA');

  const handleConfigChange = (key: keyof ValidationConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onValidationUpdate(subtask.id, newConfig);
  };

  const addValidationRule = () => {
    if (newRuleName.trim()) {
      const newRule: ValidationRule = {
        id: `rule-${Date.now()}`,
        type: newRuleType,
        config: getDefaultRuleConfig(newRuleType),
        enabled: true,
        weight: 1.0
      };
      
      const newRules = [...config.rules, newRule];
      handleConfigChange('rules', newRules);
      setNewRuleName('');
    }
  };

  const removeValidationRule = (ruleId: string) => {
    const newRules = config.rules.filter(rule => rule.id !== ruleId);
    handleConfigChange('rules', newRules);
  };

  const toggleRule = (ruleId: string) => {
    const newRules = config.rules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    handleConfigChange('rules', newRules);
  };

  const updateRuleWeight = (ruleId: string, weight: number) => {
    const newRules = config.rules.map(rule =>
      rule.id === ruleId ? { ...rule, weight } : rule
    );
    handleConfigChange('rules', newRules);
  };

  const getDefaultRuleConfig = (type: ValidationRule['type']): Record<string, any> => {
    switch (type) {
      case 'SCHEMA':
        return { minLength: 10, maxLength: 1000 };
      case 'REGEX':
        return { pattern: '.*', flags: 'i' };
      case 'SEMANTIC':
        return { keywords: [], minRelevance: 0.7 };
      case 'CUSTOM':
        return { customFunction: 'validateContent' };
      default:
        return {};
    }
  };

  const getRuleTypeColor = (type: ValidationRule['type']) => {
    switch (type) {
      case 'SCHEMA': return 'bg-blue-100 text-blue-800';
      case 'REGEX': return 'bg-green-100 text-green-800';
      case 'SEMANTIC': return 'bg-purple-100 text-purple-800';
      case 'CUSTOM': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Validation Settings</h2>
        <p className="text-gray-600 text-sm">
          Configure validation settings for subtask: <span className="font-medium">{subtask.title}</span>
        </p>
      </div>

      <div className="space-y-6">
        {/* Passing Threshold */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Passing Threshold: {(config.passingThreshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={config.passingThreshold}
            onChange={(e) => handleConfigChange('passingThreshold', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Max Retries */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Max Retries: {config.maxRetries}
          </label>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={config.maxRetries}
            onChange={(e) => handleConfigChange('maxRetries', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Retry on Failure */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Retry on Failure</h3>
            <p className="text-xs text-gray-500">Automatically retry failed validations</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.retryOnFailure}
              onChange={(e) => handleConfigChange('retryOnFailure', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Halts on Failure */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Halt on Failure</h3>
            <p className="text-xs text-gray-500">Stop execution if validation fails</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.haltsOnFailure}
              onChange={(e) => handleConfigChange('haltsOnFailure', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Validation Rules */}
        <div>
          <h3 className="text-sm font-medium mb-3">Validation Rules</h3>
          <div className="space-y-3">
            {config.rules.map((rule) => (
              <div key={rule.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getRuleTypeColor(rule.type)}`}>
                      {rule.type}
                    </span>
                    <span className="text-sm font-medium">{rule.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <button
                      onClick={() => removeValidationRule(rule.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Weight:</span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={rule.weight}
                    onChange={(e) => updateRuleWeight(rule.id, parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-600 min-w-[2rem]">{rule.weight.toFixed(1)}</span>
                </div>
              </div>
            ))}
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  placeholder="Rule name..."
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as any)}
                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="SCHEMA">Schema</option>
                  <option value="REGEX">Regex</option>
                  <option value="SEMANTIC">Semantic</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
              <button
                onClick={addValidationRule}
                className="w-full px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};