/**
 * WebSocket client for real-time execution updates
 */

import React from 'react';

export type WebSocketEventType = 
  | 'execution-started'
  | 'execution-completed'
  | 'execution-failed'
  | 'execution-halted'
  | 'subtask-started'
  | 'subtask-completed'
  | 'subtask-failed'
  | 'subtask-progress'
  | 'agent-status-changed'
  | 'validation-result'
  | 'error'
  | 'connection-established'
  | 'connection-lost';

export interface WebSocketMessage {
  type: WebSocketEventType;
  workflowId: string;
  subtaskId?: string;
  agentId?: string;
  data: any;
  timestamp: string;
}

export type WebSocketEventHandler = (message: WebSocketMessage) => void;

export class SupercolliderWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<WebSocketEventType, WebSocketEventHandler[]> = new Map();
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(baseUrl: string = 'ws://localhost:8080') {
    this.url = `${baseUrl}/ws`;
    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Initialize empty handler arrays for each event type
    const eventTypes: WebSocketEventType[] = [
      'execution-started', 'execution-completed', 'execution-failed', 'execution-halted',
      'subtask-started', 'subtask-completed', 'subtask-failed', 'subtask-progress',
      'agent-status-changed', 'validation-result', 'error',
      'connection-established', 'connection-lost'
    ];

    eventTypes.forEach(type => {
      this.eventHandlers.set(type, []);
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          
          this.emit('connection-established', {
            type: 'connection-established',
            workflowId: '',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString()
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          
          this.emit('connection-lost', {
            type: 'connection-lost',
            workflowId: '',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString()
          });

          this.handleReconnection();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.stopHeartbeat();
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached. Please refresh the page.');
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log('WebSocket message received:', message);
    this.emit(message.type, message);
  }

  private emit(eventType: WebSocketEventType, message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in WebSocket event handler for ${eventType}:`, error);
      }
    });
  }

  // Public API for subscribing to events
  on(eventType: WebSocketEventType, handler: WebSocketEventHandler): () => void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.eventHandlers.get(eventType) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
        this.eventHandlers.set(eventType, currentHandlers);
      }
    };
  }

  off(eventType: WebSocketEventType, handler?: WebSocketEventHandler): void {
    if (!handler) {
      // Remove all handlers for this event type
      this.eventHandlers.set(eventType, []);
    } else {
      // Remove specific handler
      const handlers = this.eventHandlers.get(eventType) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.eventHandlers.set(eventType, handlers);
      }
    }
  }

  // Utility methods
  subscribeToWorkflow(workflowId: string): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        workflowId
      }));
    }
  }

  unsubscribeFromWorkflow(workflowId: string): void {
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        workflowId
      }));
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}

// React hook for WebSocket integration
export const useWebSocket = (baseUrl?: string) => {
  const [ws] = React.useState(() => new SupercolliderWebSocket(baseUrl));
  const [isConnected, setIsConnected] = React.useState(false);

  React.useEffect(() => {
    const unsubscribeConnection = ws.on('connection-established', () => {
      setIsConnected(true);
    });

    const unsubscribeDisconnection = ws.on('connection-lost', () => {
      setIsConnected(false);
    });

    // Auto-connect
    ws.connect().catch(error => {
      console.error('Failed to connect WebSocket:', error);
    });

    // Cleanup on unmount
    return () => {
      unsubscribeConnection();
      unsubscribeDisconnection();
      ws.disconnect();
    };
  }, [ws]);

  return {
    ws,
    isConnected,
    subscribe: (eventType: WebSocketEventType, handler: WebSocketEventHandler) => 
      ws.on(eventType, handler),
    subscribeToWorkflow: (workflowId: string) => ws.subscribeToWorkflow(workflowId),
    unsubscribeFromWorkflow: (workflowId: string) => ws.unsubscribeFromWorkflow(workflowId)
  };
};

// Export singleton instance
export const websocket = new SupercolliderWebSocket();