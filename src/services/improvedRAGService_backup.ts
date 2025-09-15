import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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
    previousContext?: string;
    nextContext?: string;
    relatedChunks?: string[];
    contextualInfo?: {
      summary: string;
      keyElements: {
        characters: string[];
        themes: string[];
        emotions: string[];
      };
      position: string;
      importance: number;
    };
    documentId?: string;
    [key: string]: any;
  };
  relevanceScore?: number;
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

// Fix for filter parameters interface
interface FilterOptions {
  projectId?: string;
  userId?: string;
  contentTypes?: string[];
  themes?: string[];
  characters?: string[];
  timeRange?: { start: string; end: string };
  importance?: number;
  query?: string;
}

class ImprovedRAGService {
  private vectorStore: MemoryVectorStore | null;
  private textSplitter: RecursiveCharacterTextSplitter | null;
  private embeddings: GoogleGenerativeAIEmbeddings | null;
  private aiModel: ChatGoogleGenerativeAI | null;
  private persistencePath: string;
  private documents: EnhancedDocument[];
  private projectDocumentIndex: Map<string, Set<number>> = new Map(); // projectId -> document indices
  private semanticCache: Map<string, any> = new Map(); // Cache for expensive operations
  private readonly MAX_SEMANTIC_CACHE_SIZE = 1000;

