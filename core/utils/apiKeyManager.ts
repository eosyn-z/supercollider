/**
 * Secure API key management with validation and encryption
 */

import { Agent } from '../types/agentRegistry';

export interface EncryptedApiKey {
  encrypted: string;
  iv: string;
  keyId: string;
  provider: string;
  createdAt: Date;
  lastValidated?: Date;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  provider: string;
  error?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

export interface AgentEndpointConfig {
  baseUrl: string;
  completionsPath: string;
  headers: Record<string, string>;
  authHeader: string;
  requestFormat: 'openai' | 'anthropic' | 'google' | 'custom';
}

export class SecureApiKeyManager {
  private keyStore: Map<string, EncryptedApiKey> = new Map();
  private encryptionKey: string;
  private endpointConfigs: Map<string, AgentEndpointConfig> = new Map();

  constructor(encryptionKey?: string) {
    // In production, this should come from secure environment variables
    this.encryptionKey = encryptionKey || process.env.SUPERCOLLIDER_ENCRYPTION_KEY || this.generateEncryptionKey();
    this.initializeEndpointConfigs();
  }

  /**
   * Initialize endpoint configurations for different AI providers
   */
  private initializeEndpointConfigs(): void {
    this.endpointConfigs.set('openai', {
      baseUrl: 'https://api.openai.com/v1',
      completionsPath: '/chat/completions',
      headers: { 'Content-Type': 'application/json' },
      authHeader: 'Authorization',
      requestFormat: 'openai'
    });

    this.endpointConfigs.set('anthropic', {
      baseUrl: 'https://api.anthropic.com/v1',
      completionsPath: '/messages',
      headers: { 
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      authHeader: 'x-api-key',
      requestFormat: 'anthropic'
    });

    this.endpointConfigs.set('google', {
      baseUrl: 'https://generativelanguage.googleapis.com/v1',
      completionsPath: '/models/gemini-pro:generateContent',
      headers: { 'Content-Type': 'application/json' },
      authHeader: 'Authorization',
      requestFormat: 'google'
    });

    this.endpointConfigs.set('cohere', {
      baseUrl: 'https://api.cohere.ai/v1',
      completionsPath: '/generate',
      headers: { 'Content-Type': 'application/json' },
      authHeader: 'Authorization',
      requestFormat: 'custom'
    });
  }

  /**
   * Validates and stores an API key for an agent
   */
  async validateAndStoreKey(agent: Agent, apiKey: string): Promise<ApiKeyValidationResult> {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error(`Agent ${agent.id} requires a valid API key`);
    }

    // Detect provider from API key format
    const provider = this.detectProvider(apiKey);
    
    // Validate key format
    if (!this.isValidKeyFormat(apiKey, provider)) {
      throw new Error(`Invalid API key format for provider: ${provider}`);
    }

    // Test API key by making a test call
    const validationResult = await this.testApiKey(apiKey, provider);
    
    if (!validationResult.isValid) {
      throw new Error(`API key validation failed: ${validationResult.error}`);
    }

    // Encrypt and store the key
    const encrypted = await this.encryptApiKey(apiKey);
    this.keyStore.set(agent.id, {
      ...encrypted,
      provider,
      createdAt: new Date(),
      lastValidated: new Date()
    });

    return validationResult;
  }

  /**
   * Retrieves and decrypts an API key for an agent
   */
  async getApiKey(agentId: string): Promise<string> {
    const encryptedKey = this.keyStore.get(agentId);
    if (!encryptedKey) {
      throw new Error(`No API key found for agent ${agentId}`);
    }

    return await this.decryptApiKey(encryptedKey);
  }

  /**
   * Gets endpoint configuration for an agent
   */
  getEndpointConfig(agent: Agent): AgentEndpointConfig {
    const encryptedKey = this.keyStore.get(agent.id);
    if (!encryptedKey) {
      throw new Error(`No API key found for agent ${agent.id}`);
    }

    const config = this.endpointConfigs.get(encryptedKey.provider);
    if (!config) {
      throw new Error(`No endpoint configuration for provider: ${encryptedKey.provider}`);
    }

    return config;
  }

  /**
   * Detects AI provider from API key format
   */
  private detectProvider(apiKey: string): string {
    if (apiKey.startsWith('sk-')) {
      return 'openai';
    } else if (apiKey.startsWith('sk-ant-')) {
      return 'anthropic';
    } else if (apiKey.includes('google') || apiKey.startsWith('AIza')) {
      return 'google';
    } else if (apiKey.length === 40 && /^[a-zA-Z0-9]+$/.test(apiKey)) {
      return 'cohere';
    } else {
      return 'custom';
    }
  }

