import { Request, Response } from 'express';
import aiService from '../services/aiService';
import improvedRAGService from '../services/improvedRAGService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AISuggestionRequest {
  projectId: string;
  context: string;
}

class AIController {
  // Generate autocomplete suggestions (Copilot-like feature)
  async generateAutocomplete(req: Request<{}, {}, { text: string; cursorPosition: number; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, cursorPosition, projectId } = req.body;

      if (!text || cursorPosition === undefined) {
        res.status(400).json({ 
          message: 'Text and cursor position are required' 
        });
        return;
      }

      // Get context around cursor position
      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      // Generate autocomplete suggestion
      const suggestion = await aiService.generateAutocomplete(
        beforeCursor,
        afterCursor,
        projectId
      );

      res.json({
        message: 'Autocomplete suggestion generated',
        suggestion,
        cursorPosition
      });
    } catch (error) {
      console.error('Error generating autocomplete:', error);
      res.status(500).json({ 
        message: 'Server error while generating autocomplete' 
      });
    }
  }

  // Generate writing suggestions based on context
  async generateSuggestions(req: Request<{}, {}, AISuggestionRequest>, res: Response): Promise<void> {
    try {
      const { projectId, context } = req.body;

      // Validate input
      if (!projectId || !context) {
        res.status(400).json({ 
          message: 'Project ID and context are required' 
        });
        return;
      }

      // Generate AI suggestions
      const suggestions = await aiService.generateSuggestions(
        context,
        projectId
      );

      res.json({
        message: 'Suggestions generated successfully',
        suggestions
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      res.status(500).json({ 
        message: 'Server error while generating suggestions' 
      });
    }
  }

  // Analyze theme consistency
  async analyzeThemeConsistency(req: Request<{}, {}, { text: string; theme: string }>, res: Response): Promise<void> {
    try {
      const { text, theme } = req.body;

      if (!text || !theme) {
        res.status(400).json({ 
          message: 'Text and theme are required' 
        });
        return;
      }

      const analysis = await aiService.analyzeThemeConsistency(text, theme);

      res.json({
        message: 'Theme consistency analysis completed',
        analysis
      });
    } catch (error) {
      console.error('Error analyzing theme consistency:', error);
      res.status(500).json({ 
        message: 'Server error while analyzing theme consistency' 
      });
    }
  }

  // Check for foreshadowing opportunities
  async checkForeshadowing(req: Request<{}, {}, { text: string; context: string }>, res: Response): Promise<void> {
    try {
      const { text, context } = req.body;

      if (!text) {
        res.status(400).json({ 
          message: 'Text is required' 
        });
        return;
      }

      const foreshadowing = await aiService.checkForeshadowing(text, context || '');

      res.json({
        message: 'Foreshadowing analysis completed',
        foreshadowing
      });
    } catch (error) {
      console.error('Error checking foreshadowing:', error);
      res.status(500).json({ 
        message: 'Server error while checking foreshadowing' 
      });
    }
  }

  // Evaluate character motivation and stakes
  async evaluateMotivationAndStakes(req: Request<{}, {}, { text: string; character: string }>, res: Response): Promise<void> {
    try {
      const { text, character } = req.body;

      if (!text || !character) {
        res.status(400).json({ 
          message: 'Text and character are required' 
        });
        return;
      }

      const evaluation = await aiService.evaluateMotivationAndStakes(text, character);

      res.json({
        message: 'Motivation and stakes evaluation completed',
        evaluation
      });
    } catch (error) {
      console.error('Error evaluating motivation and stakes:', error);
      res.status(500).json({ 
        message: 'Server error while evaluating motivation and stakes' 
      });
    }
  }

  // Add document to RAG system
  async addDocument(req: Request<{}, {}, { content: string; metadata: Record<string, any> }>, res: Response): Promise<void> {
    try {
      const { content, metadata } = req.body;

      if (!content) {
        res.status(400).json({ 
          message: 'Content is required' 
        });
        return;
      }

      const userId = (req as any).user?.id;
      await improvedRAGService.addDocument(content, {
        ...metadata,
        userId,
        timestamp: new Date().toISOString()
      });

      res.json({
        message: 'Document added to RAG system successfully'
      });
    } catch (error) {
      console.error('Error adding document to RAG system:', error);
      res.status(500).json({ 
        message: 'Server error while adding document to RAG system' 
      });
    }
  }

  // Add project content to RAG system
  async addProjectToRAG(req: Request<{}, {}, { projectId: string; content: string }>, res: Response): Promise<void> {
    try {
      const { projectId, content } = req.body;
      const userId = (req as any).user?.id;

      if (!projectId || !content) {
        res.status(400).json({ 
          message: 'Project ID and content are required' 
        });
        return;
      }

      // Verify project ownership
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          ownerId: userId
        }
      });

      if (!project) {
        res.status(403).json({ message: 'Project not found or access denied' });
        return;
      }

      await improvedRAGService.addDocument(content, {
        projectId,
        userId,
        projectTitle: project.title,
        timestamp: new Date().toISOString(),
        contentType: 'project'
      });

      res.json({
        message: 'Project content added to RAG system successfully'
      });
    } catch (error) {
      console.error('Error adding project to RAG system:', error);
      res.status(500).json({ 
        message: 'Server error while adding project to RAG system',
        //@ts-ignore
        error: error.message
      });
    }
  }

  // Search RAG system
  async searchRAG(req: Request<{}, {}, { query: string; projectId?: string; limit?: number }>, res: Response): Promise<void> {
    try {
      const { query, projectId, limit } = req.body;
      const userId = (req as any).user?.id;

      if (!query) {
        res.status(400).json({ 
          message: 'Query is required' 
        });
        return;
      }

      const searchOptions = {
        projectId,
        userId,
        limit: limit || 4,
        includeContext: true
      };

      const searchResults = await improvedRAGService.intelligentSearch(query, searchOptions);

      res.json({
        message: 'Search completed successfully',
        query,
        results: searchResults.results.map(doc => ({
          content: doc.pageContent,
          metadata: doc.metadata
        })),
        insights: searchResults.projectInsights,
        totalResults: searchResults.results.length
      });
    } catch (error) {
      console.error('Error searching RAG system:', error);
      res.status(500).json({ 
        message: 'Server error while searching RAG system',
        //@ts-ignore
        error: error.message
      });
    }
  }
}

export default new AIController();
