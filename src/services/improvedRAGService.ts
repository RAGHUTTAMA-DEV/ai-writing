import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PrismaClient } from '@prisma/client';
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

// Enhanced interfaces for better project context management
interface ProjectContext {
  projectId: string;
  title: string;
  genre?: string;
  characters?: string[];
  themes?: string[];
  plotPoints?: string[];
  settings?: string[];
  writingStyle?: string;
  toneAnalysis?: string;
  lastUpdated?: string;
  wordCount?: number;
  chapterCount?: number;
}

interface EnhancedDocument extends Document {
  metadata: {
    projectId: string;
    projectTitle?: string;
    userId?: string;
    contentType: 'narrative' | 'dialogue' | 'notes' | 'character' | 'plot' | 'setting' | 'theme';
    chunkIndex: number;
    totalChunks: number;
    timestamp: string;
    wordCount: number;
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
    importance: number; // 1-10 scale
    contextType?: string;
    [key: string]: any;
  };
}

interface SearchOptions {
  projectId?: string;
  userId?: string;
  contentTypes?: string[];
  themes?: string[];
  characters?: string[];
  timeRange?: { start: string; end: string };
  importance?: number;
  limit?: number;
  includeContext?: boolean;
}

class ImprovedRAGService {
  private vectorStore: MemoryVectorStore | null;
  private textSplitter: RecursiveCharacterTextSplitter | null;
  private embeddings: GoogleGenerativeAIEmbeddings | null;
  private persistencePath: string;
  private documents: EnhancedDocument[];
  private projectDocumentIndex: Map<string, Set<number>> = new Map(); // projectId -> document indices
  private semanticCache: Map<string, any> = new Map(); // Cache for expensive operations

