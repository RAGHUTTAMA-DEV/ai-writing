import { Request, Response } from 'express';
import chatbotService from '../services/chatbotService';
import { AuthenticatedRequest } from '../middleware/auth';

interface WritingFlowAnswers {
  [question: string]: string;
}

class ChatbotController {
  // Get personalized writing suggestions
  async getPersonalizedSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { context, projectId } = req.body;

      if (!context) {
        res.status(400).json({ 
          message: 'Context is required' 
        });
        return;
      }

      const suggestions = await chatbotService.generatePersonalizedSuggestions(
        userId, 
        context, 
        projectId
      );

      res.json({
        message: 'Personalized suggestions generated successfully',
        suggestions
      });
    } catch (error) {
      console.error('Error generating personalized suggestions:', error);
      res.status(500).json({ 
        message: 'Server error while generating personalized suggestions' 
      });
    }
  }

  // Get writing flow questions
  async getWritingFlowQuestions(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const questions = await chatbotService.askAboutWritingFlow(userId);

      res.json({
        message: 'Writing flow questions retrieved successfully',
        questions
      });
    } catch (error) {
      console.error('Error getting writing flow questions:', error);
      res.status(500).json({ 
        message: 'Server error while getting writing flow questions' 
      });
    }
  }

  // Submit writing flow answers
  async submitWritingFlowAnswers(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const answers: WritingFlowAnswers = req.body.answers;

      if (!answers) {
        res.status(400).json({ 
          message: 'Answers are required' 
        });
        return;
      }

      chatbotService.processWritingFlowAnswers(userId, answers);

      res.json({
        message: 'Writing flow answers submitted successfully'
      });
    } catch (error) {
      console.error('Error submitting writing flow answers:', error);
      res.status(500).json({ 
        message: 'Server error while submitting writing flow answers' 
      });
    }
  }

  // Get user preferences
  async getUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const preferences = chatbotService.getUserPreferences(userId);

      res.json({
        message: 'User preferences retrieved successfully',
        preferences
      });
    } catch (error) {
      console.error('Error getting user preferences:', error);
      res.status(500).json({ 
        message: 'Server error while getting user preferences' 
      });
    }
  }

  // Update user preferences
  async updateUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const preferences = req.body.preferences;

      if (!preferences) {
        res.status(400).json({ 
          message: 'Preferences are required' 
        });
        return;
      }

      chatbotService.setUserPreferences(userId, preferences);

      res.json({
        message: 'User preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ 
        message: 'Server error while updating user preferences' 
      });
    }
  }

  // Fast chat mode - quick AI responses without complex processing
  async fastChat(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { message, projectId } = req.body;

      if (!message) {
        res.status(400).json({ 
          message: 'Message is required' 
        });
        return;
      }

      const response = await chatbotService.fastChat(userId, message, projectId);

      res.json({
        message: 'Fast chat response generated successfully',
        response
      });
    } catch (error) {
      console.error('Error in fast chat:', error);
      res.status(500).json({ 
        message: 'Server error while generating fast chat response' 
      });
    }
  }

  // Quick answer mode - direct answers without embedding
  async quickAnswer(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { question, projectId } = req.body;

      if (!question) {
        res.status(400).json({ 
          message: 'Question is required' 
        });
        return;
      }

      const answer = await chatbotService.quickAnswer(userId, question, projectId);

      res.json({
        message: 'Quick answer generated successfully',
        answer
      });
    } catch (error) {
      console.error('Error generating quick answer:', error);
      res.status(500).json({ 
        message: 'Server error while generating quick answer' 
      });
    }
  }
}

export default new ChatbotController();