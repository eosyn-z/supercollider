import React from 'react'
import { ToolManager } from '../components/ToolManager/ToolManager'

export default function ToolConfiguration() {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-screen-2xl mx-auto px-8 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Tool Configuration</h1>
          <p className="text-dark-400">Detect, validate, and configure common tools (FFmpeg, Blender, ImageMagick, Pandoc, etc.) used by agents.</p>
        </div>

        <ToolManager />
      </div>
    </div>
  )
}


