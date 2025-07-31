/**
 * WebSocket-based Progress Broadcasting System
 * Provides real-time updates for todo progress, workflow execution, and batch status
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ProgressParser, ProgressUpdate } from '../core/utils/progressParser';
import { SubtaskTodoList } from '../../core/utils/dataInjector';
import { EnhancedExecutionState, ExecutionTimelineEvent } from '../../shared/types/enhanced';

export interface WebSocketMessage {
  type: 'progress-update' | 'todo-update' | 'workflow-status' | 'batch-update' | 'error' | 'ping' | 'pong';
  timestamp: number;
  data: any;
  clientId?: string;
  workflowId?: string;
  subtaskId?: string;
}

export interface ClientSubscription {
  clientId: string;
  workflowIds: Set<string>;
  subtaskIds: Set<string>;
  eventTypes: Set<string>;
  lastPing: number;
  connection: WebSocket;
}

export interface BroadcastConfig {
  port: number;
  heartbeatInterval: number;
  clientTimeout: number;
  maxClients: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export class ProgressBroadcaster extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, ClientSubscription> = new Map();
  private progressParser: ProgressParser;
  private config: BroadcastConfig;
  private heartbeatTimer?: NodeJS.Timeout;
  private metrics: {
    messagessSent: number;
    clientsConnected: number;
    errors: number;
    startTime: number;
  };

  constructor(
    progressParser: ProgressParser,
    config: Partial<BroadcastConfig> = {}
  ) {
    super();
    
    this.progressParser = progressParser;
    this.config = {
      port: 8080,
      heartbeatInterval: 30000,
      clientTimeout: 60000,
      maxClients: 100,
      enableCompression: true,
      enableMetrics: true,
      ...config
    };

    this.metrics = {
      messagessSent: 0,
      clientsConnected: 0,
      errors: 0,
      startTime: Date.now()
    };

    this.initializeWebSocketServer();
    this.setupProgressParserListeners();
    this.startHeartbeat();
  }

  /**
   * Initialize WebSocket server
   */
  private initializeWebSocketServer(): void {
    this.wss = new WebSocketServer({
      port: this.config.port,
      perMessageDeflate: this.config.enableCompression
    });

    this.wss.on('connection', (ws, request) => {
      this.handleNewConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.metrics.errors++;
      this.emit('server-error', error);
    });

    console.log(`Progress broadcaster started on port ${this.config.port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket, request: any): void {
    if (this.clients.size >= this.config.maxClients) {
      ws.close(1013, 'Server full');
      return;
    }

    const clientId = this.generateClientId();
    const client: ClientSubscription = {
      clientId,
      workflowIds: new Set(),
      subtaskIds: new Set(),
      eventTypes: new Set(),
      lastPing: Date.now(),
      connection: ws
    };

    this.clients.set(clientId, client);
    this.metrics.clientsConnected++;

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'ping',
      timestamp: Date.now(),
      data: {
        clientId,
        message: 'Connected to progress broadcaster',
        serverMetrics: this.config.enableMetrics ? this.getMetrics() : undefined
      }
    });

    // Set up message handlers
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this.metrics.errors++;
      this.handleClientDisconnect(clientId);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }
    });

    this.emit('client-connected', { clientId, totalClients: this.clients.size });
  }

  /**
   * Handle messages from clients
   */
  private handleClientMessage(clientId: string, data: Buffer | string): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      const client = this.clients.get(clientId);
      
      if (!client) return;

      switch (message.type) {
        case 'ping':
          client.lastPing = Date.now();
          this.sendToClient(clientId, {
            type: 'pong',
            timestamp: Date.now(),
            data: { clientId }
          });
          break;

        case 'progress-update':
          // Handle subscription updates
          if (message.data.subscribe) {
            this.updateClientSubscription(clientId, message.data.subscribe);
          }
          break;

        default:
          console.warn(`Unknown message type from client ${clientId}:`, message.type);
      }
    } catch (error) {
      console.error(`Error parsing message from client ${clientId}:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Update client subscription preferences
   */
  private updateClientSubscription(clientId: string, subscriptionData: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (subscriptionData.workflowIds) {
      client.workflowIds = new Set(subscriptionData.workflowIds);
    }

    if (subscriptionData.subtaskIds) {
      client.subtaskIds = new Set(subscriptionData.subtaskIds);
    }

    if (subscriptionData.eventTypes) {
      client.eventTypes = new Set(subscriptionData.eventTypes);
    }

    this.sendToClient(clientId, {
      type: 'progress-update',
      timestamp: Date.now(),
      data: {
        message: 'Subscription updated',
        subscriptions: {
          workflowIds: Array.from(client.workflowIds),
          subtaskIds: Array.from(client.subtaskIds),
          eventTypes: Array.from(client.eventTypes)
        }
      }
    });
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.connection.terminate();
      this.clients.delete(clientId);
      this.emit('client-disconnected', { clientId, totalClients: this.clients.size });
    }
  }

  /**
   * Set up listeners for progress parser events
   */
  private setupProgressParserListeners(): void {
    this.progressParser.on('todo-updated', (data) => {
      this.broadcastTodoUpdate(data);
    });

    this.progressParser.on('progress-batch-update', (data) => {
      this.broadcastProgressBatch(data);
    });

    this.progressParser.on('todolist-registered', (data) => {
      this.broadcastTodoListRegistration(data);
    });

    this.progressParser.on('todolist-unregistered', (data) => {
      this.broadcastTodoListUnregistration(data);
    });
  }

  /**
   * Broadcast individual todo update
   */
  private broadcastTodoUpdate(data: {
    subtaskId: string;
    todoId: string;
    update: ProgressUpdate;
    todoList: SubtaskTodoList;
  }): void {
    const message: WebSocketMessage = {
      type: 'todo-update',
      timestamp: Date.now(),
      subtaskId: data.subtaskId,
      data: {
        todoId: data.todoId,
        update: data.update,
        todoList: {
          ...data.todoList,
          todos: data.todoList.todos.filter(t => t.id === data.todoId) // Send only updated todo
        }
      }
    };

    this.broadcastToSubscribers(message, {
      subtaskId: data.subtaskId,
      eventType: 'todo-update'
    });
  }

  /**
   * Broadcast progress batch update
   */
  private broadcastProgressBatch(data: {
    subtaskId: string;
    updates: ProgressUpdate[];
    timestamp: number;
  }): void {
    const message: WebSocketMessage = {
      type: 'progress-update',
      timestamp: Date.now(),
      subtaskId: data.subtaskId,
      data: {
        updates: data.updates,
        batchTimestamp: data.timestamp
      }
    };

    this.broadcastToSubscribers(message, {
      subtaskId: data.subtaskId,
      eventType: 'progress-update'
    });
  }

  /**
   * Broadcast todo list registration
   */
  private broadcastTodoListRegistration(data: {
    subtaskId: string;
    todoList: SubtaskTodoList;
  }): void {
    const message: WebSocketMessage = {
      type: 'todo-update',
      timestamp: Date.now(),
      subtaskId: data.subtaskId,
      data: {
        action: 'registered',
        todoList: data.todoList
      }
    };

    this.broadcastToSubscribers(message, {
      subtaskId: data.subtaskId,
      eventType: 'todo-update'
    });
  }

  /**
   * Broadcast todo list unregistration
   */
  private broadcastTodoListUnregistration(data: { subtaskId: string }): void {
    const message: WebSocketMessage = {
      type: 'todo-update',
      timestamp: Date.now(),
      subtaskId: data.subtaskId,
      data: {
        action: 'unregistered'
      }
    };

    this.broadcastToSubscribers(message, {
      subtaskId: data.subtaskId,
      eventType: 'todo-update'
    });
  }

  /**
   * Broadcast workflow status update
   */
  broadcastWorkflowStatus(workflowId: string, executionState: EnhancedExecutionState): void {
    const message: WebSocketMessage = {
      type: 'workflow-status',
      timestamp: Date.now(),
      workflowId,
      data: {
        status: executionState.status,
        progress: executionState.progress,
        errors: executionState.errors,
        timeline: executionState.timeline.slice(-10) // Send only recent timeline events
      }
    };

    this.broadcastToSubscribers(message, {
      workflowId,
      eventType: 'workflow-status'
    });
  }

  /**
   * Broadcast batch execution update
   */
  broadcastBatchUpdate(workflowId: string, batchData: any): void {
    const message: WebSocketMessage = {
      type: 'batch-update',
      timestamp: Date.now(),
      workflowId,
      data: batchData
    };

    this.broadcastToSubscribers(message, {
      workflowId,
      eventType: 'batch-update'
    });
  }

  /**
   * Broadcast error message
   */
  broadcastError(error: {
    workflowId?: string;
    subtaskId?: string;
    message: string;
    type: string;
    context?: any;
  }): void {
    const message: WebSocketMessage = {
      type: 'error',
      timestamp: Date.now(),
      workflowId: error.workflowId,
      subtaskId: error.subtaskId,
      data: {
        message: error.message,
        errorType: error.type,
        context: error.context
      }
    };

    this.broadcastToSubscribers(message, {
      workflowId: error.workflowId,
      subtaskId: error.subtaskId,
      eventType: 'error'
    });
  }

  /**
   * Broadcast to subscribers matching criteria
   */
  private broadcastToSubscribers(
    message: WebSocketMessage,
    criteria: {
      workflowId?: string;
      subtaskId?: string;
      eventType?: string;
    }
  ): void {
    let targetClients = Array.from(this.clients.values());

    // Filter by subscription criteria
    if (criteria.workflowId) {
      targetClients = targetClients.filter(client => 
        client.workflowIds.size === 0 || client.workflowIds.has(criteria.workflowId!)
      );
    }

    if (criteria.subtaskId) {
      targetClients = targetClients.filter(client => 
        client.subtaskIds.size === 0 || client.subtaskIds.has(criteria.subtaskId!)
      );
    }

    if (criteria.eventType) {
      targetClients = targetClients.filter(client => 
        client.eventTypes.size === 0 || client.eventTypes.has(criteria.eventType!)
      );
    }

    // Send to all matching clients
    targetClients.forEach(client => {
      this.sendToClient(client.clientId, message);
    });

    this.metrics.messagessSent += targetClients.length;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.connection.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      client.connection.send(messageString);
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.metrics.errors++;
      this.handleClientDisconnect(clientId);
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const clientsToRemove: string[] = [];

      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing > this.config.clientTimeout) {
          clientsToRemove.push(clientId);
        } else if (client.connection.readyState === WebSocket.OPEN) {
          // Send ping
          client.connection.ping();
        }
      });

      // Remove timed out clients
      clientsToRemove.forEach(clientId => {
        this.handleClientDisconnect(clientId);
      });

    }, this.config.heartbeatInterval);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get server metrics
   */
  getMetrics(): {
    connectedClients: number;
    messagesSent: number;
    errors: number;
    uptime: number;
    serverLoad: {
      cpu: number;
      memory: number;
    };
  } {
    const uptime = Date.now() - this.metrics.startTime;
    
    return {
      connectedClients: this.clients.size,
      messagesSent: this.metrics.messagessSent,
      errors: this.metrics.errors,
      uptime,
      serverLoad: {
        cpu: process.cpuUsage().user / 1000000, // Convert to seconds
        memory: process.memoryUsage().rss / 1024 / 1024 // Convert to MB
      }
    };
  }

  /**
   * Get connected clients info
   */
  getConnectedClients(): Array<{
    clientId: string;
    connected: Date;
    subscriptions: {
      workflowIds: string[];
      subtaskIds: string[];
      eventTypes: string[];
    };
    lastPing: Date;
  }> {
    return Array.from(this.clients.values()).map(client => ({
      clientId: client.clientId,
      connected: new Date(this.metrics.startTime),
      subscriptions: {
        workflowIds: Array.from(client.workflowIds),
        subtaskIds: Array.from(client.subtaskIds),
        eventTypes: Array.from(client.eventTypes)
      },
      lastPing: new Date(client.lastPing)
    }));
  }

  /**
   * Manually trigger broadcast for testing
   */
  testBroadcast(message: Partial<WebSocketMessage>): void {
    const testMessage: WebSocketMessage = {
      type: 'progress-update',
      timestamp: Date.now(),
      data: { test: true },
      ...message
    };

    this.clients.forEach(client => {
      this.sendToClient(client.clientId, testMessage);
    });
  }

  /**
   * Shutdown the broadcaster
   */
  shutdown(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Close all client connections
      this.clients.forEach(client => {
        client.connection.close(1001, 'Server shutting down');
      });

      // Close WebSocket server
      this.wss.close(() => {
        console.log('Progress broadcaster shut down');
        resolve();
      });
    });
  }
}

/**
 * Factory function to create progress broadcaster with common configurations
 */
export function createProgressBroadcaster(
  progressParser: ProgressParser,
  mode: 'development' | 'production' | 'testing' = 'production'
): ProgressBroadcaster {
  const configs = {
    development: {
      port: 8080,
      heartbeatInterval: 10000,
      clientTimeout: 30000,
      maxClients: 10,
      enableCompression: false,
      enableMetrics: true
    },
    production: {
      port: 8080,
      heartbeatInterval: 30000,
      clientTimeout: 60000,
      maxClients: 100,
      enableCompression: true,
      enableMetrics: true
    },
    testing: {
      port: 8081,
      heartbeatInterval: 5000,
      clientTimeout: 15000,
      maxClients: 5,
      enableCompression: false,
      enableMetrics: false
    }
  };

  return new ProgressBroadcaster(progressParser, configs[mode]);
}