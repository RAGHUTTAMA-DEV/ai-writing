import express from 'express';
import AIController from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All AI routes are protected
router.use(authenticateToken);

// AI suggestion generation
router.post('/suggestions', AIController.generateSuggestions);

// Autocomplete suggestions (Copilot-like feature)
router.post('/autocomplete', AIController.generateAutocomplete);

// Theme consistency analysis
router.post('/theme-consistency', AIController.analyzeThemeConsistency);

// Foreshadowing analysis
router.post('/foreshadowing', AIController.checkForeshadowing);

// Character motivation and stakes evaluation
router.post('/motivation-stakes', AIController.evaluateMotivationAndStakes);

// RAG system endpoints
router.post('/rag/add', AIController.addDocument);
router.post('/rag/add-project', (req, res, next) => {
  console.log('Received request for /rag/add-project');
  // Call the controller method
  AIController.addProjectToRAG(req, res).catch(next);
});
router.post('/rag/search', AIController.searchRAG);

// Analytics endpoints
router.get('/analytics/:projectId', (req, res, next) => {
  console.log(`Received request for /analytics/${req.params.projectId}`);
  AIController.getProjectAnalytics(req, res).catch(next);
});

export default router;
