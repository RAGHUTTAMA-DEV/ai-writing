import NodeCache from 'node-cache';
import * as crypto from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  checkperiod?: number; // How often to check for expired keys (seconds)
}

interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  memoryUsage: string;
}

export class CacheService {
  private cache: NodeCache;
  private hits: number = 0;
  private misses: number = 0;

  constructor(options: CacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: options.ttl || 600, // Default 10 minutes
      checkperiod: options.checkperiod || 60, // Check every minute
      useClones: false // Better performance, but be careful with mutable objects
    });

    // Log cache events
    this.cache.on('expired', (key: string) => {
      console.log(`🔄 Cache key expired: ${key}`);
    });

    this.cache.on('del', (key: string) => {
      console.log(`🗑️ Cache key deleted: ${key}`);
    });
  }

  // Generate cache key from various inputs
  generateKey(...args: any[]): string {
    const serialized = JSON.stringify(args);
    return crypto.createHash('md5').update(serialized).digest('hex');
  }

  // Set value with optional TTL override
  set(key: string, value: any, ttl?: number): boolean {
    console.log(`💾 Caching key: ${key}`);
    if (ttl !== undefined) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  // Get value from cache
  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    
    if (value !== undefined) {
      this.hits++;
      // Track cache hit for performance monitoring
      try {
        const { performanceService } = require('./performanceService');
        performanceService.trackCacheHit();
      } catch (e) { /* Ignore if performance service not available */ }
      console.log(`🎯 Cache hit: ${key}`);
      return value;
    } else {
      this.misses++;
      // Track cache miss for performance monitoring
      try {
        const { performanceService } = require('./performanceService');
        performanceService.trackCacheMiss();
      } catch (e) { /* Ignore if performance service not available */ }
      console.log(`❌ Cache miss: ${key}`);
      return undefined;
    }
  }

  // Get or set pattern - execute function if not in cache
  async getOrSet<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cachedValue = this.get<T>(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }

    console.log(`🔄 Executing function for cache key: ${key}`);
    const value = await fetchFunction();
    this.set(key, value, ttl);
    return value;
  }

  // Delete specific key
  delete(key: string): number {
    return this.cache.del(key);
  }

  // Delete keys matching pattern
  deletePattern(pattern: string): number {
    const keys = this.cache.keys();
    const matchingKeys = keys.filter(key => key.includes(pattern));
    return this.cache.del(matchingKeys);
  }

  // Clear all cache
  clear(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    console.log('🧹 Cache cleared');
  }
  
  // Alias for clear() to match NodeCache interface
  flushAll(): void {
    this.clear();
  }

  // Get cache statistics
  getStats(): CacheStats {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: this.hits,
      misses: this.misses,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    };
  }

  // Check if key exists
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // Get all keys (for debugging)
  keys(): string[] {
    return this.cache.keys();
  }

  // Get TTL for a key
  getTtl(key: string): number {
    return this.cache.getTtl(key) || 0;
  }

  // Update TTL for existing key
  touch(key: string, ttl?: number): boolean {
    // NodeCache doesn't have touch method, so we'll get and set again
    const value = this.cache.get(key);
    if (value !== undefined) {
      return this.set(key, value, ttl);
    }
    return false;
  }

  // Periodic cleanup and optimization
  optimize(): void {
    const stats = this.getStats();
    console.log(`🔧 Cache optimization - Keys: ${stats.keys}, Hits: ${stats.hits}, Misses: ${stats.misses}, Memory: ${stats.memoryUsage}`);
    
    // If cache is getting too full, clear old entries
    if (stats.keys > 1000) {
      console.log('🧹 Cache size limit reached, clearing some entries');
      // NodeCache automatically handles expired entries, but we can force cleanup
      const keys = this.cache.keys();
      // Remove 10% of oldest entries
      const keysToRemove = keys.slice(0, Math.floor(keys.length * 0.1));
      this.cache.del(keysToRemove);
    }

    // Reset hit/miss counters if they get too large
    if (this.hits > 10000 || this.misses > 10000) {
      this.hits = 0;
      this.misses = 0;
    }
  }
}

// Singleton instance for the entire application
export const cacheService = new CacheService({
  ttl: 600, // 10 minutes default
  checkperiod: 60 // Check for expired keys every minute
});

// Specialized cache instances for different data types
export const aiResponseCache = new CacheService({
  ttl: 1800, // 30 minutes for AI responses
  checkperiod: 120
});

export const projectCache = new CacheService({
  ttl: 3600, // 1 hour for project data
  checkperiod: 300
});

export const searchCache = new CacheService({
  ttl: 300, // 5 minutes for search results
  checkperiod: 60
});

// Cache key generators for common operations
export const CacheKeys = {
  aiResponse: (prompt: string, model: string) => 
    `ai:response:${crypto.createHash('md5').update(`${prompt}:${model}`).digest('hex')}`,
  
  projectContext: (projectId: string) => 
    `project:context:${projectId}`,
  
  projectStats: (projectId: string) => 
    `project:stats:${projectId}`,
  
  searchResults: (query: string, projectId?: string, filters?: any) =>
    `search:${crypto.createHash('md5').update(`${query}:${projectId || ''}:${JSON.stringify(filters || {})}`).digest('hex')}`,
  
  userSession: (userId: string, sessionType: string) =>
    `user:${userId}:${sessionType}`,
  
  ragAnalysis: (contentHash: string, projectId?: string) =>
    `rag:analysis:${contentHash}:${projectId || 'none'}`
};

// Performance monitoring
setInterval(() => {
  cacheService.optimize();
  console.log('📊 Cache performance:', {
    main: cacheService.getStats(),
    ai: aiResponseCache.getStats(),
    project: projectCache.getStats(),
    search: searchCache.getStats()
  });
}, 5 * 60 * 1000); // Every 5 minutes
