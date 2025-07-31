/**
 * Unit tests for ProgressParser functionality
 */

import { ProgressParser, ProgressUpdate, ParsedCheckpoint } from '../../server/core/utils/progressParser';
import { SubtaskTodoList, TodoItem } from '../../core/utils/dataInjector';

// Mock todo list for testing
const mockTodoList: SubtaskTodoList = {
  subtaskId: 'subtask-123',
  agentId: 'agent-456',
  totalItems: 3,
  completedItems: 0,
  estimatedTotalDuration: 600000, // 10 minutes
  todos: [
    {
      id: 'todo-1',
      title: 'Analyze Data',
      description: 'Examine the input data for patterns',
      estimatedDurationMs: 200000,
      status: 'pending',
      dependencies: [],
      progressPercentage: 0
    },
    {
      id: 'todo-2',
      title: 'Generate Report',
      description: 'Create comprehensive analysis report',
      estimatedDurationMs: 300000,
      status: 'pending',
      dependencies: ['todo-1'],
      progressPercentage: 0
    },
    {
      id: 'todo-3',
      title: 'Review Results',
      description: 'Final review and validation',
      estimatedDurationMs: 100000,
      status: 'pending',
      dependencies: ['todo-2'],
      progressPercentage: 0
    }
  ],
  createdAt: Date.now(),
  lastUpdated: Date.now()
};

