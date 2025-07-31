/**
 * System status and monitoring routes
 */

import express, { Request, Response } from 'express';
import { serviceRegistry } from '../services/ServiceRegistry';

const router = express.Router();

// Get system status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await serviceRegistry.systemService.getSystemStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_STATUS_ERROR',
        message: 'Failed to fetch system status'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get system metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await serviceRegistry.systemService.getSystemMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_METRICS_ERROR',
        message: 'Failed to fetch system metrics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get execution statistics
router.get('/stats/executions', async (req: Request, res: Response) => {
  try {
    const stats = await serviceRegistry.systemService.getExecutionStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching execution stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_STATS_ERROR',
        message: 'Failed to fetch execution statistics'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;