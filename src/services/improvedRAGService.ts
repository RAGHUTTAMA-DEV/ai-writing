import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { searchCache, projectCache, cacheService, CacheKeys } from './cacheService';
import aiService from './aiService';

const prisma = new PrismaClient();

export interface EnhancedDocument extends Document {
  id?: string;
  projectId?: string;
  userId?: string;
  timestamp?: Date;
  relevanceScore?: number;
  metadata: {
    id?: string;
    projectId?: string;
    userId?: string;
    timestamp?: Date;
    characters?: string[];
    themes?: string[];
    emotions?: string[];
    plotElements?: string[];
    semanticTags?: string[];
    contentType?: string;
    importance?: number;
    chunkIndex?: number;
    totalChunks?: number;
    wordCount?: number;
    [key: string]: any;
  };
}

export interface SearchOptions {
  projectId?: string;
  userId?: string;
  contentTypes?: string[];
  themes?: string[];
  characters?: string[];
  timeRange?: [Date, Date];
  importance?: number;
  limit?: number;
  includeContext?: boolean;
}

export interface FilterOptions {
  projectId?: string;
  userId?: string;
  contentTypes?: string[];
  themes?: string[];
  characters?: string[];
  timeRange?: [Date, Date];
  importance?: number;
  query?: string;
  queryAnalysis?: any;
}

export interface ProjectContext {
  projectId: string;
  characters: string[];
  themes: string[];
  plotPoints: string[];
  settings: string[];
  writingStyle: string;
  toneAnalysis: string;
  lastUpdated: Date;
}

export class ImprovedRAGService {
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;
  private aiModel: ChatGoogleGenerativeAI | null = null;
  private documents: EnhancedDocument[] = [];
  private semanticCache = new Map<string, any>();
  private projectContexts = new Map<string, ProjectContext>();
  private persistencePath: string;
  
  // Rate limiting for embeddings
  private embeddingRateLimiter = {
    calls: 0,
    resetTime: Date.now() + 60000, // Reset every minute
    maxCallsPerMinute: 10, // Very conservative limit
    isRateLimited: false,
    rateLimitUntil: 0
  };
  
  // Embedding cache to avoid repeat API calls
  private embeddingCache = new Map<string, number[]>();
  
  // Common search terms to preload embeddings for
  private commonSearchTerms = [
    'character development', 'plot', 'theme', 'setting', 'dialogue', 
    'conflict', 'resolution', 'motivation', 'backstory', 'relationship',
    'tension', 'pacing', 'scene', 'chapter', 'narrative', 'story arc'
  ];

  constructor() {
    this.persistencePath = path.join(process.cwd(), 'data', 'rag_service_data.json');
    this.initializeServices();
  }

  // Check if we can make an embedding call
  private canMakeEmbeddingCall(): boolean {
    const now = Date.now();
    
    // Reset rate limiter if time window passed
    if (now > this.embeddingRateLimiter.resetTime) {
      this.embeddingRateLimiter.calls = 0;
      this.embeddingRateLimiter.resetTime = now + 60000;
      this.embeddingRateLimiter.isRateLimited = false;
    }
    
    // Check if we're in a rate limit cooldown
    if (this.embeddingRateLimiter.isRateLimited && now < this.embeddingRateLimiter.rateLimitUntil) {
      return false;
    }
    
    // Check if we've hit our conservative limit
    if (this.embeddingRateLimiter.calls >= this.embeddingRateLimiter.maxCallsPerMinute) {
      this.embeddingRateLimiter.isRateLimited = true;
      this.embeddingRateLimiter.rateLimitUntil = now + 120000; // Wait 2 minutes before trying again
      console.warn(`🛑 Embedding rate limit reached (${this.embeddingRateLimiter.calls} calls). Waiting 2 minutes before retrying.`);
      return false;
    }
    
    return true;
  }
  
