# Supercollider AI Orchestration Platform

A sophisticated AI workflow orchestration platform that enables complex task breakdown, multi-agent management, atomic workflow decomposition, and real-time execution monitoring with advanced file processing capabilities.

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

## Advanced Features

### Core Orchestration
- **Atomic Workflow Decomposition**: Intelligent breakdown of complex tasks into atomic, executable components
- **Smart Shredding**: Advanced prompt analysis and token-based task slicing with semantic understanding
- **Multi-Agent Coordination**: Priority-based agent assignment with fallback management and load balancing
- **Real-time Execution**: WebSocket-powered live execution monitoring with progress tracking
- **Validation Framework**: Configurable validation for each subtask with quality checks and business rules

### File Processing & Integration
- **File Upload & Analysis**: Drag-and-drop file processing with automatic capability detection
- **Media Analysis**: Image, video, audio, and document analysis with AI-powered content extraction
- **Workflow Generation**: Automatic workflow suggestion based on file type and content
- **Batch Processing**: Parallel file processing with progress tracking and error handling
- **Storage Management**: Secure file storage with versioning, backup, and access control

### Advanced Workflow Management
- **Visual Workflow Designer**: React Flow-based workflow visualization with interactive editing
- **Atomic Task Library**: Pre-built task templates for common operations
- **Execution Planning**: Intelligent task scheduling with dependency resolution
- **Resource Management**: Dynamic resource allocation and performance monitoring
- **Error Recovery**: Automatic retry mechanisms with fallback strategies

### Agent Management
- **Agent Registry**: Comprehensive agent management with capability mapping
- **API Key Management**: Secure API key storage and rotation
- **Performance Tracking**: Real-time agent performance metrics and cost analysis
- **Load Balancing**: Intelligent agent selection based on availability and capabilities
- **Fallback Management**: Automatic agent switching on failures

### GUI Components
- **Smart Shred Interface**: Advanced prompt analysis and token management
- **File Upload Zone**: Drag-and-drop file processing with progress tracking
- **Atomic Workflow Visualizer**: Interactive workflow decomposition viewer
- **Agent Assignment Panel**: Visual agent assignment and priority configuration
- **Execution Timeline**: Real-time execution progress with detailed metrics
- **Validation Settings Editor**: Per-subtask validation configuration
- **Workflow Progress Dashboard**: Comprehensive execution monitoring

## Architecture

### Client (React + TypeScript)
- React 18 with TypeScript for type safety
- React Flow for advanced workflow visualization
- DnD Kit for drag-and-drop interactions
- Axios for API communication with retry logic
- WebSocket for real-time updates and progress tracking
- Tailwind CSS for modern, responsive styling
- Advanced state management with error boundaries

### Server (Express + TypeScript)
- Express.js API with comprehensive middleware and validation
- WebSocket server for real-time communication and progress broadcasting
- Zod validation for request/response validation
- Event-driven architecture with advanced error handling
- SQLite database for workflow and result persistence
- File processing pipeline with media analysis capabilities

### Core Engine
- **Task Slicer**: Advanced prompt analysis and semantic task decomposition
- **Enhanced Dispatcher**: Multi-agent coordination with retry and fallback logic
- **Execution Controller**: Workflow orchestration with dependency management
- **Result Store**: Persistent result storage with caching and retrieval
- **API Key Manager**: Secure key management with rotation and validation
- **Validator**: Comprehensive validation framework with custom rules

### Advanced Utilities
- **Smart Shredder**: Token-based prompt analysis and optimization
- **Atomic Decomposer**: Intelligent workflow breakdown into atomic tasks
- **Runtime Workflow Generator**: Dynamic workflow creation from file analysis
- **Media Classifier**: AI-powered file type and content analysis
- **Progress Parser**: Real-time execution progress analysis
- **Multipass Generator**: Iterative task improvement with quality assessment

## Project Structure

```
supercollider/
├── client/          # React frontend with advanced UI components
├── server/          # Node.js backend with comprehensive API
├── core/            # Shared logic, types, and advanced utilities
├── shared/          # Common type definitions and interfaces
├── data/            # Local data storage and caching
├── db/              # SQLite database files
├── prompts/         # Prompt templates and execution history
├── scripts/         # Development utilities and CLI tools
├── storage/         # File storage with processing pipeline
└── start.bat        # Windows startup script
```

