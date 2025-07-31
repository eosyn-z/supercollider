/**
 * Performance benchmarks for todo generation system
 * Tests performance requirements and scalability
 */

import { DataInjector } from '../../core/utils/dataInjector';
import { ProgressParser } from '../../server/core/utils/progressParser';
import { ProgressBroadcaster } from '../../server/websocket/progressBroadcaster';
import { SubtaskType } from '../../core/types/subtaskSchema';

// Benchmark configuration
const BENCHMARK_CONFIG = {
  iterations: 100,
  concurrentTasks: 10,
  largePromptSize: 10000, // 10KB
  timeoutMs: 5000,
  targetTodoGeneration: 50, // ms
  targetCheckpointDetection: 10, // ms
  targetBroadcast: 5 // ms
};

// Test data generators
function generateTestSubtask(id: string, type: SubtaskType = SubtaskType.ANALYSIS) {
  return {
    id,
    title: `Test Subtask ${id}`,
    description: `Test description for subtask ${id}`,
    type,
    priority: 'medium' as const,
    assignedAgentId: `agent-${id}`,
    dependencies: [],
    estimatedDuration: 15,
    status: 'pending' as const,
    retryCount: 0
  };
}

function generateTestWorkflow(subtaskCount = 5) {
  const subtasks = Array.from({ length: subtaskCount }, (_, i) => 
    generateTestSubtask(`subtask-${i}`)
  );

  return {
    id: 'benchmark-workflow',
    title: 'Benchmark Workflow',
    description: 'Workflow for performance testing',
    subtasks,
    status: 'draft' as const,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function generateLargePrompt(sizeKB: number): string {
  const basePrompt = `
    Create a comprehensive analysis of market trends including:
    - Statistical analysis of historical data
    - Predictive modeling and forecasting
    - Risk assessment and mitigation strategies
    - Investment recommendations and portfolio optimization
    - Detailed visualizations and charts
    - Executive summary with key findings
    - Technical appendix with methodology
  `;

  const targetSize = sizeKB * 1024;
  const repetitions = Math.ceil(targetSize / basePrompt.length);
  return Array(repetitions).fill(basePrompt).join('\n');
}

// Benchmark utilities
class BenchmarkTimer {
  private startTime = 0;
  private endTime = 0;

  start() {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  getElapsed(): number {
    return this.endTime - this.startTime;
  }
}

class BenchmarkStats {
  private measurements: number[] = [];

  add(measurement: number) {
    this.measurements.push(measurement);
  }

  getStats() {
    if (this.measurements.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      min: sorted[0],
      max: sorted[len - 1],
      avg: sorted.reduce((sum, val) => sum + val, 0) / len,
      median: len % 2 === 0 
        ? (sorted[len / 2 - 1] + sorted[len / 2]) / 2
        : sorted[Math.floor(len / 2)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  reset() {
    this.measurements = [];
  }
}

describe('Todo Generation Performance Benchmarks', () => {
  let dataInjector: DataInjector;
  let progressParser: ProgressParser;

  beforeAll(() => {
    dataInjector = new DataInjector();
    progressParser = new ProgressParser({ enableRealTimeUpdates: false });
  });

  afterAll(() => {
    progressParser.destroy();
  });

  describe('DataInjector Performance', () => {
    test('should generate todos within 50ms target', async () => {
      const stats = new BenchmarkStats();
      const timer = new BenchmarkTimer();
      const workflow = generateTestWorkflow(1);
      const subtask = workflow.subtasks[0];
      const prompt = generateLargePrompt(1); // 1KB prompt

      console.log(`\nTesting todo generation performance (${BENCHMARK_CONFIG.iterations} iterations)...`);

      for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
        timer.start();
        dataInjector.injectContextToSubtaskPrompt(subtask, workflow, prompt);
        const elapsed = timer.end();
        stats.add(elapsed);
      }

      const results = stats.getStats();
      console.log(`Todo Generation Performance Results:
        Min: ${results.min.toFixed(2)}ms
        Max: ${results.max.toFixed(2)}ms
        Avg: ${results.avg.toFixed(2)}ms
        Median: ${results.median.toFixed(2)}ms
        P95: ${results.p95.toFixed(2)}ms
        P99: ${results.p99.toFixed(2)}ms
        Target: <${BENCHMARK_CONFIG.targetTodoGeneration}ms
      `);

      expect(results.avg).toBeLessThan(BENCHMARK_CONFIG.targetTodoGeneration);
      expect(results.p95).toBeLessThan(BENCHMARK_CONFIG.targetTodoGeneration * 2);
    });

    test('should handle large prompts efficiently', async () => {
      const stats = new BenchmarkStats();
      const timer = new BenchmarkTimer();
      const workflow = generateTestWorkflow(1);
      const subtask = workflow.subtasks[0];
      const largePrompt = generateLargePrompt(BENCHMARK_CONFIG.largePromptSize / 1024); // 10KB

      console.log(`\nTesting large prompt handling (${largePrompt.length} chars)...`);

      for (let i = 0; i < Math.min(BENCHMARK_CONFIG.iterations, 50); i++) {
        timer.start();
        const result = dataInjector.injectContextToSubtaskPrompt(subtask, workflow, largePrompt);
        const elapsed = timer.end();
        stats.add(elapsed);

        expect(result.todoList.todos.length).toBeGreaterThan(0);
      }

      const results = stats.getStats();
      console.log(`Large Prompt Performance Results:
        Avg: ${results.avg.toFixed(2)}ms
        P95: ${results.p95.toFixed(2)}ms
        Max: ${results.max.toFixed(2)}ms
      `);

      expect(results.avg).toBeLessThan(BENCHMARK_CONFIG.targetTodoGeneration * 3);
    });

    test('should scale linearly with prompt complexity', async () => {
      const complexities = [1, 2, 5, 10]; // KB sizes
      const results: Array<{ size: number; avgTime: number }> = [];

      for (const sizeKB of complexities) {
        const stats = new BenchmarkStats();
        const timer = new BenchmarkTimer();
        const workflow = generateTestWorkflow(1);
        const subtask = workflow.subtasks[0];
        const prompt = generateLargePrompt(sizeKB);

        for (let i = 0; i < 20; i++) {
          timer.start();
          dataInjector.injectContextToSubtaskPrompt(subtask, workflow, prompt);
          const elapsed = timer.end();
          stats.add(elapsed);
        }

        const avgTime = stats.getStats().avg;
        results.push({ size: sizeKB, avgTime });
      }

      console.log('\nScalability Test Results:');
      results.forEach(r => {
        console.log(`  ${r.size}KB: ${r.avgTime.toFixed(2)}ms`);
      });

      // Check that scaling is reasonable (not exponential)
      const ratios = [];
      for (let i = 1; i < results.length; i++) {
        const ratio = results[i].avgTime / results[i-1].avgTime;
        ratios.push(ratio);
        expect(ratio).toBeLessThan(3); // Should not increase more than 3x per size doubling
      }
    });

    test('should maintain accuracy under time pressure', async () => {
      const stats = new BenchmarkStats();
      const accuracyStats = new BenchmarkStats();
      const timer = new BenchmarkTimer();
      const workflow = generateTestWorkflow(1);
      const subtask = workflow.subtasks[0];
      
      // Complex prompt with known requirements
      const complexPrompt = `
        Please complete the following steps in order:
        1. Research market data from reliable sources
        2. Analyze historical trends and patterns
        3. Create data visualizations and charts
        4. Write executive summary with findings
        5. Prepare presentation slides
        6. Review and validate all information
        7. Format final deliverables
      `;

      for (let i = 0; i < 50; i++) {
        timer.start();
        const result = dataInjector.injectContextToSubtaskPrompt(subtask, workflow, complexPrompt);
        const elapsed = timer.end();
        stats.add(elapsed);

        // Check accuracy - should detect most of the 7 explicit steps
        const detectedSteps = result.todoList.todos.length;
        const accuracy = Math.min(100, (detectedSteps / 7) * 100);
        accuracyStats.add(accuracy);
      }

      const timeResults = stats.getStats();
      const accuracyResults = accuracyStats.getStats();

      console.log(`\nAccuracy Under Pressure Results:
        Avg Time: ${timeResults.avg.toFixed(2)}ms
        Avg Accuracy: ${accuracyResults.avg.toFixed(1)}%
        Min Accuracy: ${accuracyResults.min.toFixed(1)}%
      `);

      expect(timeResults.avg).toBeLessThan(BENCHMARK_CONFIG.targetTodoGeneration * 2);
      expect(accuracyResults.avg).toBeGreaterThan(70); // >70% accuracy requirement
    });
  });

  describe('ProgressParser Performance', () => {
    test('should detect checkpoints within 10ms target', async () => {
      const stats = new BenchmarkStats();
      const timer = new BenchmarkTimer();
      
      const mockTodoList = {
        subtaskId: 'perf-test',
        agentId: 'agent-123',
        totalItems: 5,
        completedItems: 0,
        estimatedTotalDuration: 300000,
        todos: Array.from({ length: 5 }, (_, i) => ({
          id: `todo-${i}`,
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          estimatedDurationMs: 60000,
          status: 'pending' as const,
          dependencies: [],
          progressPercentage: 0
        })),
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      progressParser.registerTodoList('perf-test', mockTodoList);

      const testResponse = `
        Starting work on the tasks.
        [CHECKPOINT:todo-0:COMPLETED]
        [PROGRESS:todo-1:50]
        [CHECKPOINT:todo-1:COMPLETED]
        [PROGRESS:todo-2:75]
        [ISSUE:todo-3:Need clarification]
        [HELP:todo-4:How should I proceed?]
      `;

      console.log(`\nTesting checkpoint detection performance (${BENCHMARK_CONFIG.iterations} iterations)...`);

      for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
        timer.start();
        const checkpoints = progressParser.parseAgentResponse('perf-test', testResponse);
        const elapsed = timer.end();
        stats.add(elapsed);

        expect(checkpoints.length).toBeGreaterThan(0);
      }

      const results = stats.getStats();
      console.log(`Checkpoint Detection Performance Results:
        Min: ${results.min.toFixed(2)}ms
        Max: ${results.max.toFixed(2)}ms
        Avg: ${results.avg.toFixed(2)}ms
        Median: ${results.median.toFixed(2)}ms
        P95: ${results.p95.toFixed(2)}ms
        Target: <${BENCHMARK_CONFIG.targetCheckpointDetection}ms
      `);

      expect(results.avg).toBeLessThan(BENCHMARK_CONFIG.targetCheckpointDetection);
      expect(results.p95).toBeLessThan(BENCHMARK_CONFIG.targetCheckpointDetection * 2);
    });

    test('should achieve >90% checkpoint detection accuracy', async () => {
      const accuracyStats = new BenchmarkStats();
      
      const mockTodoList = {
        subtaskId: 'accuracy-test',
        agentId: 'agent-123',
        totalItems: 10,
        completedItems: 0,
        estimatedTotalDuration: 600000,
        todos: Array.from({ length: 10 }, (_, i) => ({
          id: `todo-${i}`,
          title: `Task ${i}`,
          description: `Description for task ${i}`,
          estimatedDurationMs: 60000,
          status: 'pending' as const,
          dependencies: [],
          progressPercentage: 0
        })),
        createdAt: Date.now(),
        lastUpdated: Date.now()
      };

      progressParser.registerTodoList('accuracy-test', mockTodoList);

      // Test with responses containing known numbers of checkpoints
      const testCases = [
        {
          response: '[CHECKPOINT:todo-0:COMPLETED] [CHECKPOINT:todo-1:COMPLETED]',
          expectedCount: 2
        },
        {
          response: '[PROGRESS:todo-0:25] [PROGRESS:todo-0:50] [PROGRESS:todo-0:75] [CHECKPOINT:todo-0:COMPLETED]',
          expectedCount: 4
        },
        {
          response: '✓ [todo-0] completed ✓ [todo-1] completed ❌ [todo-2] failed: error',
          expectedCount: 3
        },
        {
          response: '[HELP:todo-0:question] [ISSUE:todo-1:problem] [CHECKPOINT:todo-2:COMPLETED]',
          expectedCount: 3
        }
      ];

      console.log('\nTesting checkpoint detection accuracy...');

      testCases.forEach(testCase => {
        const checkpoints = progressParser.parseAgentResponse('accuracy-test', testCase.response);
        const accuracy = (checkpoints.length / testCase.expectedCount) * 100;
        accuracyStats.add(accuracy);
        
        console.log(`  Expected: ${testCase.expectedCount}, Found: ${checkpoints.length}, Accuracy: ${accuracy.toFixed(1)}%`);
      });

      const results = accuracyStats.getStats();
      console.log(`\nOverall Accuracy Results:
        Avg: ${results.avg.toFixed(1)}%
        Min: ${results.min.toFixed(1)}%
        Target: >90%
      `);

      expect(results.avg).toBeGreaterThan(90);
      expect(results.min).toBeGreaterThan(80); // Even worst case should be >80%
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should not leak memory with repeated operations', async () => {
      const initialMemory = process.memoryUsage();
      const workflow = generateTestWorkflow(1);
      const subtask = workflow.subtasks[0];
      const prompt = generateLargePrompt(1);

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        dataInjector.injectContextToSubtaskPrompt(subtask, workflow, prompt);
        
        if (i % 100 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`\nMemory Usage Test:
        Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Increase: ${memoryIncreaseMB.toFixed(2)}MB
      `);

      // Memory increase should be reasonable (less than 50MB for 1000 operations)
      expect(memoryIncreaseMB).toBeLessThan(50);
    });

    test('should handle concurrent operations efficiently', async () => {
      const stats = new BenchmarkStats();
      const timer = new BenchmarkTimer();
      const workflow = generateTestWorkflow(BENCHMARK_CONFIG.concurrentTasks);
      const prompt = generateLargePrompt(1);

      console.log(`\nTesting concurrent operations (${BENCHMARK_CONFIG.concurrentTasks} concurrent tasks)...`);

      timer.start();
      
      const promises = workflow.subtasks.map(subtask => 
        Promise.resolve(dataInjector.injectContextToSubtaskPrompt(subtask, workflow, prompt))
      );

      const results = await Promise.all(promises);
      const elapsed = timer.end();

      results.forEach(result => {
        expect(result.todoList.todos.length).toBeGreaterThan(0);
      });

      const avgTimePerTask = elapsed / BENCHMARK_CONFIG.concurrentTasks;

      console.log(`Concurrent Operations Results:
        Total Time: ${elapsed.toFixed(2)}ms
        Avg per Task: ${avgTimePerTask.toFixed(2)}ms
        Tasks: ${BENCHMARK_CONFIG.concurrentTasks}
      `);

      expect(avgTimePerTask).toBeLessThan(BENCHMARK_CONFIG.targetTodoGeneration * 2);
    });
  });

  describe('WebSocket Broadcasting Performance', () => {
    test('should broadcast updates within 5ms target', async () => {
      const broadcaster = new ProgressBroadcaster(progressParser, {
        port: 8082, // Different port for testing
        enableMetrics: true
      });

      const stats = new BenchmarkStats();
      const timer = new BenchmarkTimer();

      // Mock some connected clients
      const mockClients = new Map();
      for (let i = 0; i < 10; i++) {
        mockClients.set(`client-${i}`, {
          clientId: `client-${i}`,
          workflowIds: new Set(['workflow-123']),
          subtaskIds: new Set(['subtask-123']),
          eventTypes: new Set(['progress-update']),
          lastPing: Date.now(),
          connection: {
            readyState: 1, // WebSocket.OPEN
            send: () => {} // Mock send
          }
        });
      }

      // Replace internal clients map for testing
      (broadcaster as any).clients = mockClients;

      console.log(`\nTesting broadcast performance (${BENCHMARK_CONFIG.iterations} iterations)...`);

      for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
        timer.start();
        broadcaster.broadcastWorkflowStatus('workflow-123', {
          workflowId: 'workflow-123',
          status: 'running',
          startTime: new Date(),
          runningSubtasks: ['subtask-123'],
          completedSubtasks: [],
          failedSubtasks: [],
          haltedSubtasks: [],
          queuedSubtasks: [],
          retryCount: {},
          errors: [],
          progress: { total: 1, completed: 0, failed: 0, inProgress: 1, queued: 0, halted: 0 },
          batches: [],
          subtaskExecutions: {},
          timeline: []
        });
        const elapsed = timer.end();
        stats.add(elapsed);
      }

      const results = stats.getStats();
      console.log(`Broadcast Performance Results:
        Min: ${results.min.toFixed(3)}ms
        Max: ${results.max.toFixed(3)}ms
        Avg: ${results.avg.toFixed(3)}ms
        P95: ${results.p95.toFixed(3)}ms
        Target: <${BENCHMARK_CONFIG.targetBroadcast}ms
      `);

      await broadcaster.shutdown();

      expect(results.avg).toBeLessThan(BENCHMARK_CONFIG.targetBroadcast);
    });
  });
});

describe('End-to-End Performance Tests', () => {
  test('should complete full workflow within performance targets', async () => {
    const dataInjector = new DataInjector();
    const progressParser = new ProgressParser({ enableRealTimeUpdates: false });
    
    const workflow = generateTestWorkflow(3);
    const prompt = generateLargePrompt(2); // 2KB prompt
    
    const timer = new BenchmarkTimer();
    const stats = new BenchmarkStats();

    console.log('\nTesting end-to-end workflow performance...');

    for (let iteration = 0; iteration < 10; iteration++) {
      timer.start();

      // Step 1: Generate todos for all subtasks
      const results = workflow.subtasks.map(subtask => 
        dataInjector.injectContextToSubtaskPrompt(subtask, workflow, prompt)
      );

      // Step 2: Register todo lists with progress parser
      results.forEach(result => {
        progressParser.registerTodoList(result.subtaskId, result.todoList);
      });

      // Step 3: Simulate progress updates
      results.forEach(result => {
        const mockProgress = `
          [CHECKPOINT:${result.todoList.todos[0].id}:COMPLETED]
          [PROGRESS:${result.todoList.todos[1].id}:50]
        `;
        progressParser.parseAgentResponse(result.subtaskId, mockProgress);
      });

      // Step 4: Get progress summaries
      results.forEach(result => {
        progressParser.getProgressSummary(result.subtaskId);
      });

      const elapsed = timer.end();
      stats.add(elapsed);

      // Cleanup
      results.forEach(result => {
        progressParser.unregisterTodoList(result.subtaskId);
      });
    }

    const endToEndResults = stats.getStats();
    console.log(`End-to-End Performance Results:
      Avg: ${endToEndResults.avg.toFixed(2)}ms
      P95: ${endToEndResults.p95.toFixed(2)}ms
      Max: ${endToEndResults.max.toFixed(2)}ms
    `);

    progressParser.destroy();

    // End-to-end should complete within reasonable time
    expect(endToEndResults.avg).toBeLessThan(200); // 200ms for full workflow
    expect(endToEndResults.p95).toBeLessThan(400);
  });
});