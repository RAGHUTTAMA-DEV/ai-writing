import express from 'express';
import AIController from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All AI routes are protected
router.use(authenticateToken);

// AI suggestion generation
router.post('/suggestions', (req, res, next) => {
  AIController.generateSuggestions(req, res).catch(next);
});

// Autocomplete suggestions (Copilot-like feature)
router.post('/autocomplete', (req, res, next) => {
  AIController.generateAutocomplete(req, res).catch(next);
});

// Theme consistency analysis
router.post('/theme-consistency', (req, res, next) => {
  AIController.analyzeThemeConsistency(req, res).catch(next);
});

// Foreshadowing analysis
router.post('/foreshadowing', (req, res, next) => {
  AIController.checkForeshadowing(req, res).catch(next);
});

// Character motivation and stakes evaluation
router.post('/motivation-stakes', (req, res, next) => {
  AIController.evaluateMotivationAndStakes(req, res).catch(next);
});

// RAG system endpoints
router.post('/rag/add', (req, res, next) => {
  AIController.addDocument(req, res).catch(next);
});
router.post('/rag/add-project', (req, res, next) => {
  console.log('Received request for /rag/add-project');
  AIController.addProjectToRAG(req, res).catch(next);
});
router.post('/rag/search', (req, res, next) => {
  AIController.searchRAG(req, res).catch(next);
});

// Analytics endpoints
router.get('/analytics/:projectId', (req, res, next) => {
  console.log(`Received request for /analytics/${req.params.projectId}`);
  AIController.getProjectAnalytics(req, res).catch(next);
});

// Cache management
router.post('/cache/clear', (req, res, next) => {
  AIController.clearCache(req, res).catch(next);
});

export default router;
