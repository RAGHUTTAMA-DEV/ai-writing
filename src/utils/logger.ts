import fs from 'fs';
import path from 'path';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  metadata?: any;
  error?: Error;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogDirectory();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    switch (level) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, metadata?: any, error?: Error): void {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as any : undefined
    };

    // Console output with colors
    const colors = {
      ERROR: '\x1b[31m',
      WARN: '\x1b[33m',
      INFO: '\x1b[36m',
      DEBUG: '\x1b[37m',
      RESET: '\x1b[0m'
    };

    const colorCode = colors[levelName as keyof typeof colors] || colors.INFO;
    const logMessage = `${colorCode}[${entry.timestamp}] ${levelName}: ${message}${colors.RESET}`;
    
    console.log(logMessage);
    if (metadata) console.log('Metadata:', metadata);
    if (error) console.error('Error Details:', error);

    // Write to file
    this.writeToFile(entry);
  }

  error(message: string, error?: Error, metadata?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, metadata, error);
  }

  warn(message: string, metadata?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, metadata);
  }

  info(message: string, metadata?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, metadata);
  }

  debug(message: string, metadata?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, metadata);
  }

  // Request logging helper
  logRequest(method: string, url: string, userId?: string, duration?: number, statusCode?: number): void {
    this.info('HTTP Request', {
      method,
      url,
      userId,
      duration: duration ? `${duration}ms` : undefined,
      statusCode
    });
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration?: number, error?: Error): void {
    if (error) {
      this.error(`Database ${operation} failed on ${table}`, error, { operation, table, duration });
    } else {
      this.debug(`Database ${operation} on ${table}`, { operation, table, duration: duration ? `${duration}ms` : undefined });
    }
  }

  // AI service logging
  logAIOperation(operation: string, projectId?: string, userId?: string, duration?: number, error?: Error, metadata?: any): void {
    const logData = {
      operation,
      projectId,
      userId,
      duration: duration ? `${duration}ms` : undefined,
      ...metadata
    };

    if (error) {
      this.error(`AI ${operation} failed`, error, logData);
    } else {
      this.info(`AI ${operation} completed`, logData);
    }
  }

  // User action logging
  logUserAction(action: string, userId: string, metadata?: any): void {
    this.info(`User action: ${action}`, { userId, ...metadata });
  }

  // Security logging
  logSecurityEvent(event: string, userId?: string, ip?: string, metadata?: any): void {
    this.warn(`Security event: ${event}`, { userId, ip, ...metadata });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any): void {
    const level = duration > 5000 ? 'WARN' : 'DEBUG';
    this.log(
      level === 'WARN' ? LogLevel.WARN : LogLevel.DEBUG,
      level,
      `Performance: ${operation} took ${duration}ms`,
      metadata
    );
  }

  // System health logging
  logSystemHealth(component: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: any): void {
    const level = status === 'healthy' ? LogLevel.INFO : 
                 status === 'degraded' ? LogLevel.WARN : LogLevel.ERROR;
    const levelName = status === 'healthy' ? 'INFO' : 
                     status === 'degraded' ? 'WARN' : 'ERROR';
    
    this.log(level, levelName, `System health: ${component} is ${status}`, metadata);
  }

  // Cleanup old log files (keep last 7 days)
  cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      files.forEach(file => {
        if (file.startsWith('app-') && file.endsWith('.log')) {
          const filePath = path.join(this.logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < sevenDaysAgo) {
            fs.unlinkSync(filePath);
            this.debug(`Cleaned up old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('Failed to cleanup old logs', error as Error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Express middleware for request logging
export const requestLogger = (req: any, res: any, next: any) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body: any) {
    const duration = Date.now() - start;
    const userId = req.user?.id;
    
    logger.logRequest(req.method, req.originalUrl, userId, duration, res.statusCode);
    
    return originalSend.call(this, body);
  };
  
  next();
};

// Error handling middleware
export const errorHandler = (error: Error, req: any, res: any, next: any) => {
  const userId = req.user?.id;
  const ip = req.ip || req.connection.remoteAddress;
  
  logger.error('Unhandled error in request', error, {
    method: req.method,
    url: req.originalUrl,
    userId,
    ip,
    body: req.body,
    query: req.query
  });
  
  // Don't expose error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    message: 'Internal server error',
    error: isDev ? {
      message: error.message,
      stack: error.stack
    } : undefined,
    timestamp: new Date().toISOString()
  });
};

// Async error wrapper
export const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Performance monitoring decorator
export function logPerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    try {
      const result = await method.apply(this, args);
      const duration = Date.now() - start;
      logger.logPerformance(`${target.constructor.name}.${propertyName}`, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`Method ${target.constructor.name}.${propertyName} failed after ${duration}ms`, error as Error);
      throw error;
    }
  };
}

export default logger;
