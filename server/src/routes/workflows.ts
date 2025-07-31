/**
 * Workflow management routes
 */

import express, { Request, Response } from 'express';
import { serviceRegistry } from '../services/ServiceRegistry';
import { validateWorkflowCreation, validateWorkflowExecution } from '../middleware/validation';

const router = express.Router();

// Get all workflows
router.get('/', async (req: Request, res: Response) => {
  try {
    const workflows = await serviceRegistry.workflowService.getAllWorkflows();
    res.json({
      success: true,
      data: workflows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_WORKFLOWS_ERROR',
        message: 'Failed to fetch workflows'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific workflow
router.get('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const workflow = await serviceRegistry.workflowService.getWorkflow(workflowId);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: workflow,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_WORKFLOW_ERROR',
        message: 'Failed to fetch workflow'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create new workflow
router.post('/', validateWorkflowCreation, async (req: Request, res: Response) => {
  try {
    const workflowRequest = req.body;
    const workflow = await serviceRegistry.workflowService.createWorkflow(workflowRequest);
    
    res.status(201).json({
      success: true,
      data: workflow,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_WORKFLOW_ERROR',
        message: 'Failed to create workflow'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Update workflow
router.put('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const updates = req.body;
    
    const workflow = await serviceRegistry.workflowService.updateWorkflow(workflowId, updates);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: workflow,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_WORKFLOW_ERROR',
        message: 'Failed to update workflow'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Delete workflow
router.delete('/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const success = await serviceRegistry.workflowService.deleteWorkflow(workflowId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${workflowId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: { deleted: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_WORKFLOW_ERROR',
        message: 'Failed to delete workflow'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Execute workflow
router.post('/:workflowId/execute', validateWorkflowExecution, async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const executionRequest = { ...req.body, workflowId };
    
    const executionState = await serviceRegistry.executionService.startExecution(executionRequest);
    
    res.json({
      success: true,
      data: executionState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting execution:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_START_ERROR',
        message: 'Failed to start workflow execution'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get execution state
router.get('/:workflowId/execution', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const executionState = await serviceRegistry.executionService.getExecutionState(workflowId);
    
    if (!executionState) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EXECUTION_NOT_FOUND',
          message: `No execution found for workflow ${workflowId}`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: executionState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching execution state:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_EXECUTION_ERROR',
        message: 'Failed to fetch execution state'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Halt execution
router.post('/:workflowId/halt', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const { reason } = req.body;
    
    const success = await serviceRegistry.executionService.haltExecution(workflowId, reason);
    
    res.json({
      success: true,
      data: { halted: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error halting execution:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HALT_EXECUTION_ERROR',
        message: 'Failed to halt execution'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Resume execution
router.post('/:workflowId/resume', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    
    const success = await serviceRegistry.executionService.resumeExecution(workflowId);
    
    res.json({
      success: true,
      data: { resumed: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error resuming execution:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESUME_EXECUTION_ERROR',
        message: 'Failed to resume execution'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Halt specific subtask
router.post('/:workflowId/subtasks/:subtaskId/halt', async (req: Request, res: Response) => {
  try {
    const { workflowId, subtaskId } = req.params;
    
    const success = await serviceRegistry.executionService.haltSubtask(workflowId, subtaskId);
    
    res.json({
      success: true,
      data: { halted: success },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error halting subtask:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HALT_SUBTASK_ERROR',
        message: 'Failed to halt subtask'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get execution logs
router.get('/:workflowId/logs', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const logs = await serviceRegistry.executionService.getExecutionLogs(workflowId, limit);
    
    res.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching execution logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_LOGS_ERROR',
        message: 'Failed to fetch execution logs'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get micro prompts for a subtask
router.get('/subtasks/:subtaskId/micro-prompts', async (req: Request, res: Response) => {
  try {
    const { subtaskId } = req.params;
    
    // For now, return empty array - this would typically come from a database
    const microPrompts: string[] = [];
    
    res.json({
      success: true,
      data: { prompts: microPrompts },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching micro prompts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_MICRO_PROMPTS_ERROR',
        message: 'Failed to fetch micro prompts'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Generate micro prompts for a subtask
router.post('/subtasks/:subtaskId/generate-micro-prompts', async (req: Request, res: Response) => {
  try {
    const { subtaskId } = req.params;
    const { workflowContext } = req.body;
    
    // Generate sample micro prompts based on subtask context
    // In a real implementation, this would use an AI service
    const sampleMicroPrompts = [
      `Break down the main task into specific actionable steps`,
      `Identify key resources and information needed`,
      `Define success criteria and validation methods`,
      `Consider potential obstacles and mitigation strategies`,
      `Outline the expected output format and quality standards`
    ];
    
    res.json({
      success: true,
      data: { prompts: sampleMicroPrompts },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating micro prompts:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_MICRO_PROMPTS_ERROR',
        message: 'Failed to generate micro prompts'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create and decompose workflow endpoint
router.post('/create-and-decompose', async (req: Request, res: Response) => {
  try {
    const workflow = req.body;
    
    console.log('Creating workflow:', workflow.id);
    
    // For now, create simple mock subtasks since task slicer import is problematic
    if (!workflow.subtasks || workflow.subtasks.length === 0) {
      // Create basic subtasks based on the prompt
      const prompt = workflow.prompt.toLowerCase();
      const subtasks = [];
      
      if (prompt.includes('research') || prompt.includes('analyze')) {
        subtasks.push({
          id: 'subtask-1',
          title: 'Research and Analysis',
          description: 'Conduct research and analysis based on the prompt',
          type: 'RESEARCH',
          priority: 'HIGH',
          status: 'PENDING',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflow.id,
          estimatedDuration: 30
        });
      }
      
      if (prompt.includes('create') || prompt.includes('generate') || prompt.includes('write')) {
        subtasks.push({
          id: 'subtask-2',
          title: 'Content Creation',
          description: 'Create content based on research and requirements',
          type: 'CREATION',
          priority: 'HIGH',
          status: 'PENDING',
          dependencies: subtasks.length > 0 ? [{ subtaskId: subtasks[0].id, type: 'BLOCKING', description: 'Needs research first' }] : [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflow.id,
          estimatedDuration: 45
        });
      }
      
      if (prompt.includes('validate') || prompt.includes('review') || prompt.includes('check')) {
        subtasks.push({
          id: 'subtask-3',
          title: 'Validation and Review',
          description: 'Validate and review the created content',
          type: 'VALIDATION',
          priority: 'MEDIUM',
          status: 'PENDING',
          dependencies: subtasks.length > 0 ? [{ subtaskId: subtasks[subtasks.length - 1].id, type: 'BLOCKING', description: 'Needs content first' }] : [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflow.id,
          estimatedDuration: 20
        });
      }
      
      // If no specific types detected, create a general subtask
      if (subtasks.length === 0) {
        subtasks.push({
          id: 'subtask-1',
          title: 'Process Request',
          description: 'Process the workflow request',
          type: 'ANALYSIS',
          priority: 'HIGH',
          status: 'PENDING',
          dependencies: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          parentWorkflowId: workflow.id,
          estimatedDuration: 30
        });
      }
      
      workflow.subtasks = subtasks;
    }
    
    console.log('Workflow subtasks created:', workflow.subtasks.length);
    
    // Create a simple decomposition
    const decomposition = {
      workflowId: workflow.id,
      atomicUnits: workflow.subtasks.map((subtask: any, index: number) => ({
        id: `atomic-${subtask.id}`,
        type: 'TASK',
        title: subtask.title,
        description: subtask.description,
        priority: subtask.priority,
        dependencies: subtask.dependencies.map((dep: any) => dep.subtaskId),
        estimatedDuration: subtask.estimatedDuration,
        inputs: [],
        outputs: [],
        constraints: [],
        context: {
          workflowId: workflow.id,
          position: index,
          parentSubtask: subtask.id
        }
      })),
      decompositionStrategy: 'sequential',
      metadata: {
        totalUnits: workflow.subtasks.length,
        estimatedDuration: workflow.subtasks.reduce((total: number, subtask: any) => total + (subtask.estimatedDuration || 30), 0),
        complexity: workflow.subtasks.length > 3 ? 'high' : workflow.subtasks.length > 1 ? 'medium' : 'low',
        dependencies: []
      }
    };
    
    res.json({
      success: true,
      data: {
        workflow: {
          id: workflow.id,
          subtaskCount: workflow.subtasks.length
        },
        decomposition: {
          workflowId: decomposition.workflowId,
          metadata: decomposition.metadata
        },
        message: 'Workflow created and decomposed successfully'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to create and decompose workflow:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_CREATION_DECOMPOSITION_ERROR',
        message: 'Failed to create and decompose workflow',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;