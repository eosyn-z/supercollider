/**
 * System monitoring and status service
 */

import { EventEmitter } from 'events';

export class SystemService extends EventEmitter {
  private startTime: Date;

  constructor() {
    super();
    this.startTime = new Date();
  }

  // Lazy imports to prevent circular dependencies
  private get workflowService() {
    const { serviceRegistry } = require('./ServiceRegistry');
    return serviceRegistry.workflowService;
  }

  private get agentService() {
    const { serviceRegistry } = require('./ServiceRegistry');
    return serviceRegistry.agentService;
  }

  private get executionService() {
    const { serviceRegistry } = require('./ServiceRegistry');
    return serviceRegistry.executionService;
  }

  async getSystemStatus(): Promise<any> {
    const workflowStats = await this.workflowService.getWorkflowStats();
    const agentStats = await this.agentService.getAgentStats();
    const executionStats = await this.executionService.getExecutionStats();

    return {
      server: {
        status: 'healthy',
        uptime: process.uptime(),
        startTime: this.startTime,
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      resources: {
        memory: this.getMemoryUsage(),
        cpu: await this.getCpuUsage()
      },
      services: {
        workflows: {
          status: 'operational',
          ...workflowStats
        },
        agents: {
          status: 'operational',
          ...agentStats
        },
        execution: {
          status: 'operational',
          ...executionStats
        }
      },
      database: {
        status: 'operational',
        type: 'in-memory',
        connected: true
      },
      lastUpdated: new Date().toISOString()
    };
  }

  async getSystemMetrics(): Promise<any> {
    const memoryUsage = this.getMemoryUsage();
    const cpuUsage = await this.getCpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        ...memoryUsage,
        usage: memoryUsage.used / memoryUsage.total
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: this.getLoadAverage()
      },
      eventLoop: {
        delay: await this.getEventLoopDelay()
      },
      gc: this.getGarbageCollectionStats()
    };
  }

  async getExecutionStats(): Promise<any> {
    return await this.executionService.getExecutionStats();
  }

  private getMemoryUsage(): any {
    const usage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();

    return {
      process: {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      },
      system: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem
      },
      formatted: {
        processRSS: this.formatBytes(usage.rss),
        processHeap: this.formatBytes(usage.heapUsed),
        systemTotal: this.formatBytes(totalMem),
        systemUsed: this.formatBytes(totalMem - freeMem)
      }
    };
  }

  private async getCpuUsage(): Promise<number> {
    const os = require('os');
    const cpus = os.cpus();
    
    // Simple CPU usage calculation
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  private getLoadAverage(): number[] {
    const os = require('os');
    return os.loadavg();
  }

  private async getEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // Convert to milliseconds
      });
    });
  }

  private getGarbageCollectionStats(): any {
    // Note: This would require --expose-gc flag or v8 module in production
    try {
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      
      return {
        totalHeapSize: heapStats.total_heap_size,
        totalHeapSizeExecutable: heapStats.total_heap_size_executable,
        totalPhysicalSize: heapStats.total_physical_size,
        totalAvailableSize: heapStats.total_available_size,
        usedHeapSize: heapStats.used_heap_size,
        heapSizeLimit: heapStats.heap_size_limit,
        mallocedMemory: heapStats.malloced_memory,
        peakMallocedMemory: heapStats.peak_malloced_memory
      };
    } catch (error) {
      return {
        error: 'GC stats not available',
        message: 'Use --expose-gc flag to enable detailed GC statistics'
      };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Health check methods
  async performHealthCheck(): Promise<any> {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        memory: this.checkMemoryHealth(),
        cpu: await this.checkCpuHealth(),
        services: await this.checkServicesHealth(),
        database: this.checkDatabaseHealth()
      }
    };

    const failedChecks = Object.values(checks.checks).filter(check => !check.healthy);
    if (failedChecks.length > 0) {
      checks.status = 'unhealthy';
    }

    return checks;
  }

  private checkMemoryHealth(): any {
    const usage = this.getMemoryUsage();
    const heapUsagePercent = (usage.process.heapUsed / usage.process.heapTotal) * 100;
    const systemUsagePercent = (usage.system.used / usage.system.total) * 100;

    return {
      healthy: heapUsagePercent < 90 && systemUsagePercent < 90,
      heapUsage: heapUsagePercent.toFixed(2) + '%',
      systemUsage: systemUsagePercent.toFixed(2) + '%',
      details: {
        heapUsed: this.formatBytes(usage.process.heapUsed),
        heapTotal: this.formatBytes(usage.process.heapTotal),
        systemUsed: this.formatBytes(usage.system.used),
        systemTotal: this.formatBytes(usage.system.total)
      }
    };
  }

  private async checkCpuHealth(): Promise<any> {
    const cpuUsage = await this.getCpuUsage();
    const loadAvg = this.getLoadAverage();

    return {
      healthy: cpuUsage < 80,
      usage: cpuUsage.toFixed(2) + '%',
      loadAverage: {
        '1min': loadAvg[0].toFixed(2),
        '5min': loadAvg[1].toFixed(2),
        '15min': loadAvg[2].toFixed(2)
      }
    };
  }

  private async checkServicesHealth(): Promise<any> {
    try {
      const workflowStats = await this.workflowService.getWorkflowStats();
      const agentStats = await this.agentService.getAgentStats();
      const executionStats = await this.executionService.getExecutionStats();

      return {
        healthy: true,
        workflows: {
          total: workflowStats.total,
          running: workflowStats.byStatus.running
        },
        agents: {
          total: agentStats.total,
          available: agentStats.available
        },
        executions: {
          total: executionStats.total,
          running: executionStats.byStatus.running
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  private checkDatabaseHealth(): any {
    // For in-memory storage, always healthy
    return {
      healthy: true,
      type: 'in-memory',
      connected: true,
      responseTime: '<1ms'
    };
  }

  // Metrics collection
  startMetricsCollection(intervalMs: number = 60000): void {
    setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        this.emit('metrics-collected', metrics);
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, intervalMs);
  }

  // Alerting
  checkAlerts(): any[] {
    const alerts: any[] = [];
    const memoryUsage = this.getMemoryUsage();
    
    // Memory alerts
    const heapUsagePercent = (memoryUsage.process.heapUsed / memoryUsage.process.heapTotal) * 100;
    if (heapUsagePercent > 85) {
      alerts.push({
        type: 'memory',
        severity: heapUsagePercent > 95 ? 'critical' : 'warning',
        message: `High heap memory usage: ${heapUsagePercent.toFixed(2)}%`,
        timestamp: new Date().toISOString()
      });
    }

    // Uptime alerts
    const uptimeHours = process.uptime() / 3600;
    if (uptimeHours > 24 * 7) { // 1 week
      alerts.push({
        type: 'uptime',
        severity: 'info',
        message: `Server has been running for ${uptimeHours.toFixed(1)} hours`,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }
}