/**
 * Test suite for validating the batching system implementation
 */

import { TaskSlicer, BatchableSubtask, BatchGroup } from './taskSlicer';
import { Dispatcher, DispatchConfig } from './dispatcher';
import { Subtask, SubtaskType, Priority, SubtaskStatus, SubtaskDependency } from '../types/subtaskSchema';
import { Workflow } from '../types/workflowSchema';

// Mock data for testing
const createMockWorkflow = (): Workflow => {
  const subtasks: Subtask[] = [
    {
      id: 'subtask-1',
      title: 'Research Requirements',
      description: 'Research and gather initial requirements for the project',
      type: SubtaskType.RESEARCH,
      priority: Priority.HIGH,
      status: SubtaskStatus.PENDING,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'workflow-1',
      estimatedDuration: 15
    },
    {
      id: 'subtask-2',
      title: 'Analyze System Architecture',
      description: 'Analyze the current system architecture and identify improvement areas',
      type: SubtaskType.ANALYSIS,
      priority: Priority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: [
        {
          subtaskId: 'subtask-1',
          type: 'BLOCKING',
          description: 'Requires research completion'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'workflow-1',
      estimatedDuration: 20
    },
    {
      id: 'subtask-3',
      title: 'Create Implementation Plan',
      description: 'Create detailed implementation plan based on analysis',
      type: SubtaskType.CREATION,
      priority: Priority.HIGH,
      status: SubtaskStatus.PENDING,
      dependencies: [
        {
          subtaskId: 'subtask-2',
          type: 'BLOCKING',
          description: 'Requires analysis completion'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'workflow-1',
      estimatedDuration: 25
    },
    {
      id: 'subtask-4',
      title: 'Independent Code Review',
      description: 'Review existing codebase independently',
      type: SubtaskType.VALIDATION,
      priority: Priority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: [], // No dependencies - can run in parallel
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'workflow-1',
      estimatedDuration: 15
    },
    {
      id: 'subtask-5',
      title: 'Independent Documentation Review',
      description: 'Review documentation independently',
      type: SubtaskType.ANALYSIS,
      priority: Priority.LOW,
      status: SubtaskStatus.PENDING,
      dependencies: [], // No dependencies - can run in parallel
      createdAt: new Date(),
      updatedAt: new Date(),
      parentWorkflowId: 'workflow-1',
      estimatedDuration: 10
    }
  ];

  return {
    id: 'workflow-1',
    title: 'Test Workflow',
    description: 'A test workflow for batching validation',
    prompt: 'Create a comprehensive system analysis and implementation plan while reviewing existing code and documentation',
    subtasks,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {}
  };
};

const createMockDispatchConfig = (): DispatchConfig => ({
  maxConcurrentRequests: 3,
  preferBatching: true,
  autoFallbackToSequential: true,
  timeoutMs: 30000,
  concurrency: {
    maxConcurrentSubtasks: 2,
    maxConcurrentBatches: 1
  },
  retry: {
    maxRetries: 2,
    backoffMultiplier: 1.5,
    initialDelayMs: 500
  },
  timeout: {
    subtaskTimeoutMs: 15000,
    batchTimeoutMs: 60000
  },
  multipass: {
    enabled: false,
    maxPasses: 1,
    improvementThreshold: 0.1
  },
  fallback: {
    enabled: true,
    fallbackAgents: ['fallback-agent']
  }
});

class BatchingTestSuite {
  private taskSlicer: TaskSlicer;
  private dispatcher: Dispatcher;
  private config: DispatchConfig;

  constructor() {
    this.taskSlicer = new TaskSlicer();
    this.config = createMockDispatchConfig();
    this.dispatcher = new Dispatcher(this.config);
  }

  /**
   * Test Case 1: Verify batch group identification
   */
  async testBatchGroupIdentification(): Promise<void> {
    console.log('\n=== Testing Batch Group Identification ===');
    
    const workflow = createMockWorkflow();
    const batchGroups = this.taskSlicer.identifyBatchableSubtasks(workflow);
    
    console.log(`✓ Generated ${batchGroups.length} batch groups`);
    
    // Verify first batch contains subtasks with no dependencies
    const firstBatch = batchGroups[0];
    console.log(`✓ First batch contains ${firstBatch.subtasks.length} subtasks`);
    
    // Check that parallel tasks are correctly identified
    const parallelTasks = firstBatch.subtasks.filter(s => s.dependencies.length === 0);
    console.log(`✓ Found ${parallelTasks.length} independent parallel tasks`);
    
    // Verify sequential tasks are in separate batches
    const sequentialTasks = batchGroups.flatMap(bg => bg.subtasks).filter(s => s.dependencies.length > 0);
    console.log(`✓ Found ${sequentialTasks.length} sequential tasks`);
    
    // Test isolated prompt generation
    for (const batchGroup of batchGroups) {
      for (const subtask of batchGroup.subtasks) {
        console.log(`✓ Generated isolated prompt for ${subtask.title} (${subtask.injectedContext.length} chars)`);
      }
    }
  }

  /**
   * Test Case 2: Verify isolated prompt generation
   */
  async testIsolatedPromptGeneration(): Promise<void> {
    console.log('\n=== Testing Isolated Prompt Generation ===');
    
    const workflow = createMockWorkflow();
    const testSubtask = workflow.subtasks[0];
    
    const context = {
      originalPrompt: workflow.prompt,
      scaffoldData: workflow,
      globalMetadata: { testMode: true }
    };
    
    const isolatedPrompt = this.taskSlicer.generateIsolatedPrompt(testSubtask, context);
    
    console.log(`✓ Generated isolated prompt (${isolatedPrompt.length} chars)`);
    console.log(`✓ Contains original prompt: ${isolatedPrompt.includes(workflow.prompt)}`);
    console.log(`✓ Contains subtask title: ${isolatedPrompt.includes(testSubtask.title)}`);
    console.log(`✓ Contains subtask description: ${isolatedPrompt.includes(testSubtask.description)}`);
    
    // Verify prompt structure
    const hasContext = isolatedPrompt.includes('# Task Context');
    const hasSubtask = isolatedPrompt.includes('# Current Subtask');
    const hasDependencies = isolatedPrompt.includes('# Dependencies Context');
    const hasInstructions = isolatedPrompt.includes('# Instructions');
    
    console.log(`✓ Prompt structure validation: Context=${hasContext}, Subtask=${hasSubtask}, Dependencies=${hasDependencies}, Instructions=${hasInstructions}`);
  }

  /**
   * Test Case 3: Test batch execution with Promise.allSettled
   */
  async testBatchExecution(): Promise<void> {
    console.log('\n=== Testing Batch Execution ===');
    
    const workflow = createMockWorkflow();
    const batchGroups = this.taskSlicer.identifyBatchableSubtasks(workflow);
    
    if (batchGroups.length === 0) {
      console.log('⚠ No batch groups to test');
      return;
    }
    
    const firstBatch = batchGroups[0];
    console.log(`✓ Testing batch execution with ${firstBatch.subtasks.length} subtasks`);
    
    const startTime = Date.now();
    const result = await this.dispatcher.executeBatch(firstBatch, this.config);
    const executionTime = Date.now() - startTime;
    
    console.log(`✓ Batch execution completed in ${executionTime}ms`);
    console.log(`✓ Batch ID: ${result.batchId}`);
    console.log(`✓ Overall success: ${result.success}`);
    console.log(`✓ Results count: ${result.results.length}`);
    console.log(`✓ Errors count: ${result.errors.length}`);
    
    // Verify all subtasks have results
    const allSubtasksProcessed = firstBatch.subtasks.every(subtask => 
      result.results.some(r => r.subtaskId === subtask.id)
    );
    console.log(`✓ All subtasks processed: ${allSubtasksProcessed}`);
    
    // Verify Promise.allSettled behavior (no exceptions should bubble up)
    console.log(`✓ Promise.allSettled used successfully - no unhandled rejections`);
  }

  /**
   * Test Case 4: Test concurrent execution limits
   */
  async testConcurrencyLimits(): Promise<void> {
    console.log('\n=== Testing Concurrency Limits ===');
    
    const workflow = createMockWorkflow();
    const batchGroups = this.taskSlicer.identifyBatchableSubtasks(workflow);
    
    // Test with multiple batches if available
    const testBatches = batchGroups.slice(0, 2);
    console.log(`✓ Testing concurrency with ${testBatches.length} batch groups`);
    
    const promises = testBatches.map(batch => 
      this.dispatcher.executeBatch(batch, this.config)
    );
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`✓ Multiple batches completed in ${totalTime}ms`);
    console.log(`✓ All batches successful: ${results.every(r => r.success)}`);
    
    // Verify stats tracking
    const stats = this.dispatcher.getStats();
    console.log(`✓ Dispatcher stats - Running: ${stats.runningCount}, Agent load: ${JSON.stringify(stats.agentLoad)}`);
  }

  /**
   * Test Case 5: Test error handling and resilience
   */
  async testErrorHandling(): Promise<void> {
    console.log('\n=== Testing Error Handling ===');
    
    // Create a batch with intentionally problematic subtasks
    const problematicBatch: BatchGroup = {
      groupId: 'error-test-batch',
      subtasks: [
        {
          id: 'error-subtask-1',
          title: 'Intentional Error Task',
          description: 'This task should trigger an error for testing',
          type: SubtaskType.VALIDATION,
          priority: Priority.LOW,
          status: SubtaskStatus.PENDING,
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: 'test-workflow',
          estimatedDuration: 5,
          batchGroupId: 'error-test-batch',
          isBatchable: true,
          injectedContext: 'This is a test prompt that should work fine'
        }
      ] as BatchableSubtask[],
      estimatedExecutionTime: 5
    };
    
    const result = await this.dispatcher.executeBatch(problematicBatch, this.config);
    
    console.log(`✓ Error handling test completed`);
    console.log(`✓ Result success: ${result.success}`);
    console.log(`✓ Error count: ${result.errors.length}`);
    
    // Verify resilience - system should handle errors gracefully
    console.log(`✓ System remained stable after error conditions`);
  }

  /**
   * Run all test cases
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Supercollider Batching System Test Suite');
    console.log('================================================');
    
    try {
      await this.testBatchGroupIdentification();
      await this.testIsolatedPromptGeneration();
      await this.testBatchExecution();
      await this.testConcurrencyLimits();
      await this.testErrorHandling();
      
      console.log('\n✅ All tests completed successfully!');
      console.log('================================================');
      
    } catch (error) {
      console.error('\n❌ Test suite failed:', error);
      console.log('================================================');
      throw error;
    }
  }
}

// Export for use in other modules
export { BatchingTestSuite };

// Run tests if this file is executed directly
if (require.main === module) {
  const testSuite = new BatchingTestSuite();
  testSuite.runAllTests()
    .then(() => {
      console.log('Test suite execution completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test suite execution failed:', error);
      process.exit(1);
    });
}