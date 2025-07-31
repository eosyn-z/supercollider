# Supercollider AI Orchestration Platform

A powerful AI workflow orchestration platform that enables complex task breakdown, agent management, and real-time execution monitoring.

## Quick Start

### Windows
Run the startup script:
```batch
start.bat
```

### Manual Setup
1. Start the backend server:
```bash
cd server
npm install
npm run dev
```

2. In a new terminal, start the frontend client:
```bash
cd client
npm install
npm run dev
```

## Access Points

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **WebSocket**: ws://localhost:3000/ws

## Features

### Core Features
- **Workflow Graph**: Visual workflow designer with React Flow
- **Agent Management**: Priority-based agent assignment and management
- **Real-time Execution**: WebSocket-powered live execution monitoring
- **Validation Settings**: Configurable validation for each subtask
- **Connection Monitoring**: Real-time connection status indicators

### GUI Components
- **Start Execution**: Initiates workflow execution with configured agents
- **Halt/Resume**: Full execution control with halt and resume capabilities
- **Agent Priorities**: Drag-and-drop agent priority configuration by subtask type
- **Validation Editor**: Per-subtask validation configuration
- **Real-time Status**: Live execution status with color-coded indicators

## Architecture

### Client (React + TypeScript)
- React 18 with TypeScript for type safety
- React Flow for workflow visualization
- DnD Kit for drag-and-drop agent prioritization
- Axios for API communication
- WebSocket for real-time updates
- Tailwind CSS for styling

### Server (Express + TypeScript)
- Express.js API with comprehensive middleware
- WebSocket server for real-time communication
- Zod validation for request validation
- Event-driven architecture with fallback management
- SQLite database for workflow persistence

## Project Structure

```
supercollider/
├── client/          # React frontend application
├── server/          # Node.js backend API
├── core/            # Shared logic and types
├── data/            # Local data storage
├── db/              # SQLite database files
├── prompts/         # Prompt templates and history
├── scripts/         # Development utilities and CLI
└── start.bat        # Windows startup script
```

## API Endpoints

### Workflows
- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create new workflow
- `GET /api/workflows/:id` - Get workflow details
- `POST /api/workflows/:id/execute` - Start execution
- `POST /api/workflows/:id/halt` - Halt execution
- `POST /api/workflows/:id/resume` - Resume execution

### Agents
- `GET /api/agents` - List all agents
- `POST /api/agents` - Create new agent
- `GET /api/agents/:id` - Get agent details

### System
- `GET /api/system/health` - System health check
- `GET /api/system/metrics` - System metrics

## WebSocket Events

Real-time events for execution monitoring:
- `execution-started` - Workflow execution began
- `execution-completed` - Workflow execution finished
- `subtask-started` - Individual subtask started
- `subtask-completed` - Individual subtask completed
- `subtask-failed` - Individual subtask failed

## Development

### Dependencies
All required dependencies are included in package.json files:

**Client**: React, React Flow, DnD Kit, Axios, Tailwind CSS
**Server**: Express, WebSocket, Zod, SQLite, TypeScript

### Scripts
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build
- `npm run test` - Run tests
- `npm run lint` - Code linting

### Environment Variables
Create `.env` files as needed:

**Server (.env)**:
```
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

**Client (.env)**:
```
VITE_API_URL=http://localhost:3000
```

## System Requirements

- Node.js 18+
- npm or yarn
- Modern web browser with WebSocket support

## Troubleshooting

### Common Issues
1. **Port conflicts**: Change ports in package.json scripts
2. **WebSocket connection**: Ensure backend is running first
3. **CORS errors**: Check FRONTEND_URL in server environment
4. **Type errors**: Ensure all dependencies are installed

### Connection Status
The header shows connection indicators:
- 🟢 Online: API server connection
- 🔵 WebSocket: Real-time updates active

## Support

For issues or questions:
1. Check browser console for errors
2. Verify both client and server are running
3. Check network tab for failed requests
4. Ensure all dependencies are installed

## License

MIT License 