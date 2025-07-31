/**
 * Agent management routes
 */

import express, { Request, Response } from 'express';
import { serviceRegistry } from '../services/ServiceRegistry';
import { validateAgentCreation } from '../middleware/validation';

const router = express.Router();

// Get all agents
router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await serviceRegistry.agentService.getAllAgents();
    res.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_AGENTS_ERROR',
        message: 'Failed to fetch agents'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific agent
router.get('/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const agent = await serviceRegistry.agentService.getAgent(agentId);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_AGENT_ERROR',
        message: 'Failed to fetch agent'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Create new agent
router.post('/', validateAgentCreation, async (req: Request, res: Response) => {
  try {
    const agentData = req.body;
    const agent = await serviceRegistry.agentService.createAgent(agentData);
    
    res.status(201).json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_AGENT_ERROR',
        message: 'Failed to create agent'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Update agent
router.put('/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const updates = req.body;
    
    const agent = await serviceRegistry.agentService.updateAgent(agentId, updates);
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_AGENT_ERROR',
        message: 'Failed to update agent'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Delete agent
router.delete('/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const success = await serviceRegistry.agentService.deleteAgent(agentId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
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
    console.error('Error deleting agent:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_AGENT_ERROR',
        message: 'Failed to delete agent'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Validate agent API key
router.post('/:agentId/validate-key', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_API_KEY',
          message: 'API key is required'
        },
        timestamp: new Date().toISOString()
      });
    }

    const isValid = await serviceRegistry.agentService.validateApiKey(agentId, apiKey);
    
    res.json({
      success: true,
      data: { valid: isValid },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error validating API key:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATE_KEY_ERROR',
        message: 'Failed to validate API key'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get agent health status
router.get('/:agentId/health', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const health = await serviceRegistry.agentService.getAgentHealth(agentId);
    
    if (!health) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agent health:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_HEALTH_ERROR',
        message: 'Failed to fetch agent health'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get agent performance metrics
router.get('/:agentId/metrics', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const metrics = await serviceRegistry.agentService.getPerformanceMetrics(agentId);
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AGENT_NOT_FOUND',
          message: `Agent ${agentId} not found`
        },
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agent metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_METRICS_ERROR',
        message: 'Failed to fetch agent metrics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;