import React, { useState } from 'react';
import { AtomicWorkflowDecomposition, AtomicUnit } from '../types';

interface AtomicDecompositionViewerProps {
  decomposition: AtomicWorkflowDecomposition;
  className?: string;
}

export const AtomicDecompositionViewer: React.FC<AtomicDecompositionViewerProps> = ({
  decomposition,
  className = ''
}) => {
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'units' | 'dependencies'>('overview');

  const getComplexityColor = (complexity: number) => {
    if (complexity <= 3) return 'text-green-600 bg-green-100';
    if (complexity <= 6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getAtomicLevelColor = (level: string) => {
    switch (level) {
      case 'micro': return 'text-blue-600 bg-blue-100';
      case 'mini': return 'text-purple-600 bg-purple-100';
      case 'standard': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'hierarchical': return 'text-indigo-600 bg-indigo-100';
      case 'sequential': return 'text-green-600 bg-green-100';
      case 'parallel': return 'text-blue-600 bg-blue-100';
      case 'hybrid': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const selectedUnitData = selectedUnit ? 
    decomposition.atomicUnits.find(unit => unit.id === selectedUnit) : null;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Atomic Decomposition</h2>
        <p className="text-gray-600 mb-4">
          Workflow broken down into {decomposition.metadata.totalUnits} atomic units
        </p>
        
        {/* Strategy and Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStrategyColor(decomposition.decompositionStrategy)}`}>
              {decomposition.decompositionStrategy}
            </div>
            <p className="text-xs text-gray-500 mt-1">Strategy</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{decomposition.metadata.totalUnits}</div>
            <p className="text-xs text-gray-500">Total Units</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{decomposition.metadata.estimatedDuration}m</div>
            <p className="text-xs text-gray-500">Est. Duration</p>
          </div>
          <div className="text-center">
            <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              decomposition.metadata.complexity === 'low' ? 'text-green-600 bg-green-100' :
              decomposition.metadata.complexity === 'medium' ? 'text-yellow-600 bg-yellow-100' :
              'text-red-600 bg-red-100'
            }`}>
              {decomposition.metadata.complexity}
            </div>
            <p className="text-xs text-gray-500 mt-1">Complexity</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('units')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'units'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Atomic Units
        </button>
        <button
          onClick={() => setActiveTab('dependencies')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'dependencies'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Dependencies
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Decomposition Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Unit Distribution</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Micro Units:</span>
                      <span className="font-medium">{decomposition.atomicUnits.filter(u => u.atomicLevel === 'micro').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Mini Units:</span>
                      <span className="font-medium">{decomposition.atomicUnits.filter(u => u.atomicLevel === 'mini').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Standard Units:</span>
                      <span className="font-medium">{decomposition.atomicUnits.filter(u => u.atomicLevel === 'standard').length}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Parallelization</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Can Parallelize:</span>
                      <span className="font-medium">{decomposition.atomicUnits.filter(u => u.canParallelize).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Sequential:</span>
                      <span className="font-medium">{decomposition.atomicUnits.filter(u => !u.canParallelize).length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Complexity Analysis</h3>
              <div className="space-y-2">
                {decomposition.atomicUnits
                  .sort((a, b) => b.complexity - a.complexity)
                  .slice(0, 5)
                  .map(unit => (
                    <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{unit.title}</div>
                        <div className="text-sm text-gray-600">{unit.type}</div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getComplexityColor(unit.complexity)}`}>
                        Complexity: {unit.complexity}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Atomic Units</h3>
              <div className="text-sm text-gray-500">
                {decomposition.atomicUnits.length} units
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {decomposition.atomicUnits.map(unit => (
                <div
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit.id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedUnit === unit.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{unit.title}</h4>
                    <div className="flex space-x-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getAtomicLevelColor(unit.atomicLevel)}`}>
                        {unit.atomicLevel}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getComplexityColor(unit.complexity)}`}>
                        {unit.complexity}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{unit.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{unit.type}</span>
                    <span>{unit.estimatedDuration}m</span>
                    <span>{unit.dependencies.length} deps</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Dependency Graph</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">
                This view shows the dependency relationships between atomic units.
              </p>
              <div className="space-y-2">
                {decomposition.atomicUnits.map(unit => (
                  <div key={unit.id} className="p-3 bg-white rounded border">
                    <div className="font-medium text-gray-900">{unit.title}</div>
                    {unit.dependencies.length > 0 ? (
                      <div className="text-sm text-gray-600 mt-1">
                        Depends on: {unit.dependencies.join(', ')}
                      </div>
                    ) : (
                      <div className="text-sm text-green-600 mt-1">No dependencies</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Unit Details Sidebar */}
      {selectedUnitData && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Unit Details</h3>
            <button
              onClick={() => setSelectedUnit(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">{selectedUnitData.title}</h4>
              <p className="text-sm text-gray-600">{selectedUnitData.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-1">Requirements</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {selectedUnitData.requirements.map((req, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-1">Deliverables</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {selectedUnitData.deliverables.map((del, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      {del}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h5 className="font-medium text-gray-900 mb-1">Validation Criteria</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {selectedUnitData.validationCriteria.map((criteria, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    {criteria}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="font-medium text-gray-900 mb-1">Agent Requirements</h5>
                <ul className="text-sm text-gray-600 space-y-1">
                  {selectedUnitData.agentRequirements.map((req, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-1">Retry Policy</h5>
                <div className="text-sm text-gray-600">
                  <div>Max Retries: {selectedUnitData.retryPolicy.maxRetries}</div>
                  <div>Strategy: {selectedUnitData.retryPolicy.backoffStrategy}</div>
                  <div>Threshold: {selectedUnitData.retryPolicy.failureThreshold}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 