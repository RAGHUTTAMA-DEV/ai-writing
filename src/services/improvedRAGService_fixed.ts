import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

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

  constructor() {
    this.persistencePath = path.join(process.cwd(), 'data', 'rag_service_data.json');
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      const apiKey = process.env.GOOGLE_AI_API_KEY;
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
      
    } catch (error) {
      console.error('❌ Failed to initialize ImprovedRAGService:', error);
      this.embeddings = null;
      this.aiModel = null;
      this.vectorStore = null;
    }
  }

  // Main search method with intelligent fallback
  async intelligentSearch(query: string, options: SearchOptions = {}): Promise<{
    results: EnhancedDocument[];
    projectInsights?: any;
    searchSummary?: any;
  }> {
    console.log(`🔍 Starting intelligent search for: "${query}"`);
    
    try {
      // Try vector-based search first
      if (this.vectorStore && this.embeddings) {
        return await this.performVectorSearch(query, options);
      } else {
        console.log('📝 Vector store unavailable, using fallback text search');
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

      // Add to vector store if available
      if (this.vectorStore && this.embeddings) {
        try {
          await this.vectorStore.addDocuments([enhancedDoc]);
          console.log('✅ Document added to vector store');
        } catch (embedError: any) {
          if (embedError.message?.includes('429') || embedError.message?.includes('quota')) {
            console.warn('⚠️ Vector store rate limited, document added to text search only');
          } else {
            throw embedError;
          }
        }
      }

      // Update project context
      if (projectId) {
        await this.syncProjectContext(projectId);
      }

      // Persist data
      await this.persistData();

      console.log(`✅ Document added successfully. ID: ${docId}`);

    } catch (error) {
      console.error('❌ Error adding document:', error);
      throw error;
    }
  }

  // Analyze content and extract metadata
  private async analyzeContent(content: string, projectContext?: ProjectContext | null): Promise<{
    characters: string[];
    themes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
  }> {
    // Check cache first
    const cacheKey = `analysis_${this.hashContent(content)}_${projectContext?.projectId || 'none'}`;
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }

    let result;
    
    try {
      if (this.aiModel) {
        result = await this.performAIContentAnalysis(content, projectContext);
      } else {
        result = this.performBasicContentAnalysis(content, projectContext);
      }

      // Cache the result
      this.semanticCache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error analyzing content:', error);
      // Fallback to basic analysis
      result = this.performBasicContentAnalysis(content, projectContext);
      this.semanticCache.set(cacheKey, result);
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
      return this.performBasicContentAnalysis(content);
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

  // Project context management
  async syncProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      const projectDocs = this.getProjectDocuments(projectId);
      
      if (projectDocs.length === 0) {
        return null;
      }

      // Aggregate analysis from all project documents
      const aggregatedContent = projectDocs.map(doc => doc.pageContent).join('\n\n');
      const analysis = await this.analyzeProjectContent(aggregatedContent);

      const projectContext: ProjectContext = {
        projectId,
        characters: analysis.characters,
        themes: analysis.themes,
        plotPoints: analysis.plotPoints,
        settings: analysis.settings,
        writingStyle: analysis.writingStyle,
        toneAnalysis: analysis.toneAnalysis,
        lastUpdated: new Date()
      };

      this.projectContexts.set(projectId, projectContext);

      // Update database
      await this.updateProjectContextInDB(projectId, analysis);

      return projectContext;
    } catch (error) {
      console.error(`Error syncing project context for ${projectId}:`, error);
      return null;
    }
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

  // Get project statistics
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

    projectDocs.forEach(doc => {
      // Aggregate metadata
      doc.metadata.characters?.forEach(char => characters.add(char));
      doc.metadata.themes?.forEach(theme => themes.add(theme));
      doc.metadata.emotions?.forEach(emotion => emotions.add(emotion));
      doc.metadata.plotElements?.forEach(element => plotElements.add(element));
      doc.metadata.semanticTags?.forEach(tag => semanticTags.add(tag));
      
      if (doc.metadata.contentType) contentTypes.add(doc.metadata.contentType);
      
      if (doc.metadata.importance) {
        totalImportance += doc.metadata.importance;
        validImportanceCount++;
      }
      
      totalWordCount += doc.metadata.wordCount || 0;
    });

    const projectContext = this.projectContexts.get(projectId);

    return {
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
  }

  // Helper methods
  private extractCharactersBasic(content: string, projectContext?: ProjectContext | null): string[] {
    const characters = new Set<string>();
    
    // Look for quoted dialogue (indicating speakers)
    const dialogueMatches = content.match(/"[^"]*"/g);
    if (dialogueMatches) {
      // Look for attribution patterns like 'said John', 'John replied', etc.
      dialogueMatches.forEach(quote => {
        const beforeQuote = content.substring(0, content.indexOf(quote));
        const afterQuote = content.substring(content.indexOf(quote) + quote.length);
        
        // Look for speaker attribution
        const speakerPatterns = [
          /(\w+)\s+said/i,
          /(\w+)\s+replied/i,
          /(\w+)\s+asked/i,
          /(\w+)\s+whispered/i,
          /(\w+)\s+shouted/i,
          /said\s+(\w+)/i,
          /replied\s+(\w+)/i
        ];
        
        speakerPatterns.forEach(pattern => {
          const match = afterQuote.match(pattern) || beforeQuote.match(pattern);
          if (match && match[1] && match[1].length > 2 && !this.isCommonWord(match[1])) {
            characters.add(match[1]);
          }
        });
      });
    }
    
    // Look for proper nouns (capitalized words that aren't sentence starts)
    const sentences = content.split(/[.!?]+/);
    sentences.forEach(sentence => {
      const words = sentence.trim().split(/\s+/);
      words.slice(1).forEach(word => { // Skip first word (sentence start)
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord.length > 2 && 
            cleanWord[0] === cleanWord[0].toUpperCase() && 
            !this.isCommonWord(cleanWord) &&
            !this.isLocationWord(cleanWord)) {
          characters.add(cleanWord);
        }
      });
    });
    
    // If we have project context, prioritize known characters
    if (projectContext?.characters) {
      projectContext.characters.forEach(char => {
        if (content.toLowerCase().includes(char.toLowerCase())) {
          characters.add(char);
        }
      });
    }
    
    return Array.from(characters).slice(0, 10);
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

      const contextData = {
        projectId,
        characters: analysis.characters || [],
        themes: analysis.themes || [],
        settings: analysis.settings || [],
        lastUpdated: new Date()
      };

      if (existingContext) {
        await prisma.projectContext.update({
          where: { id: existingContext.id },
          data: contextData
        });
      } else {
        await prisma.projectContext.create({
          data: contextData
        });
      }
    } catch (error) {
      console.error('Error updating project context in DB:', error);
    }
  }

  private applyIntelligentFiltering(results: EnhancedDocument[], filters: FilterOptions): EnhancedDocument[] {
    return results.filter(doc => {
      // Basic filters
      if (filters.projectId && doc.metadata.projectId !== filters.projectId) return false;
      if (filters.userId && doc.metadata.userId !== filters.userId) return false;
      if (filters.importance && doc.metadata.importance && doc.metadata.importance < filters.importance) return false;

      // Content type filtering
      if (filters.contentTypes?.length && !filters.contentTypes.includes(doc.metadata.contentType)) return false;

      // Theme filtering with fuzzy matching
      if (filters.themes?.length) {
        const hasMatchingTheme = filters.themes.some(filterTheme =>
          doc.metadata.themes?.some(docTheme =>
            docTheme.toLowerCase().includes(filterTheme.toLowerCase()) ||
            filterTheme.toLowerCase().includes(docTheme.toLowerCase())
          )
        );
        if (!hasMatchingTheme) return false;
      }

      // Character filtering with fuzzy matching
      if (filters.characters?.length) {
        const hasMatchingCharacter = filters.characters.some(filterChar =>
          doc.metadata.characters?.some(docChar =>
            docChar.toLowerCase().includes(filterChar.toLowerCase()) ||
            filterChar.toLowerCase().includes(docChar.toLowerCase())
          )
        );
        if (!hasMatchingCharacter) return false;
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

  private applyContextualRanking(results: EnhancedDocument[], query: string, projectId?: string): EnhancedDocument[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);

    return results
      .map(doc => {
        let contextScore = 0;

        // Base relevance from content
        if (doc.pageContent.toLowerCase().includes(queryLower)) {
          contextScore += 10;
        }

        // Term matching
        queryTerms.forEach(term => {
          const content = doc.pageContent.toLowerCase();
          const termCount = (content.match(new RegExp(term, 'g')) || []).length;
          contextScore += termCount * 2;

          // Metadata matching
          if (doc.metadata.characters?.some(char => char.toLowerCase().includes(term))) contextScore += 3;
          if (doc.metadata.themes?.some(theme => theme.toLowerCase().includes(term))) contextScore += 3;
          if (doc.metadata.semanticTags?.some(tag => tag.toLowerCase().includes(term))) contextScore += 1;
        });

        // Importance boost
        contextScore += doc.metadata.importance || 0;

        // Content type relevance
        if (doc.metadata.contentType === 'dialogue' && queryLower.includes('said')) contextScore += 2;

        return { ...doc, contextScore };
      })
      .sort((a, b) => (b.contextScore || 0) - (a.contextScore || 0));
  }

  private async enrichWithContext(results: EnhancedDocument[]): Promise<EnhancedDocument[]> {
    return results.map(doc => {
      const relatedChunks = this.findRelatedChunks(doc.pageContent, doc.metadata.projectId || '');
      const contextualInfo = this.generateContextualInfo(doc);

      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          relatedChunks,
          contextualInfo,
          enhanced: true
        }
      };
    });
  }

  private findRelatedChunks(content: string, projectId: string): string[] {
    const projectDocs = this.getProjectDocuments(projectId);
    const contentLower = content.toLowerCase();
    
    return projectDocs
      .filter(doc => {
        const similarity = this.calculateTextSimilarity(content, doc.pageContent);
        return similarity > 0.3 && doc.pageContent !== content;
      })
      .slice(0, 3)
      .map(doc => doc.pageContent.slice(0, 100) + '...');
  }

  private generateContextualInfo(doc: EnhancedDocument): any {
    return {
      wordCount: doc.metadata.wordCount,
      estimatedReadingTime: Math.ceil((doc.metadata.wordCount || 0) / 200),
      contentType: doc.metadata.contentType,
      importance: doc.metadata.importance,
      keyElements: {
        characters: doc.metadata.characters?.slice(0, 3),
        themes: doc.metadata.themes?.slice(0, 3)
      }
    };
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

  // Utility methods
  private isCommonWord(word: string): boolean {
    const commonWords = new Set(['the', 'and', 'but', 'for', 'you', 'all', 'that', 'have', 'her', 'was', 'one', 'our', 'had', 'but', 'not', 'what', 'all', 'were', 'they', 'we', 'when', 'your', 'can', 'said']);
    return commonWords.has(word.toLowerCase());
  }

  private isLocationWord(word: string): boolean {
    const locationWords = new Set(['Street', 'Road', 'Avenue', 'City', 'Town', 'Country', 'State', 'Park', 'School', 'Hospital']);
    return locationWords.has(word);
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
          
          // Rebuild vector store from persisted documents
          if (this.documents.length > 0) {
            try {
              await this.vectorStore.addDocuments(this.documents);
              console.log(`📚 Loaded ${this.documents.length} documents into vector store`);
            } catch (embedError: any) {
              if (embedError.message?.includes('429') || embedError.message?.includes('quota')) {
                console.warn('⚠️ Rate limited during data loading, documents available for text search only');
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
