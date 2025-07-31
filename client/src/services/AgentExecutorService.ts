interface AgentExecutionRequest {
  agentType: string;
  inputs: Record<string, any>;
  options?: {
    timeout?: number;
    retries?: number;
    priority?: 'high' | 'medium' | 'low';
  };
}

interface AgentExecutionResponse {
  success: boolean;
  output: string;
  metadata?: {
    executionTime: number;
    agentId: string;
    tokens?: {
      input: number;
      output: number;
    };
  };
  error?: string;
}

export class AgentExecutorService {
  private readonly agentEndpoint = '/api/agents/execute';
  private executionHistory: Map<string, AgentExecutionResponse> = new Map();

  /**
   * Execute a specific agent with inputs
   */
  async executeAgent(request: AgentExecutionRequest): Promise<AgentExecutionResponse> {
    try {
      const startTime = Date.now();
      
      const response = await fetch(this.agentEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agent: request.agentType,
          inputs: request.inputs,
          options: request.options || {}
        })
      });

      if (!response.ok) {
        throw new Error(`Agent execution failed: ${response.statusText}`);
      }

      const result = await response.json();
      const executionTime = Date.now() - startTime;

      const executionResponse: AgentExecutionResponse = {
        success: true,
        output: result.output || result.response || '',
        metadata: {
          executionTime,
          agentId: result.agentId || request.agentType,
          tokens: result.tokens
        }
      };

      // Store in execution history
      const executionId = `${request.agentType}-${Date.now()}`;
      this.executionHistory.set(executionId, executionResponse);

      return executionResponse;
    } catch (error) {
      console.error('Agent execution error:', error);
      
      return {
        success: false,
        output: '',
        error: error.toString(),
        metadata: {
          executionTime: 0,
          agentId: request.agentType
        }
      };
    }
  }

  /**
   * Execute the APIREQUESTBUILDER agent specifically
   */
  async executeApiRequestBuilder(
    apiContext: string,
    selectedApi: string,
    userRequest: string,
    hasApiKey: boolean
  ): Promise<AgentExecutionResponse> {
    return this.executeAgent({
      agentType: 'APIREQUESTBUILDER',
      inputs: {
        user_input_here: apiContext,
        selected_api: selectedApi,
        api_key_available: hasApiKey,
        user_request: userRequest
      },
      options: {
        timeout: 30000, // 30 second timeout
        priority: 'high'
      }
    });
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): Array<{ id: string; execution: AgentExecutionResponse }> {
    return Array.from(this.executionHistory.entries()).map(([id, execution]) => ({ id, execution }));
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    this.executionHistory.clear();
  }
}