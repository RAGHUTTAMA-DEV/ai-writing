import express from 'express';
import AIController from '../controllers/aiController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken);

router.post('/suggestions', (req, res, next) => {
  AIController.generateSuggestions(req, res).catch(next);
});

router.post('/autocomplete', (req, res, next) => {
  AIController.generateAutocomplete(req, res).catch(next);
});

router.post('/corrections', (req, res, next) => {
  AIController.generateCorrections(req, res).catch(next);
});

router.post('/better-version', (req, res, next) => {
  AIController.generateBetterVersion(req, res).catch(next);
});

router.post('/theme-consistency', (req, res, next) => {
  AIController.analyzeThemeConsistency(req, res).catch(next);
});

router.post('/foreshadowing', (req, res, next) => {
  AIController.checkForeshadowing(req, res).catch(next);
});

router.post('/motivation-stakes', (req, res, next) => {
  AIController.evaluateMotivationAndStakes(req, res).catch(next);
});

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

router.get('/analytics/:projectId', (req, res, next) => {
  console.log(`Received request for /analytics/${req.params.projectId}`);
  AIController.getProjectAnalytics(req, res).catch(next);
});

router.post('/cache/clear', (req, res, next) => {
  AIController.clearCache(req, res).catch(next);
});

export default router;
