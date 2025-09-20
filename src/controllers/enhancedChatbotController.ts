import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import aiService from '../services/aiService';
import { ImprovedRAGService } from '../services/improvedRAGService';

const prisma = new PrismaClient();
const improvedRAGService = new ImprovedRAGService();

// Get personalized suggestions based on context and user preferences
export const getPersonalizedSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { context, projectId } = req.body;
    const userId = (req as any).user?.id;

    if (!context) {
      res.status(400).json({ message: 'Context is required' });
      return;
    }

    // Get user preferences for personalization
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    console.log('🤖 Generating personalized suggestions for context:', context.substring(0, 100));
    console.log('🤖 User ID:', userId);
    console.log('🤖 Project ID:', projectId);

    // Generate intelligent response using AI service
    const suggestions = await aiService.generateIntelligentResponse(
      context, 
      userId, 
      projectId && projectId !== 'default' ? projectId : undefined, // Only pass valid project IDs
      context
    );

    console.log('🤖 AI response received, length:', suggestions?.length || 0);
    console.log('🤖 AI response preview:', suggestions?.substring(0, 200) || 'No response');

    // Store the conversation in database
    let conversation = await prisma.chatConversation.findFirst({
      where: {
        userId,
        projectId: projectId || null,
        isActive: true
      }
    });

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: {
          userId,
          projectId: projectId || null,
          title: `Chat - ${new Date().toLocaleDateString()}`,
          isActive: true
        }
      });
    }

    // Add user message
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: context
      }
    });

    // Add assistant response
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: suggestions,
        metadata: {
          projectId,
          userPreferences: userPreferences ? {
            writingStyle: userPreferences.writingStyle,
            genre: userPreferences.genre,
            themes: userPreferences.themes
          } : null
        }
      }
    });

    res.json({
      message: 'Personalized suggestions generated successfully',
      suggestions,
      conversationId: conversation.id
    });
  } catch (error) {
    console.error('Error generating personalized suggestions:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get writing flow questions
export const getWritingFlowQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, difficulty } = req.query;

    const templates = await prisma.writingFlowTemplate.findMany({
      where: {
        isActive: true,
        ...(category && { category: category as string }),
        ...(difficulty && { difficulty: parseInt(difficulty as string) })
      },
      orderBy: { createdAt: 'desc' }
    });

    // If no templates exist, create default ones
    if (templates.length === 0) {
      const defaultTemplate = await prisma.writingFlowTemplate.create({
        data: {
          name: 'General Writing Flow',
          description: 'Basic questions for any writing project',
          questions: [
            'What is the main goal or theme of your writing project?',
            'Who is your target audience?',
            'What writing style do you prefer (formal, casual, descriptive, concise)?',
            'What genre or type of writing is this?',
            'What challenges are you currently facing with this project?'
          ],
          category: 'general',
          difficulty: 1
        }
      });

      res.json({
        message: 'Writing flow questions retrieved successfully',
        questions: defaultTemplate.questions,
        templateId: defaultTemplate.id
      });
      return;
    }

    const questions = templates[0].questions;
    res.json({
      message: 'Writing flow questions retrieved successfully',
      questions,
      templateId: templates[0].id
    });
  } catch (error) {
    console.error('Error retrieving writing flow questions:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Submit writing flow answers
export const submitWritingFlowAnswers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { answers, templateId, projectId } = req.body;
    const userId = (req as any).user?.id;

    if (!answers || typeof answers !== 'object') {
      res.status(400).json({ message: 'Answers object is required' });
      return;
    }

    // Store the answers
    const response = await prisma.writingFlowResponse.create({
      data: {
        userId,
        templateId: templateId || 'default',
        projectId: projectId || null,
        answers
      }
    });

    // Update or create user preferences based on answers
    const preferences = {
      writingStyle: answers['writing_style'] || answers['What writing style do you prefer (formal, casual, descriptive, concise)?'],
      genre: answers['genre'] || answers['What genre or type of writing is this?'],
      themes: answers['themes'] ? [answers['themes']] : [],
      writingGoals: answers['goals'] ? [answers['goals']] : []
    };

    await prisma.userPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    });

    res.json({
      message: 'Writing flow answers submitted successfully',
      responseId: response.id
    });
  } catch (error) {
    console.error('Error submitting writing flow answers:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get user preferences
export const getUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId }
    });

    res.json({
      message: 'User preferences retrieved successfully',
      preferences: preferences || {}
    });
  } catch (error) {
    console.error('Error retrieving user preferences:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Update user preferences
export const updateUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const { preferences } = req.body;
    const userId = (req as any).user?.id;

    if (!preferences || typeof preferences !== 'object') {
      res.status(400).json({ message: 'Preferences object is required' });
      return;
    }

    // Convert dailyWordGoal to integer if it's a string
    const dailyWordGoal = preferences.dailyWordGoal ? parseInt(preferences.dailyWordGoal.toString()) : null;
    
    const updatedPreferences = await prisma.userPreferences.upsert({
      where: { userId },
      update: {
        writingStyle: preferences.writingStyle,
        genre: preferences.genre,
        tonePreference: preferences.tonePreference,
        themes: preferences.themes || [],
        writingGoals: preferences.writingGoals || [],
        dailyWordGoal: dailyWordGoal,
        preferences: preferences
      },
      create: {
        userId,
        writingStyle: preferences.writingStyle,
        genre: preferences.genre,
        tonePreference: preferences.tonePreference,
        themes: preferences.themes || [],
        writingGoals: preferences.writingGoals || [],
        dailyWordGoal: dailyWordGoal,
        preferences: preferences
      }
    });

    res.json({
      message: 'User preferences updated successfully',
      preferences: updatedPreferences
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get conversation history
export const getConversationHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { projectId, limit = 10 } = req.query;

    const conversations = await prisma.chatConversation.findMany({
      where: {
        userId,
        ...(projectId && { projectId: projectId as string }),
        isActive: true
      },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          take: parseInt(limit as string)
        },
        project: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });

    res.json({
      message: 'Conversation history retrieved successfully',
      conversations
    });
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Get project-specific insights
export const getProjectInsights = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { query } = req.query;

    if (!projectId) {
      res.status(400).json({ message: 'Project ID is required' });
      return;
    }

    // Get project context and RAG insights
    const projectContext = await improvedRAGService.syncProjectContext(projectId);
    const ragResults = query ? await improvedRAGService.intelligentSearch(query as string, {
      projectId,
      limit: 5,
      includeContext: true
    }) : null;

    // Get project statistics
    const stats = await improvedRAGService.getProjectStats(projectId);

    res.json({
      message: 'Project insights retrieved successfully',
      projectContext,
      insights: ragResults?.projectInsights,
      stats,
      searchResults: ragResults?.results || []
    });
  } catch (error) {
    console.error('Error retrieving project insights:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Advanced context search
export const advancedContextSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      query, 
      projectId, 
      contentTypes, 
      themes, 
      characters, 
      importance, 
      limit = 5 
    } = req.body;
    const userId = (req as any).user?.id;

    if (!query) {
      res.status(400).json({ message: 'Query is required' });
      return;
    }

    const searchOptions = {
      projectId,
      userId,
      contentTypes: contentTypes || [],
      themes: themes || [],
      characters: characters || [],
      importance: importance || 1,
      limit: parseInt(limit),
      includeContext: true
    };

    const results = await improvedRAGService.intelligentSearch(query, searchOptions);

    res.json({
      message: 'Advanced context search completed successfully',
      query,
      options: searchOptions,
      results: results.results,
      insights: results.projectInsights,
      totalResults: results.results.length
    });
  } catch (error) {
    console.error('Error in advanced context search:', error);
    res.status(500).json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

export default {
  getPersonalizedSuggestions,
  getWritingFlowQuestions,
  submitWritingFlowAnswers,
  getUserPreferences,
  updateUserPreferences,
  getConversationHistory,
  getProjectInsights,
  advancedContextSearch
};
