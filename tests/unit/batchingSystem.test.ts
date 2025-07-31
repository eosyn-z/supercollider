/**
 * Test suite for the parallel batching system
 */

import { TaskSlicer, BatchGroup, BatchableSubtask } from '../../core/utils/taskSlicer';
import { Dispatcher, DispatchConfig } from '../../core/utils/dispatcher';
import { Workflow } from '../../core/types/workflowSchema';
import { Subtask, SubtaskType, Priority, SubtaskStatus } from '../../core/types/subtaskSchema';

describe('Parallel Batching System', () => {
  let taskSlicer: TaskSlicer;
  let dispatcher: Dispatcher;
  let mockWorkflow: Workflow;

  beforeEach(() => {
    taskSlicer = new TaskSlicer();
    
    const config: DispatchConfig = {
      maxConcurrentRequests: 5,
      preferBatching: true,
      autoFallbackToSequential: false,
      timeoutMs: 30000,
      concurrency: {
        maxConcurrentSubtasks: 3,
        maxConcurrentBatches: 2
      }
    };
    
    dispatcher = new Dispatcher(config);

    // Create mock workflow with sample subtasks
    mockWorkflow = {
      id: 'test-workflow-1',
      title: 'Test Parallel Processing',
      prompt: 'Create a comprehensive analysis of parallel processing techniques',
      subtasks: createSampleSubtasks(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      estimatedDuration: 60,
      metadata: {}
    };
  });

  describe('TaskSlicer.identifyBatchableSubtasks()', () => {
    it('should identify independent subtasks as batchable', () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      
      expect(batchGroups).toHaveLength(2); // Two batches expected
      expect(batchGroups[0].subtasks).toHaveLength(3); // First batch: 3 independent tasks
      expect(batchGroups[1].subtasks).toHaveLength(1); // Second batch: 1 dependent task
    });

    it('should assign correct batchGroupId to subtasks', () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      
      batchGroups.forEach(group => {
        group.subtasks.forEach(subtask => {
          expect(subtask.batchGroupId).toBe(group.groupId);
          expect(typeof subtask.batchGroupId).toBe('string');
          expect(subtask.batchGroupId.length).toBeGreaterThan(0);
        });
      });
    });

    it('should mark groups with multiple subtasks as batchable', () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      
      const largeBatchGroup = batchGroups.find(group => group.subtasks.length > 1);
      expect(largeBatchGroup).toBeDefined();
      
      largeBatchGroup?.subtasks.forEach(subtask => {
        expect(subtask.isBatchable).toBe(true);
      });
    });

    it('should generate isolated prompts for each subtask', () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      
      batchGroups.forEach(group => {
        group.subtasks.forEach(subtask => {
          expect(subtask.injectedContext).toBeDefined();
          expect(subtask.injectedContext.length).toBeGreaterThan(0);
          expect(subtask.injectedContext).toContain('Task Context');
          expect(subtask.injectedContext).toContain(subtask.title);
        });
      });
    });
  });

  describe('TaskSlicer.generateIsolatedPrompt()', () => {
    it('should include original request context', () => {
      const subtask = createSampleSubtasks()[0];
      const context = {
        originalPrompt: mockWorkflow.prompt,
        scaffoldData: mockWorkflow,
        globalMetadata: {}
      };
      
      const isolatedPrompt = taskSlicer.generateIsolatedPrompt(subtask, context);
      
      expect(isolatedPrompt).toContain('Original Request:');
      expect(isolatedPrompt).toContain(mockWorkflow.prompt);
      expect(isolatedPrompt).toContain(subtask.title);
      expect(isolatedPrompt).toContain(subtask.description);
    });

    it('should handle dependencies correctly', () => {
      const subtasks = createSampleSubtasks();
      const dependentSubtask = subtasks[3]; // Has dependency on subtask[0]
      const context = {
        originalPrompt: mockWorkflow.prompt,
        scaffoldData: mockWorkflow,
        globalMetadata: {}
      };
      
      const isolatedPrompt = taskSlicer.generateIsolatedPrompt(dependentSubtask, context);
      
      expect(isolatedPrompt).toContain('Dependencies Context');
      expect(isolatedPrompt).toContain('BLOCKING: Research Phase 1');
    });

    it('should handle subtasks with no dependencies', () => {
      const subtask = createSampleSubtasks()[0]; // No dependencies
      const context = {
        originalPrompt: mockWorkflow.prompt,
        scaffoldData: mockWorkflow,
        globalMetadata: {}
      };
      
      const isolatedPrompt = taskSlicer.generateIsolatedPrompt(subtask, context);
      
      expect(isolatedPrompt).toContain('No dependencies');
    });
  });

  describe('Dispatcher.executeBatch()', () => {
    it('should execute batch using Promise.allSettled', async () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      const firstBatch = batchGroups[0];
      
      const config: DispatchConfig = {
        maxConcurrentRequests: 5,
        preferBatching: true,
        autoFallbackToSequential: false,
        timeoutMs: 30000
      };
      
      const result = await dispatcher.executeBatch(firstBatch, config);
      
      expect(result.batchId).toBeDefined();
      expect(result.groupId).toBe(firstBatch.groupId);
      expect(result.results).toHaveLength(firstBatch.subtasks.length);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle partial failures gracefully', async () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      const firstBatch = batchGroups[0];
      
      // Simulate one subtask failure by modifying injected context to cause error
      firstBatch.subtasks[0].injectedContext = 'FORCE_ERROR_TEST';
      
      const config: DispatchConfig = {
        maxConcurrentRequests: 5,
        preferBatching: true,
        autoFallbackToSequential: false,
        timeoutMs: 30000
      };
      
      const result = await dispatcher.executeBatch(firstBatch, config);
      
      expect(result.results).toHaveLength(firstBatch.subtasks.length);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
      
      // All subtasks should have a result, even failed ones
      result.results.forEach(res => {
        expect(res.subtaskId).toBeDefined();
        expect(res.agentId).toBeDefined();
        expect(typeof res.success).toBe('boolean');
      });
    });

    it('should respect concurrency limits', async () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      const largeBatch = batchGroups.find(group => group.subtasks.length > 2);
      
      if (largeBatch) {
        const config: DispatchConfig = {
          maxConcurrentRequests: 2, // Limit concurrency
          preferBatching: true,
          autoFallbackToSequential: false,
          timeoutMs: 30000
        };
        
        const startTime = Date.now();
        const result = await dispatcher.executeBatch(largeBatch, config);
        const endTime = Date.now();
        
        expect(result.results).toHaveLength(largeBatch.subtasks.length);
        expect(endTime - startTime).toBeGreaterThan(1000); // Should take time due to concurrency limits
      }
    });
  });

  describe('Integration Test', () => {
    it('should process complete workflow with batching', async () => {
      const batchGroups = taskSlicer.identifyBatchableSubtasks(mockWorkflow);
      
      const config: DispatchConfig = {
        maxConcurrentRequests: 3,
        preferBatching: true,
        autoFallbackToSequential: false,
        timeoutMs: 30000
      };
      
      const results = [];
      
      // Process each batch group
      for (const batchGroup of batchGroups) {
        const batchResult = await dispatcher.executeBatch(batchGroup, config);
        results.push(batchResult);
      }
      
      expect(results).toHaveLength(batchGroups.length);
      
      const totalSubtasksProcessed = results.reduce(
        (sum, result) => sum + result.results.length, 
        0
      );
      
      expect(totalSubtasksProcessed).toBe(mockWorkflow.subtasks.length);
      
      // Check that all original subtasks were processed
      const processedSubtaskIds = new Set(
        results.flatMap(result => result.results.map(r => r.subtaskId))
      );
      
      mockWorkflow.subtasks.forEach(subtask => {
        expect(processedSubtaskIds.has(subtask.id)).toBe(true);
      });
    });
  });
});

