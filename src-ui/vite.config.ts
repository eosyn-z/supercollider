import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
})
