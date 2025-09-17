import { Request, Response, NextFunction } from 'express';
import * as os from 'os';
import * as process from 'process';

interface RequestMetric {
  method: string;
  url: string;
  duration: number;
  statusCode: number;
  timestamp: Date;
  memoryUsage: NodeJS.MemoryUsage;
  userAgent?: string;
  projectId?: string;
}

interface PerformanceStats {
  totalRequests: number;
  avgResponseTime: number;
  slowestEndpoint: {
    url: string;
    avgTime: number;
  };
  memoryUsage: {
    heapUsed: string;
    heapTotal: string;
    external: string;
    rss: string;
  };
  systemStats: {
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
    loadAverage: number[];
    freeMemory: string;
    totalMemory: string;
  };
  apiCalls: {
    total: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class PerformanceService {
  private metrics: RequestMetric[] = [];
  private apiCallMetrics = {
    total: 0,
    successful: 0,
    failed: 0,
    totalTime: 0
  };
  private cacheMetrics = {
    hits: 0,
    misses: 0
  };
  private readonly MAX_METRICS = 1000;
  private startTime = Date.now();
  private cpuStartUsage = process.cpuUsage();

  // Middleware to track request performance
  requestTracker = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    // Store original end function
    const originalEnd = res.end.bind(res);
    
    // Override res.end to capture response time
    res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();

      // Create metric
      const metric: RequestMetric = {
        method: req.method,
        url: req.originalUrl || req.url,
        duration,
        statusCode: res.statusCode,
        timestamp: new Date(),
        memoryUsage: {
          rss: endMemory.rss - startMemory.rss,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external,
          arrayBuffers: (endMemory.arrayBuffers || 0) - (startMemory.arrayBuffers || 0)
        },
        userAgent: req.get('User-Agent'),
        projectId: req.body?.projectId || req.params?.projectId
      };

      // Add metric to collection
      performanceService.addMetric(metric);

      // Log slow requests
      if (duration > 5000) { // 5 seconds threshold
        console.warn(`🐌 Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
      }

      // Alert on very slow requests
      if (duration > 15000) { // 15 seconds threshold
        console.error(`🚨 VERY SLOW REQUEST: ${req.method} ${req.url} took ${duration}ms`);
      }

      // Call original end function with proper arguments
      if (typeof encoding === 'function') {
        return originalEnd(chunk, encoding);
      }
      if (encoding && cb) {
        return originalEnd(chunk, encoding as BufferEncoding, cb);
      }
      if (chunk !== undefined) {
        return originalEnd(chunk);
      }
      return originalEnd();
    };

    next();
  };

  // Add a request metric
  addMetric(metric: RequestMetric): void {
    this.metrics.push(metric);

    // Keep only latest metrics to prevent memory issues
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  // Track API calls (for external services like Google AI)
  trackApiCall(success: boolean, responseTime: number): void {
    this.apiCallMetrics.total++;
    this.apiCallMetrics.totalTime += responseTime;
    
    if (success) {
      this.apiCallMetrics.successful++;
    } else {
      this.apiCallMetrics.failed++;
    }
  }

  // Track cache performance
  trackCacheHit(): void {
    this.cacheMetrics.hits++;
  }

  trackCacheMiss(): void {
    this.cacheMetrics.misses++;
  }

  // Get comprehensive performance statistics
  getStats(): PerformanceStats {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.cpuStartUsage);

    // Calculate request statistics
    const totalRequests = this.metrics.length;
    const avgResponseTime = totalRequests > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0;

    // Find slowest endpoint
    const endpointTimes = this.metrics.reduce((acc, metric) => {
      const key = `${metric.method} ${metric.url}`;
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 };
      }
      acc[key].total += metric.duration;
      acc[key].count++;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const slowestEndpoint = Object.entries(endpointTimes)
      .map(([url, data]) => ({ url, avgTime: data.total / data.count }))
      .sort((a, b) => b.avgTime - a.avgTime)[0] || { url: 'N/A', avgTime: 0 };

    // Calculate cache hit rate
    const totalCacheRequests = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const hitRate = totalCacheRequests > 0 
      ? (this.cacheMetrics.hits / totalCacheRequests) * 100 
      : 0;

    return {
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime),
      slowestEndpoint: {
        url: slowestEndpoint.url,
        avgTime: Math.round(slowestEndpoint.avgTime)
      },
      memoryUsage: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
      },
      systemStats: {
        cpuUsage,
        uptime: Math.round((now - this.startTime) / 1000),
        loadAverage: os.loadavg(),
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`
      },
      apiCalls: {
        total: this.apiCallMetrics.total,
        successful: this.apiCallMetrics.successful,
        failed: this.apiCallMetrics.failed,
        avgResponseTime: this.apiCallMetrics.total > 0 
          ? Math.round(this.apiCallMetrics.totalTime / this.apiCallMetrics.total)
          : 0
      },
      cacheStats: {
        hits: this.cacheMetrics.hits,
        misses: this.cacheMetrics.misses,
        hitRate: Math.round(hitRate * 100) / 100
      }
    };
  }

  // Get recent slow requests
  getSlowRequests(threshold: number = 3000, limit: number = 10): RequestMetric[] {
    return this.metrics
      .filter(metric => metric.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  // Get endpoint performance breakdown
  getEndpointStats(): Array<{
    endpoint: string;
    count: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    totalTime: number;
  }> {
    const endpointData = this.metrics.reduce((acc, metric) => {
      const key = `${metric.method} ${metric.url.split('?')[0]}`; // Remove query params
      
      if (!acc[key]) {
        acc[key] = {
          times: [],
          totalTime: 0
        };
      }
      
      acc[key].times.push(metric.duration);
      acc[key].totalTime += metric.duration;
      
      return acc;
    }, {} as Record<string, { times: number[]; totalTime: number }>);

    return Object.entries(endpointData)
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.times.length,
        avgTime: Math.round(data.totalTime / data.times.length),
        minTime: Math.min(...data.times),
        maxTime: Math.max(...data.times),
        totalTime: data.totalTime
      }))
      .sort((a, b) => b.avgTime - a.avgTime);
  }

