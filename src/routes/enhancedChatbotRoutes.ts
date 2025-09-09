import express from 'express';
import {
  getPersonalizedSuggestions,
  getWritingFlowQuestions,
  submitWritingFlowAnswers,
  getUserPreferences,
  updateUserPreferences,
  getConversationHistory,
  getProjectInsights,
  advancedContextSearch
} from '../controllers/enhancedChatbotController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Enhanced chatbot endpoints
router.post('/suggestions', getPersonalizedSuggestions);
router.post('/search', advancedContextSearch);

// Writing flow endpoints
router.get('/writing-flow/questions', getWritingFlowQuestions);
router.post('/writing-flow/answers', submitWritingFlowAnswers);

// User preferences endpoints
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

// Conversation endpoints
router.get('/conversations', getConversationHistory);

// Project insights endpoints
router.get('/projects/:projectId/insights', getProjectInsights);

export default router;
