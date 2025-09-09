import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import fs from "fs";
import path from "path";

// Enhanced interfaces for better project context management
interface ProjectContext {
  projectId: string;
  title: string;
  genre?: string;
  characters?: string[];
  themes?: string[];
  plotPoints?: string[];
  writingStyle?: string;
  lastUpdated?: string;
  wordCount?: number;
  chapterCount?: number;
}

interface EnhancedDocument extends Document {
  metadata: {
    projectId: string;
    projectTitle?: string;
    ownerId?: string;
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
    [key: string]: any;
  };
}

interface PersistedData {
  documents: Array<{
    pageContent: string;
    metadata: Record<string, any>;
  }>;
  projectContexts: Record<string, ProjectContext>;
  timestamp: string;
  version: string;
}

interface SearchOptions {
  projectId?: string;
  contentTypes?: string[];
  themes?: string[];
  characters?: string[];
  timeRange?: { start: string; end: string };
  importance?: number;
  limit?: number;
  includeContext?: boolean;
}

class EnhancedRAGService {
  private vectorStore: MemoryVectorStore | null;
  private textSplitter: RecursiveCharacterTextSplitter | null;
  private embeddings: GoogleGenerativeAIEmbeddings | null;
  private persistencePath: string;
  private documents: EnhancedDocument[];
  private projectContexts: Map<string, ProjectContext> = new Map();
  private projectDocumentIndex: Map<string, Set<number>> = new Map(); // projectId -> document indices
  private semanticCache: Map<string, any> = new Map(); // Cache for expensive operations

  constructor() {
    this.persistencePath = path.join(__dirname, '../../data/enhanced_vector_store.json');
    this.documents = [];
    
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("No API key found for Google Generative AI. Enhanced RAG features will not work.");
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
        "\n\n\n", // Chapter breaks
        "\n\n",   // Paragraph breaks
        "\n",     // Line breaks
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

  // Enhanced project context management
  async setProjectContext(projectId: string, context: Partial<ProjectContext>): Promise<void> {
    const existingContext = this.projectContexts.get(projectId) || { projectId, title: 'Unknown Project' };
    const updatedContext: ProjectContext = {
      ...existingContext,
      ...context,
      lastUpdated: new Date().toISOString()
    };
    
    this.projectContexts.set(projectId, updatedContext);
    await this.persistData();
  }

  getProjectContext(projectId: string): ProjectContext | null {
    return this.projectContexts.get(projectId) || null;
  }

  // Enhanced document addition with deep semantic analysis
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.embeddings || !this.vectorStore || !this.textSplitter) {
      console.warn("Enhanced RAG features are not available due to missing API key configuration.");
      return;
    }
    
