/**
 * Unit tests for enhanced DataInjector with todo generation capabilities
 */

import { DataInjector, TodoItem, SubtaskTodoList, TaskComplexity } from '../../core/utils/dataInjector';
import { SubtaskType } from '../../core/types/subtaskSchema';

// Mock data for testing
const mockSubtask = {
  id: 'subtask-123',
  title: 'Test Subtask',
  description: 'Create a comprehensive analysis of market trends',
  type: SubtaskType.ANALYSIS,
  priority: 'high' as const,
  assignedAgentId: 'agent-456',
  dependencies: [],
  estimatedDuration: 15,
  status: 'pending' as const,
  retryCount: 0
};

const mockWorkflow = {
  id: 'workflow-789',
  title: 'Test Workflow',
  description: 'Test workflow for analysis',
  subtasks: [mockSubtask],
  status: 'draft' as const,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockOriginalPrompt = `
Please analyze market trends for Q4 2024. 
The analysis should be professional and data-driven.
Format the results as a detailed report with charts and graphs.
Focus on technology sector, healthcare, and renewable energy.
Include recommendations for investment strategies.
Ensure all data is from reliable sources and cite them properly.
`;

describe('DataInjector Enhanced Functionality', () => {
  let dataInjector: DataInjector;

  beforeEach(() => {
    dataInjector = new DataInjector();
  });

  describe('Todo Generation', () => {
    test('should generate todo list for analysis subtask', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.todoList).toBeDefined();
      expect(result.todoList.subtaskId).toBe(mockSubtask.id);
      expect(result.todoList.agentId).toBe(mockSubtask.assignedAgentId);
      expect(result.todoList.todos.length).toBeGreaterThan(0);
      expect(result.todoList.totalItems).toBe(result.todoList.todos.length);
      expect(result.todoList.completedItems).toBe(0);
    });

    test('should generate appropriate number of todos based on complexity', () => {
      const simplePrompt = 'Simple task';
      const complexPrompt = mockOriginalPrompt; // More complex

      const simpleResult = dataInjector.injectContextToSubtaskPrompt(
        { ...mockSubtask, description: simplePrompt },
        mockWorkflow,
        simplePrompt
      );

      const complexResult = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        complexPrompt
      );

      expect(complexResult.todoList.todos.length).toBeGreaterThanOrEqual(
        simpleResult.todoList.todos.length
      );
    });

    test('should create todos with valid structure', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      result.todoList.todos.forEach(todo => {
        expect(todo.id).toBeDefined();
        expect(todo.title).toBeDefined();
        expect(todo.description).toBeDefined();
        expect(todo.estimatedDurationMs).toBeGreaterThan(0);
        expect(todo.status).toBe('pending');
        expect(todo.progressPercentage).toBe(0);
        expect(Array.isArray(todo.dependencies)).toBe(true);
      });
    });

    test('should generate todos with proper dependencies', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      const todosWithDeps = result.todoList.todos.filter(t => t.dependencies.length > 0);
      expect(todosWithDeps.length).toBeGreaterThan(0);

      // Verify dependency references are valid
      todosWithDeps.forEach(todo => {
        todo.dependencies.forEach(depId => {
          const depExists = result.todoList.todos.some(t => t.id === depId);
          expect(depExists).toBe(true);
        });
      });
    });

    test('should estimate realistic durations', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      const totalEstimated = result.todoList.estimatedTotalDuration;
      const sumOfTodos = result.todoList.todos.reduce((sum, t) => sum + t.estimatedDurationMs, 0);

      expect(totalEstimated).toBe(sumOfTodos);
      expect(totalEstimated).toBeGreaterThan(0);
      expect(totalEstimated).toBeLessThan(7200000); // Less than 2 hours for reasonable tasks
    });
  });

  describe('Task Complexity Analysis', () => {
    test('should analyze task complexity correctly', () => {
      const simplePrompt = 'Write a short summary';
      const complexPrompt = mockOriginalPrompt;

      // Access private method through any casting for testing
      const simpleComplexity = (dataInjector as any).analyzeTaskComplexity(
        simplePrompt,
        SubtaskType.CREATION
      );
      const complexComplexity = (dataInjector as any).analyzeTaskComplexity(
        complexPrompt,
        SubtaskType.ANALYSIS
      );

      expect(['simple', 'moderate', 'complex', 'expert']).toContain(simpleComplexity.level);
      expect(['simple', 'moderate', 'complex', 'expert']).toContain(complexComplexity.level);
      expect(complexComplexity.estimatedDuration).toBeGreaterThanOrEqual(simpleComplexity.estimatedDuration);
    });

    test('should identify risk factors', () => {
      const riskPrompt = 'Integrate with external API and analyze performance metrics';
      
      const complexity = (dataInjector as any).analyzeTaskComplexity(
        riskPrompt,
        SubtaskType.ANALYSIS
      );

      expect(complexity.riskFactors.length).toBeGreaterThan(0);
      expect(complexity.requiresExternalData).toBe(true);
    });
  });

  describe('Progress Tracking Instructions', () => {
    test('should generate valid progress tracking instructions', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.progressTrackingInstructions).toBeDefined();
      expect(result.progressTrackingInstructions).toContain('CHECKPOINT:');
      expect(result.progressTrackingInstructions).toContain('PROGRESS:');
      expect(result.progressTrackingInstructions).toContain('ISSUE:');
      expect(result.progressTrackingInstructions).toContain('HELP:');
    });

    test('should generate checkpoint markers', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.checkpointMarkers).toBeDefined();
      expect(result.checkpointMarkers.length).toBeGreaterThan(0);
      
      // Verify marker format
      result.checkpointMarkers.forEach(marker => {
        expect(marker).toMatch(/\[(?:CHECKPOINT|PROGRESS|ISSUE|HELP):/);
      });
    });

    test('should embed progress tracking in prompt', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.injectedPrompt).toContain('PROGRESS TRACKING ENABLED');
      expect(result.injectedPrompt).toContain('TODO CHECKLIST:');
      result.todoList.todos.forEach(todo => {
        expect(result.injectedPrompt).toContain(todo.id);
      });
    });
  });

  describe('Context Injection', () => {
    test('should preserve original context injection functionality', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.injectedPrompt).toContain('professional');
      expect(result.injectedPrompt).toContain('data-driven');
      expect(result.injectedPrompt).toContain('technology sector');
      expect(result.contextMetadata.originalLength).toBeGreaterThan(0);
      expect(result.contextMetadata.injectedLength).toBeGreaterThan(
        result.contextMetadata.originalLength
      );
    });

    test('should handle different subtask types', () => {
      const subtaskTypes = [
        SubtaskType.RESEARCH,
        SubtaskType.ANALYSIS,
        SubtaskType.CREATION,
        SubtaskType.VALIDATION
      ];

      subtaskTypes.forEach(type => {
        const testSubtask = { ...mockSubtask, type };
        const result = dataInjector.injectContextToSubtaskPrompt(
          testSubtask,
          mockWorkflow,
          mockOriginalPrompt
        );

        expect(result.todoList.todos.length).toBeGreaterThan(0);
        expect(result.injectedPrompt).toContain(type);
      });
    });
  });

  describe('Configuration Presets', () => {
    test('should create valid configuration presets', () => {
      const presets = ['minimal', 'standard', 'comprehensive'];
      
      presets.forEach(presetName => {
        const config = DataInjector.createPreset(presetName);
        expect(config).toBeDefined();
        expect(typeof config.includeTone).toBe('boolean');
        expect(typeof config.includeFormat).toBe('boolean');
        expect(typeof config.includeOriginalPrompt).toBe('boolean');
        expect(typeof config.includeStyleGuide).toBe('boolean');
        expect(config.maxContextLength).toBeGreaterThan(0);
      });
    });

    test('should apply preset configurations correctly', () => {
      const minimalConfig = DataInjector.createPreset('minimal');
      const comprehensiveConfig = DataInjector.createPreset('comprehensive');

      const minimalResult = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt,
        minimalConfig
      );

      const comprehensiveResult = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt,
        comprehensiveConfig
      );

      expect(comprehensiveResult.contextMetadata.injectedLength).toBeGreaterThanOrEqual(
        minimalResult.contextMetadata.injectedLength
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle empty prompts gracefully', () => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        { ...mockSubtask, description: '' },
        mockWorkflow,
        ''
      );

      expect(result.todoList).toBeDefined();
      expect(result.todoList.todos.length).toBeGreaterThan(0);
      expect(result.injectedPrompt).toBeDefined();
    });

    test('should handle invalid subtask types', () => {
      const invalidSubtask = { ...mockSubtask, type: 'INVALID' as any };
      
      expect(() => {
        dataInjector.injectContextToSubtaskPrompt(
          invalidSubtask,
          mockWorkflow,
          mockOriginalPrompt
        );
      }).not.toThrow();
    });

    test('should handle missing agent assignment', () => {
      const unassignedSubtask = { ...mockSubtask, assignedAgentId: undefined };
      
      const result = dataInjector.injectContextToSubtaskPrompt(
        unassignedSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );

      expect(result.agentId).toBe('unassigned');
      expect(result.todoList.agentId).toBe('unassigned');
    });
  });

  describe('Performance Requirements', () => {
    test('should generate todos within performance target (<50ms)', async () => {
      const startTime = performance.now();
      
      dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(50);
    });

    test('should handle large prompts efficiently', () => {
      const largePrompt = mockOriginalPrompt.repeat(100); // ~50KB prompt
      
      const startTime = performance.now();
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        largePrompt
      );
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Still reasonable for large inputs
      expect(result.todoList).toBeDefined();
    });

    test('should maintain accuracy with complex prompts', () => {
      const complexPrompt = `
        1. Research market trends
        2. Analyze competitor data
        3. Create visualizations
        4. Write executive summary
        5. Present findings
        6. Collect feedback
        7. Revise recommendations
      `;

      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        complexPrompt
      );

      // Should detect at least 70% of explicit steps (5 out of 7)
      expect(result.todoList.todos.length).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('DataInjector Integration Tests', () => {
  let dataInjector: DataInjector;

  beforeEach(() => {
    dataInjector = new DataInjector();
  });

  test('should handle workflow with multiple subtasks', () => {
    const multiSubtaskWorkflow = {
      ...mockWorkflow,
      subtasks: [
        { ...mockSubtask, id: 'subtask-1', type: SubtaskType.RESEARCH },
        { ...mockSubtask, id: 'subtask-2', type: SubtaskType.ANALYSIS },
        { ...mockSubtask, id: 'subtask-3', type: SubtaskType.CREATION }
      ]
    };

    multiSubtaskWorkflow.subtasks.forEach(subtask => {
      const result = dataInjector.injectContextToSubtaskPrompt(
        subtask,
        multiSubtaskWorkflow,
        mockOriginalPrompt
      );

      expect(result.todoList.subtaskId).toBe(subtask.id);
      expect(result.todoList.todos.length).toBeGreaterThan(0);
    });
  });

  test('should maintain consistency across multiple generations', () => {
    const results = [];
    
    // Generate same subtask multiple times
    for (let i = 0; i < 5; i++) {
      const result = dataInjector.injectContextToSubtaskPrompt(
        mockSubtask,
        mockWorkflow,
        mockOriginalPrompt
      );
      results.push(result);
    }

    // Todo counts should be consistent (within reasonable variance)
    const todoCounts = results.map(r => r.todoList.todos.length);
    const avgCount = todoCounts.reduce((sum, count) => sum + count, 0) / todoCounts.length;
    
    todoCounts.forEach(count => {
      expect(Math.abs(count - avgCount)).toBeLessThanOrEqual(2); // Allow variance of ±2
    });
  });
});

describe('DataInjector Backward Compatibility', () => {
  let dataInjector: DataInjector;

  beforeEach(() => {
    dataInjector = new DataInjector();
  });

  test('should maintain backward compatibility with legacy interface', () => {
    // Test that legacy extractRelevantContext method still works
    const relevantContext = dataInjector.extractRelevantContext(
      mockOriginalPrompt,
      SubtaskType.ANALYSIS
    );

    expect(relevantContext).toBeDefined();
    expect(typeof relevantContext).toBe('string');
    expect(relevantContext.length).toBeGreaterThan(0);
  });

  test('should not break existing functionality', () => {
    const result = dataInjector.injectContextToSubtaskPrompt(
      mockSubtask,
      mockWorkflow,
      mockOriginalPrompt
    );

    // Verify all original interface properties are present
    expect(result.agentId).toBeDefined();
    expect(result.subtaskId).toBeDefined();
    expect(result.injectedPrompt).toBeDefined();
    expect(result.contextMetadata).toBeDefined();
    expect(result.contextMetadata.originalLength).toBeDefined();
    expect(result.contextMetadata.injectedLength).toBeDefined();
    expect(result.contextMetadata.compressionRatio).toBeDefined();
  });
});