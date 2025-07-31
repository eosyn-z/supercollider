import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';

// Import routes
import workflowRoutes from './routes/workflows';
import agentRoutes from './routes/agents';
import systemRoutes from './routes/system';
import fileRoutes from './routes/fileRoutes';

// Import service registry
import { serviceRegistry } from './services/ServiceRegistry';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'supercollider-api',
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/workflows', workflowRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/files', fileRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Supercollider API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'AI Workflow Orchestration Platform API',
    endpoints: {
      health: '/health',
      workflows: '/api/workflows',
      agents: '/api/agents',
      system: '/api/system',
      files: '/api/files',
      websocket: '/ws'
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

const clients = new Map<string, Set<any>>();

wss.on('connection', (ws, req) => {
  console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'subscribe':
          if (data.workflowId) {
            if (!clients.has(data.workflowId)) {
              clients.set(data.workflowId, new Set());
            }
            clients.get(data.workflowId)!.add(ws);
            console.log(`Client subscribed to workflow ${data.workflowId}`);
          }
          break;
          
        case 'unsubscribe':
          if (data.workflowId && clients.has(data.workflowId)) {
            clients.get(data.workflowId)!.delete(ws);
            console.log(`Client unsubscribed from workflow ${data.workflowId}`);
          }
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    // Remove client from all subscriptions
    for (const [workflowId, workflowClients] of clients.entries()) {
      workflowClients.delete(ws);
      if (workflowClients.size === 0) {
        clients.delete(workflowId);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection-established',
    workflowId: '',
    data: { message: 'Connected to Supercollider WebSocket' },
    timestamp: new Date().toISOString()
  }));
});

// Broadcast function for services
const broadcast = (workflowId: string, message: any) => {
  const workflowClients = clients.get(workflowId);
  if (workflowClients) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    });
    
    workflowClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }
};

// Initialize all services
serviceRegistry.initialize();

// Get service instances
const executionService = serviceRegistry.executionService;
const systemService = serviceRegistry.systemService;
const fileWorkflowIntegration = serviceRegistry.fileWorkflowIntegration;

// Set up execution service event listeners
executionService.on('execution-started', (data) => {
  broadcast(data.workflowId, {
    type: 'execution-started',
    workflowId: data.workflowId,
    data: data.executionState
  });
});

executionService.on('execution-completed', (data) => {
  broadcast(data.workflowId, {
    type: 'execution-completed',
    workflowId: data.workflowId,
    data: data.executionState
  });
});

executionService.on('execution-failed', (data) => {
  broadcast(data.workflowId, {
    type: 'execution-failed',
    workflowId: data.workflowId,
    data: { executionState: data.executionState, error: data.error }
  });
});

executionService.on('execution-halted', (data) => {
  broadcast(data.workflowId, {
    type: 'execution-halted',
    workflowId: data.workflowId,
    data: { executionState: data.executionState, reason: data.reason }
  });
});

executionService.on('subtask-started', (data) => {
  broadcast(data.workflowId, {
    type: 'subtask-started',
    workflowId: data.workflowId,
    subtaskId: data.subtaskId,
    data: data.subtask
  });
});

executionService.on('subtask-completed', (data) => {
  broadcast(data.workflowId, {
    type: 'subtask-completed',
    workflowId: data.workflowId,
    subtaskId: data.subtaskId,
    agentId: data.agent?.id,
    data: data.result
  });
});

executionService.on('subtask-failed', (data) => {
  broadcast(data.workflowId, {
    type: 'subtask-failed',
    workflowId: data.workflowId,
    subtaskId: data.subtaskId,
    data: data.error
  });
});

// Set up file workflow integration event listeners
fileWorkflowIntegration.on('file-workflow-started', (execution) => {
  broadcast(`file_${execution.fileId}`, {
    type: 'file-workflow-started',
    workflowId: execution.workflowId,
    fileId: execution.fileId,
    data: execution
  });
});

fileWorkflowIntegration.on('file-workflow-completed', (execution) => {
  broadcast(`file_${execution.fileId}`, {
    type: 'file-workflow-completed',
    workflowId: execution.workflowId,
    fileId: execution.fileId,
    data: execution
  });
});

fileWorkflowIntegration.on('file-workflow-failed', (execution) => {
  broadcast(`file_${execution.fileId}`, {
    type: 'file-workflow-failed',
    workflowId: execution.workflowId,
    fileId: execution.fileId,
    data: execution
  });
});

fileWorkflowIntegration.on('file-workflow-progress', (data) => {
  broadcast(`file_${data.execution.fileId}`, {
    type: 'file-workflow-progress',
    workflowId: data.execution.workflowId,
    fileId: data.execution.fileId,
    taskId: data.taskId,
    progress: data.progress
  });
});

fileWorkflowIntegration.on('workflow-suggestions-generated', (data) => {
  broadcast(`file_${data.fileId}`, {
    type: 'workflow-suggestions-generated',
    fileId: data.fileId,
    data: { suggestions: data.suggestions, workflows: data.workflows }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ 
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Supercollider API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/`);
  
  // Start system metrics collection
  systemService.startMetricsCollection();
  
  console.log('✅ All services initialized successfully');
});

export default app;