    try {
      // Perform deep content analysis
      const contentAnalysis = await this.analyzeContent(content);
      
      // Enhanced metadata with semantic information
      const enhancedMetadata = {
        ...metadata,
        timestamp: new Date().toISOString(),
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
        contentType: this.classifyContentType(content),
        characters: contentAnalysis.characters,
        themes: contentAnalysis.themes,
        emotions: contentAnalysis.emotions,
        plotElements: contentAnalysis.plotElements,
        semanticTags: contentAnalysis.semanticTags,
        importance: this.calculateImportance(content, contentAnalysis),
      };

      // Create enhanced chunks with better context preservation
      const docs = await this.textSplitter.createDocuments([content], [enhancedMetadata]);
      
      const enhancedDocs: EnhancedDocument[] = docs.map((doc, index) => {
        const previousChunk = index > 0 ? docs[index - 1].pageContent.slice(-150) : "";
        const nextChunk = index < docs.length - 1 ? docs[index + 1].pageContent.slice(0, 150) : "";
        
        const finalMetadata = {
          ...enhancedMetadata,
          projectId: metadata.projectId || 'unknown',
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
      
      // Update project context
      if (projectId) {
        await this.updateProjectContextFromContent(projectId, contentAnalysis);
      }
      
      console.log(`Added ${enhancedDocs.length} enhanced document chunks for project ${projectId || 'unknown'}`);
      
      // Persist the data
      await this.persistData();
    } catch (error) {
      console.error("Error adding document to enhanced vector store:", error);
      throw error;
    }
  }

  // Intelligent search with advanced filtering and ranking
  async intelligentSearch(query: string, options: SearchOptions = {}): Promise<EnhancedDocument[]> {
    if (!this.embeddings || !this.vectorStore) {
      console.warn("Enhanced RAG features are not available.");
      return [];
    }
    
    try {
      const {
        projectId,
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
      
      return enhancedResults.slice(0, limit);
    } catch (error) {
      console.error("Error in intelligent search:", error);
      throw error;
    }
  }

  // Project-specific search with deep understanding
  async searchProjectContext(projectId: string, query: string, limit: number = 5): Promise<{
    results: EnhancedDocument[];
    projectInsights: {
      relevantCharacters: string[];
      relevantThemes: string[];
      suggestedConnections: string[];
      contextualHints: string[];
    };
  }> {
    const results = await this.intelligentSearch(query, { projectId, limit: limit * 2 });
    
    // Generate project insights
    const projectContext = this.getProjectContext(projectId);
    const projectDocs = this.getProjectDocuments(projectId);
    
    const insights = {
      relevantCharacters: this.extractRelevantCharacters(results, query),
      relevantThemes: this.extractRelevantThemes(results, query),
      suggestedConnections: this.findSuggestedConnections(results, projectDocs),
      contextualHints: this.generateContextualHints(results, projectContext, query)
    };
    
    return {
      results: results.slice(0, limit),
      projectInsights: insights
    };
  }

  // Advanced content analysis
  private async analyzeContent(content: string): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    // Use caching for expensive operations
    const cacheKey = `analysis_${this.hashContent(content)}`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }
    
    const analysis = {
      characters: this.extractCharacters(content),
      themes: this.extractThemes(content),
      emotions: this.extractEmotions(content),
      plotElements: this.extractPlotElements(content),
      semanticTags: this.generateSemanticTags(content)
    };
    
    this.semanticCache.set(cacheKey, analysis);
    return analysis;
  }

  // Enhanced character extraction
  private extractCharacters(content: string): string[] {
    const words = content.split(/\s+/);
    const potentialNames = words.filter(word => 
      /^[A-Z][a-z]{2,}$/.test(word) && 
      !this.isCommonWord(word) &&
      !this.isLocationWord(word)
    );
    
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
    return Object.entries(nameFrequency)
      .filter(([name, data]) => {
        if (data.count < 2) return false;
        
        // Check if used in character-like contexts
        const hasCharacterContext = data.contexts.some(context => 
          /\b(said|asked|replied|thought|felt|walked|ran|looked)\b/i.test(context) ||
          /\b(he|she|his|her|him)\b/i.test(context)
        );
        
        return hasCharacterContext;
      })
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name]) => name);
  }

  // Enhanced theme extraction
  private extractThemes(content: string): string[] {
    const themePatterns = {
      'love': {
        keywords: ['love', 'romance', 'heart', 'affection', 'passion', 'devotion', 'adore'],
        patterns: [/\blove\w*\b/gi, /\bheart\w*\b/gi, /\bromance\b/gi]
      },
      'betrayal': {
        keywords: ['betray', 'deceive', 'lie', 'cheat', 'backstab', 'treachery', 'unfaithful'],
        patterns: [/\bbetray\w*\b/gi, /\bdeceiv\w*\b/gi, /\blie\b/gi]
      },
      'redemption': {
        keywords: ['redeem', 'forgive', 'atone', 'salvation', 'second chance', 'forgiveness'],
        patterns: [/\bredeem\w*\b/gi, /\bforgiv\w*\b/gi, /\batone\w*\b/gi]
      },
      'power': {
        keywords: ['power', 'control', 'authority', 'dominance', 'rule', 'command', 'influence'],
        patterns: [/\bpower\w*\b/gi, /\bcontrol\w*\b/gi, /\brule\w*\b/gi]
      },
      'friendship': {
        keywords: ['friend', 'companion', 'ally', 'bond', 'loyalty', 'trust', 'support'],
        patterns: [/\bfriend\w*\b/gi, /\bally\b/gi, /\bloyal\w*\b/gi]
      },
      'family': {
        keywords: ['family', 'mother', 'father', 'sibling', 'parent', 'child', 'brother', 'sister'],
        patterns: [/\bfamily\b/gi, /\bmother\b/gi, /\bfather\b/gi, /\bparent\w*\b/gi]
      },
      'sacrifice': {
        keywords: ['sacrifice', 'give up', 'surrender', 'forfeit', 'selfless', 'noble'],
        patterns: [/\bsacrifice\w*\b/gi, /\bgive\s+up\b/gi, /\bselfless\b/gi]
      },
      'coming-of-age': {
        keywords: ['grow', 'mature', 'learn', 'discover', 'realize', 'understand', 'change'],
        patterns: [/\bgrow\w*\b/gi, /\bmature\w*\b/gi, /\bdiscover\w*\b/gi]
      },
      'good-vs-evil': {
        keywords: ['good', 'evil', 'right', 'wrong', 'moral', 'virtue', 'sin', 'justice'],
        patterns: [/\bgood\b/gi, /\bevil\b/gi, /\bright\b/gi, /\bwrong\b/gi]
      },
      'death': {
        keywords: ['death', 'die', 'dead', 'mortality', 'funeral', 'grave', 'loss'],
        patterns: [/\bdeath\b/gi, /\bdie\w*\b/gi, /\bdead\b/gi, /\bmortality\b/gi]
      }
    };
    
    const lowerContent = content.toLowerCase();
    const detectedThemes: Array<{ theme: string; score: number }> = [];
    
    Object.entries(themePatterns).forEach(([theme, config]) => {
      let score = 0;
      
      // Check keywords
      config.keywords.forEach(keyword => {
        const matches = (lowerContent.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
        score += matches;
      });
      
      // Check patterns
      config.patterns.forEach(pattern => {
        const matches = (content.match(pattern) || []).length;
        score += matches * 1.5; // Patterns get higher weight
      });
      
      if (score > 0) {
        detectedThemes.push({ theme, score });
      }
    });
    
    return detectedThemes
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(item => item.theme);
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
    const wordCount = content.split(/\s+/).length;
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

  // Apply intelligent filtering
  private applyIntelligentFiltering(results: EnhancedDocument[], filters: any): EnhancedDocument[] {
    return results.filter(doc => {
      // Project filter
      if (filters.projectId && doc.metadata.projectId !== filters.projectId) {
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
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    
    return projectDocs
      .filter(doc => doc.pageContent !== content)
      .map(doc => {
        const docWords = new Set(doc.pageContent.toLowerCase().split(/\s+/));
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

  private async updateProjectContextFromContent(projectId: string, analysis: any): Promise<void> {
    const existingContext = this.getProjectContext(projectId) || { projectId, title: 'Unknown Project' };
    
    // Merge characters
    const allCharacters = new Set([...(existingContext.characters || []), ...analysis.characters]);
    
    // Merge themes
    const allThemes = new Set([...(existingContext.themes || []), ...analysis.themes]);
    
    // Update context
    const updatedContext: ProjectContext = {
      ...existingContext,
      characters: Array.from(allCharacters).slice(0, 20), // Limit to top 20
      themes: Array.from(allThemes).slice(0, 10), // Limit to top 10
      lastUpdated: new Date().toISOString()
    };
    
    this.projectContexts.set(projectId, updatedContext);
  }

  // Content classification
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
    if (lowerContent.includes('character') || /\b(he|she|his|her|him)\s+(is|was|has|had)\b/i.test(content)) {
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

  // Helper methods
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
      const data: PersistedData = {
        documents: this.documents.map(doc => ({
          pageContent: doc.pageContent,
          metadata: doc.metadata
        })),
        projectContexts: Object.fromEntries(this.projectContexts),
        timestamp: new Date().toISOString(),
        version: "3.0"
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
      console.log(`Enhanced RAG data persisted to ${this.persistencePath}`);
    } catch (error) {
      console.error("Error persisting enhanced RAG data:", error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      if (fs.existsSync(this.persistencePath) && this.vectorStore && this.embeddings) {
        const fileContent = fs.readFileSync(this.persistencePath, 'utf8');
        const data: PersistedData = JSON.parse(fileContent);
        
        // Convert persisted data back to Document objects
        this.documents = data.documents.map(doc => 
          new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata
          }) as EnhancedDocument
        );
        
        // Load project contexts
        if (data.projectContexts) {
          Object.entries(data.projectContexts).forEach(([projectId, context]) => {
            this.projectContexts.set(projectId, context);
          });
        }
        
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
          console.log(`Loaded ${this.documents.length} enhanced documents from persisted data`);
        }
        
        console.log(`Enhanced RAG system loaded from ${this.persistencePath} (version: ${data.version || '1.0'})`);
      }
    } catch (error) {
      console.error("Error loading persisted enhanced RAG data:", error);
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
    
    // Remove project context
    this.projectContexts.delete(projectId);
    
    // Clear semantic cache
    this.semanticCache.clear();
    
    // Persist the updated data
    await this.persistData();
    
    console.log(`Deleted all documents for project ${projectId}`);
  }

  // Get overall statistics
  async getStats(): Promise<{ 
    totalDocuments: number;
    totalProjects: number;
    totalChunks: number;
    lastUpdated: string;
    averageImportance: number;
    topThemes: string[];
    topCharacters: string[];
  }> {
    const projects = new Set(this.documents.map(doc => doc.metadata.projectId).filter(Boolean));
    const documents = new Set(this.documents.map(doc => doc.metadata.documentId || doc.metadata.projectId).filter(Boolean));
    
    const themeFrequency: Record<string, number> = {};
    const characterFrequency: Record<string, number> = {};
    let totalImportance = 0;
    
    const lastUpdated = this.documents.reduce((latest, doc) => {
      const timestamp = doc.metadata.timestamp || "";
      
      // Count themes and characters
      doc.metadata.themes?.forEach((theme: string) => {
        themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
      });
      
      doc.metadata.characters?.forEach((char: string) => {
        characterFrequency[char] = (characterFrequency[char] || 0) + 1;
      });
      
      totalImportance += doc.metadata.importance || 5;
      
      return timestamp > latest ? timestamp : latest;
    }, "");
    
    const topThemes = Object.entries(themeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([theme]) => theme);
      
    const topCharacters = Object.entries(characterFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([char]) => char);
    
    return {
      totalDocuments: documents.size,
      totalProjects: projects.size,
      totalChunks: this.documents.length,
      lastUpdated,
      averageImportance: this.documents.length > 0 ? totalImportance / this.documents.length : 0,
      topThemes,
      topCharacters
    };
  }
}

// Create a singleton instance
const enhancedRAGService = new EnhancedRAGService();

export default enhancedRAGService;
export { EnhancedRAGService, ProjectContext, EnhancedDocument, SearchOptions };
