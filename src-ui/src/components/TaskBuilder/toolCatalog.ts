import type { ToolOption } from './ToolSelector'

export const TOOL_OPTIONS_BY_CAPABILITY: Record<string, ToolOption[]> = {
  code: [
    { name: 'Cargo (Rust)', command: 'cargo', argsTemplate: 'test' },
    { name: 'Node/NPM', command: 'npm', argsTemplate: 'test --silent' },
    { name: 'Yarn', command: 'yarn', argsTemplate: 'test' },
    { name: 'PNPM', command: 'pnpm', argsTemplate: 'test' },
    { name: 'Go', command: 'go', argsTemplate: 'test ./...' },
    { name: 'Python Pytest', command: 'pytest', argsTemplate: '-q' }
  ],
  text: [
    { name: 'jq', command: 'jq', argsTemplate: '.' }
  ],
  image: [
    { name: 'Graphviz', command: 'dot', argsTemplate: '-Tpng -o output.png' }
  ],
  sound: [
    { name: 'FFmpeg', command: 'ffmpeg', argsTemplate: '-i input.wav output.mp3' }
  ],
  video: [
    { name: 'FFmpeg', command: 'ffmpeg', argsTemplate: '-i input.mp4 -c:v libx264 output.mp4' }
  ],
  any: [
    { name: 'Powershell', command: 'powershell.exe', argsTemplate: '-File script.ps1' }
  ]
}


