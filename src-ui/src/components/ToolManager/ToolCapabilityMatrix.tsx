import React from 'react';
import { Tool } from './ToolManager';
// Uses global theme utility classes; no component-scoped CSS

interface ToolCapabilityMatrixProps {
  tools: Tool[];
  onSelectTool: (tool: Tool) => void;
}

// Define all possible capabilities with categories
const CAPABILITY_CATEGORIES = {
  'Video': ['video', 'VideoEncode', 'VideoDecode', 'VideoTranscode', 'VideoEdit', 'VideoComposite', 'VideoEffects'],
  'Audio': ['sound', 'AudioEncode', 'AudioDecode', 'AudioMix', 'AudioEffects', 'AudioSynthesize'],
  'Image': ['image', 'ImageResize', 'ImageConvert', 'ImageFilter', 'ImageComposite', 'ImageGenerate'],
  '3D': ['3d_models', 'ThreeDRender', 'ThreeDModel', 'ThreeDAnimate', 'ThreeDSimulate'],
  'Code': ['code', 'CodeCompile', 'CodeTranspile', 'CodeLint', 'CodeFormat', 'CodeTest', 'CodeExecute'],
  'Data': ['data_analysis', 'DataTransform', 'DataAnalyze', 'DataVisualize'],
  'Document': ['text', 'documentation', 'DocumentConvert', 'DocumentRender', 'DocumentMerge'],
  'System': ['deployment', 'containerization', 'version_control'],
};

export const ToolCapabilityMatrix: React.FC<ToolCapabilityMatrixProps> = ({
  tools,
  onSelectTool
}) => {
  // Get all unique capabilities from tools
  const getAllCapabilities = (): string[] => {
    const capSet = new Set<string>();
    Object.values(CAPABILITY_CATEGORIES).forEach(caps => {
      caps.forEach(cap => capSet.add(cap));
    });
    return Array.from(capSet);
  };

  const capabilities = getAllCapabilities();

  const hasCapability = (tool: Tool, capability: string): boolean => {
    return tool.capabilities.includes(capability);
  };

  const cannotProcess = (tool: Tool, capability: string): boolean => {
    if (!tool.cannot_process) return false;
    const capCategory = capability.toLowerCase();
    return tool.cannot_process.some(cp => 
      cp.toLowerCase() === capCategory || 
      (capCategory.includes(cp.toLowerCase()))
    );
  };

  const getCapabilityCategory = (capability: string): string => {
    for (const [category, caps] of Object.entries(CAPABILITY_CATEGORIES)) {
      if (caps.includes(capability)) {
        return category;
      }
    }
    return 'Other';
  };

  // Group capabilities by category
  const groupedCapabilities = capabilities.reduce((acc, cap) => {
    const category = getCapabilityCategory(cap);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cap);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="space-y-4">
      <div className="bg-dark-900/50 rounded-lg border border-dark-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs text-dark-300">
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">OK</span> Capability Available</div>
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">O</span> Supported but Not Installed</div>
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">X</span> Cannot Process</div>
          <div className="flex items-center gap-2"><span className="px-1.5 py-0.5 rounded bg-dark-700 text-dark-300">—</span> Not Supported</div>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-dark-700">
        <table className="min-w-full text-xs">
          <thead className="bg-dark-900">
            <tr>
              <th className="px-3 py-2 text-left text-dark-400">Tool</th>
              <th className="px-3 py-2 text-left text-dark-400">Status</th>
              {Object.entries(groupedCapabilities).map(([category, caps]) => (
                <React.Fragment key={category}>
                  <th colSpan={caps.length} className="px-3 py-2 text-left text-dark-300">{category}</th>
                </React.Fragment>
              ))}
            </tr>
            <tr className="bg-dark-800">
              <th className="px-3 py-2" />
              <th className="px-3 py-2" />
              {Object.values(groupedCapabilities).flat().map(cap => (
                <th key={cap} className="px-3 py-2 text-dark-500">
                  <div title={cap}>{cap.replace(/([A-Z])/g, ' $1').trim()}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-dark-900/40">
            {tools.map(tool => (
              <tr key={tool.id} className="border-t border-dark-700 hover:bg-dark-800/50 cursor-pointer" onClick={() => onSelectTool(tool)}>
                <td className="px-3 py-2 text-white whitespace-nowrap">
                  {tool.name} {tool.version && (<span className="ml-1 text-dark-400">v{tool.version}</span>)}
                </td>
                <td className="px-3 py-2">
                  {tool.is_available ? (
                    <span className="text-green-400">●</span>
                  ) : (
                    <span className="text-dark-500">●</span>
                  )}
                </td>
                {Object.values(groupedCapabilities).flat().map(cap => (
                  <td key={`${tool.id}-${cap}`} className="px-3 py-2 text-center">
                    {cannotProcess(tool, cap) ? (
                      <span className="text-red-400">X</span>
                    ) : hasCapability(tool, cap) ? (
                      tool.is_available ? <span className="text-green-400">OK</span> : <span className="text-yellow-400">O</span>
                    ) : (
                      <span className="text-dark-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-dark-900/50 rounded-lg border border-dark-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Capability Coverage Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(groupedCapabilities).map(([category, caps]) => {
            const availableCount = tools.filter(t => t.is_available && caps.some(c => t.capabilities.includes(c))).length;
            const totalCount = tools.filter(t => caps.some(c => t.capabilities.includes(c))).length;
            const pct = totalCount > 0 ? (availableCount / totalCount) * 100 : 0;
            return (
              <div key={category} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-dark-300">{category}</span>
                  <span className="text-dark-400">{availableCount}/{totalCount}</span>
                </div>
                <div className="w-full h-1.5 bg-dark-700 rounded">
                  <div className="h-1.5 rounded bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};