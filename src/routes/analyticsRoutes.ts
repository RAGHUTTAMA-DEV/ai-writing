import express from 'express';
import analyticsController from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All analytics routes are protected
router.use(authenticateToken);

// Full structure analysis with chapters and scenes
router.post('/structure/:projectId', analyticsController.analyzeProjectStructure);

// Quick chapter suggestions without full analysis  
router.post('/chapter-suggestions', analyticsController.getChapterSuggestions);

// Analyze specific chapter content
router.post('/chapter-analysis', analyticsController.analyzeChapter);

// Get structure analytics summary for dashboard
router.get('/structure-summary/:projectId', analyticsController.getStructureSummary);

// Compare structure across user's projects
router.get('/structure-comparison', analyticsController.compareProjectStructures);

// Enhanced project analytics with structure insights
router.get('/enhanced/:projectId', analyticsController.getEnhancedProjectAnalytics);

export default router;
