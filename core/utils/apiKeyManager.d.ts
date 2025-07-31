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
export declare class SecureApiKeyManager {
    private keyStore;
    private encryptionKey;
    private endpointConfigs;
    constructor(encryptionKey?: string);
    private initializeEndpointConfigs;
    validateAndStoreKey(agent: Agent, apiKey: string): Promise<ApiKeyValidationResult>;
    getApiKey(agentId: string): Promise<string>;
    getEndpointConfig(agent: Agent): AgentEndpointConfig;
    private detectProvider;
    private isValidKeyFormat;
    private testApiKey;
    private buildTestPayload;
    private encryptApiKey;
    private decryptApiKey;
    removeApiKey(agentId: string): boolean;
    listStoredAgents(): Array<{
        agentId: string;
        provider: string;
        createdAt: Date;
        lastValidated?: Date;
    }>;
    validateAllKeys(): Promise<Map<string, ApiKeyValidationResult>>;
    private generateEncryptionKey;
    private generateKeyId;
    private arrayBufferToBase64;
    private base64ToArrayBuffer;
}
//# sourceMappingURL=apiKeyManager.d.ts.map