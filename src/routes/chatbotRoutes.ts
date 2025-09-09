import express from 'express';
import chatbotController from '../controllers/chatbotController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All chatbot routes are protected
router.use(authenticateToken);

// Get personalized writing suggestions
router.post('/suggestions', chatbotController.getPersonalizedSuggestions);

// Get writing flow questions
router.get('/writing-flow/questions', chatbotController.getWritingFlowQuestions);

// Submit writing flow answers
router.post('/writing-flow/answers', chatbotController.submitWritingFlowAnswers);

// Get user preferences
router.get('/preferences', chatbotController.getUserPreferences);

// Update user preferences
router.put('/preferences', chatbotController.updateUserPreferences);

export default router;