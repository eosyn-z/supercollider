import React, { useState, useEffect } from 'react';
import { ApiRequestBuilderService } from '../services/ApiRequestBuilderService';

interface ApiEntry {
  name: string;
  service: string;
  description: string;
  signup_url?: string;
  requires_key: boolean;
  free_tier: boolean;
  key?: string;
  task_tags: string[];
  rate_limit: string;
  notes: string;
  documentation?: {
    base_url?: string;
    endpoints?: Array<{
      path: string;
      method: string;
      description: string;
      parameters?: Record<string, any>;
    }>;
    examples?: Array<{
      description: string;
      request: any;
      response: any;
    }>;
  };
}

interface RequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  description: string;
}

interface ApiRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestComplete: (response: any) => void;
  apiList: ApiEntry[];
}

enum ModalStep {
  SELECT_API = 'select_api',
  CONFIGURE_REQUEST = 'configure_request',
  REVIEW_CONFIG = 'review_config',
  EXECUTE_REQUEST = 'execute_request',
  VIEW_RESPONSE = 'view_response'
}

const ApiRequestModal: React.FC<ApiRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestComplete,
  apiList
}) => {
  const [currentStep, setCurrentStep] = useState<ModalStep>(ModalStep.SELECT_API);
  const [selectedApi, setSelectedApi] = useState<ApiEntry | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [userInput, setUserInput] = useState('');
  const [requestConfig, setRequestConfig] = useState<RequestConfig | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ step: '', message: '' });

  // Search and filter states (from original modal)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFreeTier, setFilterFreeTier] = useState(false);
  const [filterRequiresKey, setFilterRequiresKey] = useState(false);

  const apiRequestService = new ApiRequestBuilderService();

  const filteredApis = apiList.filter(api => {
    const searchMatch = !searchTerm || 
      api.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      api.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      api.task_tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const freeTierMatch = !filterFreeTier || api.free_tier;
    const requiresKeyMatch = !filterRequiresKey || api.requires_key;
    
    return searchMatch && freeTierMatch && requiresKeyMatch;
  });

  const handleApiSelect = (api: ApiEntry) => {
    setSelectedApi(api);
    setApiKey(api.key || '');
    setCurrentStep(ModalStep.CONFIGURE_REQUEST);
    setProgress({ step: 'API Selected', message: `Selected ${api.name}` });
  };

  const handleGenerateConfig = async () => {
    if (!selectedApi || !userInput.trim()) {
      setError('Please provide request details');
      return;
    }

    setLoading(true);
    setError('');
    setProgress({ step: 'Generating Configuration', message: 'AI is analyzing your request...' });

    try {
      const config = await apiRequestService.generateRequestConfig(
        selectedApi,
        userInput,
        apiKey
      );
      
      setRequestConfig(config);
      setCurrentStep(ModalStep.REVIEW_CONFIG);
      setProgress({ step: 'Configuration Generated', message: 'Review your request configuration' });
    } catch (err) {
      setError(`Failed to generate configuration: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRequest = async () => {
    if (!requestConfig || !selectedApi) return;

    setLoading(true);
    setError('');
    setProgress({ step: 'Executing Request', message: 'Sending request...' });

    try {
      const result = await apiRequestService.executeRequest(requestConfig, apiKey);
      setResponse(result);
      setCurrentStep(ModalStep.VIEW_RESPONSE);
      setProgress({ step: 'Request Complete', message: 'Response received successfully' });
      onRequestComplete(result);
    } catch (err) {
      setError(`Request failed: ${err}`);
      setCurrentStep(ModalStep.REVIEW_CONFIG); // Allow retry
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(ModalStep.SELECT_API);
    setSelectedApi(null);
    setApiKey('');
    setUserInput('');
    setRequestConfig(null);
    setResponse(null);
    setError('');
    setProgress({ step: '', message: '' });
    onClose();
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6">
      {Object.values(ModalStep).map((step, index) => (
        <div key={step} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            Object.values(ModalStep).indexOf(currentStep) >= index
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {index + 1}
          </div>
          {index < Object.values(ModalStep).length - 1 && (
            <div className={`w-12 h-0.5 ${
              Object.values(ModalStep).indexOf(currentStep) > index
                ? 'bg-blue-600'
                : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderApiSelection = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Select API Service</h3>
      
      {/* Search and filters from original modal */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search APIs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
        
        <div className="flex gap-4 mt-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filterFreeTier}
              onChange={(e) => setFilterFreeTier(e.target.checked)}
            />
            <span className="ml-2">Free tier only</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filterRequiresKey}
              onChange={(e) => setFilterRequiresKey(e.target.checked)}
            />
            <span className="ml-2">Requires API key</span>
          </label>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-2">
        {filteredApis.map((api, index) => (
          <div
            key={index}
            onClick={() => handleApiSelect(api)}
            className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50"
          >
            <div className="font-medium">{api.name}</div>
            <div className="text-sm text-gray-600">{api.description}</div>
            <div className="flex gap-2 mt-2">
              {api.free_tier && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Free</span>
              )}
              {api.requires_key && (
                <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">Key Required</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRequestConfiguration = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Configure Request for {selectedApi?.name}</h3>
      
      {selectedApi?.requires_key && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Request Details</label>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Describe what you want to request from this API..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>

      {selectedApi?.documentation?.examples && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <h4 className="font-medium mb-2">Example Requests:</h4>
          {selectedApi.documentation.examples.slice(0, 2).map((example, index) => (
            <div key={index} className="text-sm mb-2">
              <div className="font-medium">{example.description}</div>
              <code className="text-xs text-gray-600">{JSON.stringify(example.request, null, 2)}</code>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep(ModalStep.SELECT_API)}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleGenerateConfig}
          disabled={loading || !userInput.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Generating...' : 'Generate Request'}
        </button>
      </div>
    </div>
  );

  const renderConfigReview = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">Review Request Configuration</h3>
      
      {requestConfig && (
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          <div className="space-y-2 text-sm">
            <div><strong>Method:</strong> {requestConfig.method}</div>
            <div><strong>URL:</strong> {requestConfig.url}</div>
            <div><strong>Description:</strong> {requestConfig.description}</div>
            
            {Object.keys(requestConfig.headers).length > 0 && (
              <div>
                <strong>Headers:</strong>
                <pre className="mt-1 p-2 bg-white rounded text-xs">
                  {JSON.stringify(requestConfig.headers, null, 2)}
                </pre>
              </div>
            )}
            
            {requestConfig.body && (
              <div>
                <strong>Body:</strong>
                <pre className="mt-1 p-2 bg-white rounded text-xs">
                  {JSON.stringify(requestConfig.body, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep(ModalStep.CONFIGURE_REQUEST)}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleExecuteRequest}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? 'Executing...' : 'Execute Request'}
        </button>
      </div>
    </div>
  );

  const renderResponse = () => (
    <div>
      <h3 className="text-lg font-semibold mb-4">API Response</h3>
      
      <div className="mb-4 p-4 bg-gray-50 rounded-md max-h-64 overflow-y-auto">
        <pre className="text-sm whitespace-pre-wrap">
          {JSON.stringify(response, null, 2)}
        </pre>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setCurrentStep(ModalStep.REVIEW_CONFIG)}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Make Another Request
        </button>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">API Request Builder</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>

        {renderStepIndicator()}

        {progress.step && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="font-medium text-blue-900">{progress.step}</div>
            <div className="text-sm text-blue-700">{progress.message}</div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {currentStep === ModalStep.SELECT_API && renderApiSelection()}
        {currentStep === ModalStep.CONFIGURE_REQUEST && renderRequestConfiguration()}
        {currentStep === ModalStep.REVIEW_CONFIG && renderConfigReview()}
        {currentStep === ModalStep.VIEW_RESPONSE && renderResponse()}
      </div>
    </div>
  );
};

export default ApiRequestModal;