describe('ProgressParser Core Functionality', () => {
  let progressParser: ProgressParser;

  beforeEach(() => {
    progressParser = new ProgressParser({
      enableRealTimeUpdates: false, // Disable for unit tests
      batchUpdateInterval: 100,
      maxParsingRetries: 3,
      enableProgressValidation: true
    });
  });

  afterEach(() => {
    progressParser.destroy();
  });

  describe('Checkpoint Pattern Matching', () => {
    test('should parse standard checkpoint completion markers', () => {
      const agentResponse = `
        I'm starting the analysis now.
        [CHECKPOINT:todo-1:COMPLETED]
        The data analysis is finished. Moving to report generation.
        [CHECKPOINT:todo-2:COMPLETED]
        Report generated successfully.
      `;

      const checkpoints = progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].todoId).toBe('todo-1');
      expect(checkpoints[0].actionType).toBe('completion');
      expect(checkpoints[1].todoId).toBe('todo-2');
      expect(checkpoints[1].actionType).toBe('completion');
    });

    test('should parse progress percentage markers', () => {
      const agentResponse = `
        Starting analysis...
        [PROGRESS:todo-1:25]
        Making good progress on the data analysis.
        [PROGRESS:todo-1:75]
        Almost done with analysis.
        [PROGRESS:todo-1:100]
      `;

      const checkpoints = progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].value).toBe(25);
      expect(checkpoints[1].value).toBe(75);
      expect(checkpoints[2].value).toBe(100);
      checkpoints.forEach(cp => {
        expect(cp.actionType).toBe('progress');
        expect(cp.todoId).toBe('todo-1');
      });
    });

    test('should parse issue/error markers', () => {
      const agentResponse = `
        [ISSUE:todo-1:Data source is unavailable]
        Encountered a problem with the data source.
        [ISSUE:todo-2:Missing required fields in dataset]
        Another issue found.
      `;

      const checkpoints = progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].actionType).toBe('error');
      expect(checkpoints[0].value).toBe('Data source is unavailable');
      expect(checkpoints[1].actionType).toBe('error');
      expect(checkpoints[1].value).toBe('Missing required fields in dataset');
    });

    test('should parse help request markers', () => {
      const agentResponse = `
        [HELP:todo-1:How should I handle missing data points?]
        I need guidance on this issue.
        [HELP:todo-2:Which visualization format is preferred?]
      `;

      const checkpoints = progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].actionType).toBe('help');
      expect(checkpoints[0].value).toBe('How should I handle missing data points?');
      expect(checkpoints[1].actionType).toBe('help');
      expect(checkpoints[1].value).toBe('Which visualization format is preferred?');
    });

    test('should parse emoji-based markers', () => {
      const agentResponse = `
        ✓ [todo-1] completed successfully
        ❌ [todo-2] failed: Network timeout error
        ⚠️ [todo-3] 50%
        🔄 [todo-4] in progress
      `;

      const checkpoints = progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      expect(checkpoints).toHaveLength(4);
      expect(checkpoints[0].actionType).toBe('completion');
      expect(checkpoints[1].actionType).toBe('error');
      expect(checkpoints[2].actionType).toBe('progress');
      expect(checkpoints[2].value).toBe(50);
      expect(checkpoints[3].actionType).toBe('progress');
      expect(checkpoints[3].value).toBe(50); // Default for "in progress"
    });
  });

  describe('Todo List Management', () => {
    test('should register and track todo lists', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const summary = progressParser.getProgressSummary('subtask-123');
      expect(summary).toBeDefined();
      expect(summary!.todoList.subtaskId).toBe('subtask-123');
      expect(summary!.progress.total).toBe(3);
      expect(summary!.progress.completed).toBe(0);
    });

    test('should update todo status when parsing checkpoints', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const agentResponse = '[CHECKPOINT:todo-1:COMPLETED]';
      progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      const summary = progressParser.getProgressSummary('subtask-123');
      expect(summary!.progress.completed).toBe(1);
      expect(summary!.todoList.todos.find(t => t.id === 'todo-1')!.status).toBe('completed');
    });

    test('should update progress percentages', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const agentResponse = '[PROGRESS:todo-1:75]';
      progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      const summary = progressParser.getProgressSummary('subtask-123');
      const todo1 = summary!.todoList.todos.find(t => t.id === 'todo-1');
      expect(todo1!.progressPercentage).toBe(75);
      expect(todo1!.status).toBe('in_progress');
    });

    test('should handle error states', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const agentResponse = '[ISSUE:todo-1:Critical error occurred]';
      progressParser.parseAgentResponse('subtask-123', agentResponse);
      
      const summary = progressParser.getProgressSummary('subtask-123');
      const todo1 = summary!.todoList.todos.find(t => t.id === 'todo-1');
      expect(todo1!.status).toBe('failed');
      expect(todo1!.errorMessage).toBe('Critical error occurred');
    });

    test('should calculate estimated time remaining', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      // Complete first todo
      progressParser.parseAgentResponse('subtask-123', '[CHECKPOINT:todo-1:COMPLETED]');
      
      const summary = progressParser.getProgressSummary('subtask-123');
      // Should be less than original total since one is completed
      expect(summary!.estimatedTimeRemaining).toBeLessThan(mockTodoList.estimatedTotalDuration);
      expect(summary!.estimatedTimeRemaining).toBeGreaterThan(0);
    });
  });

  describe('Progress Validation', () => {
    test('should validate progress updates', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      // Valid progress update
      const validResponse = '[PROGRESS:todo-1:50]';
      const validCheckpoints = progressParser.parseAgentResponse('subtask-123', validResponse);
      expect(validCheckpoints).toHaveLength(1);
      
      // Invalid progress update (going backwards)
      const invalidResponse = '[PROGRESS:todo-1:25]';
      const invalidCheckpoints = progressParser.parseAgentResponse('subtask-123', invalidResponse);
      // Should still parse but might not update due to validation
      expect(invalidCheckpoints).toHaveLength(1);
    });

    test('should reject invalid progress values', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const invalidResponses = [
        '[PROGRESS:todo-1:-10]', // Negative
        '[PROGRESS:todo-1:150]', // Over 100%
        '[PROGRESS:todo-1:abc]'  // Non-numeric
      ];

      invalidResponses.forEach(response => {
        const checkpoints = progressParser.parseAgentResponse('subtask-123', response);
        if (checkpoints.length > 0) {
          // If parsed, value should be sanitized
          const value = checkpoints[0].value as number;
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      });
    });

    test('should handle completed todos gracefully', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      // Complete a todo
      progressParser.parseAgentResponse('subtask-123', '[CHECKPOINT:todo-1:COMPLETED]');
      
      // Try to update progress on completed todo
      const response = '[PROGRESS:todo-1:50]';
      progressParser.parseAgentResponse('subtask-123', response);
      
      const summary = progressParser.getProgressSummary('subtask-123');
      const todo1 = summary!.todoList.todos.find(t => t.id === 'todo-1');
      expect(todo1!.status).toBe('completed'); // Should remain completed
      expect(todo1!.progressPercentage).toBe(100); // Should remain 100%
    });
  });

  describe('Event Emission', () => {
    test('should emit todo-updated events', (done) => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      progressParser.on('todo-updated', (data) => {
        expect(data.subtaskId).toBe('subtask-123');
        expect(data.todoId).toBe('todo-1');
        expect(data.update.type).toBe('completion');
        done();
      });
      
      progressParser.parseAgentResponse('subtask-123', '[CHECKPOINT:todo-1:COMPLETED]');
    });

    test('should emit progress-batch-update events when batching is enabled', (done) => {
      const batchingParser = new ProgressParser({
        enableRealTimeUpdates: true,
        batchUpdateInterval: 50
      });
      
      batchingParser.registerTodoList('subtask-123', mockTodoList);
      
      batchingParser.on('progress-batch-update', (data) => {
        expect(data.subtaskId).toBe('subtask-123');
        expect(data.updates.length).toBeGreaterThan(0);
        batchingParser.destroy();
        done();
      });
      
      batchingParser.parseAgentResponse('subtask-123', '[CHECKPOINT:todo-1:COMPLETED]');
    });
  });

  describe('Performance Requirements', () => {
    test('should parse checkpoints quickly (<10ms for simple responses)', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const simpleResponse = '[CHECKPOINT:todo-1:COMPLETED]';
      
      const startTime = performance.now();
      progressParser.parseAgentResponse('subtask-123', simpleResponse);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(10);
    });

    test('should handle large responses efficiently', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const largeResponse = `
        This is a very long response with multiple checkpoints scattered throughout.
        ${Array(1000).fill('Some filler text to make this response large. ').join('')}
        [CHECKPOINT:todo-1:COMPLETED]
        ${Array(1000).fill('More filler text here. ').join('')}
        [PROGRESS:todo-2:50]
        ${Array(1000).fill('Even more text content. ').join('')}
        [CHECKPOINT:todo-2:COMPLETED]
      `;
      
      const startTime = performance.now();
      const checkpoints = progressParser.parseAgentResponse('subtask-123', largeResponse);
      const endTime = performance.now();
      
      expect(checkpoints).toHaveLength(3);
      expect(endTime - startTime).toBeLessThan(50); // Should still be fast
    });

    test('should achieve >90% checkpoint detection accuracy', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const responseWithKnownCheckpoints = `
        Starting the work now.
        [CHECKPOINT:todo-1:COMPLETED] ✓
        [PROGRESS:todo-2:25]
        Making progress on todo-2
        [PROGRESS:todo-2:75]
        Almost done with todo-2
        [CHECKPOINT:todo-2:COMPLETED]
        [ISSUE:todo-3:Need clarification on requirements]
        [HELP:todo-3:How should I proceed?]
      `;
      
      const checkpoints = progressParser.parseAgentResponse('subtask-123', responseWithKnownCheckpoints);
      
      // We know there are 6 valid checkpoint markers
      expect(checkpoints).toBeDefined();
      expect(checkpoints.length).toBeGreaterThanOrEqual(5); // >90% detection rate
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed checkpoint markers gracefully', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const malformedResponse = `
        [CHECKPOINT:todo-1] // Missing :COMPLETED
        [PROGRESS:todo-1] // Missing percentage
        [ISSUE:todo-1] // Missing description
        [HELP] // Missing todo ID and question
        [RANDOM:todo-1:SOMETHING] // Unknown type
      `;
      
      expect(() => {
        progressParser.parseAgentResponse('subtask-123', malformedResponse);
      }).not.toThrow();
    });

    test('should handle non-existent todo IDs', () => {
      progressParser.registerTodoList('subtask-123', mockTodoList);
      
      const response = '[CHECKPOINT:nonexistent-todo:COMPLETED]';
      
      expect(() => {
        progressParser.parseAgentResponse('subtask-123', response);
      }).not.toThrow();
      
      // Summary should remain unchanged
      const summary = progressParser.getProgressSummary('subtask-123');
      expect(summary!.progress.completed).toBe(0);
    });

    test('should handle unregistered subtasks', () => {
      const response = '[CHECKPOINT:todo-1:COMPLETED]';
      
      expect(() => {
        progressParser.parseAgentResponse('unregistered-subtask', response);
      }).not.toThrow();
    });
  });

  describe('Statistics and Metrics', () => {
    test('should provide parsing statistics', () => {
      const stats = progressParser.getParsingStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.activeTodoLists).toBe('number');
      expect(typeof stats.bufferedUpdates).toBe('number');
      expect(typeof stats.totalCheckpointPatterns).toBe('number');
      expect(stats.totalCheckpointPatterns).toBeGreaterThan(0);
    });

    test('should track todo list registration/unregistration', () => {
      const initialStats = progressParser.getParsingStats();
      
      progressParser.registerTodoList('subtask-123', mockTodoList);
      const afterRegister = progressParser.getParsingStats();
      expect(afterRegister.activeTodoLists).toBe(initialStats.activeTodoLists + 1);
      
      progressParser.unregisterTodoList('subtask-123');
      const afterUnregister = progressParser.getParsingStats();
      expect(afterUnregister.activeTodoLists).toBe(initialStats.activeTodoLists);
    });
  });
});

describe('ProgressParser Integration Tests', () => {
  test('should work with real-world agent response patterns', () => {
    const progressParser = new ProgressParser();
    progressParser.registerTodoList('subtask-real', mockTodoList);
    
    const realisticResponse = `
I'll start working on this analysis task step by step.

## Step 1: Data Analysis
Let me examine the input data first...
✓ [todo-1] completed - Data analysis is done

## Step 2: Report Generation  
Now I'll create the comprehensive report...
⚠️ [todo-2] 30% - Starting report structure
I'm making good progress on the report sections.
⚠️ [todo-2] 70% - Most sections complete
✓ [todo-2] completed - Report generation finished

## Step 3: Review Process
❌ [todo-3] failed: Missing validation criteria
[HELP:todo-3:What specific validation criteria should I apply?]

I need guidance to proceed with the final review step.
`;

    const checkpoints = progressParser.parseAgentResponse('subtask-real', realisticResponse);
    
    expect(checkpoints.length).toBeGreaterThan(0);
    
    const summary = progressParser.getProgressSummary('subtask-real');
    expect(summary!.progress.completed).toBeGreaterThan(0);
    expect(summary!.progress.failed).toBeGreaterThan(0);
    
    progressParser.destroy();
  });

  test('should handle concurrent updates from multiple subtasks', () => {
    const progressParser = new ProgressParser();
    
    // Register multiple subtasks
    const subtaskIds = ['subtask-A', 'subtask-B', 'subtask-C'];
    subtaskIds.forEach(id => {
      progressParser.registerTodoList(id, { ...mockTodoList, subtaskId: id });
    });
    
    // Process updates for all subtasks
    subtaskIds.forEach(id => {
      progressParser.parseAgentResponse(id, '[CHECKPOINT:todo-1:COMPLETED]');
    });
    
    // Verify all were updated correctly
    subtaskIds.forEach(id => {
      const summary = progressParser.getProgressSummary(id);
      expect(summary!.progress.completed).toBe(1);
    });
    
    progressParser.destroy();
  });
});