  // Get cached embedding or generate new one
  private async getCachedEmbedding(text: string): Promise<number[] | null> {
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    
    // Check cache first
    if (this.embeddingCache.has(textHash)) {
      console.log('💾 Using cached embedding');
      return this.embeddingCache.get(textHash)!;
    }
    
    // Check if we can make an API call
    if (!this.canMakeEmbeddingCall() || !this.embeddings) {
      return null;
    }
    
    try {
      console.log('🔄 Generating new embedding (cached for future use)');
      this.embeddingRateLimiter.calls++;
      const embedding = await this.embeddings.embedQuery(text);
      
      // Cache the result
      this.embeddingCache.set(textHash, embedding);
      
      // Limit cache size to prevent memory issues
      if (this.embeddingCache.size > 1000) {
        const firstKey = this.embeddingCache.keys().next().value;
        if (firstKey) {
          this.embeddingCache.delete(firstKey);
        }
      }
      
      return embedding;
    } catch (error: any) {
      // Handle rate limit errors more gracefully
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
        console.warn('🛑 Hit Google API rate limit, entering cooldown mode');
        this.embeddingRateLimiter.isRateLimited = true;
        this.embeddingRateLimiter.rateLimitUntil = Date.now() + 300000; // Wait 5 minutes for actual rate limits
      }
      throw error;
    }
  }
  
  // Preload embeddings for common search terms when rate limits allow
  async preloadCommonEmbeddings(): Promise<void> {
    if (!this.embeddings || !this.canMakeEmbeddingCall()) {
      return;
    }
    
    console.log('🔄 Preloading common embeddings...');
    let preloaded = 0;
    
    for (const term of this.commonSearchTerms) {
      if (!this.canMakeEmbeddingCall()) {
        console.log(`🛑 Rate limit reached during preloading. Preloaded ${preloaded} embeddings.`);
        break;
      }
      
      try {
        const embedding = await this.getCachedEmbedding(term);
        if (embedding) {
          preloaded++;
        }
        
        // Small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Failed to preload embedding for "${term}":`, error);
        break; // Stop on any error
      }
    }
    
    console.log(`✅ Preloaded ${preloaded} common embeddings`);
  }

  private async initializeServices(): Promise<void> {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      if (!apiKey) {
        console.warn('🚨 Google AI API key not found. RAG service will use fallback text search.');
        return;
      }

      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: apiKey,
        model: "embedding-001"
      });

      this.aiModel = new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: "gemini-2.0-flash",
        temperature: 0.7
      });

      this.vectorStore = new MemoryVectorStore(this.embeddings);
      
      console.log('✅ ImprovedRAGService initialized successfully');
      
      // Load any persisted data
      await this.loadPersistedData();
      
      // DISABLED: Preload common embeddings - causing rate limit issues
      // setTimeout(() => this.preloadCommonEmbeddings(), 2000);
      
    } catch (error) {
      console.error('❌ Failed to initialize ImprovedRAGService:', error);
      this.embeddings = null;
      this.aiModel = null;
      this.vectorStore = null;
    }
  }

  // Main search method with intelligent fallback and caching
  async intelligentSearch(query: string, options: SearchOptions = {}): Promise<{
    results: EnhancedDocument[];
    projectInsights?: any;
    searchSummary?: any;
  }> {
    console.log(`🔍 Starting intelligent search for: "${query}"`);
    
    // Create cache key for search results
    const cacheKey = CacheKeys.searchResults(query, options.projectId, {
      limit: options.limit,
      contentTypes: options.contentTypes,
      themes: options.themes,
      characters: options.characters
    });
    
    // Try to get cached results first
    const cachedResults = searchCache.get<{
      results: EnhancedDocument[];
      projectInsights?: any;
      searchSummary?: any;
    }>(cacheKey);
    
    if (cachedResults) {
      console.log('🎯 Returning cached search results');
      return cachedResults;
    }
    
    let searchResults: {
      results: EnhancedDocument[];
      projectInsights?: any;
      searchSummary?: any;
    };
    
    try {
      // Check if we can use vector search (rate limits and availability)
      if (this.vectorStore && this.embeddings && this.canMakeEmbeddingCall()) {
        console.log('🔍 Attempting vector-based search');
        searchResults = await this.performVectorSearch(query, options);
      } else {
        if (!this.canMakeEmbeddingCall()) {
          console.log('🛑 Embedding rate limited, using fallback text search immediately');
        } else {
          console.log('📝 Vector store unavailable, using fallback text search');
        }
        searchResults = await this.performFallbackSearch(query, options);
      }
    } catch (error: any) {
      // If we hit rate limits or other embedding errors, fallback to text search
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
        console.warn('⚠️ Embeddings rate limited during search, using fallback text search');
        searchResults = await this.performFallbackSearch(query, options);
      } else {
        console.error("Error in intelligent search:", error);
        return { results: [] };
      }
    }
    
    // Cache the results for 15 minutes to reduce embedding calls
    if (searchResults.results.length > 0) {
      searchCache.set(cacheKey, searchResults, 900); // 15 minutes
      console.log('💾 Cached search results for 15 minutes');
    }
    
    return searchResults;
  }

  // Vector-based search (original implementation)
  private async performVectorSearch(query: string, options: SearchOptions): Promise<{
    results: EnhancedDocument[];
    projectInsights?: any;
    searchSummary?: any;
  }> {
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
    
    // Analyze the query to improve search
    const queryAnalysis = await this.analyzeSearchQuery(query);
    
    // Try to get cached embedding for the query first
    const queryEmbedding = await this.getCachedEmbedding(query);
    if (!queryEmbedding) {
      console.warn('🛑 Cannot generate query embedding, falling back to text search');
      return await this.performFallbackSearch(query, options);
    }
    
    // Get more results initially for better filtering
    const initialLimit = Math.max(limit * 6, 30);
    const results = await this.vectorStore!.similaritySearch(query, initialLimit);
    
    console.log(`📊 Found ${results.length} initial similarity matches`);
    
    // Convert to enhanced documents
    let enhancedResults: EnhancedDocument[] = results.map(doc => doc as EnhancedDocument);
    
    // Filter by project first
    if (projectId) {
      enhancedResults = enhancedResults.filter(doc => 
        doc.metadata.projectId === projectId
      );
    }
    
    console.log(`📝 After project filtering: ${enhancedResults.length} documents`);
    
    // Apply intelligent filtering
    enhancedResults = this.applyAdvancedFiltering(enhancedResults, {
      projectId,
      userId,
      contentTypes,
      themes,
      characters,
      timeRange,
      importance,
      query,
      queryAnalysis
    });
    
    console.log(`🔬 After advanced filtering: ${enhancedResults.length} documents`);
    
    // Apply AI-powered contextual ranking
    enhancedResults = await this.applyAIContextualRanking(enhancedResults, query, queryAnalysis, projectId);
    
    // Include related context if requested
    if (includeContext) {
      enhancedResults = await this.enrichWithAdvancedContext(enhancedResults, query);
    }
    
    const finalResults = enhancedResults.slice(0, limit);
    
    console.log(`✅ Final results: ${finalResults.length} documents returned`);
    
    // Generate enhanced project insights
    let projectInsights;
    if (projectId) {
      projectInsights = await this.generateProjectInsights(
        finalResults, 
        projectId, 
        query
      );
    }
    
    // Generate search summary
    const searchSummary = await this.generateSearchSummary(finalResults, query, projectId);
    
    return {
      results: finalResults,
      projectInsights,
      searchSummary
    };
  }

  // Fallback text-based search when embeddings are not available
  private async performFallbackSearch(query: string, options: SearchOptions): Promise<{
    results: EnhancedDocument[];
    projectInsights?: any;
    searchSummary?: any;
  }> {
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
    
    console.log('🔍 Performing fallback text search...');
    
    // Filter documents based on criteria first
    let candidateDocuments = this.documents.filter(doc => {
      // Project filter
      if (projectId && doc.metadata.projectId !== projectId) {
        return false;
      }
      
      // User filter
      if (userId && doc.metadata.userId !== userId) {
        return false;
      }
      
      // Content type filter
      if (contentTypes && contentTypes.length > 0 && 
        // @ts-ignore
          !contentTypes.includes(doc.metadata.contentType)) {
        return false;
      }
      
      // Importance filter
      if (doc.metadata.importance && doc.metadata.importance < importance) {
        return false;
      }
      
      return true;
    });
    
    console.log(`📊 Found ${candidateDocuments.length} candidate documents after filtering`);
    
    // If no documents found for project, try to get from database
    if (candidateDocuments.length === 0 && projectId) {
      console.log(`📄️ No RAG documents found for project ${projectId}, searching database content...`);
      
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId }
        });
        
        if (project && project.content) {
          console.log(`✅ Found project "${project.title}" content in database`);
          
          // Create a mock document from database content for search
          const mockDoc: EnhancedDocument = {
            pageContent: project.content,
            metadata: {
              id: `db_${projectId}`,
              projectId: projectId,
              contentType: 'project',
              importance: 8, // High importance for direct project content
              wordCount: project.content.split(/\s+/).length,
              timestamp: project.updatedAt || new Date(),
              characters: [],
              themes: [],
              emotions: [],
              plotElements: [],
              semanticTags: ['database', 'project-content']
            }
          };
          
          candidateDocuments = [mockDoc];
          console.log('📄 Created mock document from database content for search');
        }
      } catch (error) {
        console.error('❌ Error fetching project from database:', error);
      }
    }
    
    // Perform text-based search scoring
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
    
    const scoredResults = candidateDocuments.map(doc => {
      let score = 0;
      const contentLower = doc.pageContent.toLowerCase();
      
      // Score based on exact query match
      if (contentLower.includes(queryLower)) {
        score += 10;
      }
      
      // Score based on individual terms
      queryTerms.forEach(term => {
        const termCount = (contentLower.match(new RegExp(term, 'g')) || []).length;
        score += termCount * 3;
        
        // Boost if term appears in metadata
        if (doc.metadata.characters?.some((char: string) => char.toLowerCase().includes(term))) {
          score += 5;
        }
        if (doc.metadata.themes?.some((theme: string) => theme.toLowerCase().includes(term))) {
          score += 4;
        }
        if (doc.metadata.semanticTags?.some((tag: string) => tag.toLowerCase().includes(term))) {
          score += 2;
        }
      });
      
      // Boost for importance
      score += doc.metadata.importance || 0;
      
      return {
        ...doc,
        relevanceScore: score
      };
    }).filter(doc => doc.relevanceScore && doc.relevanceScore > 0);
    
    // Sort by relevance score
    scoredResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    const finalResults = scoredResults.slice(0, limit);
    
    console.log(`✅ Final fallback results: ${finalResults.length} documents returned`);
    finalResults.forEach((doc, i) => {
      console.log(`  ${i + 1}. Score: ${doc.relevanceScore} - "${doc.pageContent.slice(0, 50)}..."`);
    });
    
    // Generate basic project insights
    let projectInsights;
    if (projectId && finalResults.length > 0) {
      projectInsights = {
        relevantCharacters: this.extractRelevantCharacters(finalResults, query),
        relevantThemes: this.extractRelevantThemes(finalResults, query),
        suggestedConnections: [],
        contextualHints: [`Found ${finalResults.length} results using text search`]
      };
    }
    
    // Generate search summary
    const searchSummary = await this.generateSearchSummary(finalResults, query, projectId);
    
    return {
      results: finalResults,
      projectInsights,
      searchSummary
    };
  }

  private async analyzeSearchQuery(query: string): Promise<any> {
    if (!this.aiModel) {
      return {
        intent: 'general',
        entities: [],
        themes: [],
        characters: []
      };
    }

    try {
      const prompt = `Analyze this search query and extract key information:
Query: "${query}"

Please identify:
1. Search intent (character, plot, theme, setting, general)
2. Named entities (people, places, things)
3. Themes or topics
4. Emotions or tones

Respond with a JSON object containing these categories.`;

      const response = await this.aiModel.invoke(prompt);
      const text = response.content as string;
      
      try {
        return JSON.parse(text);
      } catch {
        // Fallback to simple analysis
        return {
          intent: 'general',
          entities: query.split(/\s+/).filter(word => word.length > 3),
          themes: [],
          characters: []
        };
      }
    } catch (error) {
      console.error('Error analyzing search query:', error);
      return {
        intent: 'general',
        entities: [],
        themes: [],
        characters: []
      };
    }
  }

  private applyAdvancedFiltering(results: EnhancedDocument[], filters: any): EnhancedDocument[] {
    return results.filter(doc => {
      // Theme filtering
      if (filters.themes && filters.themes.length > 0) {
        const hasMatchingTheme = filters.themes.some((theme: string) =>
          doc.metadata.themes?.some((docTheme: string) => 
            docTheme.toLowerCase().includes(theme.toLowerCase())
          )
        );
        if (!hasMatchingTheme) return false;
      }

      // Character filtering
      if (filters.characters && filters.characters.length > 0) {
        const hasMatchingCharacter = filters.characters.some((char: string) =>
          doc.metadata.characters?.some((docChar: string) => 
            docChar.toLowerCase().includes(char.toLowerCase())
          )
        );
        if (!hasMatchingCharacter) return false;
      }

      // Content type filtering
      if (filters.contentTypes && filters.contentTypes.length > 0) {
        if (!filters.contentTypes.includes(doc.metadata.contentType)) {
          return false;
        }
      }

      // Time range filtering
      if (filters.timeRange && doc.metadata.timestamp) {
        const docTime = new Date(doc.metadata.timestamp);
        const [start, end] = filters.timeRange;
        if (docTime < start || docTime > end) return false;
      }

      return true;
    });
  }

  private async applyAIContextualRanking(
    results: EnhancedDocument[],
    query: string,
    queryAnalysis: any,
    projectId?: string
  ): Promise<EnhancedDocument[]> {
    if (!this.aiModel || results.length === 0) {
      return results;
    }

    try {
      // For each document, calculate an AI-based relevance score
      const rankedResults = await Promise.all(
        results.map(async (doc) => {
          const aiScore = await this.calculateAIRelevanceScore(doc, query, queryAnalysis);
          return {
            ...doc,
            aiRelevanceScore: aiScore
          };
        })
      );

      // Sort by AI relevance score
      return rankedResults.sort((a, b) => (b.aiRelevanceScore || 0) - (a.aiRelevanceScore || 0));
    } catch (error) {
      console.error('Error in AI contextual ranking:', error);
      return results;
    }
  }

  private async calculateAIRelevanceScore(
    doc: EnhancedDocument,
    query: string,
    queryAnalysis: any
  ): Promise<number> {
    try {
      const prompt = `Rate the relevance of this document to the search query on a scale of 0.0 to 1.0.

Query: "${query}"
Document content: "${doc.pageContent.slice(0, 500)}..."
Document metadata:
- Characters: ${doc.metadata.characters?.join(', ') || 'None'}
- Themes: ${doc.metadata.themes?.join(', ') || 'None'}
- Content type: ${doc.metadata.contentType || 'Unknown'}

Consider:
- Direct content matches
- Semantic relevance
- Character/theme alignment
- Context and narrative flow
- User intent from query analysis

Return only a number between 0.0 and 1.0.`;

      const response = await this.aiModel!.invoke(prompt);
      const scoreText = response.content as string;
      const score = parseFloat(scoreText.trim());

      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Error calculating AI relevance score:', error);
      return 0.5; // Default middle score
    }
  }

  private async enrichWithAdvancedContext(
    results: EnhancedDocument[],
    query: string
  ): Promise<EnhancedDocument[]> {
    return results.map(doc => {
      const contextualSummary = this.generateContextualSummary(doc, query);
      const matchedElements = this.findMatchedElements(doc, query);

      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          contextualSummary,
          matchedElements,
          enhancedContext: true
        }
      };
    });
  }

  private generateContextualSummary(doc: EnhancedDocument, query: string): string {
    const content = doc.pageContent.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Find the most relevant sentence containing query terms
    const sentences = doc.pageContent.split(/[.!?]+/);
    const relevantSentences = sentences.filter(sentence => 
      sentence.toLowerCase().includes(queryLower)
    );

    if (relevantSentences.length > 0) {
      return relevantSentences[0].trim();
    }

    // Fallback to first sentence or truncated content
    return sentences[0]?.trim() || doc.pageContent.slice(0, 150) + '...';
  }

  private findMatchedElements(doc: EnhancedDocument, query: string): any {
    const queryLower = query.toLowerCase();
    
    return {
      matchedCharacters: doc.metadata.characters?.filter(char => 
        char.toLowerCase().includes(queryLower)
      ) || [],
      matchedThemes: doc.metadata.themes?.filter(theme => 
        theme.toLowerCase().includes(queryLower)
      ) || [],
      directMatches: doc.pageContent.toLowerCase().includes(queryLower)
    };
  }

  private async generateSearchSummary(results: EnhancedDocument[], query: string, projectId?: string): Promise<{
    totalResults: number;
    topCharacters: string[];
    topThemes: string[];
    contentTypes: string[];
    keyFindings: string[];
    searchStrategy: string;
  }> {
    const characters = new Set<string>();
    const themes = new Set<string>();
    const contentTypes = new Set<string>();
    const keyFindings: string[] = [];

    // Aggregate data from results
    results.forEach(doc => {
      doc.metadata.characters?.forEach(char => characters.add(char));
      doc.metadata.themes?.forEach(theme => themes.add(theme));
      if (doc.metadata.contentType) contentTypes.add(doc.metadata.contentType);
    });

    // Generate key findings
    if (characters.size > 0) {
      keyFindings.push(`Found content related to ${Array.from(characters).slice(0, 3).join(', ')}`);
    }
    if (themes.size > 0) {
      keyFindings.push(`Key themes include ${Array.from(themes).slice(0, 3).join(', ')}`);
    }

    const searchStrategy = this.vectorStore ? 'AI vector search' : 'Text-based fallback search';

    return {
      totalResults: results.length,
      topCharacters: Array.from(characters).slice(0, 5),
      topThemes: Array.from(themes).slice(0, 5),
      contentTypes: Array.from(contentTypes),
      keyFindings,
      searchStrategy
    };
  }

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

  // Add document with enhanced metadata analysis
  async addDocument(
    content: string, 
    metadata: Partial<EnhancedDocument['metadata']> = {},
    projectId?: string
  ): Promise<void> {
    try {
      // Generate or validate document ID
      const docId = this.generateDocumentId(content, projectId);
      
      // Check for existing document (deduplication)
      if (projectId) {
        const existingDoc = this.findExistingDocument(content, projectId);
        if (existingDoc) {
          console.log('📄 Document already exists, updating metadata...');
          await this.updateDocumentMetadata(existingDoc, metadata);
          return;
        }
      }

      // Analyze content for enhanced metadata
      const projectContext = projectId ? this.projectContexts.get(projectId) : null;
      const analysis = await this.analyzeContent(content, projectContext);

      // Create enhanced document
      const enhancedDoc: EnhancedDocument = new Document({
        pageContent: content,
        metadata: {
          id: docId,
          projectId,
          timestamp: new Date(),
          ...metadata,
          ...analysis,
          contentType: this.classifyContentType(content),
          importance: this.calculateImportance(content, analysis),
          wordCount: content.split(/\s+/).length
        }
      }) as EnhancedDocument;

      // Add to documents array
      this.documents.push(enhancedDoc);

      // FAST MODE: Skip vector store, use text search only
      console.log('⚡ FAST MODE: Document added to text search only (no embeddings)');
      // Skip embedding generation for performance

  // Update project context
      if (projectId) {
        await this.syncProjectContext(projectId);
        
        // Clear project stats cache to force recalculation
        const statsKey = CacheKeys.projectStats(projectId);
        projectCache.delete(statsKey);
        console.log(`🧹 Cleared project stats cache for ${projectId}`);
      }

      // Persist data
      await this.persistData();

      console.log(`✅ Document added successfully. ID: ${docId}`);

    } catch (error) {
      console.error('❌ Error adding document:', error);
      throw error;
    }
  }

  // Analyze content and extract metadata with improved caching
  private async analyzeContent(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    const contentHash = this.hashContent(content);
    const cacheKey = CacheKeys.ragAnalysis(contentHash, projectContext?.projectId);
    
    // Check external cache first
    const cachedResult = cacheService.get<{
      characters: string[];
      themes: string[];
      emotions: string[];
      plotElements: string[];
      semanticTags: string[];
    }>(cacheKey);
    
    if (cachedResult) {
      // Also update local cache for faster access
      this.semanticCache.set(cacheKey, cachedResult);
      return cachedResult;
    }
    
    // Check local cache
    if (this.semanticCache.has(cacheKey)) {
      const localResult = this.semanticCache.get(cacheKey);
      // Update external cache
      cacheService.set(cacheKey, localResult, 1800);
      return localResult;
    }

    let result;
    
    try {
      // FAST MODE: Always use basic analysis for performance
      console.log('⚡ Using fast basic analysis (no AI calls)');
      result = await this.performBasicContentAnalysis(content, projectContext);

      // Cache the result in both caches
      this.semanticCache.set(cacheKey, result);
      cacheService.set(cacheKey, result, 1800); // 30 minutes
      
      // Clean up local cache if it gets too large
      if (this.semanticCache.size > 100) {
        const entries = Array.from(this.semanticCache.entries());
        // Remove oldest 20 entries
        entries.slice(0, 20).forEach(([key]) => this.semanticCache.delete(key));
      }
      
      return result;

    } catch (error) {
      console.error('Error analyzing content:', error);
      // Fallback to basic analysis
      result = await this.performBasicContentAnalysis(content, projectContext);
      this.semanticCache.set(cacheKey, result);
      cacheService.set(cacheKey, result, 900); // Shorter cache for fallback results
      return result;
    }
  }

  // AI-powered content analysis
  private async performAIContentAnalysis(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    const contextInfo = projectContext ? `
Project Context:
- Existing characters: ${projectContext.characters.join(', ')}
- Known themes: ${projectContext.themes.join(', ')}
- Plot points: ${projectContext.plotPoints.join(', ')}
- Settings: ${projectContext.settings.join(', ')}
- Writing style: ${projectContext.writingStyle}

This helps maintain consistency with the existing story elements.` : '';

    const prompt = `Read this text and tell me what you find:

"${content}"

${contextInfo}

Please analyze and extract:
1. Characters (people mentioned or speaking)
2. Themes (deeper meanings, concepts, ideas)
3. Emotions (feelings expressed or evoked)
4. Plot elements (events, conflicts, resolutions)
5. Semantic tags (genres, topics, keywords)

Return a JSON object with these 5 arrays. Keep items concise and relevant.

Example format:
{
  "characters": ["Alice", "Bob"],
  "themes": ["friendship", "betrayal"],
  "emotions": ["joy", "sadness"],
  "plotElements": ["meeting", "conflict"],
  "semanticTags": ["dialogue", "mystery"]
}`;

    const response = await this.aiModel!.invoke(prompt);
    let responseText = response.content as string;

    console.log('🤖 AI Raw Response:', responseText);

    // Clean up the response text
    responseText = responseText.trim();

    // Extract JSON from the response
    let jsonText = responseText;
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = responseText.substring(jsonStart, jsonEnd + 1);
    }

    try {
      const parsed = JSON.parse(jsonText);
      
      // Validate and clean the arrays
      return {
        characters: this.validateAndCleanArray(parsed.characters, 10, 'character'),
        themes: this.validateAndCleanArray(parsed.themes, 8, 'theme'),
        emotions: this.validateAndCleanArray(parsed.emotions, 6, 'emotion'),
        plotElements: this.validateAndCleanArray(parsed.plotElements, 8, 'plot element'),
        semanticTags: this.validateAndCleanArray(parsed.semanticTags, 10, 'semantic tag')
      };
    } catch (error) {
      console.warn('🔄 AI response not valid JSON, using simple extraction');
      return await this.extractWithSimpleAI(content);
    }
  }

  private async extractWithSimpleAI(content: string): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    try {
      const simplePrompt = `Text: "${content}"

List characters, themes, emotions, plot elements, and tags, one per line:
Characters: (names of people)
Themes: (main ideas)
Emotions: (feelings)
Plot: (events)
Style: `;

      const response = await this.aiModel!.invoke(simplePrompt);
      const text = response.content as string;

      console.log('🤖 Simple AI Response:', text);

      // Parse line-by-line
      const lines = text.split('\n');
      const result = {
        characters: this.extractListFromLine(lines, 'Characters:'),
        themes: this.extractListFromLine(lines, 'Themes:'),
        emotions: this.extractListFromLine(lines, 'Emotions:'),
        plotElements: this.extractListFromLine(lines, 'Plot:'),
        semanticTags: this.extractListFromLine(lines, 'Style:')
      };

      return result;
    } catch (error) {
      console.error('Error in simple AI extraction:', error);
      return await this.performBasicContentAnalysis(content);
    }
  }

  private extractListFromLine(lines: string[], prefix: string): string[] {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return [];
    
    const content = line.substring(prefix.length).trim();
    return content.split(/[,;]/).map(item => item.trim()).filter(item => item.length > 0).slice(0, 5);
  }

  private validateAndCleanArray(arr: any, maxLength: number, expectedType: string): string[] {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => typeof item === 'string' && item.length > 0)
      .map(item => item.trim())
      .filter(item => item.length <= 50) // Reasonable length limit
      .slice(0, maxLength);
  }

  private async performBasicContentAnalysis(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    const characters = await this.extractCharactersBasic(content, projectContext);
    
    return {
      characters,
      themes: this.extractThemesBasic(content),
      emotions: this.extractEmotionsBasic(content),
      plotElements: this.extractPlotElementsBasic(content),
      semanticTags: this.generateSemanticTagsBasic(content)
    };
  }

  // Project context management with real-time sync
  async syncProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      console.log(`🔄 Force syncing project context for ${projectId} (bypassing cache for accuracy)`);
      
      // Clear both caches to ensure fresh data
      const cacheKey = CacheKeys.projectContext(projectId);
      const projectStatsKey = CacheKeys.projectStats(projectId);
      projectCache.delete(cacheKey);
      projectCache.delete(projectStatsKey);
      
      // Remove from local cache too
      this.projectContexts.delete(projectId);
      
      // Check local memory cache
      const localContext = this.projectContexts.get(projectId);
      if (localContext && (new Date().getTime() - localContext.lastUpdated.getTime()) < 30 * 60 * 1000) {
        console.log(`💾 Returning local cached context for ${projectId}`);
        // Update external cache
        projectCache.set(cacheKey, localContext, 1800);
        return localContext;
      }
      
      console.log(`🔄 Syncing project context for ${projectId}...`);
      
      const projectDocs = this.getProjectDocuments(projectId);
      let projectContext: ProjectContext;
      
      if (projectDocs.length === 0) {
        console.log(`📊 No RAG documents found for project ${projectId}, fetching from database...`);
        
        // Use cached database query
        const project = await this.getCachedProject(projectId);
        
        if (!project || !project.content) {
          console.log(`❌ No project found or no content for project ${projectId}`);
          return null;
        }
        
        console.log(`✅ Found project "${project.title}" with content, analyzing...`);
        
        // Clear analysis cache and get fresh analysis
        const analysisKey = CacheKeys.ragAnalysis(this.hashContent(project.content!), projectId);
        cacheService.delete(analysisKey);
        console.log(`🧹 Cleared analysis cache for fresh AI analysis`);
        
        const analysis = await this.analyzeProjectContent(project.content!);
        
        projectContext = {
          projectId,
          characters: analysis.characters,
          themes: analysis.themes,
          plotPoints: analysis.plotPoints,
          settings: analysis.settings,
          writingStyle: analysis.writingStyle,
          toneAnalysis: analysis.toneAnalysis,
          lastUpdated: new Date()
        };
      } else {
        // Aggregate analysis from all project documents
        const aggregatedContent = projectDocs.map(doc => doc.pageContent).join('\n\n');
        const contentHash = this.hashContent(aggregatedContent);
        
        const analysisKey = CacheKeys.ragAnalysis(contentHash, projectId);
        cacheService.delete(analysisKey);
        console.log(`🧹 Cleared aggregated analysis cache for fresh results`);
        
        const analysis = await this.analyzeProjectContent(aggregatedContent);

        projectContext = {
          projectId,
          characters: analysis.characters,
          themes: analysis.themes,
          plotPoints: analysis.plotPoints,
          settings: analysis.settings,
          writingStyle: analysis.writingStyle,
          toneAnalysis: analysis.toneAnalysis,
          lastUpdated: new Date()
        };

        // Update database asynchronously
        setImmediate(() => {
          this.updateProjectContextInDB(projectId, analysis).catch(error => 
            console.error('Error updating project context in DB:', error)
          );
        });
      }

      // Clear related caches first
      const statsKey = CacheKeys.projectStats(projectId);
      projectCache.delete(statsKey);
      
      // Cache the context
      this.projectContexts.set(projectId, projectContext);
      projectCache.set(cacheKey, projectContext, 1800); // 30 minutes
      
      console.log(`✅ Project context synced for ${projectId}:`, {
        characters: projectContext.characters.length,
        themes: projectContext.themes.length,
        plotPoints: projectContext.plotPoints.length
      });

      return projectContext;
    } catch (error) {
      console.error(`Error syncing project context for ${projectId}:`, error);
      return null;
    }
  }
  
  // Get project with caching
  private async getCachedProject(projectId: string) {
    const cacheKey = `project:data:${projectId}`;
    
    return await projectCache.getOrSet(
      cacheKey,
      async () => {
        return await prisma.project.findUnique({
          where: { id: projectId },
          select: {
            id: true,
            title: true,
            content: true,
            updatedAt: true,
            owner: {
              select: {
                id: true,
                username: true
              }
            }
          }
        });
      },
      900 // 15 minutes cache for project data
    );
  }

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

  // Get project statistics with real-time data (bypassing cache for accuracy)
  async getProjectStats(projectId: string): Promise<{
    totalDocuments: number;
    totalChunks: number;
    characters: string[];
    themes: string[];
    contentTypes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
    averageImportance: number;
    totalWordCount: number;
    lastUpdated?: Date;
  }> {
    console.log(`🔄 Getting REAL-TIME project stats for ${projectId} (bypassing cache)`);
    
    // Always calculate fresh stats to avoid cache issues
    return this.calculateProjectStats(projectId);
  }
  
  // Calculate project statistics (cached internally)
  private calculateProjectStats(projectId: string) {
    const projectDocs = this.getProjectDocuments(projectId);
    
    const characters = new Set<string>();
    const themes = new Set<string>();
    const contentTypes = new Set<string>();
    const emotions = new Set<string>();
    const plotElements = new Set<string>();
    const semanticTags = new Set<string>();
    
    let totalImportance = 0;
    let totalWordCount = 0;
    let validImportanceCount = 0;

    console.log(`📊 Calculating stats for project ${projectId} with ${projectDocs.length} documents`);
    
    projectDocs.forEach((doc, index) => {
      console.log(`📄 Document ${index + 1} characters:`, doc.metadata.characters);
      
      // Aggregate metadata
      if (doc.metadata.characters && Array.isArray(doc.metadata.characters)) {
        doc.metadata.characters.forEach(char => {
          if (char && typeof char === 'string' && char.trim().length > 0) {
            characters.add(char.trim());
          }
        });
      }
      
      if (doc.metadata.themes && Array.isArray(doc.metadata.themes)) {
        doc.metadata.themes.forEach(theme => {
          if (theme && typeof theme === 'string' && theme.trim().length > 0) {
            themes.add(theme.trim());
          }
        });
      }
      
      if (doc.metadata.emotions && Array.isArray(doc.metadata.emotions)) {
        doc.metadata.emotions.forEach(emotion => {
          if (emotion && typeof emotion === 'string' && emotion.trim().length > 0) {
            emotions.add(emotion.trim());
          }
        });
      }
      
      if (doc.metadata.plotElements && Array.isArray(doc.metadata.plotElements)) {
        doc.metadata.plotElements.forEach(element => {
          if (element && typeof element === 'string' && element.trim().length > 0) {
            plotElements.add(element.trim());
          }
        });
      }
      
      if (doc.metadata.semanticTags && Array.isArray(doc.metadata.semanticTags)) {
        doc.metadata.semanticTags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim().length > 0) {
            semanticTags.add(tag.trim());
          }
        });
      }
      
      if (doc.metadata.contentType) contentTypes.add(doc.metadata.contentType);
      
      if (doc.metadata.importance) {
        totalImportance += doc.metadata.importance;
        validImportanceCount++;
      }
      
      totalWordCount += doc.metadata.wordCount || 0;
    });

    // Also check project context for additional characters/themes
    const projectContext = this.projectContexts.get(projectId);
    if (projectContext) {
      console.log(`🎯 Project context has:`, {
        characters: projectContext.characters?.length || 0,
        themes: projectContext.themes?.length || 0
      });
      
      // Merge with project context (but prioritize document analysis)
      if (projectContext.characters && Array.isArray(projectContext.characters)) {
        projectContext.characters.forEach(char => {
          if (char && typeof char === 'string' && char.trim().length > 0) {
            characters.add(char.trim());
          }
        });
      }
      
      if (projectContext.themes && Array.isArray(projectContext.themes)) {
        projectContext.themes.forEach(theme => {
          if (theme && typeof theme === 'string' && theme.trim().length > 0) {
            themes.add(theme.trim());
          }
        });
      }
    }
    
    const result = {
      totalDocuments: projectDocs.length,
      totalChunks: projectDocs.reduce((sum, doc) => sum + (doc.metadata.totalChunks || 1), 0),
      characters: Array.from(characters),
      themes: Array.from(themes),
      contentTypes: Array.from(contentTypes),
      emotions: Array.from(emotions),
      plotElements: Array.from(plotElements),
      semanticTags: Array.from(semanticTags),
      averageImportance: validImportanceCount > 0 ? totalImportance / validImportanceCount : 0,
      totalWordCount,
      lastUpdated: projectContext?.lastUpdated
    };
    
    console.log(`✅ Final calculated stats:`, {
      totalDocuments: result.totalDocuments,
      charactersFound: result.characters.length,
      characters: result.characters,
      themesFound: result.themes.length,
      themes: result.themes
    });
    
    return result;
  }

  // Helper methods
  private async extractCharactersBasic(content: string, projectContext?: ProjectContext | null): Promise<string[]> {
    try {
      // Use AI-based extraction for better accuracy
      const prompt = `Analyze this text and extract ONLY the actual character names (people, beings, entities with proper names). Do not include:
- Pronouns (he, she, his, her, they, etc.)
- Common words or titles (Chapter, King, Queen, etc.)
- Generic descriptions (Giant, Warrior, etc.)
- Place names (Midgard, Asgard, etc.)

Text: "${content.slice(0, 1000)}"

Return only a simple list of actual character names, one per line. If no clear character names are found, return "None found".`;

      const response = await aiService.generateStructureAnalysis(prompt);
      
      // Parse the AI response
      const lines = response.split('\n').filter(line => line.trim() && !line.includes('None found'));
      const characters = lines
        .map(line => line.trim().replace(/^[-*•]\s*/, '')) // Remove bullet points
        .filter(name => name.length > 1 && name.length < 30) // Reasonable length
        .slice(0, 10); // Limit to 10 characters
      
      // If we have project context, prioritize known characters
      if (projectContext?.characters) {
        const knownCharacters = projectContext.characters.filter(char => 
          content.toLowerCase().includes(char.toLowerCase())
        );
        
        // Merge known characters with AI-extracted ones, prioritizing known
        const allCharacters = [...new Set([...knownCharacters, ...characters])];
        return allCharacters.slice(0, 10);
      }
      
      return characters.length > 0 ? characters : [];
    } catch (error) {
      console.error('AI-based character extraction failed, using fallback:', error);
      
      // Fallback to project context only if AI fails
      if (projectContext?.characters) {
        return projectContext.characters.filter(char => 
          content.toLowerCase().includes(char.toLowerCase())
        ).slice(0, 10);
      }
      
      return [];
    }
  }

  private extractThemesBasic(content: string): string[] {
    const themes = new Set<string>();
    const contentLower = content.toLowerCase();
    
    // Common thematic keywords
    const themeKeywords = {
      'love': ['love', 'romance', 'heart', 'affection', 'dating'],
      'friendship': ['friend', 'friendship', 'buddy', 'companion'],
      'betrayal': ['betray', 'deceive', 'lie', 'cheat', 'backstab'],
      'revenge': ['revenge', 'vengeance', 'payback', 'retribution'],
      'sacrifice': ['sacrifice', 'give up', 'selfless', 'noble'],
      'redemption': ['redemption', 'forgiveness', 'second chance'],
      'power': ['power', 'control', 'authority', 'dominance'],
      'justice': ['justice', 'fair', 'right', 'wrong', 'moral'],
      'family': ['family', 'mother', 'father', 'sibling', 'parent'],
      'death': ['death', 'die', 'kill', 'murder', 'grave'],
      'hope': ['hope', 'optimism', 'future', 'dream'],
      'fear': ['fear', 'afraid', 'terror', 'anxiety', 'worry'],
      'growth': ['learn', 'grow', 'change', 'develop', 'mature']
    };
    
    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        themes.add(theme);
      }
    });
    
    return Array.from(themes).slice(0, 8);
  }

  private extractSettings(content: string): string[] {
    const settings = new Set<string>();
    const contentLower = content.toLowerCase();
    
    // Look for location indicators
    const locationWords = ['at', 'in', 'on', 'near', 'by', 'outside', 'inside'];
    const sentences = content.split(/[.!?]+/);
    
    sentences.forEach(sentence => {
      locationWords.forEach(locWord => {
        const regex = new RegExp(`\\b${locWord}\\s+(?:the\\s+)?([A-Z][\\w\\s]+?)(?=\\s*[,.;]|$)`, 'g');
        const matches = sentence.match(regex);
        if (matches) {
          matches.forEach(match => {
            const location = match.replace(new RegExp(`^${locWord}\\s+(?:the\\s+)?`, 'i'), '').trim();
            if (location.length > 2 && location.length < 30) {
              settings.add(location);
            }
          });
        }
      });
    });
    
    return Array.from(settings).slice(0, 6);
  }

  private analyzeWritingStyle(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    
    const dialogueCount = (content.match(/"/g) || []).length / 2;
    const dialogueRatio = dialogueCount / sentences.length;
    
    let style = '';
    
    if (avgSentenceLength > 25) {
      style += 'complex, detailed ';
    } else if (avgSentenceLength < 15) {
      style += 'concise, direct ';
    } else {
      style += 'balanced ';
    }
    
    if (dialogueRatio > 0.3) {
      style += 'dialogue-heavy ';
    } else if (dialogueRatio < 0.1) {
      style += 'narrative-focused ';
    }
    
    if (content.match(/[!]{2,}|[?]{2,}/)) {
      style += 'dramatic ';
    }
    
    return style.trim() || 'standard';
  }

  private analyzeTone(content: string): string {
    const contentLower = content.toLowerCase();
    
    const toneIndicators = {
      'dark': ['death', 'kill', 'murder', 'blood', 'evil', 'nightmare'],
      'light': ['joy', 'happy', 'laugh', 'smile', 'bright', 'wonderful'],
      'mysterious': ['secret', 'hidden', 'mystery', 'unknown', 'strange'],
      'romantic': ['love', 'kiss', 'heart', 'romantic', 'passion'],
      'action': ['fight', 'run', 'chase', 'battle', 'attack', 'escape'],
      'melancholic': ['sad', 'cry', 'tears', 'lonely', 'sorrow', 'grief'],
      'humorous': ['funny', 'laugh', 'joke', 'silly', 'ridiculous'],
      'tense': ['nervous', 'worry', 'anxious', 'tension', 'stress']
    };
    
    const toneScores: {[key: string]: number} = {};
    
    Object.entries(toneIndicators).forEach(([tone, words]) => {
      const score = words.reduce((sum, word) => {
        return sum + (contentLower.split(word).length - 1);
      }, 0);
      toneScores[tone] = score;
    });
    
    const dominantTone = Object.entries(toneScores)
      .sort(([,a], [,b]) => b - a)[0];
    
    return dominantTone?.[0] || 'neutral';
  }

  private extractEmotionsBasic(content: string): string[] {
    const emotions = new Set<string>();
    const contentLower = content.toLowerCase();
    
    const emotionKeywords = {
      'joy': ['joy', 'happy', 'glad', 'cheerful', 'delighted'],
      'sadness': ['sad', 'sorrow', 'grief', 'melancholy', 'despair'],
      'anger': ['angry', 'furious', 'rage', 'mad', 'irritated'],
      'fear': ['fear', 'afraid', 'terrified', 'scared', 'anxious'],
      'surprise': ['surprised', 'shocked', 'amazed', 'astonished'],
      'love': ['love', 'affection', 'adoration', 'fondness'],
      'hope': ['hope', 'optimistic', 'confident', 'positive'],
      'excitement': ['excited', 'thrilled', 'enthusiastic', 'eager'],
      'confusion': ['confused', 'puzzled', 'bewildered', 'perplexed'],
      'pride': ['proud', 'accomplished', 'satisfied', 'pleased']
    };
    
    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        emotions.add(emotion);
      }
    });
    
    return Array.from(emotions).slice(0, 6);
  }

  private extractPlotElementsBasic(content: string): string[] {
    const plotElements = new Set<string>();
    const contentLower = content.toLowerCase();
    
    const plotKeywords = {
      'meeting': ['meet', 'encounter', 'introduction', 'first time'],
      'conflict': ['fight', 'argue', 'disagree', 'conflict', 'tension'],
      'resolution': ['resolve', 'solution', 'answer', 'fix', 'solve'],
      'revelation': ['reveal', 'discover', 'realize', 'understand', 'truth'],
      'journey': ['travel', 'journey', 'adventure', 'quest', 'expedition'],
      'transformation': ['change', 'transform', 'become', 'evolution'],
      'chase': ['chase', 'pursue', 'follow', 'hunt', 'track'],
      'escape': ['escape', 'flee', 'run away', 'get away'],
      'betrayal': ['betray', 'deceive', 'trick', 'lie to'],
      'sacrifice': ['sacrifice', 'give up', 'offer', 'surrender']
    };
    
    Object.entries(plotKeywords).forEach(([element, keywords]) => {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        plotElements.add(element);
      }
    });
    
    return Array.from(plotElements).slice(0, 8);
  }

  private generateSemanticTagsBasic(content: string): string[] {
    const tags = new Set<string>();
    const contentLower = content.toLowerCase();
    
    // Genre tags
    const genreIndicators = {
      'fantasy': ['magic', 'wizard', 'dragon', 'spell', 'enchant'],
      'scifi': ['space', 'robot', 'alien', 'future', 'technology'],
      'mystery': ['mystery', 'detective', 'clue', 'investigate', 'solve'],
      'romance': ['romance', 'love', 'relationship', 'date', 'heart'],
      'horror': ['horror', 'scary', 'fear', 'nightmare', 'monster'],
      'thriller': ['thriller', 'suspense', 'danger', 'chase', 'escape'],
      'drama': ['emotion', 'dramatic', 'intense', 'serious', 'deep'],
      'comedy': ['funny', 'humor', 'laugh', 'joke', 'silly'],
      'action': ['action', 'fight', 'battle', 'adventure', 'chase'],
      'dialogue': ['"', 'said', 'asked', 'replied', 'whispered']
    };
    
    Object.entries(genreIndicators).forEach(([genre, indicators]) => {
      if (indicators.some(indicator => contentLower.includes(indicator))) {
        tags.add(genre);
      }
    });
    
    // Content type tags
    if (content.includes('"')) tags.add('dialogue');
    if (content.match(/[.!?]{3,}/)) tags.add('dramatic');
    if (content.length > 1000) tags.add('long-form');
    if (content.split('\n\n').length > 3) tags.add('multi-paragraph');
    
    return Array.from(tags).slice(0, 10);
  }

  private classifyContentType(content: string): 'narrative' | 'dialogue' | 'notes' | 'character' | 'plot' | 'setting' | 'theme' {
    const dialogueRatio = (content.match(/"/g) || []).length / 2 / content.split(/[.!?]+/).length;
    
    if (dialogueRatio > 0.5) return 'dialogue';
    
    const contentLower = content.toLowerCase();
    
    // Character profiles often have descriptive language about people
    if (contentLower.includes('character') || 
        (contentLower.match(/(he|she|they)\s+(is|was|are|were)/g) || []).length > 2) {
      return 'character';
    }
    
    // Setting descriptions often have location/place indicators
    if (contentLower.match(/(in the|at the|near the|outside the|inside the)/g)) {
      return 'setting';
    }
    
    // Plot points often have action words
    if (contentLower.match(/(then|next|after|before|when|suddenly)/g)) {
      return 'plot';
    }
    
    // Notes are often shorter and fragmented
    if (content.length < 200 || content.split('\n').length > content.length / 50) {
      return 'notes';
    }
    
    // Thematic content often discusses ideas and concepts
    if (contentLower.match(/(theme|meaning|represents|symbolizes|about)/g)) {
      return 'theme';
    }
    
    return 'narrative';
  }

  private calculateImportance(content: string, analysis: any): number {
    let importance = 1;
    
    // Length factor
    if (content.length > 1000) importance += 1;
    if (content.length > 2000) importance += 1;
    
    // Metadata richness
    importance += (analysis.characters?.length || 0) * 0.1;
    importance += (analysis.themes?.length || 0) * 0.1;
    importance += (analysis.plotElements?.length || 0) * 0.1;
    
    // Dialogue presence
    const dialogueCount = (content.match(/"/g) || []).length;
    if (dialogueCount > 4) importance += 0.5;
    
    return Math.min(5, Math.max(1, importance));
  }

  private async updateProjectContextInDB(projectId: string, analysis: any): Promise<void> {
    try {
      // Update or create project context in database
      const existingContext = await prisma.projectContext.findFirst({
        where: { projectId }
      });

      // For update, don't include projectId (it's a relation field)
      const updateData = {
        characters: analysis.characters || [],
        themes: analysis.themes || [],
        settings: analysis.settings || [],
        plotPoints: analysis.plotPoints || [],
        writingStyle: analysis.writingStyle || null,
        toneAnalysis: analysis.toneAnalysis || null,
        lastAnalyzed: new Date()
      };

      // For create, include projectId
      const createData = {
        projectId,
        ...updateData
      };

      if (existingContext) {
        await prisma.projectContext.update({
          where: { id: existingContext.id },
          data: updateData
        });
        console.log(`✅ Updated project context in database for project ${projectId}`);
      } else {
        await prisma.projectContext.create({
          data: createData
        });
        console.log(`✅ Created project context in database for project ${projectId}`);
      }
    } catch (error) {
      console.error('❌ Error updating project context in DB:', error);
    }
  }

  

  private getProjectDocuments(projectId: string): EnhancedDocument[] {
    return this.documents.filter(doc => doc.metadata.projectId === projectId);
  }

  private extractRelevantCharacters(results: EnhancedDocument[], query: string): string[] {
    const characters = new Set<string>();
    results.forEach(doc => {
      doc.metadata.characters?.forEach(char => characters.add(char));
    });
    return Array.from(characters).slice(0, 5);
  }

  private extractRelevantThemes(results: EnhancedDocument[], query: string): string[] {
    const themes = new Set<string>();
    results.forEach(doc => {
      doc.metadata.themes?.forEach(theme => themes.add(theme));
    });
    return Array.from(themes).slice(0, 5);
  }

  private findSuggestedConnections(results: EnhancedDocument[], projectDocs: EnhancedDocument[]): string[] {
    const connections: string[] = [];
    
    // Find common themes across results
    const commonThemes = new Map<string, number>();
    results.forEach(doc => {
      doc.metadata.themes?.forEach(theme => {
        commonThemes.set(theme, (commonThemes.get(theme) || 0) + 1);
      });
    });

    // Suggest connections based on common themes
    Array.from(commonThemes.entries())
      .filter(([_, count]) => count > 1)
      .slice(0, 3)
      .forEach(([theme, _]) => {
        connections.push(`Multiple documents explore the theme of ${theme}`);
      });

    return connections;
  }

  private generateContextualHints(results: EnhancedDocument[], projectContext: ProjectContext | null, query: string): string[] {
    const hints: string[] = [];

    if (results.length === 0) {
      hints.push('No results found. Try broadening your search terms.');
      return hints;
    }

    // Character-based hints
    const characters = new Set<string>();
    results.forEach(doc => doc.metadata.characters?.forEach(char => characters.add(char)));
    
    if (characters.size > 0) {
      hints.push(`Found content involving: ${Array.from(characters).slice(0, 3).join(', ')}`);
    }

    // Theme-based hints
    const themes = new Set<string>();
    results.forEach(doc => doc.metadata.themes?.forEach(theme => themes.add(theme)));
    
    if (themes.size > 0) {
      hints.push(`Related themes: ${Array.from(themes).slice(0, 3).join(', ')}`);
    }

    // Content type distribution
    const contentTypes = new Map<string, number>();
    results.forEach(doc => {
      if (doc.metadata.contentType) {
        contentTypes.set(doc.metadata.contentType, (contentTypes.get(doc.metadata.contentType) || 0) + 1);
      }
    });

    if (contentTypes.size > 1) {
      const typesList = Array.from(contentTypes.entries()).map(([type, count]) => `${count} ${type}`);
      hints.push(`Content types: ${typesList.join(', ')}`);
    }

    return hints;
  }

  // Document management helpers
  private generateDocumentId(content: string, projectId?: string): string {
    const contentHash = this.hashContent(content);
    const projectPrefix = projectId ? `${projectId}_` : '';
    return `${projectPrefix}${contentHash}_${Date.now()}`;
  }

  private findExistingDocument(content: string, projectId: string): EnhancedDocument | null {
    const projectDocs = this.getProjectDocuments(projectId);
    
    for (const doc of projectDocs) {
      const similarity = this.calculateTextSimilarity(content, doc.pageContent);
      if (similarity > 0.95) { // Very high similarity threshold for deduplication
        return doc;
      }
    }
    
    return null;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set(Array.from(words1).filter(word => words2.has(word)));
    const union = new Set([...Array.from(words1), ...Array.from(words2)]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private async updateDocumentMetadata(existingDoc: EnhancedDocument, newMetadata: Record<string, any>): Promise<void> {
    // Merge character lists
    const existingChars = new Set(existingDoc.metadata.characters || []);
    const existingThemes = new Set(existingDoc.metadata.themes || []);

    if (newMetadata.characters) {
      newMetadata.characters.forEach((char: string) => existingChars.add(char));
      existingDoc.metadata.characters = Array.from(existingChars);
    }

    if (newMetadata.themes) {
      newMetadata.themes.forEach((theme: string) => existingThemes.add(theme));
      existingDoc.metadata.themes = Array.from(existingThemes);
    }

    // Update other metadata
    Object.entries(newMetadata).forEach(([key, value]) => {
      if (key !== 'characters' && key !== 'themes' && value !== undefined) {
        existingDoc.metadata[key] = value;
      }
    });

    existingDoc.metadata.lastUpdated = new Date();

    // Sync project context if needed
    if (existingDoc.metadata.projectId) {
      await this.syncProjectContext(existingDoc.metadata.projectId);
    }
  }

  private hashContent(content: string): string {
    return crypto
      .createHash('md5')
      .update(content)
      .digest('hex')
      .substring(0, 12);
  }

  // Data persistence
  private async persistData(): Promise<void> {
    try {
      const data = {
        documents: this.documents,
        projectContexts: Array.from(this.projectContexts.entries()),
        lastUpdated: new Date().toISOString()
      };

      // Ensure directory exists
      const dataDir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.persistencePath, JSON.stringify(data, null, 2));
      console.log('📁 RAG service data persisted successfully');

    } catch (error) {
      console.error('❌ Error persisting RAG service data:', error);
    }
  }

  private async loadPersistedData(): Promise<void> {
    try {
      if (fs.existsSync(this.persistencePath) && this.vectorStore && this.embeddings) {
        const data = JSON.parse(fs.readFileSync(this.persistencePath, 'utf8'));
        
        if (data.documents && Array.isArray(data.documents)) {
          this.documents = data.documents;
          
          if (this.documents.length > 0) {
            try {
              await this.vectorStore.addDocuments(this.documents);
              console.log(` Loaded ${this.documents.length} documents into vector store`);
            } catch (embedError: any) {
              if (embedError.message?.includes('429') || embedError.message?.includes('quota')) {
                console.warn(' Rate limited during data loading, documents available for text search only');
              }
            }
          }
        }

        if (data.projectContexts && Array.isArray(data.projectContexts)) {
          this.projectContexts = new Map(data.projectContexts);
          console.log(`🎯 Loaded ${this.projectContexts.size} project contexts`);
        }

        console.log('✅ RAG service data loaded successfully');
      }
    } catch (error) {
      console.error('❌ Error loading persisted RAG service data:', error);
    }
  }
}
