import React, { useState, useEffect } from 'react';
import { ToolList } from './ToolList';
import { ToolDetails } from './ToolDetails';
import { ToolCapabilityMatrix } from './ToolCapabilityMatrix';
import { invokeWithFallback as invoke } from '../../ipc/tauriWrapper';
import * as api from '../../ipc/commands'
// Uses global theme utility classes; no component-scoped CSS

export interface Tool {
  id: string;
  name: string;
  category: string;
  executable_path?: string;
  version?: string;
  capabilities: string[];
  input_formats: string[];
  output_formats: string[];
  is_available: boolean;
  requires_gpu: boolean;
  requires_network: boolean;
  documentation_url?: string;
  cannot_process?: string[];
}

interface ToolManagerProps {
  onToolSelect?: (tool: Tool) => void;
  selectedCapability?: string;
}

export const ToolManager: React.FC<ToolManagerProps> = ({ 
  onToolSelect, 
  selectedCapability 
}) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAvailable, setFilterAvailable] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTools();
    detectInstalledTools();
  }, []);

  const loadTools = async () => {
    try {
      setIsLoading(true);
      const response = await invoke<{ tools: Tool[] }>('tools_list');
      setTools(response.tools);
    } catch (err) {
      setError(`Failed to load tools: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const detectInstalledTools = async () => {
    try {
      await invoke('tools_detect');
      // Reload tools to get updated availability status
      await loadTools();
    } catch (err) {
      console.error('Failed to detect tools:', err);
    }
  };

  const handleManualAdd = async () => {
    // Modal inputs could be implemented later; for now, collect richer fields via prompts
    const id = prompt('Enter tool id (e.g., ffmpeg, blender):')?.trim();
    if (!id) return;
    const name = prompt('Enter display name:')?.trim() || id;
    const category = prompt('Enter category (e.g., VideoProcessing, ImageProcessing, ThreeDModeling, CodeCompilation, DocumentProcessing):')?.trim() || 'Custom';
    const capabilities = prompt('Enter capabilities (comma-separated, e.g., VideoEncode,VideoTranscode):')?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const input_formats = prompt('Enter input formats (comma-separated, e.g., mp4,avi):')?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const output_formats = prompt('Enter output formats (comma-separated, e.g., mp4,webm):')?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const requires_gpu = (prompt('Requires GPU? (y/n):') || 'n').toLowerCase().startsWith('y');
    const requires_network = (prompt('Requires Network? (y/n):') || 'n').toLowerCase().startsWith('y');
    try {
      setIsLoading(true);
      await api.toolsRegisterManual({ id, name, category, capabilities, input_formats, output_formats, requires_gpu, requires_network });
      await loadTools();
    } catch (err) {
      setError(`Failed to add tool: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstallTool = async (toolId: string) => {
    try {
      setIsLoading(true);
      const result = await invoke<{ success: boolean; message: string }>('tools_install', {
        tool_id: toolId
      });
      
      if (result.success) {
        await loadTools();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(`Failed to install tool: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateTool = async (toolId: string) => {
    try {
      const result = await invoke<{ valid: boolean; version?: string }>('tools_validate', {
        tool_id: toolId
      });
      
      if (result.valid) {
        // Update tool version in list
        setTools(tools.map(t => 
          t.id === toolId ? { ...t, version: result.version, is_available: true } : t
        ));
      }
    } catch (err) {
      setError(`Failed to validate tool: ${err}`);
    }
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
    onToolSelect?.(tool);
  };

  const getToolsForCapability = (capability: string): Tool[] => {
    return tools.filter(tool => 
      tool.is_available && 
      tool.capabilities.includes(capability) &&
      (!tool.cannot_process || !tool.cannot_process.includes(capability))
    );
  };

  const getCategories = (): string[] => {
    const categories = new Set(tools.map(t => t.category));
    return ['all', ...Array.from(categories)];
  };

  const filteredTools = tools.filter(tool => {
    const matchesCategory = filterCategory === 'all' || tool.category === filterCategory;
    const matchesAvailable = !filterAvailable || tool.is_available;
    const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tool.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tool.capabilities.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCapability = !selectedCapability || tool.capabilities.includes(selectedCapability);
    
    return matchesCategory && matchesAvailable && matchesSearch && matchesCapability;
  });

  return (
    <div className="bg-dark-800/50 rounded-xl border border-dark-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Tool Manager</h2>
        <div className="flex items-center gap-3">
          <button 
            className="btn btn-secondary"
            onClick={detectInstalledTools}
            disabled={isLoading}
          >
            Detect Installed Tools
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleManualAdd}
            disabled={isLoading}
          >
            Add Tool Manually
          </button>
          <div className="flex items-center gap-2">
            <button 
              className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('list')}
            >
              List View
            </button>
            <button 
              className={`btn ${viewMode === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('matrix')}
            >
              Capability Matrix
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg border border-red-600/40 bg-red-900/20 text-red-300 text-sm">
          <span>{error}</span>
          <button className="px-2 py-1 text-red-300 hover:text-white" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {selectedCapability && (
        <div className="mb-3 text-sm text-dark-300">
          <span>Showing tools for capability: <strong className="text-white">{selectedCapability}</strong></span>
          <div className="mt-1 text-xs text-dark-400">
            Compatible tools: {getToolsForCapability(selectedCapability).map(t => t.name).join(', ') || 'None available'}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white placeholder-dark-500"
        />
        
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
        >
          {getCategories().map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-dark-300">
          <input
            type="checkbox"
            checked={filterAvailable}
            onChange={(e) => setFilterAvailable(e.target.checked)}
          />
          Available Only
        </label>
      </div>

      <div>
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToolList
              tools={filteredTools}
              selectedTool={selectedTool}
              onSelectTool={handleToolSelect}
              onInstallTool={handleInstallTool}
              onValidateTool={handleValidateTool}
              isLoading={isLoading}
            />
            {selectedTool && (
              <ToolDetails
                tool={selectedTool}
                onClose={() => setSelectedTool(null)}
              />
            )}
          </div>
        ) : (
          <ToolCapabilityMatrix
            tools={filteredTools}
            onSelectTool={handleToolSelect}
          />
        )}
      </div>

      {isLoading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm grid place-items-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  );
};