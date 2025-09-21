import { Request, Response } from 'express';
import { AIService } from '../services/aiService';
import { ImprovedRAGService, EnhancedDocument } from '../services/improvedRAGService';
import { PrismaClient } from '@prisma/client';
import { aiResponseCache } from '../services/cacheService';
import crypto from 'crypto';

const prisma = new PrismaClient();
const improvedRAGService = new ImprovedRAGService();
const aiService = new AIService();

interface AISuggestionRequest {
  projectId: string;
  context: string;
  analysisMode?: 'fast' | 'deep';
}

interface AIAnalysisRequest {
  text: string;
  theme?: string;
  character?: string;
  context?: string;
  projectId?: string;
  analysisMode?: 'fast' | 'deep';
}

class AIController {
  private async createContentAwareCacheKey(
    operation: string, 
    text: string, 
    additionalParams: string = '', 
    projectId?: string
  ): Promise<string> {
    const contentHash = crypto.createHash('md5').update(text).digest('hex').substring(0, 8);
    
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
    
    const keyParts = [operation, contentHash, projectTimestamp, additionalParams].filter(Boolean);
    return keyParts.join(':');
  }

  async generateCorrections(req: Request<{}, {}, { text: string; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, projectId } = req.body;
      const userId = (req as any).user?.id;

      if (!text || text.trim().length === 0) {
        res.status(400).json({ 
          message: 'Text is required' 
        });
        return;
      }

      console.log(`🔧 Generating clean corrections for text length: ${text.length}`);

      const result = await aiService.generateCleanCorrections(text, projectId, userId);

      res.json({
        message: 'Corrections generated successfully',
        corrections: result.corrections,
        overallFeedback: result.overallFeedback,
        hasCorrections: result.corrections.length > 0
      });
    } catch (error) {
      console.error('Error generating corrections:', error);
      res.status(500).json({ 
        message: 'Server error while generating corrections' 
      });
    }
  }

  // Generate better version of text with context awareness
  async generateBetterVersion(req: Request<{}, {}, { text: string; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, projectId } = req.body;
      const userId = (req as any).user?.id;

      if (!text || text.trim().length === 0) {
        res.status(400).json({ 
          message: 'Text is required' 
        });
        return;
      }

      console.log(`✨ Generating better version for text length: ${text.length}`);

      const cacheKey = await this.createContentAwareCacheKey(
        'better-version', 
        text, 
        projectId || '', 
        projectId
      );

      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log('📋 Returning cached better version');
        res.json({
          message: 'Better version generated successfully',
          improvedText: cached,
          fromCache: true
        });
        return;
      }

      const betterVersion = await aiService.generateBetterVersion(text, projectId, userId);

      aiResponseCache.set(cacheKey, betterVersion);

      res.json({
        message: 'Better version generated successfully',
        improvedText: betterVersion,
        fromCache: false
      });
    } catch (error) {
      console.error('Error generating better version:', error);
      res.status(500).json({ 
        message: 'Server error while generating better version' 
      });
    }
  }
  
  async generateAutocomplete(req: Request<{}, {}, { text: string; cursorPosition: number; projectId?: string }>, res: Response): Promise<void> {
    try {
      const { text, cursorPosition, projectId } = req.body;

      if (!text || cursorPosition === undefined) {
        res.status(400).json({ 
          message: 'Text and cursor position are required' 
        });
        return;
      }

      const beforeCursor = text.substring(0, cursorPosition);
      const afterCursor = text.substring(cursorPosition);
      
      const suggestion = await aiService.generateAutocomplete(
        beforeCursor,
        afterCursor,
        projectId
      );

      res.json({
        message: 'Autocomplete suggestion generated',
        suggestion: suggestion || '', 
        cursorPosition,
        insertAt: cursorPosition,
        replaceLength: 0, // Don't replace any existing text
        beforeCursor: beforeCursor.slice(-20), 
        afterCursor: afterCursor.slice(0, 20) 
      });
    } catch (error) {
      console.error('Error generating autocomplete:', error);
      res.status(500).json({ 
        message: 'Server error while generating autocomplete' 
      });
    }
  }

  async generateSuggestions(req: Request<{}, {}, AISuggestionRequest>, res: Response): Promise<void> {
    try {
      const { projectId, context, analysisMode = 'fast' } = req.body;

      // Validate input
      if (!projectId || !context) {
        res.status(400).json({ 
          message: 'Project ID and context are required' 
        });
        return;
      }

      const userId = (req as any).user?.id;
      console.log(`🎯 Generating suggestions in ${analysisMode} mode for user ${userId}`);

      const cacheKey = await this.createContentAwareCacheKey('suggestions', context, `${analysisMode}:${userId || 'anon'}`, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log(`🎯 Returning cached suggestions (${analysisMode} mode)`);
        res.json({
          message: `Suggestions generated successfully (cached, ${analysisMode} mode)`,
          suggestions: cached,
          analysisMode
        });
        return;
      }

      const suggestions = await aiService.generateSuggestions(
        context,
        projectId,
        userId,
        analysisMode
      );

      aiResponseCache.set(cacheKey, suggestions, 600); // 10 minutes

      res.json({
        message: `Suggestions generated successfully (${analysisMode} mode)`,
        suggestions,
        analysisMode
      });
    } catch (error) {
      console.error('Error generating suggestions:', error);
      res.status(500).json({ 
        message: 'Server error while generating suggestions' 
      });
    }
  }

  async analyzeThemeConsistency(req: Request<{}, {}, AIAnalysisRequest>, res: Response): Promise<void> {
    try {
      const { text, theme, projectId, analysisMode = 'fast' } = req.body;

      if (!text || !theme) {
        res.status(400).json({ 
          message: 'Text and theme are required' 
        });
        return;
      }

      console.log(`🎯 Analyzing theme consistency in ${analysisMode} mode`);

      const cacheKey = await this.createContentAwareCacheKey('theme', text, `${theme}:${analysisMode}`, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log(`🎯 Returning cached theme analysis (${analysisMode} mode)`);
        res.json({
          message: `Theme analysis completed (cached, ${analysisMode} mode)`,
          analysis: cached,
          analysisMode
        });
        return;
      }
      const analysis = await aiService.analyzeThemeConsistency(text, theme, projectId, analysisMode);
      aiResponseCache.set(cacheKey, analysis, 3600);
      
      res.json({
        message: `Theme consistency analysis completed (${analysisMode} mode)`,
        analysis,
        analysisMode
      });
    } catch (error) {
      console.error('Error analyzing theme consistency:', error);
      res.status(500).json({ 
        message: 'Server error while analyzing theme consistency' 
      });
    }
  }

  // Check for foreshadowing opportunities with analysis mode support
  async checkForeshadowing(req: Request<{}, {}, AIAnalysisRequest>, res: Response): Promise<void> {
    try {
      const { text, context, projectId, analysisMode = 'fast' } = req.body;

      if (!text) {
        res.status(400).json({ 
          message: 'Text is required' 
        });
        return;
      }

      console.log(`🔮 Checking foreshadowing in ${analysisMode} mode`);

      const cacheKey = await this.createContentAwareCacheKey('foreshadowing', text, `${analysisMode}`, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log(`🔮 Returning cached foreshadowing analysis (${analysisMode} mode)`);
        res.json({
          message: `Foreshadowing analysis completed (cached, ${analysisMode} mode)`,
          foreshadowing: cached,
          analysisMode
        });
        return;
      }

      const foreshadowing = await aiService.checkForeshadowing(text, context || '', projectId, analysisMode);
      
      aiResponseCache.set(cacheKey, foreshadowing, 3600);
      
      res.json({
        message: `Foreshadowing analysis completed (${analysisMode} mode)`,
        foreshadowing,
        analysisMode
      });
    } catch (error) {
      console.error('Error checking foreshadowing:', error);
      res.status(500).json({ 
        message: 'Server error while checking foreshadowing' 
      });
    }
  }

  // Evaluate character motivation and stakes with analysis mode support
  async evaluateMotivationAndStakes(req: Request<{}, {}, AIAnalysisRequest>, res: Response): Promise<void> {
    try {
      const { text, character, projectId, analysisMode = 'fast' } = req.body;

      if (!text || !character) {
        res.status(400).json({ 
          message: 'Text and character name are required' 
        });
        return;
      }

      console.log(`🎭 Evaluating motivation and stakes in ${analysisMode} mode`);

      const cacheKey = await this.createContentAwareCacheKey('motivation', text, `${character}:${analysisMode}`, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log(`🎭 Returning cached motivation analysis (${analysisMode} mode)`);
        res.json({
          message: `Motivation evaluation completed (cached, ${analysisMode} mode)`,
          evaluation: cached,
          analysisMode
        });
        return;
      }

      // Generate motivation analysis with specified mode
      const evaluation = await aiService.evaluateMotivationAndStakes(text, character, projectId, analysisMode);
      aiResponseCache.set(cacheKey, evaluation, 3600);
      
      res.json({
        message: `Motivation and stakes evaluation completed (${analysisMode} mode)`,
        evaluation,
        analysisMode
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

      await improvedRAGService.addDocument(content, {
        projectId,
        userId,
        projectTitle: project.title,
        timestamp: new Date(),
        contentType: 'project',
        importance: 9 // High importance for project content
      });

      const projectContext = await improvedRAGService.syncProjectContext(projectId);
      
      const projectStats = await improvedRAGService.getProjectStats(projectId);
      
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

  // Get project analytics for frontend with fast/slow mode support
  async getProjectAnalytics(req: Request<{ projectId: string }, {}, {}, { analysisMode?: 'fast' | 'deep' }>, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { analysisMode = 'fast' } = req.query;
      const userId = (req as any).user?.id;

      if (!projectId) {
        res.status(400).json({ 
          message: 'Project ID is required' 
        });
        return;
      }

      console.log(`📊 Fetching analytics for project ${projectId} in ${analysisMode} mode...`);

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

      // Check cache first
      const cacheKey = await this.createContentAwareCacheKey('analytics', project.content || '', `${analysisMode}:${userId || 'anon'}`, projectId);
      const cached = aiResponseCache.get(cacheKey);
      if (cached) {
        console.log(`📊 Returning cached analytics (${analysisMode} mode)`);
        res.json({
          message: `Project analytics retrieved successfully (cached, ${analysisMode} mode)`,
          summary: cached,
          analysisMode
        });
        return;
      }

      if (analysisMode === 'fast') {
        // FAST MODE: Direct AI analysis of project content
        console.log('⚡ FAST MODE: Direct AI content analysis');
        
        const basicAnalytics = {
          projectId,
          title: project.title,
          wordCount: project.content ? project.content.split(/\s+/).length : 0,
          lastAnalyzed: new Date().toISOString(),
          estimatedReadingTime: project.content ? Math.ceil(project.content.split(/\s+/).length / 200) : 0,
          estimatedScenes: project.content ? Math.ceil(project.content.split(/\s+/).length / 300) : 0,
          suggestedChapters: project.content ? Math.ceil(project.content.split(/\s+/).length / 2500) : 0,
          genre: project.type,
          writingStyle: 'balanced',
          recommendations: [
            project.content && project.content.split(/\s+/).length < 10000 ? 'Consider expanding content for full-length novel' : 'Length is suitable for novel format',
            'Length is manageable for single volume',
            'Good foundation for character development'
          ]
        };

        if (project.content && project.content.length > 0) {
          // Generate AI-based analytics with improved prompt
          const analyticsPrompt = `Analyze this story content and provide detailed insights. You must respond ONLY with valid JSON in exactly this format:

{"characters": ["name1", "name2"], "themes": ["theme1", "theme2"], "emotions": ["emotion1", "emotion2"], "plotElements": ["event1", "event2"], "writingStyle": "style", "genre": "genre", "tone": "tone", "pacing": "pacing", "strengths": ["strength1", "strength2"], "suggestions": ["suggestion1", "suggestion2"]}

Story content:
"${project.content.slice(0, 1500)}"

Provide comprehensive analysis:
- characters: Extract actual character names (people, beings with names), not pronouns or generic terms
- themes: Identify deeper meanings, concepts, or ideas (family, betrayal, coming-of-age, justice, etc.)
- emotions: List feelings or moods expressed (fear, love, anger, hope, despair, joy, etc.)
- plotElements: Key events, conflicts, or story developments (discovery, confrontation, revelation, etc.)
- writingStyle: Describe the writing approach (descriptive, concise, dramatic, poetic, dialogue-heavy, etc.)
- genre: Classify the story type (fantasy, sci-fi, drama, romance, mystery, thriller, etc.)
- tone: Overall emotional atmosphere (dark, hopeful, mysterious, humorous, serious, etc.)
- pacing: Story rhythm (fast-paced, slow-burn, episodic, building, etc.)
- strengths: What works well in the writing (character development, dialogue, world-building, etc.)
- suggestions: Areas for improvement (pacing, character depth, plot development, etc.)

Respond with ONLY the JSON object, no other text:`;

          try {
            const aiResponse = await aiService.generateStructureAnalysis(analyticsPrompt);
            console.log('🤖 Raw AI Response for analytics:', aiResponse);
            
            let aiAnalytics;
            
            try {
              // Clean the response to extract JSON
              let cleanResponse = aiResponse.trim();
              
              // Remove any markdown code blocks
              cleanResponse = cleanResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
              
              // Find JSON object boundaries
              const startIndex = cleanResponse.indexOf('{');
              const endIndex = cleanResponse.lastIndexOf('}');
              
              if (startIndex !== -1 && endIndex !== -1) {
                cleanResponse = cleanResponse.substring(startIndex, endIndex + 1);
              }
              
              console.log('🧹 Cleaned AI Response:', cleanResponse);
              aiAnalytics = JSON.parse(cleanResponse);
              
              // Validate the response structure
              if (!aiAnalytics.characters) aiAnalytics.characters = [];
              if (!aiAnalytics.themes) aiAnalytics.themes = [];
              if (!aiAnalytics.emotions) aiAnalytics.emotions = [];
              if (!aiAnalytics.plotElements) aiAnalytics.plotElements = [];
              if (!aiAnalytics.writingStyle) aiAnalytics.writingStyle = 'balanced';
              if (!aiAnalytics.genre) aiAnalytics.genre = project.type || 'fiction';
              if (!aiAnalytics.tone) aiAnalytics.tone = 'neutral';
              if (!aiAnalytics.pacing) aiAnalytics.pacing = 'moderate';
              if (!aiAnalytics.strengths) aiAnalytics.strengths = [];
              if (!aiAnalytics.suggestions) aiAnalytics.suggestions = [];
              
              console.log('✅ Parsed AI Analytics:', aiAnalytics);
              
            } catch (parseError) {
              console.log('❌ Failed to parse AI response as JSON:', parseError);
              console.log('Raw response was:', aiResponse);
              
              // Fallback: try to extract information with regex
              const characterMatches = aiResponse.match(/"characters":\s*\[(.*?)\]/);
              const themeMatches = aiResponse.match(/"themes":\s*\[(.*?)\]/);
              
              const extractArrayFromMatch = (match: RegExpMatchArray | null): string[] => {
                if (!match) return [];
                try {
                  const arrayStr = '[' + match[1] + ']';
                  return JSON.parse(arrayStr);
                } catch {
                  return [];
                }
              };
              
              aiAnalytics = {
                characters: extractArrayFromMatch(characterMatches).length > 0 
                  ? extractArrayFromMatch(characterMatches)
                  : ['Characters need manual review'],
                themes: extractArrayFromMatch(themeMatches).length > 0
                  ? extractArrayFromMatch(themeMatches) 
                  : ['Themes need manual review'],
                emotions: [],
                plotElements: [],
                writingStyle: 'balanced',
                genre: project.type || 'fiction',
                tone: 'neutral',
                pacing: 'moderate',
                strengths: ['Content present for analysis'],
                suggestions: ['Consider adding more detailed character development']
              };
            }
            
            const summary = {
              ...basicAnalytics,
              characters: aiAnalytics.characters || ['No characters identified'],
              themes: aiAnalytics.themes || ['No themes identified'],
              emotions: aiAnalytics.emotions || [],
              plotElements: aiAnalytics.plotElements || [],
              writingStyle: aiAnalytics.writingStyle || 'balanced',
              genre: aiAnalytics.genre || project.type || 'fiction',
              tone: aiAnalytics.tone || 'neutral',
              pacing: aiAnalytics.pacing || 'moderate',
              strengths: aiAnalytics.strengths || [],
              suggestions: aiAnalytics.suggestions || [],
              recommendations: [
                ...(basicAnalytics.recommendations || []),
                ...(aiAnalytics.suggestions || [])
              ]
            };

            aiResponseCache.set(cacheKey, summary, 600); // 10 minutes cache
            
            res.json({
              message: `Project analytics retrieved successfully (${analysisMode} mode)`,
              summary,
              analysisMode
            });
          } catch (aiError) {
            console.error('AI analysis failed, using basic analytics:', aiError);
            res.json({
              message: `Project analytics retrieved successfully (${analysisMode} mode)`,
              summary: {
                ...basicAnalytics,
                characters: ['Unable to analyze characters'],
                themes: ['Unable to analyze themes']
              },
              analysisMode
            });
          }
        } else {
          res.json({
            message: `Project analytics retrieved successfully (${analysisMode} mode)`,
            summary: {
              ...basicAnalytics,
              characters: ['No content to analyze'],
              themes: ['No content to analyze']
            },
            analysisMode
          });
        }
      } else {
        // DEEP MODE: Use comprehensive RAG analysis
        console.log('🔍 DEEP MODE: Comprehensive RAG-based analysis');
        
        // Get project stats and context from RAG
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

        const summary = {
          projectId,
          title: project.title,
          wordCount: basicAnalytics.wordCount,
          lastAnalyzed: new Date().toISOString(),
          estimatedReadingTime: Math.ceil(basicAnalytics.wordCount / 200),
          estimatedScenes: Math.ceil(basicAnalytics.wordCount / 300),
          suggestedChapters: Math.ceil(basicAnalytics.wordCount / 2500),
          genre: project.type,
          writingStyle: projectContext?.writingStyle || 'balanced',
          characters: projectStats.characters || ['No characters identified'],
          themes: projectStats.themes || ['No themes identified'],
          emotions: projectStats.emotions || [],
          plotElements: projectStats.plotElements || [],
          recommendations: [
            basicAnalytics.wordCount < 10000 ? 'Consider expanding content for full-length novel' : 'Length is suitable for novel format',
            'Length is manageable for single volume',
            'Good foundation for character development'
          ],
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
        };

        aiResponseCache.set(cacheKey, summary, 1800); // 30 minutes cache for deep analysis
        
        console.log(`✅ Deep analytics retrieved for project "${project.title}":`);
        console.log(`  - Characters found: ${projectStats.characters.length}`);
        console.log(`  - Themes found: ${projectStats.themes.length}`);
        console.log(`  - Emotions found: ${projectStats.emotions.length}`);

        res.json({
          message: `Project analytics retrieved successfully (${analysisMode} mode)`,
          summary,
          analysisMode
        });
      }
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
