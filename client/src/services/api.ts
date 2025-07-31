/**
 * API client for Supercollider backend communication
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ApiResponse, 
  Workflow, 
  Agent, 
  ExecutionState, 
  WorkflowCreationRequest,
  WorkflowExecutionRequest,
  FileMetadata,
  AtomicWorkflowDecomposition
} from '../types';

export class SupercolliderApi {
  private client: AxiosInstance;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL: `${baseUrl}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        console.log(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Workflow operations
  async getWorkflows(): Promise<Workflow[]> {
    try {
      const response = await this.client.get<ApiResponse<Workflow[]>>('/workflows');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      return [];
    }
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const response = await this.client.get<ApiResponse<Workflow>>(`/workflows/${workflowId}`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to fetch workflow ${workflowId}:`, error);
      return null;
    }
  }

  async createWorkflow(request: WorkflowCreationRequest): Promise<Workflow | null> {
    try {
      const response = await this.client.post<ApiResponse<Workflow>>('/workflows', request);
      return response.data.data || null;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      return null;
    }
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow | null> {
    try {
      const response = await this.client.put<ApiResponse<Workflow>>(`/workflows/${workflowId}`, updates);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to update workflow ${workflowId}:`, error);
      return null;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      await this.client.delete(`/workflows/${workflowId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete workflow ${workflowId}:`, error);
      return false;
    }
  }

  // Execution operations
  async startExecution(request: WorkflowExecutionRequest): Promise<ExecutionState | null> {
    try {
      const response = await this.client.post<ApiResponse<ExecutionState>>(
        `/workflows/${request.workflowId}/execute`, 
        request
      );
      return response.data.data || null;
    } catch (error) {
      console.error('Failed to start execution:', error);
      return null;
    }
  }

  async getExecutionState(workflowId: string): Promise<ExecutionState | null> {
    try {
      const response = await this.client.get<ApiResponse<ExecutionState>>(
        `/workflows/${workflowId}/execution`
      );
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to get execution state for ${workflowId}:`, error);
      return null;
    }
  }

  async haltExecution(workflowId: string, reason?: string): Promise<boolean> {
    try {
      await this.client.post(`/workflows/${workflowId}/halt`, { reason });
      return true;
    } catch (error) {
      console.error(`Failed to halt execution for ${workflowId}:`, error);
      return false;
    }
  }

  async resumeExecution(workflowId: string): Promise<boolean> {
    try {
      await this.client.post(`/workflows/${workflowId}/resume`);
      return true;
    } catch (error) {
      console.error(`Failed to resume execution for ${workflowId}:`, error);
      return false;
    }
  }

  async haltSubtask(workflowId: string, subtaskId: string): Promise<boolean> {
    try {
      await this.client.post(`/workflows/${workflowId}/subtasks/${subtaskId}/halt`);
      return true;
    } catch (error) {
      console.error(`Failed to halt subtask ${subtaskId}:`, error);
      return false;
    }
  }

  // Agent operations
  async getAgents(): Promise<Agent[]> {
    try {
      const response = await this.client.get<ApiResponse<Agent[]>>('/agents');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return [];
    }
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const response = await this.client.get<ApiResponse<Agent>>(`/agents/${agentId}`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to fetch agent ${agentId}:`, error);
      return null;
    }
  }

  async createAgent(agent: Omit<Agent, 'id'>): Promise<Agent | null> {
    try {
      const response = await this.client.post<ApiResponse<Agent>>('/agents', agent);
      return response.data.data || null;
    } catch (error) {
      console.error('Failed to create agent:', error);
      return null;
    }
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent | null> {
    try {
      const response = await this.client.put<ApiResponse<Agent>>(`/agents/${agentId}`, updates);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to update agent ${agentId}:`, error);
      return null;
    }
  }

  async deleteAgent(agentId: string): Promise<boolean> {
    try {
      await this.client.delete(`/agents/${agentId}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete agent ${agentId}:`, error);
      return false;
    }
  }

  async validateAgentApiKey(agentId: string, apiKey: string): Promise<boolean> {
    try {
      const response = await this.client.post<ApiResponse<{ valid: boolean }>>(
        `/agents/${agentId}/validate-key`, 
        { apiKey }
      );
      return response.data.data?.valid || false;
    } catch (error) {
      console.error(`Failed to validate API key for agent ${agentId}:`, error);
      return false;
    }
  }

  // System operations
  async getSystemStatus(): Promise<any> {
    try {
      const response = await this.client.get<ApiResponse<any>>('/system/status');
      return response.data.data || {};
    } catch (error) {
      console.error('Failed to get system status:', error);
      return {};
    }
  }

  async getExecutionLogs(workflowId: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await this.client.get<ApiResponse<any[]>>(
        `/workflows/${workflowId}/logs?limit=${limit}`
      );
      return response.data.data || [];
    } catch (error) {
      console.error(`Failed to get execution logs for ${workflowId}:`, error);
      return [];
    }
  }

  // Utility methods
  async ping(): Promise<number> {
    const startTime = Date.now();
    try {
      await this.client.get('/health');
      return Date.now() - startTime;
    } catch (error) {
      return -1;
    }
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  updateBaseUrl(newBaseUrl: string): void {
    this.client.defaults.baseURL = `${newBaseUrl}/api`;
  }

  // Micro prompts operations
  async getMicroPrompts(subtaskId: string): Promise<{ prompts: string[] } | null> {
    try {
      const response = await this.client.get<ApiResponse<{ prompts: string[] }>>(
        `/subtasks/${subtaskId}/micro-prompts`
      );
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to get micro prompts for subtask ${subtaskId}:`, error);
      return null;
    }
  }

  async generateMicroPrompts(subtaskId: string, workflowContext?: string): Promise<{ prompts: string[] } | null> {
    try {
      const response = await this.client.post<ApiResponse<{ prompts: string[] }>>(
        `/subtasks/${subtaskId}/generate-micro-prompts`,
        { workflowContext }
      );
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to generate micro prompts for subtask ${subtaskId}:`, error);
      return null;
    }
  }

  // File Management Methods
  async listWorkflows(): Promise<FileMetadata[]> {
    try {
      const response = await this.client.get<ApiResponse<FileMetadata[]>>('/files/workflows');
      return response.data.data || [];
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      return [];
    }
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const response = await this.client.get<ApiResponse<Workflow>>(`/files/workflows/${workflowId}`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to fetch workflow ${workflowId}:`, error);
      return null;
    }
  }

  async saveWorkflow(workflow: Workflow): Promise<boolean> {
    try {
      const response = await this.client.post<ApiResponse<any>>('/files/workflows', workflow);
      return response.data.success || false;
    } catch (error) {
      console.error('Failed to save workflow:', error);
      return false;
    }
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    try {
      const response = await this.client.delete<ApiResponse<any>>(`/files/workflows/${workflowId}`);
      return response.data.success || false;
    } catch (error) {
      console.error(`Failed to delete workflow ${workflowId}:`, error);
      return false;
    }
  }

  async backupWorkflow(workflowId: string): Promise<boolean> {
    try {
      const response = await this.client.post<ApiResponse<any>>(`/files/workflows/${workflowId}/backup`);
      return response.data.success || false;
    } catch (error) {
      console.error(`Failed to backup workflow ${workflowId}:`, error);
      return false;
    }
  }

  async cleanupBackups(maxAge?: number): Promise<number> {
    try {
      const params = maxAge ? `?maxAge=${maxAge}` : '';
      const response = await this.client.post<ApiResponse<{ deletedCount: number }>>(`/files/backups/cleanup${params}`);
      return response.data.data?.deletedCount || 0;
    } catch (error) {
      console.error('Failed to cleanup backups:', error);
      return 0;
    }
  }

  // Atomic Workflow Decomposition Methods
  async decomposeWorkflow(workflowId: string): Promise<AtomicWorkflowDecomposition | null> {
    try {
      const response = await this.client.post<ApiResponse<AtomicWorkflowDecomposition>>(`/files/workflows/${workflowId}/decompose`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to decompose workflow ${workflowId}:`, error);
      return null;
    }
  }

  async getAtomicDecomposition(workflowId: string): Promise<AtomicWorkflowDecomposition | null> {
    try {
      const response = await this.client.get<ApiResponse<AtomicWorkflowDecomposition>>(`/files/workflows/${workflowId}/decomposition`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to get atomic decomposition for workflow ${workflowId}:`, error);
      return null;
    }
  }

  async createAndDecomposeWorkflow(workflow: Workflow): Promise<{
    workflow: { id: string; filepath: string };
    decomposition: { workflowId: string; filepath: string; metadata: any };
  } | null> {
    try {
      const response = await this.client.post<ApiResponse<any>>('/files/workflows/create-and-decompose', workflow);
      return response.data.data || null;
    } catch (error) {
      console.error('Failed to create and decompose workflow:', error);
      return null;
    }
  }

  // File System Utilities
  async getFileStats(filepath: string): Promise<any> {
    try {
      const response = await this.client.get<ApiResponse<any>>(`/files/files/${encodeURIComponent(filepath)}/stats`);
      return response.data.data || null;
    } catch (error) {
      console.error(`Failed to get file stats for ${filepath}:`, error);
      return null;
    }
  }
}

// Export a singleton instance
export const api = new SupercolliderApi();

// Export hooks for React components
export const useApi = () => {
  return {
    api,
    isHealthy: async () => await api.healthCheck(),
    ping: async () => await api.ping(),
  };
};