  // Health check method
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    uptime: number;
    memoryPressure: number;
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check memory usage
    const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryPressure = heapUsedMB / (process.memoryUsage().heapTotal / 1024 / 1024);
    
    if (memoryPressure > 0.9) {
      issues.push('High memory pressure (>90%)');
      status = 'critical';
    } else if (memoryPressure > 0.75) {
      issues.push('Medium memory pressure (>75%)');
      status = 'warning';
    }

    // Check average response time
    if (stats.avgResponseTime > 10000) {
      issues.push('Very slow average response time (>10s)');
      status = 'critical';
    } else if (stats.avgResponseTime > 5000 && status !== 'critical') {
      issues.push('Slow average response time (>5s)');
      status = 'warning';
    }

    // Check API call failure rate
    const failureRate = stats.apiCalls.total > 0 
      ? (stats.apiCalls.failed / stats.apiCalls.total) * 100 
      : 0;
      
    if (failureRate > 20) {
      issues.push(`High API failure rate (${failureRate.toFixed(1)}%)`);
      status = 'critical';
    } else if (failureRate > 10 && status !== 'critical') {
      issues.push(`Medium API failure rate (${failureRate.toFixed(1)}%)`);
      status = 'warning';
    }

    // Check cache hit rate
    if (stats.cacheStats.hitRate < 30 && status !== 'critical') {
      issues.push(`Low cache hit rate (${stats.cacheStats.hitRate}%)`);
      status = 'warning';
    }

    return {
      status,
      issues,
      uptime: stats.systemStats.uptime,
      memoryPressure: Math.round(memoryPressure * 100)
    };
  }

  // Reset metrics (useful for testing or periodic cleanup)
  reset(): void {
    this.metrics = [];
    this.apiCallMetrics = {
      total: 0,
      successful: 0,
      failed: 0,
      totalTime: 0
    };
    this.cacheMetrics = {
      hits: 0,
      misses: 0
    };
    this.startTime = Date.now();
    this.cpuStartUsage = process.cpuUsage();
    console.log('📊 Performance metrics reset');
  }

  // Start periodic logging
  startPeriodicLogging(intervalMinutes: number = 5): NodeJS.Timeout {
    return setInterval(() => {
      const stats = this.getStats();
      const health = this.getHealthStatus();
      
      console.log(`\n📊 Performance Report (${new Date().toISOString()})`);
      console.log(`Status: ${health.status.toUpperCase()} ${health.issues.length > 0 ? '⚠️' : '✅'}`);
      console.log(`Requests: ${stats.totalRequests} (avg: ${stats.avgResponseTime}ms)`);
      console.log(`Memory: ${stats.memoryUsage.heapUsed}/${stats.memoryUsage.heapTotal}`);
      console.log(`API Calls: ${stats.apiCalls.successful}/${stats.apiCalls.total} (${stats.apiCalls.failed} failed)`);
      console.log(`Cache: ${stats.cacheStats.hitRate}% hit rate`);
      
      if (health.issues.length > 0) {
        console.log(`Issues: ${health.issues.join(', ')}`);
      }
      
      // Log slow endpoints
      const slowEndpoints = this.getEndpointStats().slice(0, 3);
      if (slowEndpoints.length > 0) {
        console.log(`Slowest endpoints:`);
        slowEndpoints.forEach(ep => {
          console.log(`  ${ep.endpoint}: ${ep.avgTime}ms avg (${ep.count} calls)`);
        });
      }
    }, intervalMinutes * 60 * 1000);
  }
}

// Singleton instance
export const performanceService = new PerformanceService();

// Helper to wrap AI API calls with performance tracking
export const trackAICall = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'AI API Call'
): Promise<T> => {
  const startTime = Date.now();
  
  try {
    console.log(`🤖 Starting ${operationName}...`);
    const result = await operation();
    const duration = Date.now() - startTime;
    
    performanceService.trackApiCall(true, duration);
    console.log(`✅ ${operationName} completed in ${duration}ms`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    performanceService.trackApiCall(false, duration);
    console.error(`❌ ${operationName} failed after ${duration}ms:`, error);
    
    throw error;
  }
};
