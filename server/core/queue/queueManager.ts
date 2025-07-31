import { PromptShred } from '../utils/smartShredder';

interface WorkflowQueue {
  id: string;
  userId: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'processing' | 'completed' | 'failed';
  workflowType: 'video_generation' | 'js_code_creation' | 'document_analysis' | 'custom';
  originalPrompt: string;
  decomposedTasks: PromptShred[];
  estimatedTokens: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  approvedAt?: Date;
  rejectedReason?: string;
  metadata?: {
    estimatedCost?: number;
    estimatedDuration?: number;
    requiredCapabilities?: string[];
    batchGroups?: string[];
  };
}

interface ApprovalCriteria {
  tokenLimit: number;
  complexityThreshold: number;
  costEstimate: number;
  userTier: 'free' | 'pro' | 'enterprise';
  requiresHumanReview: boolean;
}

interface QueueStats {
  pending: number;
  approved: number;
  processing: number;
  completed: number;
  failed: number;
  rejected: number;
}

class QueueManager {
  private workflows: Map<string, WorkflowQueue> = new Map();
  private userTiers: Map<string, 'free' | 'pro' | 'enterprise'> = new Map();
  
  private readonly TIER_LIMITS = {
    free: {
      tokenLimit: 5000,
      complexityThreshold: 3,
      costLimit: 5.0,
      autoApprovalLimit: 1000,
      maxConcurrentWorkflows: 2
    },
    pro: {
      tokenLimit: 50000,
      complexityThreshold: 6,
      costLimit: 50.0,
      autoApprovalLimit: 10000,
      maxConcurrentWorkflows: 10
    },
    enterprise: {
      tokenLimit: 500000,
      complexityThreshold: 10,
      costLimit: 500.0,
      autoApprovalLimit: 100000,
      maxConcurrentWorkflows: 50
    }
  };

  constructor() {
    this.initializeDefaultTiers();
  }

  private initializeDefaultTiers(): void {
    this.userTiers.set('demo_user', 'free');
    this.userTiers.set('test_user', 'pro');
    this.userTiers.set('admin_user', 'enterprise');
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateComplexity(shreds: PromptShred[]): number {
    if (shreds.length === 0) return 1;
    
    const avgTokens = shreds.reduce((sum, shred) => sum + shred.estimatedTokens, 0) / shreds.length;
    const uniqueAtomTypes = new Set(shreds.map(shred => shred.atomType)).size;
    const dependencyComplexity = shreds.reduce((sum, shred) => sum + shred.dependencies.length, 0);
    
    return Math.min(10, Math.max(1, 
      (avgTokens / 1000) + 
      (uniqueAtomTypes * 0.5) + 
      (dependencyComplexity * 0.3)
    ));
  }

  private calculateEstimatedCost(shreds: PromptShred[]): number {
    return shreds.reduce((total, shred) => total + (shred.estimatedTokens * 0.001), 0);
  }

  private determineWorkflowType(prompt: string, shreds: PromptShred[]): WorkflowQueue['workflowType'] {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('video') || lowerPrompt.includes('media')) {
      return 'video_generation';
    }
    
    if (lowerPrompt.includes('code') || lowerPrompt.includes('javascript') || lowerPrompt.includes('programming')) {
      return 'js_code_creation';
    }
    
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('document') || lowerPrompt.includes('review')) {
      return 'document_analysis';
    }
    
