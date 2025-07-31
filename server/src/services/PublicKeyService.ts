import fs from 'fs';
import path from 'path';

export interface PublicKey {
  service: string;
  key: string;
  can_generate_text: boolean;
  can_generate_image: boolean;
  can_read_image: boolean;
  can_generate_audio: boolean;
  can_generate_video: boolean;
  filetypes_supported: string[];
  task_tags: string[];
  rate_limit: string;
  notes: string;
}

export class PublicKeyService {
  private publicKeys: PublicKey[] = [];
  private readonly configPath = path.join(__dirname, '../../config/publicKeys.json');

  constructor() {
    this.loadPublicKeys();
  }

  private loadPublicKeys(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.publicKeys = JSON.parse(data);
        console.log(`✅ Loaded ${this.publicKeys.length} public API keys`);
      } else {
        console.warn('⚠️ Public keys config not found, using empty list');
        this.publicKeys = [];
      }
    } catch (error) {
      console.error('❌ Failed to load public keys:', error);
      this.publicKeys = [];
    }
  }

  /**
   * Get all available public keys
   */
  getAllPublicKeys(): PublicKey[] {
    return [...this.publicKeys];
  }

  /**
   * Get public keys that can perform a specific capability
   */
  getKeysByCapability(capability: keyof Pick<PublicKey, 'can_generate_text' | 'can_generate_image' | 'can_read_image' | 'can_generate_audio' | 'can_generate_video'>): PublicKey[] {
    return this.publicKeys.filter(key => key[capability]);
  }

  /**
   * Get public keys that support specific file types
   */
  getKeysByFileType(fileType: string): PublicKey[] {
    return this.publicKeys.filter(key => 
      key.filetypes_supported.includes(fileType.toLowerCase())
    );
  }

  /**
   * Get public keys that match specific task tags
   */
  getKeysByTaskTag(tag: string): PublicKey[] {
    return this.publicKeys.filter(key => 
      key.task_tags.some(taskTag => taskTag.includes(tag))
    );
  }

  /**
   * Get a specific public key by service name
   */
  getKeyByService(service: string): PublicKey | undefined {
    return this.publicKeys.find(key => 
      key.service.toLowerCase() === service.toLowerCase()
    );
  }

  /**
   * Get public keys suitable for a specific task type
   */
  getKeysForTask(taskType: string): PublicKey[] {
    const taskTypeLower = taskType.toLowerCase();
    
    return this.publicKeys.filter(key => {
      // Check if any task tags match the task type
      const tagMatch = key.task_tags.some(tag => 
        tag.toLowerCase().includes(taskTypeLower)
      );
      
      // Check capabilities based on task type
      const capabilityMatch = 
        (taskTypeLower.includes('text') && key.can_generate_text) ||
        (taskTypeLower.includes('image') && (key.can_generate_image || key.can_read_image)) ||
        (taskTypeLower.includes('audio') && key.can_generate_audio) ||
        (taskTypeLower.includes('video') && key.can_generate_video) ||
        (taskTypeLower.includes('data') && !key.can_generate_text && !key.can_generate_image);
      
      return tagMatch || capabilityMatch;
    });
  }

  /**
   * Get public keys with unlimited rate limits
   */
  getUnlimitedKeys(): PublicKey[] {
    return this.publicKeys.filter(key => 
      key.rate_limit.toLowerCase().includes('unlimited')
    );
  }

  /**
   * Get public keys that require no authentication
   */
  getNoAuthKeys(): PublicKey[] {
    return this.publicKeys.filter(key => 
      key.key === 'public'
    );
  }

  /**
   * Get public keys that are demo/trial keys
   */
  getDemoKeys(): PublicKey[] {
    return this.publicKeys.filter(key => 
      key.key.includes('demo') || key.key.includes('DEMO') || key.notes.toLowerCase().includes('demo')
    );
  }

  /**
   * Get summary of available public keys
   */
  getSummary(): {
    total: number;
    text_generation: number;
    image_generation: number;
    image_reading: number;
    audio_generation: number;
    video_generation: number;
    unlimited_rate: number;
    no_auth: number;
    demo_keys: number;
  } {
    return {
      total: this.publicKeys.length,
      text_generation: this.getKeysByCapability('can_generate_text').length,
      image_generation: this.getKeysByCapability('can_generate_image').length,
      image_reading: this.getKeysByCapability('can_read_image').length,
      audio_generation: this.getKeysByCapability('can_generate_audio').length,
      video_generation: this.getKeysByCapability('can_generate_video').length,
      unlimited_rate: this.getUnlimitedKeys().length,
      no_auth: this.getNoAuthKeys().length,
      demo_keys: this.getDemoKeys().length
    };
  }

  /**
   * Reload public keys from config file
   */
  reload(): void {
    this.loadPublicKeys();
  }
}

export const publicKeyService = new PublicKeyService(); 