  constructor() {
    this.persistencePath = path.join(__dirname, '../../data/improved_vector_store.json');
    this.documents = [];
    
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("No API key found for Google Generative AI. RAG features will not work.");
      this.embeddings = null;
      this.vectorStore = null;
      this.textSplitter = null;
      return;
    }
    
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      modelName: "embedding-001"
    });
    
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Enhanced text splitter with better semantic awareness
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: [
        "\\n\\n\\n", // Chapter breaks
        "\\n\\n",   // Paragraph breaks
        "\\n",     // Line breaks
        ". ",     // Sentence endings
        "! ",     // Exclamations
        "? ",     // Questions
        "; ",     // Semicolons
        ", ",     // Commas
        " ",      // Spaces
        ""        // Characters
      ],
    });
    
    this.loadPersistedData();
  }

  // Sync project context with database
  async syncProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contexts: true,
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (!project) {
        console.warn(`Project ${projectId} not found in database`);
        return null;
      }

      // Get or create general context
      let context = project.contexts.find(ctx => ctx.contextType === 'GENERAL');
      
      if (!context && project.content) {
        // Analyze project content and create context
        const analysis = await this.analyzeProjectContent(project.content);
        
        context = await prisma.projectContext.create({
          data: {
            projectId,
            contextType: 'GENERAL',
            title: project.title,
            themes: analysis.themes,
            characters: analysis.characters,
            plotPoints: analysis.plotPoints,
            settings: analysis.settings,
            writingStyle: analysis.writingStyle,
            toneAnalysis: analysis.toneAnalysis,
            wordCount: project.content.split(/\\s+/).filter(word => word.length > 0).length,
            lastAnalyzed: new Date(),
            metadata: {
              owner: `${project.owner.firstName} ${project.owner.lastName}`,
              format: project.format,
              type: project.type
            }
          }
        });
      }

      return context ? {
        projectId: context.projectId,
        title: context.title || project.title,
        genre: context.genre || undefined,
        characters: context.characters,
        themes: context.themes,
        plotPoints: context.plotPoints,
        settings: context.settings,
        writingStyle: context.writingStyle || undefined,
        toneAnalysis: context.toneAnalysis || undefined,
        lastUpdated: context.updatedAt.toISOString(),
        wordCount: context.wordCount,
        chapterCount: context.chapterCount
      } : null;
    } catch (error) {
      console.error('Error syncing project context:', error);
      return null;
    }
  }

  // Enhanced document addition with database integration
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.embeddings || !this.vectorStore || !this.textSplitter) {
      console.warn("RAG features are not available due to missing API key configuration.");
      return;
    }
    
    try {
      // Sync project context with database
      const projectContext = metadata.projectId ? await this.syncProjectContext(metadata.projectId) : null;
      
      // Perform deep content analysis
      const contentAnalysis = await this.analyzeContent(content, projectContext);
      
      // Enhanced metadata with semantic information
      const enhancedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        wordCount: content.split(/\\s+/).filter(word => word.length > 0).length,
        contentType: this.classifyContentType(content),
        characters: contentAnalysis.characters,
        themes: contentAnalysis.themes,
        emotions: contentAnalysis.emotions,
        plotElements: contentAnalysis.plotElements,
        semanticTags: contentAnalysis.semanticTags,
        importance: this.calculateImportance(content, contentAnalysis),
        projectContext: projectContext
      };

      // Create enhanced chunks with better context preservation
      const docs = await this.textSplitter.createDocuments([content], [enhancedMetadata]);
      
      const enhancedDocs: EnhancedDocument[] = docs.map((doc, index) => {
        const previousChunk = index > 0 ? docs[index - 1].pageContent.slice(-150) : "";
        const nextChunk = index < docs.length - 1 ? docs[index + 1].pageContent.slice(0, 150) : "";
        
        const finalMetadata = {
          ...enhancedMetadata,
          projectId: metadata.projectId || 'unknown',
          userId: metadata.userId,
          chunkIndex: index,
          totalChunks: docs.length,
          previousContext: previousChunk,
          nextContext: nextChunk,
          // Add cross-references to related chunks
          relatedChunks: this.findRelatedChunks(doc.pageContent, metadata.projectId || 'unknown'),
        };
        
        return new Document({
          pageContent: doc.pageContent,
          metadata: finalMetadata
        }) as EnhancedDocument;
      });
      
      // Add to vector store
      await this.vectorStore.addDocuments(enhancedDocs);
      
      // Update indices
      const startIndex = this.documents.length;
      this.documents.push(...enhancedDocs);
      
      // Update project document index
      const projectId = metadata.projectId;
      if (projectId) {
        if (!this.projectDocumentIndex.has(projectId)) {
          this.projectDocumentIndex.set(projectId, new Set());
        }
        const projectDocs = this.projectDocumentIndex.get(projectId)!;
        for (let i = 0; i < enhancedDocs.length; i++) {
          projectDocs.add(startIndex + i);
        }
      }
      
      // Update project context in database
      if (projectId) {
        await this.updateProjectContextInDB(projectId, contentAnalysis);
      }
      
      console.log(`Added ${enhancedDocs.length} enhanced document chunks for project ${projectId || 'unknown'}`);
      
      // Persist the data
      await this.persistData();
    } catch (error) {
      console.error("Error adding document to improved vector store:", error);
      throw error;
    }
  }

  // Intelligent search with advanced filtering and ranking
  async intelligentSearch(query: string, options: SearchOptions = {}): Promise<{
    results: EnhancedDocument[];
    projectInsights?: {
      relevantCharacters: string[];
      relevantThemes: string[];
      suggestedConnections: string[];
      contextualHints: string[];
    };
  }> {
    if (!this.embeddings || !this.vectorStore) {
      console.warn("RAG features are not available.");
      return { results: [] };
    }
    
    try {
      const {
        projectId,
        userId,
        contentTypes,
        themes,
        characters,
        timeRange,
        importance = 1,
        limit = 5,
        includeContext = true
      } = options;
      
      // Get initial similarity search results (more than needed for filtering)
      const initialLimit = Math.max(limit * 4, 20);
      const results = await this.vectorStore.similaritySearch(query, initialLimit);
      
      // Convert to enhanced documents
      let enhancedResults: EnhancedDocument[] = results.map(doc => doc as EnhancedDocument);
      
      // Apply intelligent filtering
      enhancedResults = this.applyIntelligentFiltering(enhancedResults, {
        projectId,
        userId,
        contentTypes,
        themes,
        characters,
        timeRange,
        importance,
        query
      });
      
      // Apply contextual ranking
      enhancedResults = this.applyContextualRanking(enhancedResults, query, projectId);
      
      // Include related context if requested
      if (includeContext) {
        enhancedResults = await this.enrichWithContext(enhancedResults);
      }
      
      const finalResults = enhancedResults.slice(0, limit);
      
      // Generate project insights if projectId is provided
      let projectInsights;
      if (projectId) {
        projectInsights = await this.generateProjectInsights(finalResults, projectId, query);
      }
      
      return {
        results: finalResults,
        projectInsights
      };
    } catch (error) {
      console.error("Error in intelligent search:", error);
      return { results: [] };
    }
  }

  // Generate comprehensive project insights
  private async generateProjectInsights(results: EnhancedDocument[], projectId: string, query: string): Promise<{
    relevantCharacters: string[];
    relevantThemes: string[];
    suggestedConnections: string[];
    contextualHints: string[];
  }> {
    const projectDocs = this.getProjectDocuments(projectId);
    const projectContext = await this.syncProjectContext(projectId);
    
    return {
      relevantCharacters: this.extractRelevantCharacters(results, query),
      relevantThemes: this.extractRelevantThemes(results, query),
      suggestedConnections: this.findSuggestedConnections(results, projectDocs),
      contextualHints: this.generateContextualHints(results, projectContext, query)
    };
  }

  // Advanced content analysis with AI assistance
  private async analyzeContent(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    // Use caching for expensive operations
    const cacheKey = `analysis_${this.hashContent(content)}_${projectContext?.projectId || 'none'}`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }
    
    const analysis = {
      characters: this.extractCharacters(content, projectContext),
      themes: this.extractThemes(content, projectContext),
      emotions: this.extractEmotions(content),
      plotElements: this.extractPlotElements(content),
      semanticTags: this.generateSemanticTags(content)
    };
    
    this.semanticCache.set(cacheKey, analysis);
    return analysis;
  }

  // Analyze project content for context creation
  private async analyzeProjectContent(content: string): Promise<{
    themes: string[];
    characters: string[];
    plotPoints: string[];
    settings: string[];
    writingStyle: string;
    toneAnalysis: string;
  }> {
    const analysis = await this.analyzeContent(content);
    
    return {
      themes: analysis.themes,
      characters: analysis.characters,
      plotPoints: analysis.plotElements,
      settings: this.extractSettings(content),
      writingStyle: this.analyzeWritingStyle(content),
      toneAnalysis: this.analyzeTone(content)
    };
  }

  // Enhanced character extraction with project context
  private extractCharacters(content: string, projectContext?: ProjectContext | null): string[] {
    const words = content.split(/\\s+/);
    const potentialNames = words.filter(word => 
      /^[A-Z][a-z]{2,}$/.test(word) && 
      !this.isCommonWord(word) &&
      !this.isLocationWord(word)
    );
    
    // Include known characters from project context
    const knownCharacters = new Set(projectContext?.characters || []);
    
    // Count frequency and context
    const nameFrequency: Record<string, { count: number; contexts: string[] }> = {};
    
    potentialNames.forEach((name, index) => {
      if (!nameFrequency[name]) {
        nameFrequency[name] = { count: 0, contexts: [] };
      }
      nameFrequency[name].count++;
      
      // Get context around the name
      const start = Math.max(0, index - 3);
      const end = Math.min(words.length, index + 4);
      const context = words.slice(start, end).join(' ');
      nameFrequency[name].contexts.push(context);
    });
    
    // Filter based on frequency and context patterns
    const extractedCharacters = Object.entries(nameFrequency)
      .filter(([name, data]) => {
        // Lower threshold for known characters
        const threshold = knownCharacters.has(name) ? 1 : 2;
        if (data.count < threshold) return false;
        
        // Check if used in character-like contexts
        const hasCharacterContext = data.contexts.some(context => 
          /\\b(said|asked|replied|thought|felt|walked|ran|looked)\\b/i.test(context) ||
          /\\b(he|she|his|her|him)\\b/i.test(context)
        );
        
        return hasCharacterContext || knownCharacters.has(name);
      })
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name]) => name);

    // Merge with known characters
    const allCharacters = new Set([...extractedCharacters, ...knownCharacters]);
    return Array.from(allCharacters).slice(0, 15);
  }

  // Enhanced theme extraction with project context
  private extractThemes(content: string, projectContext?: ProjectContext | null): string[] {
    const themePatterns = {
      'love': {
        keywords: ['love', 'romance', 'heart', 'affection', 'passion', 'devotion', 'adore'],
        patterns: [/\\blove\\w*\\b/gi, /\\bheart\\w*\\b/gi, /\\bromance\\b/gi]
      },
      'betrayal': {
        keywords: ['betray', 'deceive', 'lie', 'cheat', 'backstab', 'treachery', 'unfaithful'],
        patterns: [/\\bbetray\\w*\\b/gi, /\\bdeceiv\\w*\\b/gi, /\\blie\\b/gi]
      },
      'redemption': {
        keywords: ['redeem', 'forgive', 'atone', 'salvation', 'second chance', 'forgiveness'],
        patterns: [/\\bredeem\\w*\\b/gi, /\\bforgiv\\w*\\b/gi, /\\batone\\w*\\b/gi]
      },
      'power': {
        keywords: ['power', 'control', 'authority', 'dominance', 'rule', 'command', 'influence'],
        patterns: [/\\bpower\\w*\\b/gi, /\\bcontrol\\w*\\b/gi, /\\brule\\w*\\b/gi]
      },
      'friendship': {
        keywords: ['friend', 'companion', 'ally', 'bond', 'loyalty', 'trust', 'support'],
        patterns: [/\\bfriend\\w*\\b/gi, /\\bally\\b/gi, /\\bloyal\\w*\\b/gi]
      },
      'family': {
        keywords: ['family', 'mother', 'father', 'sibling', 'parent', 'child', 'brother', 'sister'],
        patterns: [/\\bfamily\\b/gi, /\\bmother\\b/gi, /\\bfather\\b/gi, /\\bparent\\w*\\b/gi]
      },
      'sacrifice': {
        keywords: ['sacrifice', 'give up', 'surrender', 'forfeit', 'selfless', 'noble'],
        patterns: [/\\bsacrifice\\w*\\b/gi, /\\bgive\\s+up\\b/gi, /\\bselfless\\b/gi]
      },
      'coming-of-age': {
        keywords: ['grow', 'mature', 'learn', 'discover', 'realize', 'understand', 'change'],
        patterns: [/\\bgrow\\w*\\b/gi, /\\bmature\\w*\\b/gi, /\\bdiscover\\w*\\b/gi]
      },
      'good-vs-evil': {
        keywords: ['good', 'evil', 'right', 'wrong', 'moral', 'virtue', 'sin', 'justice'],
        patterns: [/\\bgood\\b/gi, /\\bevil\\b/gi, /\\bright\\b/gi, /\\bwrong\\b/gi]
      },
      'death': {
        keywords: ['death', 'die', 'dead', 'mortality', 'funeral', 'grave', 'loss'],
        patterns: [/\\bdeath\\b/gi, /\\bdie\\w*\\b/gi, /\\bdead\\b/gi, /\\bmortality\\b/gi]
      }
    };
    
    const lowerContent = content.toLowerCase();
    const detectedThemes: Array<{ theme: string; score: number }> = [];
    
    // Include known themes from project context
    const knownThemes = new Set(projectContext?.themes || []);
    
    Object.entries(themePatterns).forEach(([theme, config]) => {
      let score = 0;
      
      // Check keywords
      config.keywords.forEach(keyword => {
        const matches = (lowerContent.match(new RegExp(`\\\\b${keyword}\\\\b`, 'g')) || []).length;
        score += matches;
      });
      
      // Check patterns
      config.patterns.forEach(pattern => {
        const matches = (content.match(pattern) || []).length;
        score += matches * 1.5; // Patterns get higher weight
      });
      
      // Boost score for known themes
      if (knownThemes.has(theme)) {
        score += 2;
      }
      
      if (score > 0) {
        detectedThemes.push({ theme, score });
      }
    });
    
    const extractedThemes = detectedThemes
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.theme);

    // Merge with known themes
    const allThemes = new Set([...extractedThemes, ...knownThemes]);
    return Array.from(allThemes).slice(0, 8);
  }

  // Extract settings/locations from content
  private extractSettings(content: string): string[] {
    const locationPatterns = [
      /\\b[A-Z][a-z]+ (?:City|Town|Village|Kingdom|Empire|Forest|Mountain|Desert|Ocean|Lake|River|Castle|Palace|Temple|School|Hospital|Library|Restaurant|Bar|Hotel|House|Apartment|Office|Shop|Market)\\b/g,
      /\\b(?:the )?[A-Z][a-z]+ (?:of [A-Z][a-z]+)?\\b/g
    ];
    
    const settings = new Set<string>();
    
    locationPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      matches.forEach(match => {
        if (match.length > 3 && match.length < 50) {
          settings.add(match.trim());
        }
      });
    });
    
    return Array.from(settings).slice(0, 10);
  }

  // Analyze writing style
  private analyzeWritingStyle(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / sentences.length;
    const wordCount = content.split(/\\s+/).length;
    const avgWordsPerSentence = wordCount / sentences.length;
    
    let style = "";
    
    if (avgWordsPerSentence < 10) {
      style += "concise, ";
    } else if (avgWordsPerSentence > 20) {
      style += "elaborate, ";
    }
    
    const dialogueCount = (content.match(/"/g) || []).length;
    const dialogueRatio = dialogueCount / content.length;
    
    if (dialogueRatio > 0.1) {
      style += "dialogue-heavy, ";
    }
    
    const descriptiveWords = content.match(/\\b(beautiful|dark|bright|ancient|mysterious|elegant|graceful|powerful)\\b/gi);
    if (descriptiveWords && descriptiveWords.length > wordCount * 0.02) {
      style += "descriptive, ";
    }
    
    return style.slice(0, -2) || "narrative";
  }

  // Analyze tone of content
  private analyzeTone(content: string): string {
    const lowerContent = content.toLowerCase();
    
    const toneIndicators = {
      'dark': ['death', 'shadow', 'fear', 'horror', 'nightmare', 'evil', 'despair'],
      'romantic': ['love', 'heart', 'kiss', 'embrace', 'passion', 'tender', 'devotion'],
      'humorous': ['laugh', 'funny', 'joke', 'smile', 'amusing', 'witty', 'chuckle'],
      'mysterious': ['mystery', 'secret', 'hidden', 'unknown', 'strange', 'enigmatic'],
      'dramatic': ['dramatic', 'intense', 'powerful', 'overwhelming', 'climactic'],
      'melancholic': ['sad', 'sorrow', 'grief', 'melancholy', 'lonely', 'wistful'],
      'hopeful': ['hope', 'bright', 'future', 'dream', 'possibility', 'optimistic']
    };
    
    let bestMatch = { tone: 'neutral', score: 0 };
    
    Object.entries(toneIndicators).forEach(([tone, indicators]) => {
      const matches = indicators.filter(indicator => lowerContent.includes(indicator));
      if (matches.length > bestMatch.score) {
        bestMatch = { tone, score: matches.length };
      }
    });
    
    return bestMatch.tone;
  }

  // Extract emotional content
  private extractEmotions(content: string): string[] {
    const emotionPatterns = {
      'joy': ['happy', 'joy', 'delight', 'elated', 'cheerful', 'blissful', 'ecstatic'],
      'sadness': ['sad', 'sorrow', 'grief', 'melancholy', 'despair', 'mourn', 'weep'],
      'anger': ['angry', 'rage', 'fury', 'wrath', 'irritated', 'furious', 'livid'],
      'fear': ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'panic', 'dread'],
      'surprise': ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'bewildered'],
      'disgust': ['disgusted', 'revolted', 'repulsed', 'sickened', 'appalled'],
      'anticipation': ['excited', 'eager', 'hopeful', 'expectant', 'anticipating']
    };
    
    const lowerContent = content.toLowerCase();
    const detectedEmotions: string[] = [];
    
    Object.entries(emotionPatterns).forEach(([emotion, keywords]) => {
      const hasEmotion = keywords.some(keyword => 
        lowerContent.includes(keyword.toLowerCase())
      );
      if (hasEmotion) {
        detectedEmotions.push(emotion);
      }
    });
    
    return detectedEmotions;
  }

  // Extract plot elements
  private extractPlotElements(content: string): string[] {
    const plotPatterns = {
      'conflict': ['conflict', 'fight', 'battle', 'struggle', 'oppose', 'against'],
      'resolution': ['resolved', 'solved', 'concluded', 'ended', 'finished', 'settled'],
      'revelation': ['revealed', 'discovered', 'found out', 'realized', 'uncovered'],
      'turning_point': ['suddenly', 'then', 'however', 'but then', 'unexpectedly'],
      'climax': ['climax', 'peak', 'crucial', 'critical moment', 'decisive'],
      'setup': ['began', 'started', 'introduced', 'first', 'initially']
    };
    
    const lowerContent = content.toLowerCase();
    const detectedElements: string[] = [];
    
    Object.entries(plotPatterns).forEach(([element, keywords]) => {
      const hasElement = keywords.some(keyword => 
        lowerContent.includes(keyword.toLowerCase())
      );
      if (hasElement) {
        detectedElements.push(element);
      }
    });
    
    return detectedElements;
  }

  // Generate semantic tags
  private generateSemanticTags(content: string): string[] {
    const tags: string[] = [];
    
    // Content length tags
    const wordCount = content.split(/\\s+/).length;
    if (wordCount < 50) tags.push('short');
    else if (wordCount < 200) tags.push('medium');
    else tags.push('long');
    
    // Dialogue detection
    if (content.includes('"') && content.includes(':')) {
      tags.push('dialogue-heavy');
    }
    
    // Action detection
    const actionWords = ['ran', 'jumped', 'fought', 'moved', 'rushed', 'grabbed', 'threw'];
    if (actionWords.some(word => content.toLowerCase().includes(word))) {
      tags.push('action');
    }
    
    // Description detection
    const descriptiveWords = ['beautiful', 'dark', 'bright', 'tall', 'small', 'ancient', 'mysterious'];
    if (descriptiveWords.some(word => content.toLowerCase().includes(word))) {
      tags.push('descriptive');
    }
    
    // Time indicators
    const timeWords = ['morning', 'evening', 'night', 'day', 'yesterday', 'tomorrow', 'later'];
    if (timeWords.some(word => content.toLowerCase().includes(word))) {
      tags.push('time-specific');
    }
    
    return tags;
  }

  // Content type classification
  private classifyContentType(content: string): 'narrative' | 'dialogue' | 'notes' | 'character' | 'plot' | 'setting' | 'theme' {
    const lowerContent = content.toLowerCase();
    
    // Check for dialogue
    if (content.includes('"') && content.includes(':')) {
      return 'dialogue';
    }
    
    // Check for notes
    if (lowerContent.includes('note:') || lowerContent.includes('todo:') || lowerContent.includes('remember:')) {
      return 'notes';
    }
    
    // Check for character descriptions
    if (lowerContent.includes('character') || /\\b(he|she|his|her|him)\\s+(is|was|has|had)\\b/i.test(content)) {
      return 'character';
    }
    
    // Check for plot elements
    if (lowerContent.includes('plot') || lowerContent.includes('story') || lowerContent.includes('chapter')) {
      return 'plot';
    }
    
    // Check for setting descriptions
    if (lowerContent.includes('setting') || lowerContent.includes('location') || lowerContent.includes('place')) {
      return 'setting';
    }
    
    // Check for theme discussions
    if (lowerContent.includes('theme') || lowerContent.includes('meaning') || lowerContent.includes('symbolism')) {
      return 'theme';
    }
    
    // Default to narrative
    return 'narrative';
  }

  // Calculate content importance
  private calculateImportance(content: string, analysis: any): number {
    let importance = 5; // Base importance
    
    // Boost for character mentions
    importance += Math.min(analysis.characters.length * 0.5, 2);
    
    // Boost for theme richness
    importance += Math.min(analysis.themes.length * 0.3, 1.5);
    
    // Boost for plot elements
    importance += Math.min(analysis.plotElements.length * 0.4, 2);
    
    // Boost for emotional content
    importance += Math.min(analysis.emotions.length * 0.2, 1);
    
    // Boost for dialogue
    if (content.includes('"')) importance += 0.5;
    
    // Boost for action
    if (analysis.semanticTags.includes('action')) importance += 0.5;
    
    return Math.min(Math.max(importance, 1), 10);
  }

  // Update project context in database
  private async updateProjectContextInDB(projectId: string, analysis: any): Promise<void> {
    try {
      const existingContext = await prisma.projectContext.findUnique({
        where: {
          projectId_contextType: {
            projectId,
            contextType: 'GENERAL'
          }
        }
      });

      if (existingContext) {
        // Merge characters and themes
        const allCharacters = new Set([...(existingContext.characters || []), ...analysis.characters]);
        const allThemes = new Set([...(existingContext.themes || []), ...analysis.themes]);
        
        await prisma.projectContext.update({
          where: {
            id: existingContext.id
          },
          data: {
            characters: Array.from(allCharacters).slice(0, 20),
            themes: Array.from(allThemes).slice(0, 10),
            lastAnalyzed: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error updating project context in database:', error);
    }
  }

  // Apply intelligent filtering
  private applyIntelligentFiltering(results: EnhancedDocument[], filters: any): EnhancedDocument[] {
    return results.filter(doc => {
      // Project filter
      if (filters.projectId && doc.metadata.projectId !== filters.projectId) {
        return false;
      }

      // User filter
      if (filters.userId && doc.metadata.userId !== filters.userId) {
        return false;
      }
      
      // Content type filter
      if (filters.contentTypes && !filters.contentTypes.includes(doc.metadata.contentType)) {
        return false;
      }
      
      // Theme filter
      if (filters.themes && !filters.themes.some((theme: string) => 
        doc.metadata.themes.includes(theme))) {
        return false;
      }
      
      // Character filter
      if (filters.characters && !filters.characters.some((char: string) => 
        doc.metadata.characters.includes(char))) {
        return false;
      }
      
      // Importance filter
      if (filters.importance && doc.metadata.importance < filters.importance) {
        return false;
      }
      
      // Time range filter
      if (filters.timeRange) {
        const docTime = new Date(doc.metadata.timestamp);
        const start = new Date(filters.timeRange.start);
        const end = new Date(filters.timeRange.end);
        if (docTime < start || docTime > end) {
          return false;
        }
      }
      
      return true;
    });
  }

  // Apply contextual ranking
  private applyContextualRanking(results: EnhancedDocument[], query: string, projectId?: string): EnhancedDocument[] {
    const queryLower = query.toLowerCase();
    
    return results.map(doc => {
      let relevanceScore = 1.0;
      
      // Boost for same project
      if (projectId && doc.metadata.projectId === projectId) {
        relevanceScore *= 1.8;
      }
      
      // Boost for matching themes
      if (doc.metadata.themes) {
        const matchingThemes = doc.metadata.themes.filter((theme: string) => 
          queryLower.includes(theme.toLowerCase())
        );
        relevanceScore *= (1 + matchingThemes.length * 0.3);
      }
      
      // Boost for matching characters
      if (doc.metadata.characters) {
        const matchingCharacters = doc.metadata.characters.filter((char: string) => 
          queryLower.includes(char.toLowerCase())
        );
        relevanceScore *= (1 + matchingCharacters.length * 0.4);
      }
      
      // Boost for importance
      relevanceScore *= (1 + (doc.metadata.importance - 5) * 0.1);
      
      // Boost for content type relevance
      if (queryLower.includes('character') && doc.metadata.contentType === 'character') {
        relevanceScore *= 1.5;
      }
      if (queryLower.includes('plot') && doc.metadata.contentType === 'plot') {
        relevanceScore *= 1.5;
      }
      
      return { ...doc, relevanceScore };
    }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
  }

  // Enrich results with context
  private async enrichWithContext(results: EnhancedDocument[]): Promise<EnhancedDocument[]> {
    return results.map(doc => {
      // Add related chunks information
      const relatedChunks = this.findRelatedChunks(doc.pageContent, doc.metadata.projectId);
      
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          relatedChunks,
          contextualInfo: this.generateContextualInfo(doc)
        }
      };
    });
  }

  // Find related chunks
  private findRelatedChunks(content: string, projectId: string): string[] {
    if (!projectId) return [];
    
    const projectDocs = this.getProjectDocuments(projectId);
    const contentWords = new Set(content.toLowerCase().split(/\\s+/));
    
    return projectDocs
      .filter(doc => doc.pageContent !== content)
      .map(doc => {
        const docWords = new Set(doc.pageContent.toLowerCase().split(/\\s+/));
        const intersection = new Set([...contentWords].filter(x => docWords.has(x)));
        const similarity = intersection.size / Math.min(contentWords.size, docWords.size);
        
        return { doc, similarity };
      })
      .filter(item => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.doc.pageContent.slice(0, 100) + '...');
  }

  // Generate contextual information
  private generateContextualInfo(doc: EnhancedDocument): any {
    return {
      summary: doc.pageContent.slice(0, 150) + '...',
      keyElements: {
        characters: doc.metadata.characters.slice(0, 3),
        themes: doc.metadata.themes.slice(0, 2),
        emotions: doc.metadata.emotions.slice(0, 2)
      },
      position: `Chunk ${doc.metadata.chunkIndex + 1} of ${doc.metadata.totalChunks}`,
      importance: doc.metadata.importance
    };
  }

  // Helper methods
  private getProjectDocuments(projectId: string): EnhancedDocument[] {
    const indices = this.projectDocumentIndex.get(projectId);
    if (!indices) return [];
    
    return Array.from(indices).map(index => this.documents[index]).filter(Boolean);
  }

  private extractRelevantCharacters(results: EnhancedDocument[], query: string): string[] {
    const characters = new Set<string>();
    results.forEach(doc => {
      doc.metadata.characters.forEach((char: string) => characters.add(char));
    });
    return Array.from(characters).slice(0, 5);
  }

  private extractRelevantThemes(results: EnhancedDocument[], query: string): string[] {
    const themes = new Set<string>();
    results.forEach(doc => {
      doc.metadata.themes.forEach((theme: string) => themes.add(theme));
    });
    return Array.from(themes).slice(0, 5);
  }

  private findSuggestedConnections(results: EnhancedDocument[], projectDocs: EnhancedDocument[]): string[] {
    // Find potential connections between search results and other project content
    const connections: string[] = [];
    
    results.forEach(result => {
      const relatedDocs = projectDocs.filter(doc => 
        doc.metadata.characters.some((char: string) => 
          result.metadata.characters.includes(char)
        ) && doc.pageContent !== result.pageContent
      );
      
      relatedDocs.slice(0, 2).forEach(doc => {
        connections.push(`Related to: ${doc.pageContent.slice(0, 80)}...`);
      });
    });
    
    return connections.slice(0, 3);
  }

  private generateContextualHints(results: EnhancedDocument[], projectContext: ProjectContext | null, query: string): string[] {
    const hints: string[] = [];
    
    if (projectContext) {
      // Suggest exploring related themes
      const projectThemes = projectContext.themes || [];
      const resultThemes = new Set<string>();
      results.forEach(doc => {
        doc.metadata.themes.forEach((theme: string) => resultThemes.add(theme));
      });
      
      const unexploredThemes = projectThemes.filter(theme => !resultThemes.has(theme));
      if (unexploredThemes.length > 0) {
        hints.push(`Consider exploring: ${unexploredThemes.slice(0, 2).join(', ')}`);
      }
      
      // Suggest character development
      const projectCharacters = projectContext.characters || [];
      const resultCharacters = new Set<string>();
      results.forEach(doc => {
        doc.metadata.characters.forEach((char: string) => resultCharacters.add(char));
      });
      
      const unexploredCharacters = projectCharacters.filter(char => !resultCharacters.has(char));
      if (unexploredCharacters.length > 0) {
        hints.push(`Character development opportunity: ${unexploredCharacters.slice(0, 2).join(', ')}`);
      }
    }
    
    return hints.slice(0, 3);
  }

  // Helper methods for text analysis
  private isCommonWord(word: string): boolean {
    const commonWords = new Set([
      'The', 'And', 'But', 'For', 'Nor', 'Or', 'So', 'Yet', 'This', 'That', 
      'These', 'Those', 'When', 'Where', 'Why', 'How', 'What', 'Who', 'Which',
      'Then', 'Now', 'Here', 'There', 'Today', 'Tomorrow', 'Yesterday'
    ]);
    return commonWords.has(word);
  }

  private isLocationWord(word: string): boolean {
    const locationWords = new Set([
      'City', 'Town', 'Village', 'Country', 'State', 'Street', 'Road', 'Avenue',
      'Park', 'School', 'Hospital', 'Church', 'Store', 'Restaurant', 'Hotel'
    ]);
    return locationWords.has(word);
  }

  private hashContent(content: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Persistence methods
  private async persistData(): Promise<void> {
    try {
      const data = {
        documents: this.documents.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata
        })),
        timestamp: new Date().toISOString(),
        version: "4.0"
      };
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Create backup of existing data
      if (fs.existsSync(this.persistencePath)) {
        const backupPath = this.persistencePath.replace('.json', `.backup.${Date.now()}.json`);
        fs.copyFileSync(this.persistencePath, backupPath);
      }
      
      // Write to file
      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
      console.log(`Improved RAG data persisted to ${this.persistencePath}`);
    } catch (error) {
      console.error("Error persisting improved RAG data:", error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      if (fs.existsSync(this.persistencePath) && this.vectorStore && this.embeddings) {
        const fileContent = fs.readFileSync(this.persistencePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Convert persisted data back to Document objects
        this.documents = data.documents.map((doc: any) => 
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata
          }) as EnhancedDocument
        );
        
        // Rebuild project document index
        this.documents.forEach((doc, index) => {
          const projectId = doc.metadata.projectId;
          if (projectId) {
            if (!this.projectDocumentIndex.has(projectId)) {
              this.projectDocumentIndex.set(projectId, new Set());
            }
            this.projectDocumentIndex.get(projectId)!.add(index);
          }
        });
        
        // Add documents to vector store
        if (this.documents.length > 0 && this.vectorStore) {
          await this.vectorStore.addDocuments(this.documents);
          console.log(`Loaded ${this.documents.length} improved documents from persisted data`);
        }
        
        console.log(`Improved RAG system loaded from ${this.persistencePath} (version: ${data.version || '1.0'})`);
      }
    } catch (error) {
      console.error("Error loading persisted improved RAG data:", error);
    }
  }

  // Get comprehensive project statistics
  async getProjectStats(projectId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    characters: string[];
    themes: string[];
    contentTypes: string[];
    emotions: string[];
    plotElements: string[];
    averageImportance: number;
    lastUpdated: string;
    wordCount: number;
  }> {
    const projectDocs = this.getProjectDocuments(projectId);
    
    const characters = new Set<string>();
    const themes = new Set<string>();
    const contentTypes = new Set<string>();
    const emotions = new Set<string>();
    const plotElements = new Set<string>();
    let totalImportance = 0;
    let totalWordCount = 0;
    let lastUpdated = "";
    
    projectDocs.forEach(doc => {
      doc.metadata.characters?.forEach((char: string) => characters.add(char));
      doc.metadata.themes?.forEach((theme: string) => themes.add(theme));
      doc.metadata.emotions?.forEach((emotion: string) => emotions.add(emotion));
      doc.metadata.plotElements?.forEach((element: string) => plotElements.add(element));
      
      if (doc.metadata.contentType) {
        contentTypes.add(doc.metadata.contentType);
      }
      
      totalImportance += doc.metadata.importance || 5;
      totalWordCount += doc.metadata.wordCount || 0;
      
      if (doc.metadata.timestamp && doc.metadata.timestamp > lastUpdated) {
        lastUpdated = doc.metadata.timestamp;
      }
    });
    
    return {
      totalDocuments: new Set(projectDocs.map(doc => doc.metadata.documentId || doc.metadata.projectId)).size,
      totalChunks: projectDocs.length,
      characters: Array.from(characters),
      themes: Array.from(themes),
      contentTypes: Array.from(contentTypes),
      emotions: Array.from(emotions),
      plotElements: Array.from(plotElements),
      averageImportance: projectDocs.length > 0 ? totalImportance / projectDocs.length : 0,
      lastUpdated,
      wordCount: totalWordCount
    };
  }

  // Delete project documents
  async deleteProjectDocuments(projectId: string): Promise<void> {
    // Remove from project document index
    this.projectDocumentIndex.delete(projectId);
    
    // Filter out documents from the specified project
    this.documents = this.documents.filter(doc => doc.metadata.projectId !== projectId);
    
    // Recreate vector store without the deleted documents
    if (this.vectorStore && this.embeddings && this.documents.length > 0) {
      this.vectorStore = new MemoryVectorStore(this.embeddings);
      await this.vectorStore.addDocuments(this.documents);
    }
    
    // Clear semantic cache
    this.semanticCache.clear();
    
    // Persist the updated data
    await this.persistData();
    
    console.log(`Deleted all documents for project ${projectId}`);
  }
}

// Create a singleton instance
const improvedRAGService = new ImprovedRAGService();

export default improvedRAGService;
export { ImprovedRAGService, ProjectContext, EnhancedDocument, SearchOptions };
