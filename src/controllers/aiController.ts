import { Request, Response } from 'express';
import aiService, { AIService } from '../services/aiService';
import { ImprovedRAGService, EnhancedDocument } from '../services/improvedRAGService';
import { PrismaClient } from '@prisma/client';
import { aiResponseCache } from '../services/cacheService';
import crypto from 'crypto';

const prisma = new PrismaClient();
const improvedRAGService = new ImprovedRAGService();

interface AISuggestionRequest {
  projectId: string;
  context: string;
}

class AIController {
  // Helper function to create cache keys that change when content changes
  private async createContentAwareCacheKey(
    operation: string, 
    text: string, 
    additionalParams: string = '', 
    projectId?: string
  ): Promise<string> {
    // Create a hash of the content to detect changes
    const contentHash = crypto.createHash('md5').update(text).digest('hex').substring(0, 8);
    
    // Get project's last modified timestamp if available
    let projectTimestamp = 'none';
    if (projectId) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { updatedAt: true }
        });
        if (project) {
          projectTimestamp = project.updatedAt.getTime().toString();
        }
      } catch (error) {
        console.warn('Could not get project timestamp for cache key');
      }
    }
    
    // Combine operation, content hash, project timestamp, and additional params
    const keyParts = [operation, contentHash, projectTimestamp, additionalParams].filter(Boolean);
    return keyParts.join(':');
  }
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
        suggestion: suggestion || '', // Ensure we always return a string
        cursorPosition,
        // Additional info for frontend to handle properly
        insertAt: cursorPosition,
        replaceLength: 0, // Don't replace any existing text
        beforeCursor: beforeCursor.slice(-20), // Last 20 chars for context
        afterCursor: afterCursor.slice(0, 20) // Next 20 chars for context
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

  // Analyze theme consistency with circuit breaker
  async analyzeThemeConsistency(req: Request<{}, {}, { text: string; theme: string; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, theme, projectId } = req.body;

      if (!text || !theme) {
        res.status(400).json({ 
          message: 'Text and theme are required' 
        });
        return;
      }

      // Content-aware cache key that changes when project content changes
      const cacheKey = await this.createContentAwareCacheKey('theme', text, theme, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log('🎯 Returning cached theme analysis');
        res.json({
          message: 'Theme analysis completed (cached)',
          analysis: cached
        });
        return;
      }

      // Let AI service handle timeouts
      const analysis = await aiService.analyzeThemeConsistency(text, theme, projectId);
      aiResponseCache.set(cacheKey, analysis, 3600);
      
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

  // Check for foreshadowing opportunities with aggressive caching and circuit breaker
  async checkForeshadowing(req: Request<{}, {}, { text: string; context?: string; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, context, projectId } = req.body;

      if (!text) {
        res.status(400).json({ 
          message: 'Text is required' 
        });
        return;
      }

      // Content-aware cache key that changes when project content changes
      const cacheKey = await this.createContentAwareCacheKey('foreshadowing', text, '', projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log('🔮 Returning cached foreshadowing analysis');
        res.json({
          message: 'Foreshadowing analysis completed (cached)',
          foreshadowing: cached
        });
        return;
      }

      // Let AI service handle its own timeouts - no circuit breaker
      const foreshadowing = await aiService.checkForeshadowing(text, context || '', projectId);
      
      // Cache for 1 hour
      aiResponseCache.set(cacheKey, foreshadowing, 3600);
      
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

  // Evaluate character motivation and stakes with circuit breaker
  async evaluateMotivationAndStakes(req: Request<{}, {}, { text: string; character: string; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, character, projectId } = req.body;

      if (!text || !character) {
        res.status(400).json({ 
          message: 'Text and character are required' 
        });
        return;
      }

      // Content-aware cache key that changes when project content changes
      const cacheKey = await this.createContentAwareCacheKey('motivation', text, character, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log('🎭 Returning cached motivation analysis');
        res.json({
          message: 'Motivation evaluation completed (cached)',
          evaluation: cached
        });
        return;
      }

      // Let AI service handle timeouts
      const evaluation = await aiService.evaluateMotivationAndStakes(text, character, projectId);
      aiResponseCache.set(cacheKey, evaluation, 3600);
      
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
        timestamp: new Date()
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

  // Add project content to RAG system with enhanced metadata extraction
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

      console.log(`📝 Adding project ${projectId} to RAG with enhanced metadata extraction...`);

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

      // Use the RAG service's enhanced metadata extraction
      await improvedRAGService.addDocument(content, {
        projectId,
        userId,
        projectTitle: project.title,
        timestamp: new Date(),
        contentType: 'project',
        importance: 9 // High importance for project content
      });

      // Sync project context to ensure all metadata is extracted and cached
      console.log(`🔄 Syncing project context for enhanced analytics...`);
      const projectContext = await improvedRAGService.syncProjectContext(projectId);
      
      // Get detailed project analytics
      const projectStats = await improvedRAGService.getProjectStats(projectId);
      
      console.log(`✅ Project successfully added to RAG with enhanced metadata:`);
      console.log(`  - Characters: ${projectStats.characters.length}`);
      console.log(`  - Themes: ${projectStats.themes.length}`);
      console.log(`  - Content Types: ${projectStats.contentTypes.length}`);
      console.log(`  - Total Word Count: ${projectStats.totalWordCount}`);

      res.json({
        message: 'Project content added to RAG system successfully with enhanced metadata',
        analytics: {
          characters: projectStats.characters,
          themes: projectStats.themes,
          contentTypes: projectStats.contentTypes,
          emotions: projectStats.emotions,
          plotElements: projectStats.plotElements,
          semanticTags: projectStats.semanticTags,
          totalDocuments: projectStats.totalDocuments,
          totalChunks: projectStats.totalChunks,
          totalWordCount: projectStats.totalWordCount,
          averageImportance: projectStats.averageImportance,
          lastUpdated: projectStats.lastUpdated
        },
        projectContext: projectContext ? {
          writingStyle: projectContext.writingStyle,
          toneAnalysis: projectContext.toneAnalysis,
          settings: projectContext.settings
        } : null
      });
    } catch (error) {
      console.error('❌ Error adding project to RAG system:', error);
      res.status(500).json({ 
        message: 'Server error while adding project to RAG system',
        error: error instanceof Error ? error.message : 'Unknown error'
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
        results: searchResults.results.map((doc: EnhancedDocument) => ({
          content: doc.pageContent,
          metadata: doc.metadata
        })),
        insights: searchResults.projectInsights,
        summary: searchResults.searchSummary,
        totalResults: searchResults.results.length
      });
    } catch (error) {
      console.error('Error searching RAG system:', error);
      res.status(500).json({ 
        message: 'Server error while searching RAG system',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get project analytics for frontend
  async getProjectAnalytics(req: Request<{ projectId: string }>, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user?.id;

      if (!projectId) {
        res.status(400).json({ 
          message: 'Project ID is required' 
        });
        return;
      }

      console.log(`📊 Fetching analytics for project ${projectId}...`);

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

      // Get project stats and context
      const projectStats = await improvedRAGService.getProjectStats(projectId);
      const projectContext = await improvedRAGService.syncProjectContext(projectId);
      
      // Get basic project info
      const basicAnalytics = {
        title: project.title,
        description: project.description,
        format: project.format,
        type: project.type,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        contentLength: project.content?.length || 0,
        wordCount: project.content ? project.content.split(/\s+/).length : 0
      };

      console.log(`✅ Analytics retrieved for project "${project.title}":`);
      console.log(`  - Characters found: ${projectStats.characters.length}`);
      console.log(`  - Themes found: ${projectStats.themes.length}`);
      console.log(`  - Emotions found: ${projectStats.emotions.length}`);
      console.log(`  - Plot elements found: ${projectStats.plotElements.length}`);

      res.json({
        message: 'Project analytics retrieved successfully',
        projectId,
        basic: basicAnalytics,
        analytics: {
          characters: projectStats.characters,
          themes: projectStats.themes,
          contentTypes: projectStats.contentTypes,
          emotions: projectStats.emotions,
          plotElements: projectStats.plotElements,
          semanticTags: projectStats.semanticTags,
          totalDocuments: projectStats.totalDocuments,
          totalChunks: projectStats.totalChunks,
          totalWordCount: projectStats.totalWordCount,
          averageImportance: projectStats.averageImportance,
          lastUpdated: projectStats.lastUpdated
        },
        context: projectContext ? {
          writingStyle: projectContext.writingStyle,
          toneAnalysis: projectContext.toneAnalysis,
          settings: projectContext.settings,
          lastContextUpdate: projectContext.lastUpdated
        } : null,
        hasRAGData: projectStats.totalDocuments > 0
      });
    } catch (error) {
      console.error('❌ Error fetching project analytics:', error);
      res.status(500).json({ 
        message: 'Server error while fetching project analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Manual cache clearing for debugging/testing
  async clearCache(req: Request<{}, {}, { projectId?: string; type?: string }>, res: Response): Promise<void> {
    try {
      const { projectId, type } = req.body;
      
      if (type === 'all') {
        // Clear all AI response caches
        aiResponseCache.flushAll();
        console.log('🧹 All AI response caches cleared');
        
        res.json({
          message: 'All AI caches cleared successfully'
        });
      } else if (projectId) {
        // Clear project-specific caches (this will be handled by content-aware keys automatically)
        console.log(`🧹 Content-aware caches will auto-invalidate for project ${projectId}`);
        
        res.json({
          message: `Cache invalidation noted for project ${projectId}. Content-aware caches will refresh automatically.`
        });
      } else {
        res.status(400).json({
          message: 'Either specify projectId or type=all'
        });
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        message: 'Error clearing cache'
      });
    }
  }
}

export default new AIController();
