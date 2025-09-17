import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import structureAnalysisService from '../services/structureAnalysisService';
import { PrismaClient } from '@prisma/client';
import { ImprovedRAGService } from '../services/improvedRAGService';

const prisma = new PrismaClient();
const improvedRAGService = new ImprovedRAGService();

class AnalyticsController {
  
  // Full structure analysis with chapters and scenes
  async analyzeProjectStructure(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          message: 'Project ID is required'
        });
        return;
      }
      
      console.log(`🔍 Starting structure analysis for project: ${projectId} by user: ${userId}`);
      
      const analysis = await structureAnalysisService.analyzeProjectStructure(projectId, userId);
      
      res.json({
        message: 'Project structure analysis completed successfully',
        analysis
      });
    } catch (error) {
      console.error('Error in project structure analysis:', error);
      res.status(500).json({
        message: 'Server error while analyzing project structure',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Quick chapter suggestions without full analysis
  async getChapterSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { content, targetChapters } = req.body;
      
      if (!content) {
        res.status(400).json({
          message: 'Content is required for chapter analysis'
        });
        return;
      }
      
      console.log(`📚 Generating quick chapter suggestions for ${content.length} characters of content`);
      
      const suggestions = await structureAnalysisService.getQuickChapterSuggestions(
        content, 
        targetChapters ? parseInt(targetChapters) : undefined
      );
      
      res.json({
        message: 'Chapter suggestions generated successfully',
        suggestions: suggestions.suggestions,
        estimatedBreaks: suggestions.estimatedBreaks,
        contentWordCount: content.split(/\s+/).length,
        suggestedChapters: Math.max(3, Math.floor(content.split(/\s+/).length / 2500))
      });
    } catch (error) {
      console.error('Error generating chapter suggestions:', error);
      res.status(500).json({
        message: 'Server error while generating chapter suggestions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Analyze specific chapter content
  async analyzeChapter(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { content, chapterTitle, themes, characters } = req.body;
      
      if (!content) {
        res.status(400).json({
          message: 'Chapter content is required'
        });
        return;
      }
      
      console.log(`📖 Analyzing individual chapter: "${chapterTitle || 'Untitled'}"`);
      
      // Create a mock chapter object for analysis
      const mockChapter = {
        chapterNumber: 1,
        title: chapterTitle || 'Chapter Analysis',
        startPosition: 0,
        endPosition: content.split(/\s+/).length,
        content,
        themes: themes || ['general narrative'],
        characters: characters || ['main character'],
        plotPoints: ['story development'],
        wordCount: content.split(/\s+/).length,
        summary: 'Chapter content for analysis',
        scenes: []
      };
      
      // Use the private scene division method (we'll need to make it public or create a wrapper)
      // For now, let's create a simple analysis response
      const wordCount = content.split(/\s+/).length;
      const estimatedScenes = Math.min(4, Math.max(2, Math.floor(wordCount / 500)));
      
      const analysis = {
        wordCount,
        estimatedScenes,
        themes: themes || ['general narrative'],
        characters: characters || ['main character'],
        recommendations: [
          `This chapter contains ${wordCount} words`,
          `Consider dividing into ${estimatedScenes} scenes for better pacing`,
          'Ensure clear scene transitions',
          'Balance dialogue and narrative description',
          'Check for consistent character voice'
        ]
      };
      
      res.json({
        message: 'Chapter analysis completed successfully',
        analysis
      });
    } catch (error) {
      console.error('Error analyzing chapter:', error);
      res.status(500).json({
        message: 'Server error while analyzing chapter',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Get structure analytics summary for dashboard
  async getStructureSummary(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          message: 'Project ID is required'
        });
        return;
      }
      
      console.log(`📊 Getting structure summary for project: ${projectId}`);
      
      // Get basic project info for quick summary
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contexts: {
            where: { contextType: 'GENERAL' }
          }
        }
      });
      
      if (!project) {
        res.status(404).json({
          message: 'Project not found'
        });
        return;
      }
      
      const content = project.content || '';
      const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
      const context = project.contexts?.[0];
      
      const summary = {
        projectId: project.id,
        title: project.title,
        wordCount,
        estimatedReadingTime: Math.ceil(wordCount / 200), // Average reading speed
        suggestedChapters: Math.max(3, Math.floor(wordCount / 2500)),
        estimatedScenes: Math.max(6, Math.floor(wordCount / 800)),
        themes: context?.themes || [],
        characters: context?.characters || [],
        genre: context?.genre,
        writingStyle: context?.writingStyle,
        lastAnalyzed: context?.lastAnalyzed,
        recommendations: [
          wordCount < 50000 ? 'Consider expanding content for full-length novel' : 'Good length for novel format',
          wordCount > 100000 ? 'Consider splitting into multiple volumes' : 'Length is manageable for single volume',
          'Regular chapter divisions will improve readability',
          'Scene-level organization will enhance pacing'
        ]
      };
      
      res.json({
        message: 'Structure summary retrieved successfully',
        summary
      });
    } catch (error) {
      console.error('Error getting structure summary:', error);
      res.status(500).json({
        message: 'Server error while getting structure summary',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Compare structure across user's projects
  async compareProjectStructures(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      
      console.log(`📈 Comparing project structures for user: ${userId}`);
      
      const prisma = (global as any).prisma || require('@prisma/client');
      const projects = await prisma.project.findMany({
        where: { ownerId: userId },
        include: {
          contexts: {
            where: { contextType: 'GENERAL' }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10 // Compare up to 10 most recent projects
      });
      
      const comparison = projects.map((project: any) => {
        const content = project.content || '';
        const wordCount = content.split(/\s+/).filter((w: string) => w.length > 0).length;
        const context = project.contexts?.[0];
        
        return {
          projectId: project.id,
          title: project.title,
          wordCount,
          suggestedChapters: Math.max(3, Math.floor(wordCount / 2500)),
          themes: context?.themes || [],
          characters: context?.characters || [],
          genre: context?.genre,
          writingStyle: context?.writingStyle,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        };
      });
      
      // Generate insights
      const totalWords = comparison.reduce((sum: number, p: any) => sum + p.wordCount, 0);
      const avgWordsPerProject = totalWords / comparison.length;
      const mostCommonGenre = this.findMostCommon(comparison.map((p: any) => p.genre).filter(Boolean));
      const mostCommonThemes = this.findMostCommonThemes(comparison.flatMap((p: any) => p.themes));
      
      const insights = {
        totalProjects: comparison.length,
        totalWords,
        averageWordsPerProject: Math.round(avgWordsPerProject),
        mostCommonGenre,
        mostCommonThemes: mostCommonThemes.slice(0, 5),
        recommendations: [
          avgWordsPerProject < 20000 ? 'Consider developing longer form content' : 'Good project length consistency',
          mostCommonGenre ? `Strong focus on ${mostCommonGenre} genre` : 'Diverse genre exploration',
          'Consider exploring different narrative structures',
          'Maintain consistent writing style across projects'
        ]
      };
      
      res.json({
        message: 'Project structure comparison completed successfully',
        comparison,
        insights
      });
    } catch (error) {
      console.error('Error comparing project structures:', error);
      res.status(500).json({
        message: 'Server error while comparing project structures',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Helper method to find most common item in array
  private findMostCommon(arr: string[]): string | null {
    if (!arr.length) return null;
    
    const frequency: { [key: string]: number } = {};
    arr.forEach(item => {
      frequency[item] = (frequency[item] || 0) + 1;
    });
    
    return Object.entries(frequency).reduce((a, b) => 
      frequency[a[0]] > frequency[b[0]] ? a : b
    )[0];
  }
  
  // Helper method to find most common themes
  private findMostCommonThemes(themes: string[]): string[] {
    if (!themes.length) return [];
    
    const frequency: { [key: string]: number } = {};
    themes.forEach(theme => {
      frequency[theme] = (frequency[theme] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .map(([theme]) => theme);
  }
  
  // Enhanced project analytics with structure insights
  async getEnhancedProjectAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user!.id;
      const { projectId } = req.params;
      
      if (!projectId) {
        res.status(400).json({
          message: 'Project ID is required'
        });
        return;
      }
      
      console.log(`📊 Getting enhanced analytics for project: ${projectId}`);
      
      // Get project with RAG analytics and structure insights
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          ownerId: userId
        },
        include: {
          contexts: {
            where: { contextType: 'GENERAL' }
          }
        }
      });
      
      if (!project) {
        res.status(403).json({
          message: 'Project not found or access denied'
        });
        return;
      }
      
      const content = project.content || '';
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
      
      // Get existing RAG analytics
      const projectStats = await improvedRAGService.getProjectStats(projectId);
      const projectContext = project.contexts?.[0];
      
      // Calculate structure insights
      const structureInsights = {
        wordCount,
        estimatedReadingTime: Math.ceil(wordCount / 200),
        suggestedChapters: Math.max(3, Math.floor(wordCount / 2500)),
        estimatedScenes: Math.max(6, Math.floor(wordCount / 800)),
        paragraphCount: content.split(/\n\s*\n/).length,
        averageWordsPerParagraph: Math.round(wordCount / Math.max(content.split(/\n\s*\n/).length, 1))
      };
      
      const enhancedAnalytics = {
        projectInfo: {
          id: project.id,
          title: project.title,
          description: project.description,
          format: project.format,
          type: project.type
        },
        contentMetrics: structureInsights,
        storyElements: {
          characters: projectStats.characters || projectContext?.characters || [],
          themes: projectStats.themes || projectContext?.themes || [],
          plotElements: projectStats.plotElements || projectContext?.plotPoints || [],
          settings: projectContext?.settings || []
        },
        writingAnalysis: {
          genre: projectContext?.genre,
          writingStyle: projectContext?.writingStyle,
          toneAnalysis: projectContext?.toneAnalysis
        }
      };
      
      res.json({
        message: 'Enhanced project analytics retrieved successfully',
        analytics: enhancedAnalytics
      });
      
    } catch (error) {
      console.error('Error getting enhanced project analytics:', error);
      res.status(500).json({
        message: 'Server error while getting enhanced project analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new AnalyticsController();
