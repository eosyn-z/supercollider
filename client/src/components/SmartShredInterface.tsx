import React, { useState, useEffect, useCallback } from 'react';
import ShredControl, { ShredPreview, TokenControlInterface } from './ShredControl';

interface SmartShredInterfaceProps {
  onSubmitWorkflow: (shreds: PromptShred[], tokenSize: number) => Promise<string>;
  onTokenSizeChange: (size: number) => void;
  userTier: 'free' | 'pro' | 'enterprise';
  initialPrompt?: string;
  onWorkflowStatusChange?: (workflowId: string, status: string) => void;
}

interface PromptShred {
  id: string;
  atomType: string;
  content: string;
  estimatedTokens: number;
  dependencies: string[];
  batchable: boolean;
  agentCapabilities: string[];
}

interface ExecutionProgress {
  workflowId: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed';
  currentShred?: string;
  completedShreds: string[];
  failedShreds: string[];
  totalShreds: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
  messages: ProgressMessage[];
}

interface ProgressMessage {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  shredId?: string;
}

interface CostDisplayProps {
  totalCost: number;
  userTier: 'free' | 'pro' | 'enterprise';
  estimatedDuration: number;
  tokenCount: number;
}

const CostDisplay: React.FC<CostDisplayProps> = ({ 
  totalCost, 
  userTier, 
  estimatedDuration, 
  tokenCount 
}) => {
  const getTierLimits = () => {
    switch (userTier) {
      case 'free': return { costLimit: 5.0, tokenLimit: 5000 };
      case 'pro': return { costLimit: 50.0, tokenLimit: 50000 };
      case 'enterprise': return { costLimit: 500.0, tokenLimit: 500000 };
    }
  };

  const limits = getTierLimits();
  const costPercentage = (totalCost / limits.costLimit) * 100;
  const tokenPercentage = (tokenCount / limits.tokenLimit) * 100;

  const getCostColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-600';
    if (percentage > 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="cost-display bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-3">Cost & Usage Estimate</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${getCostColor(costPercentage)}`}>
            ${totalCost.toFixed(4)}
          </div>
          <div className="text-sm text-gray-600">Estimated Cost</div>
          <div className="text-xs text-gray-500">
            {costPercentage.toFixed(1)}% of ${limits.costLimit} limit
          </div>
        </div>
        
        <div className="text-center">
          <div className={`text-2xl font-bold ${getCostColor(tokenPercentage)}`}>
            {tokenCount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Total Tokens</div>
          <div className="text-xs text-gray-500">
            {tokenPercentage.toFixed(1)}% of {limits.tokenLimit.toLocaleString()} limit
          </div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Cost Usage</span>
          <span>{costPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              costPercentage > 90 ? 'bg-red-500' : 
              costPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, costPercentage)}%` }}
          ></div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span>Token Usage</span>
          <span>{tokenPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${
              tokenPercentage > 90 ? 'bg-red-500' : 
              tokenPercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, tokenPercentage)}%` }}
          ></div>
        </div>
      </div>

      <div className="text-center pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Estimated Duration: <span className="font-medium">{estimatedDuration.toFixed(1)}s</span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Tier: <span className="font-medium capitalize">{userTier}</span>
        </div>
      </div>
    </div>
  );
};

interface SubmitButtonProps {
  onSubmit: () => void;
  disabled: boolean;
  isLoading: boolean;
  shredCount: number;
  estimatedCost: number;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({ 
  onSubmit, 
  disabled, 
  isLoading, 
  shredCount, 
  estimatedCost 
}) => {
  return (
    <button
      onClick={onSubmit}
      disabled={disabled || isLoading}
      className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-200 ${
        disabled || isLoading
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg'
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          Submitting Workflow...
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <span>Submit Workflow</span>
          <div className="ml-2 text-sm opacity-90">
            ({shredCount} shreds • ${estimatedCost.toFixed(4)})
          </div>
        </div>
      )}
    </button>
  );
};

interface ProgressTrackerProps {
  progress: ExecutionProgress | null;
  onCancel?: () => void;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress, onCancel }) => {
  if (!progress) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      case 'approved': return 'text-indigo-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'processing': return '⚙️';
      case 'approved': return '✅';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  return (
    <div className="progress-tracker bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">Execution Progress</h3>
        {onCancel && progress.status === 'processing' && (
          <button
            onClick={onCancel}
            className="text-sm text-red-600 hover:text-red-800 px-3 py-1 border border-red-200 rounded"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center">
            <span className="mr-2 text-lg">{getStatusIcon(progress.status)}</span>
            <span className={`font-medium ${getStatusColor(progress.status)}`}>
              {progress.status.toUpperCase()}
            </span>
          </div>
          <span className="text-sm text-gray-600">
            {progress.completedShreds.length}/{progress.totalShreds} completed
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="h-3 rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress.overallProgress}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{progress.overallProgress.toFixed(1)}% complete</span>
          {progress.estimatedTimeRemaining > 0 && (
            <span>~{progress.estimatedTimeRemaining.toFixed(0)}s remaining</span>
          )}
        </div>
      </div>

      {progress.currentShred && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900">
            Currently Processing: {progress.currentShred}
          </div>
        </div>
      )}

      {progress.messages.length > 0 && (
        <div className="progress-messages max-h-40 overflow-y-auto">
          <div className="text-sm font-medium text-gray-700 mb-2">Recent Updates:</div>
          {progress.messages.slice(-5).map((message, index) => (
            <div key={index} className={`text-xs p-2 rounded mb-1 ${
              message.type === 'error' ? 'bg-red-50 text-red-700' :
              message.type === 'success' ? 'bg-green-50 text-green-700' :
              message.type === 'warning' ? 'bg-yellow-50 text-yellow-700' :
              'bg-gray-50 text-gray-700'
            }`}>
              <span className="font-mono">{message.timestamp}</span>: {message.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SmartShredInterface: React.FC<SmartShredInterfaceProps> = ({
  onSubmitWorkflow,
  onTokenSizeChange,
  userTier,
  initialPrompt = '',
  onWorkflowStatusChange
}) => {
  const [userPrompt, setUserPrompt] = useState<string>(initialPrompt);
  const [tokenSize, setTokenSize] = useState<number>(1000);
  const [shredPreview, setShredPreview] = useState<ShredPreview[]>([]);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [executionProgress, setExecutionProgress] = useState<ExecutionProgress | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);

  const handleTokenChange = useCallback((newSize: number) => {
    setTokenSize(newSize);
    onTokenSizeChange(newSize);
  }, [onTokenSizeChange]);

  const handlePreviewUpdate = useCallback((previews: ShredPreview[]) => {
    setShredPreview(previews);
    const cost = previews.reduce((sum, p) => sum + p.estimatedCost, 0);
    const duration = previews.reduce((sum, p) => sum + parseFloat(p.estimatedDuration), 0);
    setTotalCost(cost);
    setEstimatedDuration(duration);
  }, []);

  const handleShredControlChange = useCallback((control: TokenControlInterface) => {
    setTotalCost(control.estimatedCost);
    setEstimatedDuration(control.estimatedDuration);
  }, []);

  const convertToPromptShreds = (previews: ShredPreview[]): PromptShred[] => {
    return previews.map(preview => ({
      id: preview.shredId,
      atomType: preview.atomType,
      content: preview.contentPreview,
      estimatedTokens: preview.estimatedTokens,
      dependencies: preview.dependencies,
      batchable: true,
      agentCapabilities: ['general-purpose']
    }));
  };

  const handleSubmit = async () => {
    if (shredPreview.length === 0) {
      alert('Please enter a prompt to generate shreds first.');
      return;
    }

    setIsSubmitting(true);
    setExecutionProgress({
      workflowId: '',
      status: 'pending',
      completedShreds: [],
      failedShreds: [],
      totalShreds: shredPreview.length,
      overallProgress: 0,
      estimatedTimeRemaining: estimatedDuration,
      messages: [{
        timestamp: new Date().toLocaleTimeString(),
        type: 'info',
        message: 'Submitting workflow for approval...'
      }]
    });

    try {
      const promptShreds = convertToPromptShreds(shredPreview);
      const newWorkflowId = await onSubmitWorkflow(promptShreds, tokenSize);
      
      setWorkflowId(newWorkflowId);
      setExecutionProgress(prev => prev ? {
        ...prev,
        workflowId: newWorkflowId,
        status: 'approved',
        messages: [...prev.messages, {
          timestamp: new Date().toLocaleTimeString(),
          type: 'success',
          message: `Workflow ${newWorkflowId} submitted successfully!`
        }]
      } : null);

      if (onWorkflowStatusChange) {
        onWorkflowStatusChange(newWorkflowId, 'approved');
      }

      setTimeout(() => {
        setExecutionProgress(prev => prev ? {
          ...prev,
          status: 'processing',
          overallProgress: 25,
          messages: [...prev.messages, {
            timestamp: new Date().toLocaleTimeString(),
            type: 'info',
            message: 'Processing shreds...'
          }]
        } : null);
      }, 1000);

      setTimeout(() => {
        setExecutionProgress(prev => prev ? {
          ...prev,
          status: 'completed',
          overallProgress: 100,
          completedShreds: promptShreds.map(s => s.id),
          estimatedTimeRemaining: 0,
          messages: [...prev.messages, {
            timestamp: new Date().toLocaleTimeString(),
            type: 'success',
            message: 'All shreds completed successfully!'
          }]
        } : null);

        if (onWorkflowStatusChange && newWorkflowId) {
          onWorkflowStatusChange(newWorkflowId, 'completed');
        }
      }, 5000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setExecutionProgress(prev => prev ? {
        ...prev,
        status: 'failed',
        messages: [...prev.messages, {
          timestamp: new Date().toLocaleTimeString(),
          type: 'error',
          message: `Workflow submission failed: ${errorMessage}`
        }]
      } : null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setExecutionProgress(null);
    setWorkflowId(null);
    setIsSubmitting(false);
  };

  const canSubmit = userPrompt.trim().length > 0 && shredPreview.length > 0 && !isSubmitting;
  const totalTokens = shredPreview.reduce((sum, p) => sum + p.estimatedTokens, 0);

  useEffect(() => {
    setUserPrompt(initialPrompt);
  }, [initialPrompt]);

  return (
    <div className="smart-shred-interface max-w-7xl mx-auto p-6 space-y-6">
      <div className="header mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart-Shred Supercollider</h1>
        <p className="text-gray-600">
          Intelligently decompose complex prompts into optimized executable shreds
        </p>
      </div>

      <div className="prompt-input mb-6">
        <label htmlFor="user-prompt" className="block text-sm font-medium text-gray-700 mb-2">
          Enter your prompt:
        </label>
        <textarea
          id="user-prompt"
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          placeholder="Describe what you want to accomplish... The system will automatically break it down into optimized shreds."
          className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ShredControl
            onTokenSizeChange={handleTokenChange}
            onPreviewUpdate={handlePreviewUpdate}
            userPrompt={userPrompt}
            initialTokenSize={tokenSize}
            onShredControlChange={handleShredControlChange}
          />
        </div>

        <div className="space-y-4">
          <CostDisplay
            totalCost={totalCost}
            userTier={userTier}
            estimatedDuration={estimatedDuration}
            tokenCount={totalTokens}
          />

          <SubmitButton
            onSubmit={handleSubmit}
            disabled={!canSubmit}
            isLoading={isSubmitting}
            shredCount={shredPreview.length}
            estimatedCost={totalCost}
          />

          {executionProgress && (
            <ProgressTracker
              progress={executionProgress}
              onCancel={executionProgress.status === 'processing' ? handleCancel : undefined}
            />
          )}
        </div>
      </div>

      {workflowId && (
        <div className="workflow-info mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>Workflow ID:</strong> {workflowId}
          </div>
          <div className="text-xs text-blue-600 mt-1">
            You can use this ID to track your workflow progress
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartShredInterface;
export type { SmartShredInterfaceProps, ExecutionProgress, ProgressMessage };