  constructor() {
    this.persistencePath = path.join(__dirname, '../../data/improved_vector_store.json');
    this.documents = [];
    
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("No API key found for Google Generative AI. RAG features will not work.");
      this.embeddings = null;
      this.vectorStore = null;
      this.textSplitter = null;
      this.aiModel = null;
      return;
    }
    
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey,
      modelName: "embedding-001"
    });
    
    this.aiModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 1024,
      apiKey: apiKey,
      temperature: 0.3,
    });
    
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    
    // Advanced semantic-aware text splitter
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,        // Smaller chunks for better precision
      chunkOverlap: 150,     // Sufficient overlap for context
      separators: [
        "\n\n\n",   // Chapter/scene breaks (highest priority)
        "\n\n",     // Paragraph breaks
        "\n---\n",  // Scene separators
        "\n",       // Line breaks
        ". ",       // Sentence endings
        "! ",       // Exclamations
        "? ",       // Questions
        "; ",       // Semicolons for complex sentences
        ": ",       // Colons for lists/explanations
        ", ",       // Commas
        " ",        // Word boundaries
        ""          // Character fallback
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
          //@ts-ignore
          contexts: {
            select: {
              id: true,
              contextType: true,
              title: true,
              characters: true,
              themes: true,
              plotPoints: true,
              settings: true,
              writingStyle: true,
              toneAnalysis: true,
              projectId: true,
              genre: true,
              wordCount: true,
              chapterCount: true,
              updatedAt: true
            }
          },
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

      //@ts-ignore
      let context = project.contexts.find(ctx => ctx.contextType === 'GENERAL');
      
      if (!context && project.content) {
        // Analyze project content and create context
        const analysis = await this.analyzeProjectContent(project.content);
        //@ts-ignore
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
            wordCount: project.content.split(/\s+/).filter(word => word.length > 0).length,
            lastAnalyzed: new Date(),
            metadata: {
              //@ts-ignore
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
        characters: context.characters as string[] || [],
        themes: context.themes as string[] || [],
        plotPoints: context.plotPoints as string[] || [],
        settings: context.settings as string[] || [],
        writingStyle: context.writingStyle || undefined,
        toneAnalysis: context.toneAnalysis || undefined,
        lastUpdated: context.updatedAt.toISOString(),
        wordCount: context.wordCount || undefined,
        chapterCount: context.chapterCount || undefined
      } : null;
    } catch (error) {
      console.error('Error syncing project context:', error);
      return null;
    }
  }

  // Enhanced document addition with deduplication and database integration
  async addDocument(content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }
    
    try {
      const projectId = metadata.projectId;
      const userId = metadata.userId;
      
      // Check for existing similar content to prevent duplicates
      if (projectId) {
        const existingDoc = this.findExistingDocument(content, projectId);
        if (existingDoc) {
          console.log(`📄 Document already exists for project ${projectId}, updating metadata instead`);
          await this.updateDocumentMetadata(existingDoc, metadata);
          return;
        }
      }
      
      // Sync project context with database
      const projectContext = projectId ? await this.syncProjectContext(projectId) : null;
      
      // Perform deep content analysis
      const contentAnalysis = await this.analyzeContent(content, projectContext);
      
      // Enhanced metadata with semantic information
      const enhancedMetadata = {
        ...metadata,
        documentId: this.generateDocumentId(content, projectId),
        timestamp: new Date().toISOString(),
        wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
        contentType: this.classifyContentType(content),
        characters: contentAnalysis.characters,
        themes: contentAnalysis.themes,
        emotions: contentAnalysis.emotions,
        plotElements: contentAnalysis.plotElements,
        semanticTags: contentAnalysis.semanticTags,
        importance: this.calculateImportance(content, contentAnalysis),
        projectContext: projectContext
      };
      
      // Only use embeddings if available, otherwise skip vector operations
      let enhancedDocs: EnhancedDocument[];
      
      if (this.embeddings && this.vectorStore && this.textSplitter) {
        // Create enhanced chunks with better context preservation
        const docs = await this.textSplitter.createDocuments([content], [enhancedMetadata]);
        
        enhancedDocs = docs.map((doc, index) => {
          const previousChunk = index > 0 ? docs[index - 1].pageContent.slice(-150) : "";
          const nextChunk = index < docs.length - 1 ? docs[index + 1].pageContent.slice(0, 150) : "";
          
          const finalMetadata = {
            ...enhancedMetadata,
            projectId: projectId || 'unknown',
            userId: userId,
            chunkIndex: index,
            totalChunks: docs.length,
            previousContext: previousChunk,
            nextContext: nextChunk,
            relatedChunks: this.findRelatedChunks(doc.pageContent, projectId || 'unknown'),
          };
          
          return new Document({
            pageContent: doc.pageContent,
            metadata: finalMetadata
          }) as EnhancedDocument;
        });
        
        // Add to vector store
        await this.vectorStore.addDocuments(enhancedDocs);
      } else {
        console.warn('⚠️ Vector embeddings not available, creating text-only document');
        // Create a single document without chunking for fallback search
        enhancedDocs = [new Document({
          pageContent: content,
          metadata: {
            ...enhancedMetadata,
            projectId: projectId || 'unknown',
            userId: userId,
            chunkIndex: 0,
            totalChunks: 1,
            previousContext: '',
            nextContext: '',
            relatedChunks: [],
          }
        }) as EnhancedDocument];
      }
      
      // Update indices
      const startIndex = this.documents.length;
      this.documents.push(...enhancedDocs);
      
      // Update project document index
      if (projectId) {
        if (!this.projectDocumentIndex.has(projectId)) {
          this.projectDocumentIndex.set(projectId, new Set());
        }
        const projectDocs = this.projectDocumentIndex.get(projectId)!;
        for (let i = 0; i < enhancedDocs.length; i++) {
          projectDocs.add(startIndex + i);
        }
      }
      
      // Update project context in database with extracted metadata
      if (projectId) {
        await this.updateProjectContextInDB(projectId, contentAnalysis);
      }
      
      console.log(`✅ Added ${enhancedDocs.length} enhanced document chunks for project ${projectId || 'unknown'}`);
      
      // Persist the data
      await this.persistData();
    } catch (error) {
      console.error("❌ Error adding document to improved vector store:", error);
      throw error;
    }
  }

  // Enhanced intelligent search with AI-powered relevance scoring and fallback
  async intelligentSearch(query: string, options: SearchOptions = {}): Promise<{
    results: EnhancedDocument[];
    projectInsights?: {
      relevantCharacters: string[];
      relevantThemes: string[];
      suggestedConnections: string[];
      contextualHints: string[];
      queryAnalysis?: string;
      searchStrategy?: string;
    };
    searchSummary?: {
      totalResults: number;
      topCharacters: string[];
      topThemes: string[];
      contentTypes: string[];
      keyFindings: string[];
      searchStrategy: string;
    };
  }> {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }
    
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
    
    console.log(`🔍 Intelligent search query: "${query}" for project: ${projectId || 'none'}`);
    
    try {
      // Try vector search first if embeddings are available
      if (this.embeddings && this.vectorStore) {
        const results = await this.performVectorSearch(query, options);
        return results;
      } else {
        console.warn('⚠️ Embeddings not available, using fallback text search');
        return await this.performFallbackSearch(query, options);
      }
    } catch (error: any) {
      // If we hit rate limits or other embedding errors, fallback to text search
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate limit')) {
        console.warn('⚠️ Embeddings rate limited, using fallback text search');
        return await this.performFallbackSearch(query, options);
      } else {
        console.error("Error in intelligent search:", error);
        return { results: [] };
      }
    }
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
    
    // Generate search summary for fallback results
    const searchSummary = await this.generateSearchSummary(finalResults, query, projectId);
    
    // Generate search summary
    const searchSummary = await this.generateSearchSummary(finalResults, query, projectId);
    
    return {
      results: finalResults,
      projectInsights,
      searchSummary
    };
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
          !contentTypes.includes(doc.metadata.contentType)) {
        return false;
      }
      
      // Importance filter
      if (doc.metadata.importance < importance) {
        return false;
      }
      
      return true;
    });
    
    console.log(`📊 Found ${candidateDocuments.length} candidate documents after filtering`);
    
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
    }).filter(doc => doc.relevanceScore > 0);
    
    // Sort by relevance score
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
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

  // Analyze search query to improve results
  private async analyzeSearchQuery(query: string): Promise<any> {
    if (!this.aiModel) {
      return { type: 'general', keywords: [], intent: 'search' };
    }

    try {
      const prompt = `Analyze this search query for a writing project and return JSON:

QUERY: "${query}"

Return this exact format:
{
  "type": "character|theme|plot|setting|dialogue|general",
  "intent": "search|analysis|suggestion|question",
  "keywords": ["key", "terms", "from", "query"],
  "focus": "what the user is specifically looking for",
  "suggestions": ["related", "search", "terms"]
}

Be precise and helpful.`;

      const response = await this.aiModel.invoke(prompt);
      const responseText = response.content as string;
      
      try {
        return JSON.parse(responseText.trim());
      } catch {
        return { type: 'general', keywords: query.split(' '), intent: 'search' };
      }
    } catch (error) {
      return { type: 'general', keywords: query.split(' '), intent: 'search' };
    }
  }

  // Advanced filtering with query analysis
  private applyAdvancedFiltering(results: EnhancedDocument[], filters: any): EnhancedDocument[] {
    return results.filter(doc => {
      // Basic filters first
      if (filters.userId && doc.metadata.userId !== filters.userId) {
        return false;
      }
      
      if (filters.contentTypes && filters.contentTypes.length > 0 && 
          !filters.contentTypes.includes(doc.metadata.contentType)) {
        return false;
      }
      
      if (filters.importance && doc.metadata.importance < filters.importance) {
        return false;
      }
      
      // Advanced query-based filtering
      if (filters.queryAnalysis) {
        const analysis = filters.queryAnalysis;
        
        // Filter by content type if query is specific
        if (analysis.type !== 'general' && doc.metadata.contentType !== analysis.type) {
          return false;
        }
        
        // Check for keyword relevance
        const contentLower = doc.pageContent.toLowerCase();
        const keywordMatches = analysis.keywords?.filter((keyword: string) => 
          contentLower.includes(keyword.toLowerCase())
        ).length || 0;
        
        if (keywordMatches === 0) {
          return false;
        }
      }
      
      return true;
    });
  }

  // AI-powered contextual ranking
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
      // Score each document for relevance
      const scoredResults = await Promise.all(results.map(async (doc, index) => {
        const relevanceScore = await this.calculateAIRelevanceScore(doc, query, queryAnalysis);
        return {
          ...doc,
          relevanceScore: relevanceScore + (1 - index * 0.01) // Small boost for vector similarity order
        };
      }));

      // Sort by relevance score
      return scoredResults.sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.warn('AI ranking failed, using basic ranking:', error);
      return results;
    }
  }

  // Calculate AI-based relevance score
  private async calculateAIRelevanceScore(
    doc: EnhancedDocument, 
    query: string, 
    queryAnalysis: any
  ): Promise<number> {
    try {
      const prompt = `Rate the relevance of this document to the search query on a scale of 0.0 to 1.0.

SEARCH QUERY: "${query}"
QUERY ANALYSIS: ${JSON.stringify(queryAnalysis)}

DOCUMENT CONTENT:
"""${doc.pageContent.slice(0, 800)}"""

DOCUMENT METADATA:
- Content Type: ${doc.metadata.contentType}
- Characters: ${doc.metadata.characters?.join(', ') || 'none'}
- Themes: ${doc.metadata.themes?.join(', ') || 'none'}
- Emotions: ${doc.metadata.emotions?.join(', ') || 'none'}
- Plot Elements: ${doc.metadata.plotElements?.join(', ') || 'none'}

Return ONLY a number between 0.0 and 1.0, where:
- 1.0 = Perfect match, exactly what the user is looking for
- 0.7-0.9 = Highly relevant, contains key information
- 0.4-0.6 = Somewhat relevant, has related content
- 0.1-0.3 = Tangentially related
- 0.0 = Not relevant

Consider:
- Direct content relevance
- Thematic connections
- Character involvement
- Plot significance
- User intent from query analysis`;

      const response = await this.aiModel!.invoke(prompt);
      const scoreText = response.content as string;
      const score = parseFloat(scoreText.trim());
      
      return isNaN(score) ? 0.5 : Math.max(0, Math.min(1, score));
    } catch (error) {
      return 0.5; // Default middle score
    }
  }

  // Enhanced context enrichment
  private async enrichWithAdvancedContext(
    results: EnhancedDocument[], 
    query: string
  ): Promise<EnhancedDocument[]> {
    return results.map(doc => {
      const relatedChunks = this.findRelatedChunks(doc.pageContent, doc.metadata.projectId);
      const contextualSummary = this.generateContextualSummary(doc, query);
      
      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          relatedChunks,
          contextualSummary,
          searchRelevance: {
            query,
            matchedElements: this.findMatchedElements(doc, query)
          }
        }
      };
    });
  }

  // Generate contextual summary for search result
  private generateContextualSummary(doc: EnhancedDocument, query: string): string {
    const content = doc.pageContent;
    const queryLower = query.toLowerCase();
    
    // Find sentences that contain query terms
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const relevantSentences = sentences.filter(sentence => 
      queryLower.split(' ').some(term => 
        sentence.toLowerCase().includes(term)
      )
    );
    
    if (relevantSentences.length > 0) {
      return relevantSentences.slice(0, 2).join('. ').slice(0, 200) + '...';
    }
    
    return content.slice(0, 150) + '...';
  }

  // Find elements that match the query
  private findMatchedElements(doc: EnhancedDocument, query: string): any {
    const queryLower = query.toLowerCase();
    
    return {
      characters: doc.metadata.characters?.filter((char: string) => 
        queryLower.includes(char.toLowerCase())
      ) || [],
      themes: doc.metadata.themes?.filter((theme: string) => 
        queryLower.includes(theme.toLowerCase())
      ) || [],
      emotions: doc.metadata.emotions?.filter((emotion: string) => 
        queryLower.includes(emotion.toLowerCase())
      ) || [],
      plotElements: doc.metadata.plotElements?.filter((element: string) => 
        queryLower.includes(element.toLowerCase())
      ) || []
    };
  }

  // Generate search summary for better user understanding
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
    
    // Extract metadata from results
    results.forEach(doc => {
      doc.metadata.characters?.forEach((char: string) => characters.add(char));
      doc.metadata.themes?.forEach((theme: string) => themes.add(theme));
      if (doc.metadata.contentType) {
        contentTypes.add(doc.metadata.contentType);
      }
    });
    
    // Generate key findings
    if (characters.size > 0) {
      keyFindings.push(`Found ${characters.size} character${characters.size > 1 ? 's' : ''}: ${Array.from(characters).slice(0, 3).join(', ')}`);
    }
    if (themes.size > 0) {
      keyFindings.push(`${themes.size} theme${themes.size > 1 ? 's' : ''} identified: ${Array.from(themes).slice(0, 3).join(', ')}`);
    }
    if (contentTypes.size > 0) {
      keyFindings.push(`Content spans ${Array.from(contentTypes).join(', ')} sections`);
    }
    
    // Determine search strategy used
    const searchStrategy = this.embeddings && this.vectorStore ? 
      'semantic vector search with AI ranking' : 
      'text-based search with keyword matching';
    
    return {
      totalResults: results.length,
      topCharacters: Array.from(characters).slice(0, 5),
      topThemes: Array.from(themes).slice(0, 5),
      contentTypes: Array.from(contentTypes),
      keyFindings,
      searchStrategy
    };
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

  // AI-powered content analysis
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
    
    let analysis;
    
    if (this.aiModel) {
      try {
        analysis = await this.performAIContentAnalysis(content, projectContext);
      } catch (error) {
        console.warn('AI analysis failed, falling back to basic analysis:', error);
        analysis = this.performBasicContentAnalysis(content, projectContext);
      }
    } else {
      analysis = this.performBasicContentAnalysis(content, projectContext);
    }
    
    this.semanticCache.set(cacheKey, analysis);
    
    // Clean up old cache entries if we have too many
    if (this.semanticCache.size > this.MAX_SEMANTIC_CACHE_SIZE) {
      const oldestKeys = Array.from(this.semanticCache.keys()).slice(0, this.semanticCache.size - this.MAX_SEMANTIC_CACHE_SIZE);
      oldestKeys.forEach(key => this.semanticCache.delete(key));
    }
    
    return analysis;
  }

  // AI-powered content analysis method with advanced prompting
  private async performAIContentAnalysis(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    const contextInfo = projectContext ? `

EXISTING PROJECT CONTEXT:
- Title: ${projectContext.title}
- Genre: ${projectContext.genre || 'Unknown'}
- Known Characters: ${projectContext.characters?.join(', ') || 'None yet identified'}
- Established Themes: ${projectContext.themes?.join(', ') || 'None yet identified'}
- Writing Style: ${projectContext.writingStyle || 'Not specified'}
- Plot Points: ${projectContext.plotPoints?.join(', ') || 'None identified'}

This helps maintain consistency with the existing story elements.` : '';

    const prompt = `Read this text and tell me what you find:

"${content}"

${contextInfo}

I need you to look at this text and find:
- Character names (any people mentioned)
- Themes (what is this about?)
- Emotions (how does it feel?)
- Plot elements (what happens?)
- Tags (describe the writing)

Example: If I give you "Thor is brave and strong", you should find:
- Characters: ["Thor"]
- Themes: ["courage", "strength"]
- Emotions: ["confidence"]
- Plot elements: ["character_description"]
- Tags: ["descriptive", "short"]

Give me your answer as JSON only:
{
  "characters": ["names you found"],
  "themes": ["themes you found"],
  "emotions": ["emotions you found"],
  "plotElements": ["plot things you found"],
  "semanticTags": ["tags you found"]
}`;

    const response = await this.aiModel!.invoke(prompt);
    let responseText = response.content as string;
    
    console.log('🤖 AI Raw Response:', responseText);
    
    // Clean the response to extract just the JSON
    responseText = responseText.trim();
    
    // Try to find JSON in the response
    let jsonText = responseText;
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonText = responseText.substring(jsonStart, jsonEnd + 1);
    }
    
    console.log('📝 Extracted JSON:', jsonText);
    
    try {
      const parsed = JSON.parse(jsonText);
      
      console.log('✅ Parsed Successfully:', parsed);
      
      // Validate and clean the results
      const result = {
        characters: this.validateAndCleanArray(parsed.characters, 10, 'string'),
        themes: this.validateAndCleanArray(parsed.themes, 8, 'string'),
        emotions: this.validateAndCleanArray(parsed.emotions, 8, 'string'),
        plotElements: this.validateAndCleanArray(parsed.plotElements, 8, 'string'),
        semanticTags: this.validateAndCleanArray(parsed.semanticTags, 10, 'string')
      };
      
      console.log('🎯 Final Analysis Result:', result);
      return result;
      
    } catch (parseError) {
      console.error('❌ Failed to parse AI analysis response:', parseError);
      console.error('📄 Raw response was:', responseText);
      console.error('🔧 Attempted to parse:', jsonText);
      
      // Try AI extraction with simpler prompt as fallback
      const fallback = await this.extractWithSimpleAI(content);
      console.log('🔄 Using fallback extraction:', fallback);
      return fallback;
    }
  }

  // Simple AI extraction when complex analysis fails
  private async extractWithSimpleAI(content: string): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    try {
      const simplePrompt = `Text: "${content}"

What characters, themes, and elements do you see? Answer with simple lists:
Characters: 
Themes: 
Emotions: 
Plot: 
Style: `;

      const response = await this.aiModel!.invoke(simplePrompt);
      const text = response.content as string;
      
      console.log('🤖 Simple AI Response:', text);
      
      // Parse the simple response
      const lines = text.split('\n');
      const result = {
        characters: this.extractListFromLine(lines, 'Characters'),
        themes: this.extractListFromLine(lines, 'Themes'),
        emotions: this.extractListFromLine(lines, 'Emotions'),
        plotElements: this.extractListFromLine(lines, 'Plot'),
        semanticTags: this.extractListFromLine(lines, 'Style')
      };
      
      return result;
    } catch (error) {
      console.error('❌ Simple AI extraction also failed:', error);
      return {
        characters: [],
        themes: [],
        emotions: [],
        plotElements: [],
        semanticTags: ['short']
      };
    }
  }

  // Extract list from AI response line
  private extractListFromLine(lines: string[], prefix: string): string[] {
    const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
    if (!line) return [];
    
    const content = line.substring(prefix.length + 1).trim();
    return content.split(',').map(s => s.trim()).filter(s => s.length > 0).slice(0, 5);
  }

  // Validation helper for AI analysis results
  private validateAndCleanArray(arr: any, maxLength: number, expectedType: string): string[] {
    if (!Array.isArray(arr)) return [];
    
    return arr
      .filter(item => typeof item === expectedType && item.trim().length > 0)
      .map(item => item.trim())
      .filter(item => item.length > 1) // Remove single character entries
      .slice(0, maxLength);
  }

  // Basic fallback content analysis
  private performBasicContentAnalysis(content: string, projectContext?: ProjectContext | null): {
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  } {
    return {
      characters: this.extractCharactersBasic(content, projectContext),
      themes: this.extractThemesBasic(content),
      emotions: this.extractEmotionsBasic(content),
      plotElements: this.extractPlotElementsBasic(content),
      semanticTags: this.generateSemanticTagsBasic(content)
    };
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

  // Basic character extraction (fallback)
  private extractCharactersBasic(content: string, projectContext?: ProjectContext | null): string[] {
    const words = content.split(/\s+/);
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
          /\b(said|asked|replied|thought|felt|walked|ran|looked)\b/i.test(context) ||
          /\b(he|she|his|her|him)\b/i.test(context)
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

  // Basic theme extraction (fallback)
  private extractThemesBasic(content: string): string[] {
    const basicThemes = {
      'love': ['love', 'romance', 'heart', 'affection'],
      'betrayal': ['betray', 'deceive', 'lie', 'cheat'],
      'power': ['power', 'control', 'authority', 'rule'],
      'friendship': ['friend', 'companion', 'ally', 'loyalty'],
      'family': ['family', 'mother', 'father', 'parent'],
      'sacrifice': ['sacrifice', 'selfless', 'noble'],
      'death': ['death', 'die', 'dead', 'mortality']
    };
    
    const lowerContent = content.toLowerCase();
    const detectedThemes: string[] = [];
    
    Object.entries(basicThemes).forEach(([theme, keywords]) => {
      const hasTheme = keywords.some(keyword => 
        lowerContent.includes(keyword.toLowerCase())
      );
      if (hasTheme) {
        detectedThemes.push(theme);
      }
    });
    
    return detectedThemes.slice(0, 5);
  }

  // Extract settings/locations from content
  private extractSettings(content: string): string[] {
    const locationPatterns = [
      /\b[A-Z][a-z]+ (?:City|Town|Village|Kingdom|Empire|Forest|Mountain|Desert|Ocean|Lake|River|Castle|Palace|Temple|School|Hospital|Library|Restaurant|Bar|Hotel|House|Apartment|Office|Shop|Market)\b/g,
      /\b(?:the )?[A-Z][a-z]+ (?:of [A-Z][a-z]+)?\b/g
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
    const wordCount = content.split(/\s+/).length;
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
    
    const descriptiveWords = content.match(/\b(beautiful|dark|bright|ancient|mysterious|elegant|graceful|powerful)\b/gi);
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
  private extractEmotionsBasic(content: string): string[] {
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

  // Basic plot elements extraction (fallback)
  private extractPlotElementsBasic(content: string): string[] {
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

  // Basic semantic tags generation (fallback)
  private generateSemanticTagsBasic(content: string): string[] {
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

  // Enhanced content type classification with better accuracy
  private classifyContentType(content: string): 'narrative' | 'dialogue' | 'notes' | 'character' | 'plot' | 'setting' | 'theme' {
    const lowerContent = content.toLowerCase();
    const lines = content.split('\n');
    const dialogueCount = (content.match(/"/g) || []).length;
    const wordCount = content.split(/\s+/).length;
    
    // Score-based classification for better accuracy
    const scores = {
      dialogue: 0,
      narrative: 0,
      character: 0,
      plot: 0,
      setting: 0,
      theme: 0,
      notes: 0
    };
    
    // Dialogue indicators
    if (dialogueCount > 2) scores.dialogue += 3;
    if (content.includes('said') || content.includes('asked') || content.includes('replied')) {
      scores.dialogue += 2;
    }
    if (/^\s*["'].+["']\s*,?\s*(he|she|they|\w+)\s+(said|asked|replied|whispered|shouted)/im.test(content)) {
      scores.dialogue += 4;
    }
    
    // Character development indicators
    const characterWords = ['personality', 'character', 'motivation', 'backstory', 'trait', 'behavior'];
    characterWords.forEach(word => {
      if (lowerContent.includes(word)) scores.character += 1;
    });
    if (/\b(he|she|his|her|him)\s+(is|was|has|had|felt|thought|remembered)\b/gi.test(content)) {
      scores.character += 2;
    }
    
    // Plot indicators
    const plotWords = ['plot', 'story', 'conflict', 'resolution', 'climax', 'twist', 'reveal'];
    plotWords.forEach(word => {
      if (lowerContent.includes(word)) scores.plot += 1;
    });
    if (/\b(then|next|suddenly|meanwhile|later|after|before)\b/gi.test(content)) {
      scores.plot += 1;
    }
    
    // Setting indicators
    const settingWords = ['setting', 'location', 'place', 'environment', 'atmosphere', 'landscape'];
    settingWords.forEach(word => {
      if (lowerContent.includes(word)) scores.setting += 1;
    });
    if (/\b(in the|at the|outside|inside|room|house|city|forest|mountain)\b/gi.test(content)) {
      scores.setting += 1;
    }
    
    // Theme indicators
    const themeWords = ['theme', 'meaning', 'symbolism', 'represents', 'signifies', 'metaphor'];
    themeWords.forEach(word => {
      if (lowerContent.includes(word)) scores.theme += 1;
    });
    
    // Notes indicators
    const notePatterns = [/^note:/im, /^todo:/im, /^remember:/im, /^idea:/im, /\[.*\]/g];
    notePatterns.forEach(pattern => {
      if (pattern.test(content)) scores.notes += 2;
    });
    
    // Narrative is default, but gets points for storytelling elements
    if (wordCount > 50 && dialogueCount < 4) {
      scores.narrative += 2;
    }
    if (/\b(narrator|story|tale|once|began|ended)\b/gi.test(content)) {
      scores.narrative += 1;
    }
    
    // Find the highest scoring type
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) return 'narrative';
    
    const topType = Object.entries(scores).find(([_, score]) => score === maxScore)?.[0] as keyof typeof scores;
    return topType || 'narrative';
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
      //@ts-ignore
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
        const allCharacters = new Set([...(existingContext.characters as string[] || []), ...analysis.characters]);
        const allThemes = new Set([...(existingContext.themes as string[] || []), ...analysis.themes]);
        //@ts-ignore
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
  private applyIntelligentFiltering(results: EnhancedDocument[], filters: FilterOptions): EnhancedDocument[] {
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
    }).sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
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

  // Helper methods for document management
  private generateDocumentId(content: string, projectId?: string): string {
    const contentHash = this.hashContent(content);
    const projectPrefix = projectId ? projectId.slice(0, 8) : 'global';
    return `${projectPrefix}_${contentHash}_${Date.now()}`;
  }
  
  private findExistingDocument(content: string, projectId: string): EnhancedDocument | null {
    const projectDocs = this.getProjectDocuments(projectId);
    const contentLower = content.toLowerCase().trim();
    
    // Check for exact matches or very similar content (90% similarity)
    for (const doc of projectDocs) {
      const docContentLower = doc.pageContent.toLowerCase().trim();
      
      // Exact match
      if (docContentLower === contentLower) {
        return doc;
      }
      
      // High similarity check (Jaccard similarity)
      const similarity = this.calculateTextSimilarity(contentLower, docContentLower);
      if (similarity > 0.9) {
        console.log(`🔄 Found similar document with ${Math.round(similarity * 100)}% similarity`);
        return doc;
      }
    }
    
    return null;
  }
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  private async updateDocumentMetadata(existingDoc: EnhancedDocument, newMetadata: Record<string, any>): Promise<void> {
    // Merge characters and themes
    const existingChars = new Set(existingDoc.metadata.characters || []);
    const existingThemes = new Set(existingDoc.metadata.themes || []);
    
    if (newMetadata.characters) {
      newMetadata.characters.forEach((char: string) => existingChars.add(char));
    }
    if (newMetadata.themes) {
      newMetadata.themes.forEach((theme: string) => existingThemes.add(theme));
    }
    
    // Update metadata
    existingDoc.metadata = {
      ...existingDoc.metadata,
      ...newMetadata,
      characters: Array.from(existingChars),
      themes: Array.from(existingThemes),
      lastUpdated: new Date().toISOString()
    };
    
    // Update project context if needed
    if (existingDoc.metadata.projectId) {
      const contentAnalysis = {
        characters: Array.from(existingChars),
        themes: Array.from(existingThemes),
        emotions: existingDoc.metadata.emotions || [],
        plotElements: existingDoc.metadata.plotElements || [],
        semanticTags: existingDoc.metadata.semanticTags || []
      };
      
      await this.updateProjectContextInDB(existingDoc.metadata.projectId, contentAnalysis);
    }
    
    console.log(`✅ Updated existing document metadata`);
    await this.persistData();
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