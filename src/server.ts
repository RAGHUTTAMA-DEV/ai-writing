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

dotenv.config();

const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// Middleware
app.use(helmet()); 

// Configure CORS with specific origins
const corsOptions = {
  origin: [
    'https://ai-writings.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:3000',
    'https://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); // Enable CORS with specific configuration
app.use(requestLogger); // Enhanced logging
app.use(performanceService.requestTracker); // Performance monitoring

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

app.use(errorHandler);

app.use((req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
  
  setInterval(() => {
    logger.cleanupOldLogs();
  }, 24 * 60 * 60 * 1000);
  
  performanceService.startPeriodicLogging(5); // Log every 5 minutes
  
  logger.info('AI Writing Platform is ready to serve requests');
  logger.info('Performance monitoring started');
});

export default app;