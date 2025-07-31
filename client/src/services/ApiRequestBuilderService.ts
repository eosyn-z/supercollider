interface ApiEntry {
  name: string;
  service: string;
  description: string;
  requires_key: boolean;
  task_tags: string[];
  documentation?: {
    base_url?: string;
    endpoints?: Array<{
      path: string;
      method: string;
      description: string;
      parameters?: Record<string, any>;
    }>;
  };
}

interface RequestConfig {
  method: string;
  url: string;
  headers: Record<string, string>;
  params?: Record<string, any>;
  body?: any;
  description: string;
}

import { AgentExecutorService } from './AgentExecutorService';

export class ApiRequestBuilderService {
  private agentExecutor: AgentExecutorService;

  constructor() {
    this.agentExecutor = new AgentExecutorService();
  }
  
  /**
   * Generate request configuration using the APIREQUESTBUILDER prompt
   */
  async generateRequestConfig(
    selectedApi: ApiEntry,
    userInput: string,
    apiKey: string
  ): Promise<RequestConfig> {
    try {
      // Prepare context for the APIREQUESTBUILDER prompt
      const apiContext = this.buildApiContext(selectedApi, userInput);
      
      // Execute the APIREQUESTBUILDER agent
      const result = await this.agentExecutor.executeApiRequestBuilder(
        apiContext,
        selectedApi.name,
        userInput,
        !!apiKey
      );

      if (!result.success) {
        throw new Error(result.error || 'Agent execution failed');
      }
      
      // Parse the structured response from APIREQUESTBUILDER
      const requestConfig = this.parseRequestConfig(result.output, selectedApi, apiKey);
      
      return requestConfig;
    } catch (error) {
      console.error('Failed to generate request config:', error);
      throw new Error(`Configuration generation failed: ${error}`);
    }
  }

  /**
   * Execute the HTTP request with dynamic placeholder replacement
   */
  async executeRequest(config: RequestConfig, apiKey: string): Promise<any> {
    try {
      // Replace dynamic placeholders
      const processedConfig = this.replacePlaceholders(config, apiKey);
      
      const requestOptions: RequestInit = {
        method: processedConfig.method,
        headers: processedConfig.headers
      };

      // Add query parameters to URL if present
      let url = processedConfig.url;
      if (processedConfig.params) {
        const searchParams = new URLSearchParams(processedConfig.params);
        url += (url.includes('?') ? '&' : '?') + searchParams.toString();
      }

      // Add body for POST/PUT requests
      if (processedConfig.body && ['POST', 'PUT', 'PATCH'].includes(processedConfig.method)) {
        requestOptions.body = JSON.stringify(processedConfig.body);
      }

      const response = await fetch(url, requestOptions);
      
      const responseData = await this.parseResponse(response);
      
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        timestamp: new Date().toISOString(),
        request: {
          method: processedConfig.method,
          url: url,
          headers: processedConfig.headers
        }
      };
    } catch (error) {
      console.error('Request execution failed:', error);
      throw new Error(`Request failed: ${error}`);
    }
  }

  /**
   * Build context string for the APIREQUESTBUILDER prompt
   */
  private buildApiContext(api: ApiEntry, userInput: string): string {
    const context = [];
    
    context.push(`API: ${api.name}`);
    context.push(`Description: ${api.description}`);
    context.push(`Capabilities: ${api.task_tags.join(', ')}`);
    
    if (api.documentation?.base_url) {
      context.push(`Base URL: ${api.documentation.base_url}`);
    }
    
    if (api.documentation?.endpoints) {
      context.push('Available endpoints:');
      api.documentation.endpoints.forEach(endpoint => {
        context.push(`  ${endpoint.method} ${endpoint.path} - ${endpoint.description}`);
        if (endpoint.parameters) {
          context.push(`    Parameters: ${JSON.stringify(endpoint.parameters, null, 2)}`);
        }
      });
    }
    
    context.push('');
    context.push(`User Request: ${userInput}`);
    
    return context.join('\n');
  }

  /**
   * Parse the structured response from APIREQUESTBUILDER prompt
   */
  private parseRequestConfig(
    promptOutput: string,
    selectedApi: ApiEntry,
    apiKey: string
  ): RequestConfig {
    try {
      // Try to extract JSON from the prompt output
      const jsonMatch = promptOutput.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON configuration found in prompt output');
      }
      
      const configJson = JSON.parse(jsonMatch[0]);
      
      // Validate and normalize the configuration
      const config: RequestConfig = {
        method: configJson.method?.toUpperCase() || 'GET',
        url: configJson.url || configJson.endpoint || '',
        headers: {
          'Content-Type': 'application/json',
          ...configJson.headers
        },
        params: configJson.params || configJson.query_params,
        body: configJson.body || configJson.data,
        description: configJson.description || `Request to ${selectedApi.name}`
      };

      // Add API key to headers if required
      if (selectedApi.requires_key && apiKey) {
        if (configJson.auth_header) {
          config.headers[configJson.auth_header] = `Bearer {API_KEY}`;
        } else {
          config.headers['Authorization'] = `Bearer {API_KEY}`;
        }
      }

      return config;
    } catch (error) {
      console.error('Failed to parse request config:', error);
      throw new Error(`Invalid configuration format: ${error}`);
    }
  }

  /**
   * Replace dynamic placeholders in the request configuration
   */
  private replacePlaceholders(config: RequestConfig, apiKey: string): RequestConfig {
    const processedConfig = JSON.parse(JSON.stringify(config));
    
    // Replace {API_KEY} placeholder
    if (apiKey) {
      processedConfig.url = processedConfig.url.replace(/\{API_KEY\}/g, apiKey);
      
      Object.keys(processedConfig.headers).forEach(key => {
        processedConfig.headers[key] = processedConfig.headers[key].replace(/\{API_KEY\}/g, apiKey);
      });
      
      if (processedConfig.params) {
        Object.keys(processedConfig.params).forEach(key => {
          if (typeof processedConfig.params[key] === 'string') {
            processedConfig.params[key] = processedConfig.params[key].replace(/\{API_KEY\}/g, apiKey);
          }
        });
      }
    }

    // Replace other common placeholders
    const timestamp = new Date().toISOString();
    const replacements = {
      '{TIMESTAMP}': timestamp,
      '{DATE}': timestamp.split('T')[0],
      '{USER_AGENT}': 'Supercollider-API-Client/1.0'
    };

    Object.entries(replacements).forEach(([placeholder, value]) => {
      processedConfig.url = processedConfig.url.replace(new RegExp(placeholder, 'g'), value);
      
      Object.keys(processedConfig.headers).forEach(key => {
        processedConfig.headers[key] = processedConfig.headers[key].replace(new RegExp(placeholder, 'g'), value);
      });
    });

    return processedConfig;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return await response.text();
    } else if (contentType.includes('image/')) {
      const blob = await response.blob();
      return {
        type: 'image',
        size: blob.size,
        contentType: blob.type,
        dataUrl: await this.blobToDataUrl(blob)
      };
    } else {
      // Default to text for unknown types
      return await response.text();
    }
  }

  /**
   * Convert blob to data URL for display
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}