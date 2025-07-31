/**
 * Request validation middleware
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Validation schemas
const WorkflowCreationSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(50000, 'Prompt too long'),
  config: z.object({
    granularity: z.enum(['fine', 'coarse']).optional(),
    batchSize: z.number().min(1).max(50).optional(),
    maxSubtasks: z.number().min(1).max(100).optional(),
    maxPromptLength: z.number().min(100).max(100000).optional(),
    maxTokensPerSubtask: z.number().min(100).max(10000).optional()
  }).optional()
});

const WorkflowExecutionSchema = z.object({
  config: z.object({
    concurrency: z.object({
      maxConcurrentSubtasks: z.number().min(1).max(20).optional(),
      maxConcurrentBatches: z.number().min(1).max(10).optional()
    }).optional(),
    retry: z.object({
      maxRetries: z.number().min(0).max(10).optional(),
      backoffMultiplier: z.number().min(1).max(5).optional(),
      initialDelayMs: z.number().min(100).max(60000).optional()
    }).optional(),
    validation: z.object({
      enabled: z.boolean().optional(),
      strictMode: z.boolean().optional()
    }).optional()
  }).optional()
});

const AgentCreationSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  apiKey: z.string().min(1, 'API key is required'),
  capabilities: z.array(z.object({
    name: z.string().min(1),
    category: z.enum(['RESEARCH', 'ANALYSIS', 'CREATION', 'VALIDATION']),
    proficiency: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
  })).min(1, 'At least one capability is required'),
  performanceMetrics: z.object({
    averageCompletionTime: z.number().min(0),
    successRate: z.number().min(0).max(100),
    qualityScore: z.number().min(0).max(100),
    totalTasksCompleted: z.number().min(0),
    lastUpdated: z.date().optional()
  }),
  availability: z.boolean(),
  costPerMinute: z.number().min(0)
});

// Validation middleware functions
export const validateWorkflowCreation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = WorkflowCreationSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.error('Unexpected validation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during validation'
      },
      timestamp: new Date().toISOString()
    });
  }
};

export const validateWorkflowExecution = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = WorkflowExecutionSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid execution configuration',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.error('Unexpected validation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during validation'
      },
      timestamp: new Date().toISOString()
    });
  }
};

export const validateAgentCreation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = AgentCreationSchema.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid agent data',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.error('Unexpected validation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error during validation'
      },
      timestamp: new Date().toISOString()
    });
  }
};

// Generic validation middleware
export const validateSchema = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors.map(err => ({
              path: err.path.join('.'),
              message: err.message
            }))
          },
          timestamp: new Date().toISOString()
        });
      }
      
      console.error('Unexpected validation error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error during validation'
        },
        timestamp: new Date().toISOString()
      });
    }
  };
};

// Parameter validation
export const validateWorkflowId = (req: Request, res: Response, next: NextFunction) => {
  const { workflowId } = req.params;
  
  if (!workflowId || typeof workflowId !== 'string' || workflowId.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_WORKFLOW_ID',
        message: 'Valid workflow ID is required'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

export const validateAgentId = (req: Request, res: Response, next: NextFunction) => {
  const { agentId } = req.params;
  
  if (!agentId || typeof agentId !== 'string' || agentId.trim() === '') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_AGENT_ID',
        message: 'Valid agent ID is required'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};