## API Endpoints

### Workflows
- `GET /api/workflows` - List all workflows with filtering
- `POST /api/workflows` - Create new workflow with atomic decomposition
- `GET /api/workflows/:id` - Get workflow details with execution state
- `POST /api/workflows/:id/execute` - Start execution with agent assignment
- `POST /api/workflows/:id/halt` - Halt execution with state preservation
- `POST /api/workflows/:id/resume` - Resume execution from checkpoint

### Agents
- `GET /api/agents` - List all agents with performance metrics
- `POST /api/agents` - Register new agent with capability mapping
- `GET /api/agents/:id` - Get agent details with availability status
- `PUT /api/agents/:id` - Update agent configuration and capabilities

### Files
- `POST /api/files/upload` - Upload files with automatic analysis
- `GET /api/files` - List files with filtering and search
- `GET /api/files/:id` - Get file details with processing results
- `POST /api/files/:id/process` - Trigger file processing workflow
- `DELETE /api/files/:id` - Delete file with cleanup

### System
- `GET /api/system/health` - Comprehensive system health check
- `GET /api/system/metrics` - Real-time system metrics and performance
- `GET /api/system/agents` - Agent availability and performance status
- `POST /api/system/validate` - Validate system configuration

## WebSocket Events

Real-time events for comprehensive execution monitoring:
- `execution-started` - Workflow execution began with agent assignment
- `execution-completed` - Workflow execution finished with results
- `execution-failed` - Workflow execution failed with error details
- `execution-halted` - Workflow execution halted with reason
- `subtask-started` - Individual subtask started with agent info
- `subtask-completed` - Individual subtask completed with results
- `subtask-failed` - Individual subtask failed with error details
- `file-workflow-started` - File processing workflow initiated
- `file-workflow-progress` - File processing progress update
- `workflow-suggestions-generated` - File-based workflow suggestions

## Advanced Capabilities

### Atomic Workflow Decomposition
- Intelligent task breakdown based on semantic analysis
- Dependency resolution and parallel execution planning
- Resource requirement analysis and allocation
- Quality assessment and optimization suggestions

### Smart File Processing
- Automatic file type detection and capability analysis
- AI-powered content extraction and analysis
- Workflow suggestion based on file content and type
- Batch processing with progress tracking

### Multi-Agent Orchestration
- Dynamic agent selection based on task requirements
- Load balancing and performance optimization
- Automatic fallback and retry mechanisms
- Real-time performance monitoring and cost tracking

### Advanced Validation
- Custom validation rules and business logic
- Quality checks and performance metrics
- Error recovery and suggestion generation
- Comprehensive audit trails

## Development

### Dependencies
All required dependencies are included in package.json files:

**Client**: React, React Flow, DnD Kit, Axios, Tailwind CSS, Lucide React
**Server**: Express, WebSocket, Zod, SQLite, Multer, Node-Cron, OpenAI
**Core**: Advanced TypeScript utilities for workflow orchestration

### Scripts
- `npm run dev` - Development server with hot reload
- `npm run build` - Production build with optimization
- `npm run test` - Comprehensive test suite
- `npm run lint` - Code linting and type checking
- `npm run install:all` - Install all dependencies

### Environment Variables
Create `.env` files as needed:

**Server (.env)**:
```
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
FILE_STORAGE_PATH=./storage
MAX_FILE_SIZE=104857600
```

**Client (.env)**:
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

## System Requirements

- Node.js 18+
- npm or yarn
- Modern web browser with WebSocket support
- 4GB+ RAM for optimal performance
- SSD storage recommended for file processing

## Troubleshooting

### Common Issues
1. **Port conflicts**: Change ports in package.json scripts
2. **WebSocket connection**: Ensure backend is running first
3. **CORS errors**: Check FRONTEND_URL in server environment
4. **File upload issues**: Verify storage directory permissions
5. **Memory issues**: Increase Node.js memory limit for large files

### Connection Status
The header shows comprehensive connection indicators:
- 🟢 Online: API server connection
- 🔵 WebSocket: Real-time updates active
- 📊 Metrics: System performance monitoring
- 🔑 Keys: API key validation status

## Support

For issues or questions:
1. Check browser console for detailed error messages
2. Verify both client and server are running
3. Check network tab for failed requests
4. Ensure all dependencies are installed
5. Review server logs for detailed error information

## License

MIT License 