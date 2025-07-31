/**
 * Progress Parsing and Update System
 * Parses checkpoint markers from agent responses and updates todo lists in real-time
 */

import { TodoItem, SubtaskTodoList, CheckpointMarker } from '../../../core/utils/dataInjector';
import { EventEmitter } from 'events';

export interface ProgressUpdate {
  todoId: string;
  type: 'completion' | 'progress' | 'error' | 'help';
  timestamp: number;
  data: {
    percentage?: number;
    errorMessage?: string;
    helpRequest?: string;
    metadata?: Record<string, any>;
  };
}

export interface ParsedCheckpoint {
  todoId: string;
  actionType: 'completion' | 'progress' | 'error' | 'help';
  value?: string | number;
  timestamp: number;
  rawMatch: string;
}

export interface ProgressParserConfig {
  enableRealTimeUpdates: boolean;
  batchUpdateInterval: number;
  maxParsingRetries: number;
  enableProgressValidation: boolean;
}

export class ProgressParser extends EventEmitter {
  private config: ProgressParserConfig;
  private activeTodoLists: Map<string, SubtaskTodoList> = new Map();
  private checkpointPatterns: RegExp[];
  private updateBuffer: Map<string, ProgressUpdate[]> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(config: Partial<ProgressParserConfig> = {}) {
    super();
    
    this.config = {
      enableRealTimeUpdates: true,
      batchUpdateInterval: 1000,
      maxParsingRetries: 3,
      enableProgressValidation: true,
      ...config
    };

    this.initializeCheckpointPatterns();
    
    if (this.config.enableRealTimeUpdates) {
      this.startBatchProcessor();
    }
  }

