import React, { useState, useEffect, useCallback } from 'react';

interface TokenControlInterface {
  userPrompt: string;
  targetTokenSize: number;
  shredStrategy: 'atom_types' | 'token_chunks' | 'hybrid';
  previewMode: boolean;
  estimatedCost: number;
  estimatedDuration: number;
}

interface ShredPreview {
  shredId: string;
  title: string;
  atomType: string;
  contentPreview: string;
  estimatedTokens: number;
  estimatedCost: number;
  estimatedDuration: string;
  dependencies: string[];
  batchGroup?: string;
}

interface TokenSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}

const TokenSlider: React.FC<TokenSliderProps> = ({ 
  value, 
  onChange, 
  min, 
  max, 
  disabled = false 
}) => {
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(event.target.value));
  };

  return (
    <div className="token-slider-container mb-6">
      <div className="flex justify-between items-center mb-2">
        <label htmlFor="token-slider" className="text-sm font-medium text-gray-700">
          Target Token Size
        </label>
        <span className="text-sm text-gray-500">{value} tokens</span>
      </div>
      <input
        id="token-slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleSliderChange}
        disabled={disabled}
        className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

interface ShredCardProps {
  shred: ShredPreview;
  index: number;
}

const ShredCard: React.FC<ShredCardProps> = ({ shred, index }) => {
  const getAtomTypeColor = (atomType: string): string => {
    const colors = {
      'RESEARCH': 'bg-blue-100 text-blue-800',
      'ANALYSIS': 'bg-purple-100 text-purple-800', 
      'CREATION': 'bg-green-100 text-green-800',
      'VALIDATION': 'bg-red-100 text-red-800',
      'PLANNING': 'bg-yellow-100 text-yellow-800',
      'OPTIMIZATION': 'bg-indigo-100 text-indigo-800',
      'DOCUMENTATION': 'bg-gray-100 text-gray-800',
      'INTEGRATION': 'bg-pink-100 text-pink-800',
      'GENERAL': 'bg-slate-100 text-slate-800'
    };
    return colors[atomType as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="shred-card bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAtomTypeColor(shred.atomType)}`}>
            {shred.atomType}
          </span>
          {shred.batchGroup && (
            <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800">
              Batch: {shred.batchGroup}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">${shred.estimatedCost.toFixed(4)}</div>
          <div className="text-xs text-gray-500">{shred.estimatedTokens} tokens</div>
        </div>
      </div>
      
      <h4 className="font-medium text-gray-900 mb-2 line-clamp-1">{shred.title}</h4>
      
      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{shred.contentPreview}</p>
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Duration: {shred.estimatedDuration}</span>
        {shred.dependencies.length > 0 && (
          <span>Depends on: {shred.dependencies.length} shred(s)</span>
        )}
      </div>
    </div>
  );
};

interface LivePreviewProps {
  shreds: ShredPreview[];
  totalCost: number;
  totalDuration: number;
}

const LivePreview: React.FC<LivePreviewProps> = ({ shreds, totalCost, totalDuration }) => {
  if (shreds.length === 0) {
    return (
      <div className="live-preview-empty text-center py-8 text-gray-500">
        <p>Enter a prompt to see the shred preview</p>
      </div>
    );
  }

  return (
    <div className="live-preview">
      <div className="preview-header mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-medium text-gray-900">Shred Preview</h3>
            <p className="text-sm text-gray-600">{shreds.length} shreds generated</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900">${totalCost.toFixed(4)}</div>
            <div className="text-sm text-gray-600">Est. {totalDuration.toFixed(1)}s duration</div>
          </div>
        </div>
      </div>
      
      <div className="shred-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shreds.map((shred, index) => (
          <ShredCard key={shred.shredId} shred={shred} index={index} />
        ))}
      </div>
    </div>
  );
};

interface ShredControlProps {
  onTokenSizeChange: (size: number) => void;
  onPreviewUpdate: (preview: ShredPreview[]) => void;
  userPrompt?: string;
  initialTokenSize?: number;
  onShredControlChange?: (control: TokenControlInterface) => void;
}

const ShredControl: React.FC<ShredControlProps> = ({
  onTokenSizeChange,
  onPreviewUpdate,
  userPrompt = '',
  initialTokenSize = 1000,
  onShredControlChange
}) => {
  const [tokenSize, setTokenSize] = useState<number>(initialTokenSize);
  const [shredStrategy, setShredStrategy] = useState<'atom_types' | 'token_chunks' | 'hybrid'>('atom_types');
  const [previewMode, setPreviewMode] = useState<boolean>(true);
  const [shredPreviews, setShredPreviews] = useState<ShredPreview[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const generateShredPreviews = useCallback(async (prompt: string, targetTokenSize: number, strategy: string) => {
    if (!prompt.trim()) {
      setShredPreviews([]);
      setEstimatedCost(0);
      setEstimatedDuration(0);
      return;
    }

    setIsLoading(true);
    
    try {
      const mockShreds: ShredPreview[] = [];
      const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
      
      let totalCost = 0;
      let totalDuration = 0;
      
      if (strategy === 'atom_types') {
        const atomTypes = ['RESEARCH', 'ANALYSIS', 'CREATION', 'VALIDATION'];
        
        atomTypes.forEach((atomType, index) => {
          const relevantSentences = sentences.filter((_, i) => i % atomTypes.length === index);
          if (relevantSentences.length > 0) {
            const content = relevantSentences.join('. ').trim();
            const tokens = Math.ceil(content.length / 4);
            const cost = tokens * 0.001;
            const duration = tokens * 0.1;
            
            totalCost += cost;
            totalDuration += duration;
            
            mockShreds.push({
              shredId: `shred_${Date.now()}_${index}`,
              title: `${atomType} Task`,
              atomType,
              contentPreview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              estimatedTokens: Math.min(tokens, targetTokenSize),
              estimatedCost: cost,
              estimatedDuration: `${duration.toFixed(1)}s`,
              dependencies: index > 0 ? [`shred_${Date.now()}_${index - 1}`] : [],
              batchGroup: index % 2 === 0 ? `batch_${Math.floor(index / 2)}` : undefined
            });
          }
        });
      } else {
        const chunks = Math.ceil(prompt.length / (targetTokenSize * 4));
        
        for (let i = 0; i < chunks; i++) {
          const startPos = i * targetTokenSize * 4;
          const endPos = Math.min((i + 1) * targetTokenSize * 4, prompt.length);
          const chunk = prompt.substring(startPos, endPos);
          const tokens = Math.ceil(chunk.length / 4);
          const cost = tokens * 0.001;
          const duration = tokens * 0.1;
          
          totalCost += cost;
          totalDuration += duration;
          
          mockShreds.push({
            shredId: `chunk_${Date.now()}_${i}`,
            title: `Chunk ${i + 1}`,
            atomType: 'GENERAL',
            contentPreview: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''),
            estimatedTokens: tokens,
            estimatedCost: cost,
            estimatedDuration: `${duration.toFixed(1)}s`,
            dependencies: i > 0 ? [`chunk_${Date.now()}_${i - 1}`] : [],
            batchGroup: undefined
          });
        }
      }
      
      setShredPreviews(mockShreds);
      setEstimatedCost(totalCost);
      setEstimatedDuration(totalDuration);
      onPreviewUpdate(mockShreds);
      
    } catch (error) {
      console.error('Error generating shred previews:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onPreviewUpdate]);

  const handleTokenSizeChange = (newSize: number) => {
    setTokenSize(newSize);
    onTokenSizeChange(newSize);
    generateShredPreviews(userPrompt, newSize, shredStrategy);
  };

  const handleStrategyChange = (newStrategy: 'atom_types' | 'token_chunks' | 'hybrid') => {
    setShredStrategy(newStrategy);
    generateShredPreviews(userPrompt, tokenSize, newStrategy);
  };

  useEffect(() => {
    generateShredPreviews(userPrompt, tokenSize, shredStrategy);
  }, [userPrompt, generateShredPreviews, tokenSize, shredStrategy]);

  useEffect(() => {
    if (onShredControlChange) {
      onShredControlChange({
        userPrompt,
        targetTokenSize: tokenSize,
        shredStrategy,
        previewMode,
        estimatedCost,
        estimatedDuration
      });
    }
  }, [userPrompt, tokenSize, shredStrategy, previewMode, estimatedCost, estimatedDuration, onShredControlChange]);

  return (
    <div className="shred-control-container">
      <div className="control-panel mb-6 p-4 bg-gray-50 rounded-lg">
        <TokenSlider
          value={tokenSize}
          onChange={handleTokenSizeChange}
          min={100}
          max={4000}
          disabled={isLoading}
        />
        
        <div className="strategy-selector mb-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Shredding Strategy
          </label>
          <div className="flex gap-2">
            {(['atom_types', 'token_chunks', 'hybrid'] as const).map((strategy) => (
              <button
                key={strategy}
                onClick={() => handleStrategyChange(strategy)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  shredStrategy === strategy
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
                disabled={isLoading}
              >
                {strategy.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        
        <div className="preview-toggle">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={previewMode}
              onChange={(e) => setPreviewMode(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Enable live preview</span>
          </label>
        </div>
      </div>

      {previewMode && (
        <div className="preview-section">
          {isLoading ? (
            <div className="loading-state text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Generating shred preview...</p>
            </div>
          ) : (
            <LivePreview 
              shreds={shredPreviews} 
              totalCost={estimatedCost} 
              totalDuration={estimatedDuration} 
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ShredControl;
export type { TokenControlInterface, ShredPreview, ShredControlProps };