  /**
   * Validates API key format for specific provider
   */
  private isValidKeyFormat(apiKey: string, provider: string): boolean {
    switch (provider) {
      case 'openai':
        return /^sk-[a-zA-Z0-9]{32,}$/.test(apiKey);
      case 'anthropic':
        return /^sk-ant-api03-[a-zA-Z0-9\-_]{95}$/.test(apiKey);
      case 'google':
        return /^AIza[a-zA-Z0-9\-_]{35}$/.test(apiKey) || apiKey.includes('google');
      case 'cohere':
        return /^[a-zA-Z0-9]{40}$/.test(apiKey);
      default:
        return apiKey.length > 10; // Basic validation for custom providers
    }
  }

  /**
   * Tests an API key by making a minimal API call
   */
  private async testApiKey(apiKey: string, provider: string): Promise<ApiKeyValidationResult> {
    const config = this.endpointConfigs.get(provider);
    if (!config) {
      return {
        isValid: false,
        provider,
        error: `No configuration found for provider: ${provider}`
      };
    }

    try {
      const testPayload = this.buildTestPayload(provider);
      const headers = {
        ...config.headers,
        [config.authHeader]: provider === 'openai' ? `Bearer ${apiKey}` : apiKey
      };

      const response = await fetch(`${config.baseUrl}${config.completionsPath}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload)
      });

      const result: ApiKeyValidationResult = {
        isValid: response.ok,
        provider
      };

      // Extract rate limit information if available
      if (response.headers.has('x-ratelimit-limit-requests')) {
        result.rateLimit = {
          limit: parseInt(response.headers.get('x-ratelimit-limit-requests') || '0'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining-requests') || '0'),
          resetTime: new Date(response.headers.get('x-ratelimit-reset-requests') || Date.now())
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        result.error = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      }

      return result;

    } catch (error) {
      return {
        isValid: false,
        provider,
        error: `Network error: ${error.message}`
      };
    }
  }

  /**
   * Builds test payload for different providers
   */
  private buildTestPayload(provider: string): any {
    switch (provider) {
      case 'openai':
        return {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        };
      case 'anthropic':
        return {
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1
        };
      case 'google':
        return {
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 1 }
        };
      case 'cohere':
        return {
          prompt: 'test',
          max_tokens: 1
        };
      default:
        return { prompt: 'test', max_tokens: 1 };
    }
  }

  /**
   * Encrypts an API key using AES-256-GCM
   */
  private async encryptApiKey(apiKey: string): Promise<Omit<EncryptedApiKey, 'provider' | 'createdAt' | 'lastValidated'>> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyId = this.generateKeyId();
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encoder.encode(apiKey)
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      keyId
    };
  }

  /**
   * Decrypts an API key
   */
  private async decryptApiKey(encryptedKey: EncryptedApiKey): Promise<string> {
    const iv = this.base64ToArrayBuffer(encryptedKey.iv);
    const encrypted = this.base64ToArrayBuffer(encryptedKey.encrypted);
    
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.encryptionKey),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Removes an API key for an agent
   */
  removeApiKey(agentId: string): boolean {
    return this.keyStore.delete(agentId);
  }

  /**
   * Lists all agents with stored API keys
   */
  listStoredAgents(): Array<{ agentId: string; provider: string; createdAt: Date; lastValidated?: Date }> {
    return Array.from(this.keyStore.entries()).map(([agentId, keyData]) => ({
      agentId,
      provider: keyData.provider,
      createdAt: keyData.createdAt,
      lastValidated: keyData.lastValidated
    }));
  }

  /**
   * Validates all stored API keys
   */
  async validateAllKeys(): Promise<Map<string, ApiKeyValidationResult>> {
    const results = new Map<string, ApiKeyValidationResult>();
    
    for (const [agentId, keyData] of this.keyStore.entries()) {
      try {
        const apiKey = await this.decryptApiKey(keyData);
        const result = await this.testApiKey(apiKey, keyData.provider);
        results.set(agentId, result);
        
        if (result.isValid) {
          keyData.lastValidated = new Date();
        }
      } catch (error) {
        results.set(agentId, {
          isValid: false,
          provider: keyData.provider,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Utility methods
  private generateEncryptionKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }

  private generateKeyId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}