    return 'custom';
  }

  private determineWorkflowPriority(
    userTier: 'free' | 'pro' | 'enterprise',
    estimatedTokens: number,
    complexity: number
  ): WorkflowQueue['priority'] {
    if (userTier === 'enterprise') return 'high';
    if (userTier === 'pro' && (estimatedTokens > 10000 || complexity > 5)) return 'high';
    if (estimatedTokens > 5000 || complexity > 3) return 'medium';
    return 'low';
  }

  private getUserTier(userId: string): 'free' | 'pro' | 'enterprise' {
    return this.userTiers.get(userId) || 'free';
  }

  private shouldAutoApprove(workflow: WorkflowQueue, criteria: ApprovalCriteria): boolean {
    const limits = this.TIER_LIMITS[criteria.userTier];
    
    return (
      !criteria.requiresHumanReview &&
      workflow.estimatedTokens <= limits.autoApprovalLimit &&
      criteria.costEstimate <= (limits.costLimit * 0.5) &&
      criteria.complexityThreshold <= (limits.complexityThreshold * 0.7)
    );
  }

  private getUserActiveWorkflows(userId: string): WorkflowQueue[] {
    return Array.from(this.workflows.values()).filter(
      workflow => workflow.userId === userId && 
      ['pending_approval', 'approved', 'processing'].includes(workflow.status)
    );
  }

  async submitWorkflow(
    prompt: string, 
    userId: string, 
    shreds: PromptShred[], 
    workflowType?: string
  ): Promise<string> {
    const userTier = this.getUserTier(userId);
    const limits = this.TIER_LIMITS[userTier];
    const activeWorkflows = this.getUserActiveWorkflows(userId);

    if (activeWorkflows.length >= limits.maxConcurrentWorkflows) {
      throw new Error(`Maximum concurrent workflows (${limits.maxConcurrentWorkflows}) reached for ${userTier} tier`);
    }

    const estimatedTokens = shreds.reduce((sum, shred) => sum + shred.estimatedTokens, 0);
    const complexity = this.calculateComplexity(shreds);
    const estimatedCost = this.calculateEstimatedCost(shreds);

    if (estimatedTokens > limits.tokenLimit) {
      throw new Error(`Token limit exceeded. ${userTier} tier limit: ${limits.tokenLimit}, requested: ${estimatedTokens}`);
    }

    if (estimatedCost > limits.costLimit) {
      throw new Error(`Cost limit exceeded. ${userTier} tier limit: $${limits.costLimit}, estimated: $${estimatedCost.toFixed(2)}`);
    }

    const workflowId = this.generateWorkflowId();
    const detectedWorkflowType = workflowType || this.determineWorkflowType(prompt, shreds);
    const priority = this.determineWorkflowPriority(userTier, estimatedTokens, complexity);

    const workflow: WorkflowQueue = {
      id: workflowId,
      userId,
      status: 'pending_approval',
      workflowType: detectedWorkflowType as WorkflowQueue['workflowType'],
      originalPrompt: prompt,
      decomposedTasks: shreds,
      estimatedTokens,
      priority,
      createdAt: new Date(),
      metadata: {
        estimatedCost,
        estimatedDuration: estimatedTokens * 0.1,
        requiredCapabilities: [...new Set(shreds.flatMap(s => s.agentCapabilities))],
        batchGroups: [...new Set(shreds.map(s => s.id.split('_')[1]))]
      }
    };

    const approvalCriteria: ApprovalCriteria = {
      tokenLimit: limits.tokenLimit,
      complexityThreshold: complexity,
      costEstimate: estimatedCost,
      userTier,
      requiresHumanReview: complexity > limits.complexityThreshold || estimatedCost > (limits.costLimit * 0.8)
    };

    if (this.shouldAutoApprove(workflow, approvalCriteria)) {
      workflow.status = 'approved';
      workflow.approvedAt = new Date();
    }

    this.workflows.set(workflowId, workflow);
    
    return workflowId;
  }

  async approveWorkflow(workflowId: string, approverId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'pending_approval') {
      throw new Error(`Workflow ${workflowId} is not pending approval (current status: ${workflow.status})`);
    }

    workflow.status = 'approved';
    workflow.approvedAt = new Date();
    workflow.metadata = {
      ...workflow.metadata,
      approvedBy: approverId
    };

    this.workflows.set(workflowId, workflow);
  }

  async rejectWorkflow(workflowId: string, reason: string, rejectorId?: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (workflow.status !== 'pending_approval') {
      throw new Error(`Workflow ${workflowId} is not pending approval (current status: ${workflow.status})`);
    }

    workflow.status = 'rejected';
    workflow.rejectedReason = reason;
    workflow.metadata = {
      ...workflow.metadata,
      rejectedBy: rejectorId,
      rejectedAt: new Date().toISOString()
    };

    this.workflows.set(workflowId, workflow);
  }

  async getWorkflow(workflowId: string): Promise<WorkflowQueue | null> {
    return this.workflows.get(workflowId) || null;
  }

  async getUserWorkflows(userId: string, status?: WorkflowQueue['status']): Promise<WorkflowQueue[]> {
    const userWorkflows = Array.from(this.workflows.values()).filter(
      workflow => workflow.userId === userId
    );

    if (status) {
      return userWorkflows.filter(workflow => workflow.status === status);
    }

    return userWorkflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getQueueStats(): Promise<QueueStats> {
    const workflows = Array.from(this.workflows.values());
    
    return {
      pending: workflows.filter(w => w.status === 'pending_approval').length,
      approved: workflows.filter(w => w.status === 'approved').length,
      processing: workflows.filter(w => w.status === 'processing').length,
      completed: workflows.filter(w => w.status === 'completed').length,
      failed: workflows.filter(w => w.status === 'failed').length,
      rejected: workflows.filter(w => w.status === 'rejected').length
    };
  }

  async getWorkflowsByStatus(status: WorkflowQueue['status']): Promise<WorkflowQueue[]> {
    return Array.from(this.workflows.values())
      .filter(workflow => workflow.status === status)
      .sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
  }

  async updateWorkflowStatus(
    workflowId: string, 
    status: WorkflowQueue['status'],
    metadata?: any
  ): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    workflow.status = status;
    if (metadata) {
      workflow.metadata = { ...workflow.metadata, ...metadata };
    }

    this.workflows.set(workflowId, workflow);
  }

  async setUserTier(userId: string, tier: 'free' | 'pro' | 'enterprise'): Promise<void> {
    this.userTiers.set(userId, tier);
  }

  async getUserTierInfo(userId: string): Promise<{
    tier: 'free' | 'pro' | 'enterprise';
    limits: typeof QueueManager.prototype.TIER_LIMITS['free'];
    usage: {
      activeWorkflows: number;
      maxConcurrentWorkflows: number;
    };
  }> {
    const tier = this.getUserTier(userId);
    const limits = this.TIER_LIMITS[tier];
    const activeWorkflows = this.getUserActiveWorkflows(userId);

    return {
      tier,
      limits,
      usage: {
        activeWorkflows: activeWorkflows.length,
        maxConcurrentWorkflows: limits.maxConcurrentWorkflows
      }
    };
  }

  async clearCompletedWorkflows(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let removedCount = 0;
    
    for (const [id, workflow] of this.workflows.entries()) {
      if (
        (workflow.status === 'completed' || workflow.status === 'failed' || workflow.status === 'rejected') &&
        workflow.createdAt < cutoffDate
      ) {
        this.workflows.delete(id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
}

export { QueueManager, WorkflowQueue, ApprovalCriteria, QueueStats };