  /**
   * Initialize regex patterns for checkpoint detection
   */
  private initializeCheckpointPatterns(): void {
    this.checkpointPatterns = [
      /\[CHECKPOINT:([^:]+):COMPLETED\]/g,
      /\[PROGRESS:([^:]+):(\d+)\]/g,
      /\[ISSUE:([^:]+):([^\]]+)\]/g,
      /\[HELP:([^:]+):([^\]]+)\]/g,
      /✓\s*\[([^\]]+)\]\s*completed/gi,
      /❌\s*\[([^\]]+)\]\s*failed:?\s*([^\n]*)/gi,
      /⚠️\s*\[([^\]]+)\]\s*(\d+)%/gi,
      /🔄\s*\[([^\]]+)\]\s*in progress/gi
    ];
  }

  /**
   * Register a todo list for progress tracking
   */
  registerTodoList(subtaskId: string, todoList: SubtaskTodoList): void {
    this.activeTodoLists.set(subtaskId, todoList);
    this.emit('todolist-registered', { subtaskId, todoList });
  }

  /**
   * Unregister a todo list (cleanup when subtask completes)
   */
  unregisterTodoList(subtaskId: string): void {
    this.activeTodoLists.delete(subtaskId);
    this.updateBuffer.delete(subtaskId);
    this.emit('todolist-unregistered', { subtaskId });
  }

  /**
   * Parse agent response for progress checkpoints
   */
  parseAgentResponse(
    subtaskId: string,
    agentResponse: string,
    timestamp: number = Date.now()
  ): ParsedCheckpoint[] {
    const checkpoints: ParsedCheckpoint[] = [];
    
    // Try each pattern
    this.checkpointPatterns.forEach((pattern, index) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(agentResponse)) !== null) {
        const checkpoint = this.parseCheckpointMatch(match, index, timestamp);
        if (checkpoint) {
          checkpoints.push(checkpoint);
        }
      }
    });

    // Process found checkpoints
    if (checkpoints.length > 0) {
      this.processCheckpoints(subtaskId, checkpoints);
    }

    return checkpoints;
  }

  /**
   * Parse individual checkpoint match based on pattern type
   */
  private parseCheckpointMatch(
    match: RegExpMatchArray,
    patternIndex: number,
    timestamp: number
  ): ParsedCheckpoint | null {
    try {
      switch (patternIndex) {
        case 0: // [CHECKPOINT:todoId:COMPLETED]
          return {
            todoId: match[1],
            actionType: 'completion',
            timestamp,
            rawMatch: match[0]
          };

        case 1: // [PROGRESS:todoId:percentage]
          return {
            todoId: match[1],
            actionType: 'progress',
            value: parseInt(match[2], 10),
            timestamp,
            rawMatch: match[0]
          };

        case 2: // [ISSUE:todoId:description]
          return {
            todoId: match[1],
            actionType: 'error',
            value: match[2],
            timestamp,
            rawMatch: match[0]
          };

        case 3: // [HELP:todoId:question]
          return {
            todoId: match[1],
            actionType: 'help',
            value: match[2],
            timestamp,
            rawMatch: match[0]
          };

        case 4: // ✓ [todoId] completed
          return {
            todoId: match[1],
            actionType: 'completion',
            timestamp,
            rawMatch: match[0]
          };

        case 5: // ❌ [todoId] failed: reason
          return {
            todoId: match[1],
            actionType: 'error',
            value: match[2] || 'Task failed',
            timestamp,
            rawMatch: match[0]
          };

        case 6: // ⚠️ [todoId] percentage%
          return {
            todoId: match[1],
            actionType: 'progress',
            value: parseInt(match[2], 10),
            timestamp,
            rawMatch: match[0]
          };

        case 7: // 🔄 [todoId] in progress
          return {
            todoId: match[1],
            actionType: 'progress',
            value: 50, // Default to 50% for "in progress"
            timestamp,
            rawMatch: match[0]
          };

        default:
          return null;
      }
    } catch (error) {
      console.warn('Failed to parse checkpoint match:', match[0], error);
      return null;
    }
  }

  /**
   * Process parsed checkpoints and update todo lists
   */
  private processCheckpoints(subtaskId: string, checkpoints: ParsedCheckpoint[]): void {
    const todoList = this.activeTodoLists.get(subtaskId);
    if (!todoList) {
      console.warn(`No todo list found for subtask: ${subtaskId}`);
      return;
    }

    const updates: ProgressUpdate[] = [];

    checkpoints.forEach(checkpoint => {
      const todo = todoList.todos.find(t => t.id === checkpoint.todoId);
      if (!todo) {
        console.warn(`Todo item not found: ${checkpoint.todoId} in subtask ${subtaskId}`);
        return;
      }

      const update = this.createProgressUpdate(checkpoint, todo);
      if (update) {
        updates.push(update);
        this.applyProgressUpdate(todoList, update);
      }
    });

    if (updates.length > 0) {
      this.bufferUpdates(subtaskId, updates);
    }
  }

  /**
   * Create progress update object from checkpoint
   */
  private createProgressUpdate(checkpoint: ParsedCheckpoint, todo: TodoItem): ProgressUpdate | null {
    const baseUpdate: Partial<ProgressUpdate> = {
      todoId: checkpoint.todoId,
      type: checkpoint.actionType,
      timestamp: checkpoint.timestamp,
      data: {
        metadata: {
          rawMatch: checkpoint.rawMatch,
          previousStatus: todo.status,
          previousProgress: todo.progressPercentage
        }
      }
    };

    switch (checkpoint.actionType) {
      case 'completion':
        return {
          ...baseUpdate,
          type: 'completion',
          data: {
            ...baseUpdate.data,
            percentage: 100
          }
        } as ProgressUpdate;

      case 'progress':
        const percentage = typeof checkpoint.value === 'number' ? checkpoint.value : 0;
        if (this.config.enableProgressValidation && !this.isValidProgressUpdate(todo, percentage)) {
          console.warn(`Invalid progress update: ${percentage}% for todo ${todo.id}`);
          return null;
        }
        return {
          ...baseUpdate,
          type: 'progress',
          data: {
            ...baseUpdate.data,
            percentage
          }
        } as ProgressUpdate;

      case 'error':
        return {
          ...baseUpdate,
          type: 'error',
          data: {
            ...baseUpdate.data,
            errorMessage: String(checkpoint.value || 'Unknown error')
          }
        } as ProgressUpdate;

      case 'help':
        return {
          ...baseUpdate,
          type: 'help',
          data: {
            ...baseUpdate.data,
            helpRequest: String(checkpoint.value || 'Help requested')
          }
        } as ProgressUpdate;

      default:
        return null;
    }
  }

  /**
   * Apply progress update to todo item
   */
  private applyProgressUpdate(todoList: SubtaskTodoList, update: ProgressUpdate): void {
    const todo = todoList.todos.find(t => t.id === update.todoId);
    if (!todo) return;

    const now = Date.now();

    switch (update.type) {
      case 'completion':
        todo.status = 'completed';
        todo.progressPercentage = 100;
        todo.completionTime = now;
        break;

      case 'progress':
        if (update.data.percentage !== undefined) {
          todo.progressPercentage = Math.min(100, Math.max(0, update.data.percentage));
          if (todo.status === 'pending') {
            todo.status = 'in_progress';
            todo.startTime = now;
          }
        }
        break;

      case 'error':
        todo.status = 'failed';
        todo.errorMessage = update.data.errorMessage;
        break;

      case 'help':
        // Don't change status for help requests, just record the request
        break;
    }

    // Update todo list metadata
    todoList.lastUpdated = now;
    todoList.completedItems = todoList.todos.filter(t => t.status === 'completed').length;
    
    if (todoList.completedItems > 0) {
      const completedTodos = todoList.todos.filter(t => t.status === 'completed' && t.completionTime);
      const totalDuration = completedTodos.reduce((sum, t) => {
        const duration = (t.completionTime! - (t.startTime || todoList.createdAt));
        return sum + duration;
      }, 0);
      
      if (completedTodos.length > 0) {
        todoList.actualDuration = totalDuration;
      }
    }

    this.emit('todo-updated', {
      subtaskId: todoList.subtaskId,
      todoId: update.todoId,
      update,
      todoList
    });
  }

  /**
   * Validate progress update to prevent invalid state transitions
   */
  private isValidProgressUpdate(todo: TodoItem, newPercentage: number): boolean {
    // Progress should generally increase
    if (newPercentage < todo.progressPercentage && todo.status !== 'failed') {
      return false;
    }

    // Percentage must be valid range
    if (newPercentage < 0 || newPercentage > 100) {
      return false;
    }

    // Can't progress a completed or failed todo
    if (todo.status === 'completed' || todo.status === 'failed') {
      return newPercentage === todo.progressPercentage;
    }

    return true;
  }

  /**
   * Buffer updates for batch processing
   */
  private bufferUpdates(subtaskId: string, updates: ProgressUpdate[]): void {
    if (!this.updateBuffer.has(subtaskId)) {
      this.updateBuffer.set(subtaskId, []);
    }
    
    const buffer = this.updateBuffer.get(subtaskId)!;
    buffer.push(...updates);

    if (!this.config.enableRealTimeUpdates) {
      this.flushUpdates(subtaskId);
    }
  }

  /**
   * Start batch processor for real-time updates
   */
  private startBatchProcessor(): void {
    this.batchTimer = setInterval(() => {
      this.updateBuffer.forEach((updates, subtaskId) => {
        if (updates.length > 0) {
          this.flushUpdates(subtaskId);
        }
      });
    }, this.config.batchUpdateInterval);
  }

  /**
   * Flush buffered updates for a subtask
   */
  private flushUpdates(subtaskId: string): void {
    const updates = this.updateBuffer.get(subtaskId);
    if (!updates || updates.length === 0) return;

    this.emit('progress-batch-update', {
      subtaskId,
      updates: [...updates],
      timestamp: Date.now()
    });

    // Clear buffer
    this.updateBuffer.set(subtaskId, []);
  }

  /**
   * Get current progress summary for a subtask
   */
  getProgressSummary(subtaskId: string): {
    todoList: SubtaskTodoList | null;
    progress: {
      total: number;
      completed: number;
      inProgress: number;
      failed: number;
      pending: number;
    };
    estimatedTimeRemaining: number;
  } | null {
    const todoList = this.activeTodoLists.get(subtaskId);
    if (!todoList) return null;

    const progress = {
      total: todoList.todos.length,
      completed: todoList.todos.filter(t => t.status === 'completed').length,
      inProgress: todoList.todos.filter(t => t.status === 'in_progress').length,
      failed: todoList.todos.filter(t => t.status === 'failed').length,
      pending: todoList.todos.filter(t => t.status === 'pending').length
    };

    // Calculate estimated time remaining
    const remainingTodos = todoList.todos.filter(t => t.status === 'pending' || t.status === 'in_progress');
    const estimatedTimeRemaining = remainingTodos.reduce((sum, todo) => {
      if (todo.status === 'in_progress') {
        const elapsed = Date.now() - (todo.startTime || todoList.createdAt);
        const estimated = todo.estimatedDurationMs;
        const remaining = Math.max(0, estimated - elapsed);
        return sum + remaining;
      }
      return sum + todo.estimatedDurationMs;
    }, 0);

    return {
      todoList,
      progress,
      estimatedTimeRemaining
    };
  }

  /**
   * Force parse and update from agent response (for testing or manual triggers)
   */
  forceParseAndUpdate(subtaskId: string, agentResponse: string): ParsedCheckpoint[] {
    return this.parseAgentResponse(subtaskId, agentResponse);
  }

  /**
   * Get parsing statistics
   */
  getParsingStats(): {
    activeTodoLists: number;
    bufferedUpdates: number;
    totalCheckpointPatterns: number;
    averageParsingTime: number;
  } {
    const bufferedUpdates = Array.from(this.updateBuffer.values())
      .reduce((sum, updates) => sum + updates.length, 0);

    return {
      activeTodoLists: this.activeTodoLists.size,
      bufferedUpdates,
      totalCheckpointPatterns: this.checkpointPatterns.length,
      averageParsingTime: 0 // TODO: Implement timing metrics
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Flush any remaining updates
    this.updateBuffer.forEach((updates, subtaskId) => {
      if (updates.length > 0) {
        this.flushUpdates(subtaskId);
      }
    });

    this.activeTodoLists.clear();
    this.updateBuffer.clear();
    this.removeAllListeners();
  }
}

/**
 * Factory function to create progress parser with common configurations
 */
export function createProgressParser(
  mode: 'development' | 'production' | 'testing' = 'production'
): ProgressParser {
  const configs = {
    development: {
      enableRealTimeUpdates: true,
      batchUpdateInterval: 500,
      maxParsingRetries: 1,
      enableProgressValidation: false
    },
    production: {
      enableRealTimeUpdates: true,
      batchUpdateInterval: 1000,
      maxParsingRetries: 3,
      enableProgressValidation: true
    },
    testing: {
      enableRealTimeUpdates: false,
      batchUpdateInterval: 100,
      maxParsingRetries: 1,
      enableProgressValidation: true
    }
  };

  return new ProgressParser(configs[mode]);
}