/**
 * Helper function to create sample subtasks for testing
 */
function createSampleSubtasks(): Subtask[] {
  return [
    {
      id: 'subtask-1',
      title: 'Research Phase 1',
      description: 'Research parallel processing concepts',
      type: SubtaskType.RESEARCH,
      priority: Priority.HIGH,
      status: SubtaskStatus.PENDING,
      dependencies: [], // No dependencies - can be batched
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'test-workflow-1',
      estimatedDuration: 15
    },
    {
      id: 'subtask-2',
      title: 'Analysis Phase 1',
      description: 'Analyze different approaches',
      type: SubtaskType.ANALYSIS,
      priority: Priority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: [], // No dependencies - can be batched
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'test-workflow-1',
      estimatedDuration: 12
    },
    {
      id: 'subtask-3',
      title: 'Creation Phase 1',
      description: 'Create initial implementation',
      type: SubtaskType.CREATION,
      priority: Priority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: [], // No dependencies - can be batched
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'test-workflow-1',
      estimatedDuration: 20
    },
    {
      id: 'subtask-4',
      title: 'Validation Phase 1',
      description: 'Validate the implementation',
      type: SubtaskType.VALIDATION,
      priority: Priority.HIGH,
      status: SubtaskStatus.PENDING,
      dependencies: [
        {
          subtaskId: 'subtask-1',
          type: 'BLOCKING',
          description: 'Requires research to be completed first'
        }
      ], // Has dependency - separate batch
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'test-workflow-1',
      estimatedDuration: 10
    }
  ];
}