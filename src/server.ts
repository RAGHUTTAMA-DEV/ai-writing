import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from './config/passport';
import { logger, requestLogger, errorHandler } from './utils/logger';
import { performanceService } from './services/performanceService';

// Import routes
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import aiRoutes from './routes/aiRoutes';
import chatbotRoutes from './routes/chatbotRoutes';
import enhancedChatbotRoutes from './routes/enhancedChatbotRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Load environment variables
dotenv.config();

// Initialize Express app
const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(requestLogger); // Enhanced logging
app.use(performanceService.requestTracker); // Performance monitoring

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware (required for Passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/enhanced-chatbot', enhancedChatbotRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint with performance metrics
app.get('/health', (req: Request, res: Response) => {
  const health = performanceService.getHealthStatus();
  const stats = performanceService.getStats();
  
  res.status(health.status === 'critical' ? 503 : 200).json({ 
    status: health.status,
    timestamp: new Date().toISOString(),
    uptime: health.uptime,
    memoryPressure: health.memoryPressure,
    issues: health.issues,
    performance: {
      avgResponseTime: stats.avgResponseTime,
      totalRequests: stats.totalRequests,
      cacheHitRate: stats.cacheStats.hitRate,
      apiCallsSuccess: stats.apiCalls.successful,
      apiCallsTotal: stats.apiCalls.total
    }
  });
});

// Enhanced error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  
  // Setup log cleanup interval (daily)
  setInterval(() => {
    logger.cleanupOldLogs();
  }, 24 * 60 * 60 * 1000);
  
  // Start performance monitoring
  performanceService.startPeriodicLogging(5); // Log every 5 minutes
  
  logger.info('AI Writing Platform is ready to serve requests');
  logger.info('Performance monitoring started');
});

export default app;