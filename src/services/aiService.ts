  import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
  import { ImprovedRAGService, ProjectContext } from './improvedRAGService';
  import { PrismaClient } from '@prisma/client';
  import { aiResponseCache, projectCache, CacheKeys } from './cacheService';
  import { trackAICall } from './performanceService';
  import * as dotenv from "dotenv";

  dotenv.config();
  const prisma = new PrismaClient();
  const improvedRAGService = new ImprovedRAGService();

  interface ConversationMemory {
    userId: string;
    projectId?: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      context?: string;
    }>;
    userPreferences?: Record<string, any>;
    projectContext?: ProjectContext;
  }

  interface WritingAnalysis {
    wordCount: number;
    characterCount: number;
    paragraphCount: number;
    sentenceCount: number;
    readabilityScore: number;
    tone: string;
    pacing: string;
    themes: string[];
    characters: string[];
    plotPoints: string[];
  }

export class AIService {
    private model: ChatGoogleGenerativeAI;
    private fastModel: ChatGoogleGenerativeAI;
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private writingPatterns: Map<string, any> = new Map();
  private readonly MAX_CONVERSATION_MEMORY_SIZE = 100;
  private readonly MAX_WRITING_PATTERNS_SIZE = 50;
  private readonly AI_TIMEOUT_MS = 60000; // 60 second timeout - reasonable for detailed analysis

    constructor() {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.warn("No API key found for Google Generative AI. AI features will not work.");
        this.model = null as any;
        this.fastModel = null as any;
        return;
      }
      
      this.model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        maxOutputTokens: 1024, // Reduced for faster response
        apiKey: apiKey,
        temperature: 0.6, // Slightly lower for more focused responses
        maxRetries: 1,
      });
      
      // Create a separate fast model for autocomplete with better quality settings
      this.fastModel = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        maxOutputTokens: 100, // Increased for better quality responses
        apiKey: apiKey,
        temperature: 0.7, // Higher temperature for more creative and natural suggestions
        maxRetries: 0, // No retries for speed
      });
    }

    // Timeout wrapper for AI calls
    private async callWithTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`AI operation '${operation}' timed out after ${this.AI_TIMEOUT_MS}ms`));
        }, this.AI_TIMEOUT_MS);
      });
      
      return Promise.race([promise, timeoutPromise]);
    }

    // Generate fast autocomplete suggestions (NO vector search, NO complex analysis)
    async generateAutocomplete(
      beforeCursor: string,
      afterCursor: string,
      projectId?: string
    ): Promise<string> {
      try {
        if (!this.fastModel) {
          return '';
        }
        
        // Safety check: Only autocomplete actual writing content, not AI prompts
        const lowerBefore = beforeCursor.toLowerCase();
        const aiPromptIndicators = [
          'selected text:', 'user request:', 'provide suggestions', 'please provide',
          'different options', 'context:', 'suggestions:', 'analyze this',
          'fix spelling', 'grammar', 'rewrite this', 'improve this'
        ];
        
        if (aiPromptIndicators.some(indicator => lowerBefore.includes(indicator))) {
          console.log('🚫 Skipping autocomplete for AI prompt/instruction text');
          return ''; // Don't autocomplete AI prompts
        }
        
        // Also skip if it looks like structured text (lots of quotes and colons)
        const quoteCount = (beforeCursor.match(/"/g) || []).length;
        const colonCount = (beforeCursor.match(/:/g) || []).length;
        if (quoteCount > 2 && colonCount > 2) {
          console.log('🚫 Skipping autocomplete for structured/prompt text');
          return '';
        }

        // Get more context for better quality suggestions (but still fast)
        const contextLength = Math.min(beforeCursor.length, 300);
        const context = beforeCursor.slice(-contextLength);
        
        // Simple cache key based on just the context (no timestamp for better caching)
        const cacheKey = `fastautocomplete:${context.slice(-50)}`;
        
        // Try to get cached result first (shorter cache time)
        const cachedSuggestion = aiResponseCache.get<string>(cacheKey);
        if (cachedSuggestion) {
          return cachedSuggestion;
        }
        
        // Super simple and fast autocomplete generation
        const suggestion = await this.generateFastAutocompleteSuggestion(context, afterCursor);
        
        // Cache for 3 minutes for good balance of freshness and performance
        aiResponseCache.set(cacheKey, suggestion, 180);
        
        return suggestion;
      } catch (error) {
        console.error('Error generating fast autocomplete:', error);
        return '';
      }
    }
    
    // Super fast and simple autocomplete suggestion method
    private async generateFastAutocompleteSuggestion(
      context: string,
      afterCursor: string
    ): Promise<string> {
      try {
        // Get more context words for better quality suggestions
        const contextWords = context.trim().split(/\s+/);
        const lastWords = contextWords.slice(-15).join(' '); // Use last 15 words for better context
        
        // Better prompt for quality autocomplete suggestions
        const prompt = `You are a creative writing assistant. Continue this text naturally and smoothly.

Text: "${lastWords}"

Continue with the most natural next 2-4 words that would flow perfectly. Only provide the continuation words, nothing else:`;

        // Fast AI call using optimized fast model with reasonable timeout for quality
        const response = await Promise.race([
          this.fastModel!.invoke(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)) // 5 second max for balance of speed and quality
        ]) as any;
        
        let suggestion = (response.content as string).trim();
        
        // Better cleanup for quality suggestions
        suggestion = suggestion.replace(/^["'`]|["'`]$/g, '').trim();
        suggestion = suggestion.replace(/^(next words:|continue:|continuation:|text:|words:)/i, '').trim();
        suggestion = suggestion.split('\n')[0]; // Take first line only
        
        // Don't cut off mid-sentence, but limit to reasonable length
        const words = suggestion.trim().split(/\s+/);
        if (words.length > 6) {
          suggestion = words.slice(0, 6).join(' ');
        }
        
        // Better validation - allow longer, more meaningful suggestions
        if (suggestion.length > 40 || suggestion.length < 2) {
          return '';
        }
        
        // Don't return if it just repeats the last word
        const lastWord = lastWords.trim().split(' ').pop()?.toLowerCase();
        if (lastWord && suggestion.toLowerCase().startsWith(lastWord)) {
          return '';
        }
        
        return suggestion;
      } catch (error) {
        // If anything fails, return empty string fast
        return '';
      }
    }
    
    // Quick analysis for autocomplete (performance optimized)
    private analyzeWritingQuick(text: string): { tone: string; pacing: string } {
      const lowerText = text.toLowerCase();
      
      let tone = 'neutral';
      if (lowerText.includes('love') || lowerText.includes('heart')) tone = 'romantic';
      else if (lowerText.includes('dark') || lowerText.includes('death')) tone = 'dark';
      else if (lowerText.includes('funny') || lowerText.includes('laugh')) tone = 'humorous';
      
      const avgLength = text.split('.').reduce((acc, s) => acc + s.length, 0) / Math.max(text.split('.').length, 1);
      const pacing = avgLength < 50 ? 'fast' : avgLength > 100 ? 'slow' : 'moderate';
      
      return { tone, pacing };
    }
    
    // Get project context with caching
    private async getCachedProjectContext(projectId: string): Promise<ProjectContext | null> {
      const cacheKey = CacheKeys.projectContext(projectId);
      
      return await projectCache.getOrSet(
        cacheKey,
        () => improvedRAGService.syncProjectContext(projectId),
        1800 // 30 minutes cache
      );
    }

  // Enhanced suggestion generation with project context and conversation memory (with caching)
  // HYBRID MODE: Supports both fast (text-based) and deep (embedding-based) analysis
  async generateSuggestions(
    context: string,
    projectId: string,
    userId?: string,
    analysisMode: 'fast' | 'deep' = 'fast'
  ): Promise<string> {
    try {
      if (!this.model) {
        return 'AI features are not available due to missing API key configuration.';
      }

      console.log(`🎯 Generating suggestions for project: ${projectId} (${analysisMode} mode)`);
      
      // Create cache key for suggestions (include analysis mode)
      const contextHash = context.slice(0, 200); // Use first 200 chars for cache key
      const cacheKey = CacheKeys.aiResponse(
        `suggestions:${analysisMode}:${contextHash}:${projectId}:${userId || 'anon'}`,
        'gemini-2.0-flash'
      );
      
      // Check cache first (shorter TTL for suggestions as they should be more dynamic)
      const cachedSuggestion = aiResponseCache.get<string>(cacheKey);
      if (cachedSuggestion) {
        console.log(`🎯 Returning cached suggestions (${analysisMode} mode)`);
        return cachedSuggestion;
      }

      // FAST MODE: Skip complex processing for speed but include user preferences
      if (analysisMode === 'fast') {
        console.log(`⚡ PERSONALIZED FAST MODE: Using user preferences for tailored suggestions`);
        
        // Get user preferences for personalized suggestions
        let userPreferences = null;
        if (userId) {
          try {
            userPreferences = await prisma.userPreferences.findUnique({
              where: { userId }
            });
            console.log(`👤 User preferences loaded:`, userPreferences ? 'Found' : 'Not found');
          } catch (error) {
            console.log('⚠️ Could not load user preferences:', error);
          }
        }
        
        // Build personalized prompt based on user preferences
        let personalizedContext = '';
        if (userPreferences) {
          personalizedContext = `\n\nUSER'S WRITING PREFERENCES:
- Writing Style: ${userPreferences.writingStyle || 'Not specified'}
- Genre: ${userPreferences.genre || 'Not specified'}
- Tone Preference: ${userPreferences.tonePreference || 'Not specified'}
- Themes: ${userPreferences.themes?.join(', ') || 'Not specified'}
- Writing Goals: ${userPreferences.writingGoals?.join(', ') || 'Not specified'}

IMPORTANT: Tailor your suggestions to match the user's preferences. If their preference is "${userPreferences.genre || 'action'}", don't suggest deep romantic elements unless relevant. If they prefer "${userPreferences.writingStyle || 'concise'}", focus on that style.`;
        }
        
        // Enhanced prompt with personalization
        const prompt = `You are an expert writing coach and literary editor. Analyze this text comprehensively:

"${context.slice(-300)}"
${personalizedContext}

Provide a thorough analysis with immediate fixes and creative improvements tailored to the user's preferences.

Format your response EXACTLY like this:

SUMMARY:
[Brief analysis of the text's strengths, weaknesses, tone, and style - 2-3 sentences. Reference user preferences when relevant.]

CORRECTED VERSION:
[Provide corrected text with spelling/grammar fixes, or "No corrections needed"]

SUGGESTIONS:
1. [Specific improvement for style, flow, or clarity - tailored to user's writing style preference]
2. [Character development or plot enhancement - aligned with user's genre preference]
3. [Dialogue, description, or pacing improvement - matching user's tone preference]
4. [Theme, mood, or literary technique - incorporating user's preferred themes]

SUMMARY:`;
        
        console.log(`🤖 Invoking AI model for PERSONALIZED suggestions...`);
        const response = await Promise.race([
          this.model!.invoke(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Quality timeout')), 15000)) // 15 second max for quality results
        ]) as any;
        
        const suggestions = response.content as string;
        console.log(`✅ PERSONALIZED AI suggestions generated`);
        
        // No caching for fast mode - always fresh results
        return suggestions;
      }
      
      // DEEP MODE: Full complex processing
      console.log(`🔍 DEEP MODE: Using full analysis...`);
      let relevantChunks: any[] = [];
      let projectFullContent = '';
      
      // Get project context and stats (only for deep mode)
      const projectContext = await improvedRAGService.syncProjectContext(projectId);
      const projectStats = await improvedRAGService.getProjectStats(projectId);
      
      // Get project content
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { content: true, title: true, description: true }
        });
        if (project?.content) {
          projectFullContent = project.content;
        }
      } catch (error) {
        console.log(`⚠️ Could not retrieve project content`);
      }
      
      // RAG search for deep mode
      try {
        const ragResults = await improvedRAGService.intelligentSearch(context, {
          projectId,
          limit: 5,
          includeContext: true
        });
        relevantChunks = ragResults.results || [];
      } catch (ragError) {
        console.log(`⚠️ RAG search failed`);
      }
      
      // Get conversation memory and analysis
      const memory = userId ? await this.getConversationMemory(userId, projectId) : null;
      const analysis = this.analyzeWritingOptimized(context);
      
      // Build comprehensive prompt for deep mode
      const prompt = this.buildEnhancedPrompt({
        context,
        projectId,
        projectContext,
        projectStats,
        projectFullContent: projectFullContent.slice(0, 3000),
        relevantChunks,
        memory,
        analysis,
        analysisMode,
        requestType: 'suggestions'
      });

      console.log(`🤖 Invoking AI model for suggestions...`);
      const response = await trackAICall(
        () => this.callWithTimeout(this.model!.invoke(prompt), 'Suggestions Generation'),
        'Suggestions Generation'
      );
      const suggestions = response.content as string;
      
      console.log(`✅ AI suggestions generated successfully (fast path)`);
      
      // Cache the result for 10 minutes (shorter than autocomplete)
      aiResponseCache.set(cacheKey, suggestions, 600);
      
      // Store in conversation memory (async to not block response)
      if (userId) {
        setImmediate(async () => {
          await this.updateConversationMemory(userId, projectId, 'user', context.slice(0, 500));
          await this.updateConversationMemory(userId, projectId, 'assistant', suggestions.slice(0, 500));
        });
      }
      
      return suggestions;
    } catch (error) {
      console.error('❌ Error generating suggestions:', error);
      return 'I encountered an error while generating suggestions. Please try again later.';
    }
  }

  // Optimized writing analysis for performance
    analyzeWritingOptimized(text: string): WritingAnalysis {
      // Use cached result if available
      const textHash = text.substring(0, 100); // Use first 100 chars as hash
      const cacheKey = `analysis:${textHash.replace(/\s+/g, '_')}`;
      
      // Check if we've analyzed similar text recently
      if (this.writingPatterns.has(cacheKey)) {
        return this.writingPatterns.get(cacheKey);
      }
      
      const analysis = this.performFastAnalysis(text);
      
      // Cache the analysis
      this.writingPatterns.set(cacheKey, analysis);
      
      // Clean up cache if it gets too large
      if (this.writingPatterns.size > this.MAX_WRITING_PATTERNS_SIZE) {
        const entries = Array.from(this.writingPatterns.entries());
        // Remove oldest entries
        entries.slice(0, 10).forEach(([key]) => this.writingPatterns.delete(key));
      }
      
      return analysis;
    }
    
    // Fast analysis implementation
    private performFastAnalysis(text: string): WritingAnalysis {
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      // Simplified calculations for performance
      const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
      const readabilityScore = Math.max(0, Math.min(100, 100 - avgWordsPerSentence * 2));
      
      return {
        wordCount: words.length,
        characterCount: text.length,
        paragraphCount: paragraphs.length,
        sentenceCount: sentences.length,
        readabilityScore,
        tone: this.analyzeToneQuick(text),
        pacing: avgWordsPerSentence < 15 ? 'fast' : avgWordsPerSentence > 25 ? 'slow' : 'moderate',
        themes: this.extractThemesQuick(text),
        characters: this.extractCharactersQuick(text),
        plotPoints: this.extractPlotPointsQuick(text)
      };
    }
    
    // Quick tone analysis
    private analyzeToneQuick(text: string): string {
      const lowerText = text.toLowerCase();
      
      if (lowerText.match(/\b(death|dark|fear|evil)\b/)) return 'dark';
      if (lowerText.match(/\b(love|heart|romance|kiss)\b/)) return 'romantic';
      if (lowerText.match(/\b(funny|laugh|humor|joke)\b/)) return 'humorous';
      if (lowerText.match(/\b(mystery|secret|hidden|unknown)\b/)) return 'mysterious';
      if (lowerText.match(/\b(action|fight|battle|chase)\b/)) return 'action';
      
      return 'neutral';
    }
    
    // Quick theme extraction
    private extractThemesQuick(text: string): string[] {
      const themes: string[] = [];
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('love') || lowerText.includes('heart')) themes.push('love');
      if (lowerText.includes('friend') || lowerText.includes('loyal')) themes.push('friendship');
      if (lowerText.includes('family') || lowerText.includes('mother') || lowerText.includes('father')) themes.push('family');
      if (lowerText.includes('power') || lowerText.includes('control')) themes.push('power');
      if (lowerText.includes('betray') || lowerText.includes('lie')) themes.push('betrayal');
      
      return themes.slice(0, 3); // Limit to 3 themes for performance
    }
    
    // Quick character extraction
    private extractCharactersQuick(text: string): string[] {
      const words = text.split(/\s+/);
      const characters = new Set<string>();
      
      // Look for capitalized words that might be names (simplified)
      words.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord.length > 2 && 
            cleanWord[0] === cleanWord[0].toUpperCase() && 
            cleanWord.slice(1) === cleanWord.slice(1).toLowerCase() &&
            !['The', 'And', 'But', 'For', 'This', 'That'].includes(cleanWord)) {
          characters.add(cleanWord);
        }
      });
      
      return Array.from(characters).slice(0, 5); // Limit to 5 characters
    }
    
    // Quick plot points extraction
    private extractPlotPointsQuick(text: string): string[] {
      const plotPoints: string[] = [];
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('meet') || lowerText.includes('encounter')) plotPoints.push('meeting');
      if (lowerText.includes('fight') || lowerText.includes('conflict')) plotPoints.push('conflict');
      if (lowerText.includes('discover') || lowerText.includes('reveal')) plotPoints.push('revelation');
      if (lowerText.includes('escape') || lowerText.includes('flee')) plotPoints.push('escape');
      if (lowerText.includes('journey') || lowerText.includes('travel')) plotPoints.push('journey');
      
      return plotPoints.slice(0, 3); // Limit for performance
    }
    
    // Build optimized prompt (shorter and more focused)
    private buildOptimizedPrompt(params: {
      context: string;
      projectId: string;
      projectContext: ProjectContext | null;
      relevantChunks: any[];
      projectStats: any;
      memory: ConversationMemory | null;
      analysis: WritingAnalysis;
      requestType: string;
    }): string {
      const { context, projectContext, relevantChunks, analysis } = params;
      
    // Comprehensive prompt for detailed writing suggestions
    return `You are an expert writing coach and storytelling advisor. Analyze this text and provide detailed, actionable suggestions to elevate the writing.

## PROJECT CONTEXT
${projectContext ? `
**Project Style**: ${projectContext.writingStyle || 'Not specified'}
**Known Themes**: ${projectContext.themes?.join(', ') || 'None identified'}
**Characters**: ${projectContext.characters?.join(', ') || 'None identified'}
**Settings**: ${projectContext.settings?.join(', ') || 'None specified'}
` : 'No project context available.'}

## CURRENT WRITING ANALYSIS
**Word Count**: ${analysis.wordCount} words
**Tone**: ${analysis.tone}
**Pacing**: ${analysis.pacing}
**Readability Score**: ${analysis.readabilityScore.toFixed(0)}/100
**Detected Themes**: ${analysis.themes.join(', ') || 'None detected'}
**Characters Mentioned**: ${analysis.characters.join(', ') || 'None detected'}

${relevantChunks.length > 0 ? `## RELEVANT CONTEXT FROM PROJECT
${relevantChunks.map((chunk, i) => `${i + 1}. ${chunk.pageContent.slice(0, 250)}...`).join('\n')}
` : ''}
## TEXT TO ANALYZE
"${context}"

## WRITING IMPROVEMENT SUGGESTIONS

Provide a comprehensive analysis with the following structure:

### 🎯 **STRENGTHS**
What works well in this passage? Highlight specific elements that are effective.

### 🛠️ **AREAS FOR IMPROVEMENT**

**1. Story Structure & Flow**
- How can the narrative flow be enhanced?
- Are there pacing issues to address?
- Suggestions for scene transitions or paragraph structure

**2. Character Development**
- How can characters be made more compelling?
- Opportunities for deeper characterization
- Dialogue improvements (if applicable)

**3. Descriptive Writing & Atmosphere**
- Ways to strengthen scene setting and atmosphere
- Sensory detail suggestions
- Show vs. tell improvements

**4. Plot & Tension**
- How to increase narrative tension or stakes
- Plot development opportunities
- Conflict enhancement

### ✨ **SPECIFIC ACTIONABLE RECOMMENDATIONS**
1. **Immediate Fix**: One quick improvement that would have the biggest impact
2. **Sentence-Level Edit**: Suggest a specific sentence revision with before/after
3. **Expansion Opportunity**: Where to add 1-2 sentences for maximum effect
4. **Stylistic Enhancement**: One technique to elevate the writing style

### 🎨 **THEMATIC DEVELOPMENT**
${projectContext && projectContext.themes ? `How can the themes of ${projectContext.themes.slice(0, 2).join(' and ')} be woven more effectively into this passage?` : 'What themes emerge from this text and how can they be strengthened?'}

Provide specific, implementable advice that will help the writer create more engaging and polished prose.`;
    }
  
  // Original detailed analysis (keep for compatibility)
    analyzeWriting(text: string): WritingAnalysis {
      const words = text.split(/\s+/).filter(word => word.length > 0);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      
      // Calculate readability (simplified Flesch Reading Ease)
      const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
      const avgSyllablesPerWord = this.estimateSyllables(text) / Math.max(words.length, 1);
      const readabilityScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
      
      // Analyze tone
      const tone = this.analyzeTone(text);
      
      // Analyze pacing
      const pacing = this.analyzePacing(text);
      
      // Extract themes and characters (enhanced)
      const themes = this.extractAdvancedThemes(text);
      const characters = this.extractCharacters(text);
      const plotPoints = this.extractPlotPoints(text);
      
      return {
        wordCount: words.length,
        characterCount: text.length,
        paragraphCount: paragraphs.length,
        sentenceCount: sentences.length,
        readabilityScore: Math.max(0, Math.min(100, readabilityScore)),
        tone,
        pacing,
        themes,
        characters,
        plotPoints
      };
    }

  // Deep theme consistency analysis with narrative expertise
  // HYBRID MODE: Supports both fast (text-based) and deep (embedding-based) analysis
  async analyzeThemeConsistency(text: string, theme: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast'): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      console.log(`🎯 Analyzing theme consistency for "${theme}" in project: ${projectId} (${analysisMode} mode)`);
      
      // HYBRID ANALYSIS MODE: Fast vs Deep
      let relevantChunks: any[] = [];
      let projectFullContent = '';
      
      // 1. Get project context and stats (always needed)
      const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
      const projectStats = projectId ? await improvedRAGService.getProjectStats(projectId) : {
        characters: [] as string[], 
        themes: [] as string[], 
        plotElements: [] as string[], 
        totalChunks: 0
      };
      console.log(`📋 Project context retrieved:`, projectContext ? 'Found' : 'Not found');
      console.log(`📊 Project stats: ${projectStats.themes.length} themes total`);
      
      // 2. Get actual project content for richer AI context
      if (projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { content: true, title: true, description: true }
          });
          
          if (project?.content) {
            projectFullContent = project.content;
            console.log(`📜 Retrieved full project content for theme analysis: ${projectFullContent.length} characters`);
          }
        } catch (error) {
          console.log(`⚠️ Could not retrieve full project content:`, error);
        }
      }
      
      // 3. Mode-specific analysis
      if (analysisMode === 'deep') {
        console.log(`🔍 DEEP MODE: Using embedding-based RAG search for detailed theme analysis...`);
        try {
          const ragResults = projectId && projectContext ? await improvedRAGService.intelligentSearch(`${theme} thematic elements narrative`, {
            projectId,
            limit: 4, // More chunks for deep theme analysis
            themes: [theme],
            includeContext: true
          }) : null;
          relevantChunks = ragResults?.results || [];
          console.log(`🔍 Deep search found ${relevantChunks.length} relevant chunks for theme "${theme}"`);
        } catch (ragError) {
          console.log(`⚠️ Deep search failed, falling back to fast mode`);
        }
      } else {
        console.log(`⚡ FAST MODE: Using direct project context for theme analysis (no embedding search)`);
      }
      
      const analysis = this.analyzeWriting(text);
      console.log(`📝 Theme analysis complete for ${analysisMode} mode`);
      
      // Check if theme exists in project
      const themeExistsInProject = projectStats.themes.some((t: string) => 
        t.toLowerCase().includes(theme.toLowerCase()) || theme.toLowerCase().includes(t.toLowerCase())
      );
      
      // Build enhanced theme analysis prompt with rich context
      const prompt = this.buildEnhancedPrompt({
        context: text,
        projectId: projectId || 'unknown',
        projectContext,
        projectStats,
        projectFullContent,
        relevantChunks,
        memory: null, // Theme analysis doesn't need conversation memory
        analysis,
        analysisMode,
        requestType: `theme consistency analysis for "${theme}"`
      }) + `
        
        THEME TO ANALYZE: "${theme}"
        THEME EXISTS IN PROJECT: ${themeExistsInProject ? 'Yes' : 'No'}
        THEME APPEARS IN CURRENT TEXT: ${text.toLowerCase().includes(theme.toLowerCase()) ? 'Yes' : 'No'}
        
        Please provide a detailed theme analysis with this structure:
        
        ## 🎯 THEME CONSISTENCY ANALYSIS: "${theme.toUpperCase()}"
        
        **Theme Presence Score**: [Rate 1-10 how well the theme appears]
        
        **Current Expression**:
        - How the theme currently manifests in the text
        - Specific examples of where it appears
        - Strength of thematic elements
        
        **Consistency Issues**:
        - Areas where the theme could be stronger
        - Inconsistencies or missed opportunities
        - Character actions/dialogue that could better reflect the theme
        
        **Enhancement Strategies**:
        1. **Character Development**: How characters can better embody this theme
        2. **Plot Integration**: Ways to weave the theme into plot events
        3. **Symbolic Elements**: Objects, settings, or imagery that reinforce the theme
        4. **Dialogue Opportunities**: Conversations that could explore the theme
        
        **Specific Recommendations**:
        Provide 3-4 concrete, actionable suggestions with examples.
        
        **Thematic Resonance**:
        Explain how this theme connects to universal human experiences.
      `;

      const response = await trackAICall(
        () => this.callWithTimeout(this.model.invoke(prompt), 'Theme Analysis'),
        'Theme Analysis'
      );
      return response.content as string;
    } catch (error) {
      console.error('Error analyzing theme consistency:', error);
      return 'I encountered an error while analyzing theme consistency. Please try again, or consider manually reviewing how your chosen theme is woven through character actions, dialogue, and plot developments in this section.';
    }
  }

  // Advanced foreshadowing analysis with deep storytelling insights
  // HYBRID MODE: Supports both fast (text-based) and deep (embedding-based) analysis
  async checkForeshadowing(text: string, context: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast'): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      console.log(`🔮 Analyzing foreshadowing for project: ${projectId} (${analysisMode} mode)`);
      
      // HYBRID ANALYSIS MODE: Fast vs Deep
      let relevantChunks: any[] = [];
      let projectFullContent = '';
      
      // 1. Get project context and stats (always needed)
      const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
      const projectStats = projectId ? await improvedRAGService.getProjectStats(projectId) : {
        characters: [] as string[], 
        themes: [] as string[], 
        plotElements: [] as string[], 
        totalChunks: 0
      };
      console.log(`📋 Project context retrieved:`, projectContext ? 'Found' : 'Not found');
      console.log(`📊 Project stats: ${projectStats.characters.length} characters, ${projectStats.plotElements.length} plot elements`);
      
      // 2. Get actual project content for richer AI context
      if (projectId) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { content: true, title: true, description: true }
          });
          
          if (project?.content) {
            projectFullContent = project.content;
            console.log(`📜 Retrieved full project content for foreshadowing analysis: ${projectFullContent.length} characters`);
          }
        } catch (error) {
          console.log(`⚠️ Could not retrieve full project content:`, error);
        }
      }
      
      // 3. Mode-specific analysis
      if (analysisMode === 'deep') {
        console.log(`🔍 DEEP MODE: Using embedding-based RAG search for detailed foreshadowing analysis...`);
        try {
          const ragResults = projectId && projectContext ? await improvedRAGService.intelligentSearch('plot future events character development foreshadowing', {
            projectId,
            limit: 6, // More chunks for deep foreshadowing analysis
            contentTypes: ['plot', 'narrative', 'character'],
            includeContext: true
          }) : null;
          relevantChunks = ragResults?.results || [];
          console.log(`🔍 Deep search found ${relevantChunks.length} relevant chunks for foreshadowing`);
        } catch (ragError) {
          console.log(`⚠️ Deep search failed, falling back to fast mode`);
        }
      } else {
        console.log(`⚡ FAST MODE: Using direct project context for foreshadowing (no embedding search)`);
      }
      
      const analysis = this.analyzeWriting(text);
      console.log(`📝 Text analysis complete for ${analysisMode} mode`);
      
      // Use enhanced prompt builder with rich story content
      
      // Build enhanced foreshadowing prompt with rich context
      const basePrompt = this.buildEnhancedPrompt({
        context: text,
        projectId: projectId || 'unknown',
        projectContext,
        projectStats,
        projectFullContent,
        relevantChunks,
        memory: null, // Foreshadowing doesn't need conversation memory
        analysis,
        analysisMode,
        requestType: 'foreshadowing analysis'
      });
      
      const additionalInstructions = `
      
Please provide a comprehensive foreshadowing analysis with the following structure:
      
      ## 🔮 FORESHADOWING ANALYSIS
      
      **Current Foreshadowing Elements**:
      - List any existing hints, symbols, or subtle elements that hint at future events
      - Note their effectiveness and clarity
      
      **Missed Opportunities**:
      - Identify 3-4 specific places where foreshadowing could be strengthened
      - Explain what future events these could hint at
      
      **Concrete Suggestions**:
      1. **Symbolic Elements**: Specific objects, imagery, or metaphors to introduce
      2. **Dialogue Hints**: Subtle lines characters could say that gain meaning later
      3. **Environmental Details**: Setting elements that could become significant
      4. **Character Actions**: Small behaviors that could foreshadow larger character arcs
      
      **Implementation Examples**:
      Provide 2-3 specific sentence examples showing how to implement these suggestions.
      
      Focus on subtlety and organic integration with the existing narrative.`;
      
      const prompt = basePrompt + additionalInstructions;

      const response = await trackAICall(
        () => this.callWithTimeout(this.model.invoke(prompt), 'Foreshadowing Analysis'),
        'Foreshadowing Analysis'
      );
      return response.content as string;
    } catch (error) {
      console.error('Error checking foreshadowing:', error);
      return 'I encountered an error while analyzing foreshadowing opportunities. Please try again, or consider manually reviewing your text for subtle hints and symbolic elements that could enhance future story developments.';
    }
  }

    // Enhanced character motivation and stakes evaluation
    // HYBRID MODE: Supports both fast (text-based) and deep (embedding-based) analysis
    async evaluateMotivationAndStakes(text: string, character: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast'): Promise<string> {
      if (!this.model) {
        return 'AI features are not available due to missing API key configuration.';
      }
      
      try {
        console.log(`🎭 Analyzing motivation for character: ${character} in project: ${projectId} (${analysisMode} mode)`);
        
        // HYBRID ANALYSIS MODE: Fast vs Deep
        let relevantChunks: any[] = [];
        let projectFullContent = '';
        
        // 1. Get project context and stats (always needed)
        const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
        const projectStats = projectId ? await improvedRAGService.getProjectStats(projectId) : {
          characters: [] as string[], 
          themes: [] as string[], 
          plotElements: [] as string[], 
          totalChunks: 0
        };
        console.log(`📋 Project context retrieved:`, projectContext ? 'Found' : 'Not found');
        console.log(`📊 Project stats: ${projectStats.characters.length} characters`);
        
        // 2. Get actual project content for richer AI context
        if (projectId) {
          try {
            const project = await prisma.project.findUnique({
              where: { id: projectId },
              select: { content: true, title: true, description: true }
            });
            
            if (project?.content) {
              projectFullContent = project.content;
              console.log(`📜 Retrieved full project content for character analysis: ${projectFullContent.length} characters`);
            }
          } catch (error) {
            console.log(`⚠️ Could not retrieve full project content:`, error);
          }
        }
        
        // 3. Mode-specific analysis
        if (analysisMode === 'deep') {
          console.log(`🔍 DEEP MODE: Using embedding-based RAG search for detailed character analysis...`);
          try {
            const ragResults = projectId && projectContext ? await improvedRAGService.intelligentSearch(`${character} motivation goals development`, {
              projectId,
              limit: 4, // More chunks for deep character analysis
              characters: [character],
              contentTypes: ['character'],
              includeContext: true
            }) : null;
            relevantChunks = ragResults?.results || [];
            console.log(`🔍 Deep search found ${relevantChunks.length} relevant chunks for character "${character}"`);
          } catch (ragError) {
            console.log(`⚠️ Deep search failed, falling back to fast mode`);
          }
        } else {
          console.log(`⚡ FAST MODE: Using direct project context for character analysis (no embedding search)`);
        }
        
        console.log(`📝 Text analysis for motivation in ${analysisMode} mode`);
                const characterExistsInProject = projectStats.characters.includes(character);
        const characterAppearsInText = text.toLowerCase().includes(character.toLowerCase());
        
        const analysis = this.analyzeWriting(text);
        const basePrompt = this.buildEnhancedPrompt({
          context: text,
          projectId: projectId || 'unknown',
          projectContext,
          projectStats,
          projectFullContent,
          relevantChunks,
          memory: null,
          analysis,
          analysisMode,
          requestType: `character motivation and stakes analysis for "${character}"`
        });
        
        const characterAnalysis = `
        
        CHARACTER TO ANALYZE: "${character}"
        CHARACTER EXISTS IN PROJECT: ${characterExistsInProject ? 'Yes' : 'No'}
        CHARACTER APPEARS IN CURRENT TEXT: ${characterAppearsInText ? 'Yes' : 'No'}
        
        Please provide a comprehensive character analysis with this structure:
        
        ## 🎭 CHARACTER ANALYSIS: ${character.toUpperCase()}
        
        **Motivation Clarity Score**: [1-10] - How clear are ${character}'s motivations?
        
        **Core Motivations**:
        - **Internal Drives**: What does ${character} want emotionally/psychologically?
        - **External Goals**: What concrete objectives are they pursuing?
        - **Hidden Desires**: What might they not admit to themselves?
        
        **Stakes Assessment**:
        - **What They Stand to Gain**: Rewards for success
        - **What They Stand to Lose**: Consequences of failure
        - **Personal Cost**: What they must sacrifice to achieve their goals
        
        **Motivation Strength Analysis**:
        - Areas where motivations are compelling and clear
        - Places where motivations feel weak or unclear
        - Contradictions or conflicts in their desires
        
        **Enhancement Recommendations**:
        1. **Dialogue Opportunities**: Lines that could reveal deeper motivations
        2. **Action Sequences**: Behaviors that would demonstrate their drives
        3. **Internal Conflict**: Ways to show competing motivations
        4. **Backstory Elements**: Past events that could justify current motivations
        
        **Character Arc Potential**:
        Explain how their current motivations could evolve throughout the story.
        
        **Reader Investment**:
        Why should readers care about ${character}'s journey and outcome?`;
        
        const prompt = basePrompt + characterAnalysis;

        const response = await trackAICall(
          () => this.callWithTimeout(this.model.invoke(prompt), 'Motivation Analysis'),
          'Motivation Analysis'
        );
        return response.content as string;
      } catch (error) {
        console.error('Error evaluating motivation and stakes:', error);
        return 'Unable to evaluate motivation and stakes at this time.';
      }
    }

    // Intelligent conversation routing and response generation
    async generateIntelligentResponse(
      userInput: string,
      userId: string,
      projectId?: string,
      context?: string
    ): Promise<string> {
      if (!this.model) {
        return 'AI features are not available due to missing API key configuration.';
      }

      try {
        // Classify the user's intent
        const intent = await this.classifyIntent(userInput);
        
        // Get conversation memory and project context
        const memory = await this.getConversationMemory(userId, projectId);
        const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
        
        // Route to appropriate handler based on intent
        switch (intent.type) {
          case 'writing_help':
            return this.handleWritingHelp(userInput, userId, projectId, context);
          case 'character_development':
            return this.handleCharacterDevelopment(userInput, userId, projectId, context);
          case 'plot_assistance':
            return this.handlePlotAssistance(userInput, userId, projectId, context);
          case 'style_feedback':
            return this.handleStyleFeedback(userInput, userId, projectId, context);
          case 'brainstorming':
            return this.handleBrainstorming(userInput, userId, projectId, context);
          default:
            return this.handleGeneralQuery(userInput, userId, projectId, context);
        }
      } catch (error) {
        console.error('Error generating intelligent response:', error);
        return 'I encountered an error while processing your request. Please try again.';
      }
    }

    // Helper methods for conversation memory management
    private async getConversationMemory(userId: string, projectId?: string): Promise<ConversationMemory> {
      const key = `${userId}_${projectId || 'general'}`;
      if (!this.conversationMemory.has(key)) {
        const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : undefined;
      this.conversationMemory.set(key, {
        userId,
        projectId,
        messages: [],
        userPreferences: {},
        projectContext: projectContext || undefined
      });
      }
      return this.conversationMemory.get(key)!;
    }

    private async updateConversationMemory(
      userId: string,
      projectId: string | undefined,
      role: 'user' | 'assistant',
      content: string,
      context?: string
    ): Promise<void> {
      const memory = await this.getConversationMemory(userId, projectId);
      memory.messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
        context
      });
      
    // Keep only last 20 messages to manage memory
    if (memory.messages.length > 20) {
      memory.messages = memory.messages.slice(-20);
    }
    
    // Clean up old conversation memories if we have too many
    if (this.conversationMemory.size > this.MAX_CONVERSATION_MEMORY_SIZE) {
      const oldestEntries = Array.from(this.conversationMemory.entries())
        .sort(([, a], [, b]) => {
          const lastA = a.messages[a.messages.length - 1]?.timestamp || '0';
          const lastB = b.messages[b.messages.length - 1]?.timestamp || '0';
          return lastA.localeCompare(lastB);
        })
        .slice(0, this.conversationMemory.size - this.MAX_CONVERSATION_MEMORY_SIZE);
      
      oldestEntries.forEach(([key]) => this.conversationMemory.delete(key));
    }
    }

    // Intent classification
    private async classifyIntent(userInput: string): Promise<{ type: string; confidence: number }> {
      const input = userInput.toLowerCase();
      
      const intents = [
        { type: 'character_development', keywords: ['character', 'personality', 'motivation', 'backstory', 'development'] },
        { type: 'plot_assistance', keywords: ['plot', 'story', 'narrative', 'structure', 'outline', 'events'] },
        { type: 'style_feedback', keywords: ['style', 'tone', 'voice', 'writing', 'prose', 'flow'] },
        { type: 'brainstorming', keywords: ['idea', 'brainstorm', 'creative', 'inspiration', 'concept'] },
        { type: 'writing_help', keywords: ['help', 'stuck', 'continue', 'next', 'suggestion'] }
      ];
      
      let bestMatch = { type: 'general', confidence: 0 };
      
      for (const intent of intents) {
        const matches = intent.keywords.filter(keyword => input.includes(keyword));
        const confidence = matches.length / intent.keywords.length;
        
        if (confidence > bestMatch.confidence) {
          bestMatch = { type: intent.type, confidence };
        }
      }
      
      return bestMatch;
    }

    // Specialized handlers for different types of requests
    private async handleWritingHelp(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      return this.generateSuggestions(context || userInput, projectId || 'default', userId);
    }

    private async handleCharacterDevelopment(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      // Extract character name from input
      const characterMatch = userInput.match(/(?:character|about|for)\s+([A-Z][a-z]+)/i);
      const character = characterMatch ? characterMatch[1] : 'the main character';
      
      return this.evaluateMotivationAndStakes(context || userInput, character, projectId);
    }

    private async handlePlotAssistance(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      return this.checkForeshadowing(context || userInput, userInput, projectId);
    }

    private async handleStyleFeedback(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      const analysis = this.analyzeWriting(context || userInput);
      
      const prompt = `
        Provide detailed style and prose feedback for this writing:
        
        "${context || userInput}"
        
        Current Analysis:
        - Tone: ${analysis.tone}
        - Pacing: ${analysis.pacing}
        - Readability: ${analysis.readabilityScore.toFixed(1)}/100
        - Word Count: ${analysis.wordCount}
        
        Focus on:
        1. Prose quality and flow
        2. Sentence variety and rhythm
        3. Word choice and precision
        4. Voice consistency
        5. Areas for improvement
        
        Provide specific, actionable feedback.
      `;
      
      const response = await trackAICall(
        () => this.callWithTimeout(this.model.invoke(prompt), 'Style Feedback'),
        'Style Feedback'
      );
      return response.content as string;
    }

    private async handleBrainstorming(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
      
      const prompt = `
        Help brainstorm creative ideas based on this request:
        
        "${userInput}"
        
        ${projectContext ? `
        Project Context:
        - Project ID: ${projectContext.projectId}
        - Themes: ${projectContext.themes?.join(', ') || 'None'}
        - Characters: ${projectContext.characters?.join(', ') || 'None'}
        - Writing Style: ${projectContext.writingStyle || 'Unknown'}
        - Settings: ${projectContext.settings?.join(', ') || 'None'}
        ` : ''}
        
        ${context ? `Current Writing Context: "${context}"` : ''}
        
        Provide 5-7 creative, specific ideas that:
        1. Address the user's request
        2. Fit the project context
        3. Are actionable and inspiring
        4. Build on existing elements
        5. Offer fresh perspectives
        
        Make each idea detailed and immediately usable.
      `;
      
      const response = await trackAICall(
        () => this.callWithTimeout(this.model.invoke(prompt), 'Brainstorming'),
        'Brainstorming'
      );
      return response.content as string;
    }

    private async handleGeneralQuery(userInput: string, userId: string, projectId?: string, context?: string): Promise<string> {
      const memory = await this.getConversationMemory(userId, projectId);
      const recentContext = memory.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n');
      
      const prompt = `
        You are an expert writing assistant. Respond helpfully to this query:
        
        "${userInput}"
        
        ${recentContext ? `Recent conversation:\n${recentContext}` : ''}
        ${context ? `Current writing context: "${context}"` : ''}
        
        Provide a helpful, specific response that addresses their needs.
      `;
      
      const response = await trackAICall(
        () => this.callWithTimeout(this.model.invoke(prompt), 'General Query'),
        'General Query'
      );
      return response.content as string;
    }

    // Build enhanced context-aware prompt with richer story content and hybrid mode
    private buildEnhancedPrompt(params: {
      context: string;
      projectId: string;
      projectContext: ProjectContext | null;
      projectStats: any;
      projectFullContent?: string;
      relevantChunks: any[];
      memory: ConversationMemory | null;
      analysis: WritingAnalysis;
      analysisMode: 'fast' | 'deep';
      requestType: string;
    }): string {
      const { context, projectContext, projectStats, projectFullContent = '', relevantChunks, memory, analysis, analysisMode, requestType } = params;
      
      return `
        You are an expert AI writing assistant with deep understanding of storytelling, character development, and narrative craft.
        
        ANALYSIS MODE: ${analysisMode.toUpperCase()}
        REQUEST TYPE: ${requestType}
        
        PROJECT CONTEXT:
        ${projectContext ? `
        - Project ID: "${projectContext.projectId}"
        - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
        - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
        - Writing Style: ${projectContext.writingStyle || 'Not specified'}
        - Settings: ${projectContext.settings?.join(', ') || 'None identified'}
        - Plot Points: ${projectContext.plotPoints?.join(', ') || 'None identified'}
        ` : 'No specific project context available.'}
        
        PROJECT STATISTICS:
        - Total Chunks: ${projectStats.totalChunks || 0}
        - Characters: ${Array.isArray(projectStats.characters) ? projectStats.characters.join(', ') : 'None'}
        - Themes: ${Array.isArray(projectStats.themes) ? projectStats.themes.join(', ') : 'None'}
        - Content Types: ${Array.isArray(projectStats.contentTypes) ? projectStats.contentTypes.join(', ') : 'None'}
        
        ${projectFullContent ? `
        FULL STORY CONTEXT (EXCERPT):
        ${projectFullContent.slice(0, 1500)}
        ${projectFullContent.length > 1500 ? '... [truncated]' : ''}
        ` : ''}
        
        CURRENT WRITING ANALYSIS:
        - Word Count: ${analysis.wordCount}
        - Tone: ${analysis.tone}
        - Pacing: ${analysis.pacing}
        - Readability: ${analysis.readabilityScore.toFixed(1)}/100
        - Detected Themes: ${analysis.themes.join(', ')}
        - Characters Mentioned: ${analysis.characters.join(', ')}
        - Plot Points: ${analysis.plotPoints.join(', ')}
        
        ${relevantChunks.length > 0 ? `
        RELEVANT CONTEXT FROM PROJECT (${relevantChunks.length} chunks):
        ${relevantChunks.map((chunk, i) => `
        ${i + 1}. [${chunk.metadata?.contentType || 'unknown'}] ${chunk.pageContent.slice(0, 300)}...
        `).join('\n')}
        ` : projectContext ? `
        RELEVANT CONTEXT FROM PROJECT:
        Since this is a known project, provide suggestions that build upon the established elements above.
        Consider how your suggestions can enhance the existing characters, themes, and settings.
        ` : `
        RELEVANT CONTEXT FROM PROJECT:
        No specific project context available - provide general but helpful writing suggestions.
        `}
        
        ${memory && memory.messages.length > 0 ? `
        RECENT CONVERSATION:
        ${memory.messages.slice(-3).map(m => `${m.role}: ${m.content.slice(0, 200)}...`).join('\n')}
        ` : ''}
        
        CURRENT TEXT TO ANALYZE:
        "${context}"
        
        Based on all this context, provide intelligent, specific, and actionable ${requestType} that:
        1. Maintain consistency with the established project elements
        2. Build upon the existing narrative and character development
        3. Consider the current tone, pacing, and style
        4. Address potential plot development opportunities
        5. Suggest improvements that enhance the overall story
        6. Are specific and immediately actionable
        
        Format your response with clear sections and specific examples. Be encouraging but constructive.
      `;
    }

    // Build comprehensive context-aware prompts
    private buildIntelligentPrompt(params: {
      context: string;
      projectId: string;
      projectContext: ProjectContext | null;
      relevantChunks: any[];
      projectStats: any;
      memory: ConversationMemory | null;
      analysis: WritingAnalysis;
      requestType: string;
    }): string {
      const { context, projectContext, relevantChunks, projectStats, memory, analysis, requestType } = params;
      
      return `
        You are an expert AI writing assistant with deep understanding of storytelling, character development, and narrative craft.
        
        PROJECT CONTEXT:
        ${projectContext ? `
        - Project ID: "${projectContext.projectId}"
        - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
        - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
        - Writing Style: ${projectContext.writingStyle || 'Not specified'}
        - Settings: ${projectContext.settings?.join(', ') || 'None identified'}
        - Plot Points: ${projectContext.plotPoints?.join(', ') || 'None identified'}
        ` : 'No specific project context available.'}
        
        PROJECT STATISTICS:
        - Total Chunks: ${projectStats.totalChunks}
        - Characters: ${projectStats.characters.join(', ') || 'None'}
        - Themes: ${projectStats.themes.join(', ') || 'None'}
        - Content Types: ${projectStats.contentTypes.join(', ') || 'None'}
        
        CURRENT WRITING ANALYSIS:
        - Word Count: ${analysis.wordCount}
        - Tone: ${analysis.tone}
        - Pacing: ${analysis.pacing}
        - Readability: ${analysis.readabilityScore.toFixed(1)}/100
        - Detected Themes: ${analysis.themes.join(', ')}
        - Characters Mentioned: ${analysis.characters.join(', ')}
        
        ${relevantChunks.length > 0 ? `
        RELEVANT CONTEXT FROM PROJECT:
        ${relevantChunks.map((chunk, i) => `
        ${i + 1}. [${chunk.metadata.contentType || 'unknown'}] ${chunk.pageContent.slice(0, 300)}...
        `).join('\n')}
        ` : projectContext ? `
        RELEVANT CONTEXT FROM PROJECT:
        Since this is a known project, provide suggestions that build upon the established elements above.
        Consider how your suggestions can enhance the existing characters, themes, and settings.
        ` : `
        RELEVANT CONTEXT FROM PROJECT:
        No specific project context available - provide general but helpful writing suggestions.
        `}
        
        ${memory && memory.messages.length > 0 ? `
        RECENT CONVERSATION:
        ${memory.messages.slice(-3).map(m => `${m.role}: ${m.content.slice(0, 200)}...`).join('\n')}
        ` : ''}
        
        CURRENT TEXT TO ANALYZE:
        "${context}"
        
        Based on all this context, provide intelligent, specific, and actionable writing suggestions that:
        1. Maintain consistency with the established project elements
        2. Build upon the existing narrative and character development
        3. Consider the current tone, pacing, and style
        4. Address potential plot development opportunities
        5. Suggest improvements that enhance the overall story
        6. Are specific and immediately actionable
        
        Format your response with clear sections and specific examples. Be encouraging but constructive.
      `;
    }

    // Advanced analysis helper methods
    private estimateSyllables(text: string): number {
      const words = text.toLowerCase().split(/\s+/);
      let totalSyllables = 0;
      
      for (const word of words) {
        const syllables = word.match(/[aeiouy]+/g);
        totalSyllables += syllables ? syllables.length : 1;
      }
      
      return totalSyllables;
    }

    private analyzeTone(text: string): string {
      const lowerText = text.toLowerCase();
      
      const toneIndicators = {
        'dark': ['death', 'shadow', 'fear', 'horror', 'nightmare', 'evil'],
        'romantic': ['love', 'heart', 'kiss', 'embrace', 'passion', 'tender'],
        'humorous': ['laugh', 'funny', 'joke', 'smile', 'amusing', 'witty'],
        'mysterious': ['mystery', 'secret', 'hidden', 'unknown', 'strange'],
        'dramatic': ['dramatic', 'intense', 'powerful', 'overwhelming'],
        'melancholic': ['sad', 'sorrow', 'grief', 'melancholy', 'lonely'],
        'hopeful': ['hope', 'bright', 'future', 'dream', 'possibility']
      };
      
      let bestMatch = { tone: 'neutral', score: 0 };
      
      Object.entries(toneIndicators).forEach(([tone, indicators]) => {
        const matches = indicators.filter(indicator => lowerText.includes(indicator));
        if (matches.length > bestMatch.score) {
          bestMatch = { tone, score: matches.length };
        }
      });
      
      return bestMatch.tone;
    }

    private analyzePacing(text: string): string {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLength = text.length / sentences.length;
      
      if (avgSentenceLength < 50) return 'fast';
      if (avgSentenceLength < 100) return 'moderate';
      return 'slow';
    }

    private extractAdvancedThemes(text: string): string[] {
      // Extract themes using simplified logic
      const themeKeywords = {
        'love': ['love', 'romance', 'heart', 'affection'],
        'betrayal': ['betray', 'deceive', 'lie', 'cheat'],
        'power': ['power', 'control', 'authority', 'rule'],
        'friendship': ['friend', 'companion', 'ally', 'loyalty'],
        'family': ['family', 'mother', 'father', 'parent']
      };
      
      const lowerText = text.toLowerCase();
      const themes: string[] = [];
      
      Object.entries(themeKeywords).forEach(([theme, keywords]) => {
        if (keywords.some(keyword => lowerText.includes(keyword))) {
          themes.push(theme);
        }
      });
      
      return themes;
    }

    private extractCharacters(text: string): string[] {
      // Extract character names using more sophisticated pattern matching
      const words = text.split(/\s+/);
      const potentialNames = words.filter(word => 
        /^[A-Z][a-z]{2,}$/.test(word) && 
        !['The', 'And', 'But', 'For', 'Nor', 'Or', 'So', 'Yet', 'This', 'That', 'These', 'Those'].includes(word)
      );
      
      // Count frequency and return most frequent
      const frequency: Record<string, number> = {};
      potentialNames.forEach(name => {
        frequency[name] = (frequency[name] || 0) + 1;
      });
      
      return Object.entries(frequency)
        .filter(([_, count]) => count > 1)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 5)
        .map(([name, _]) => name);
    }

    private extractPlotPoints(text: string): string[] {
      const plotKeywords = [
        'discovered', 'revealed', 'confronted', 'decided', 'realized', 'escaped',
        'arrived', 'departed', 'met', 'lost', 'found', 'betrayed', 'saved'
      ];
      
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const plotSentences = sentences.filter(sentence => 
        plotKeywords.some(keyword => sentence.toLowerCase().includes(keyword))
      );
      
      return plotSentences.slice(0, 3).map(s => s.trim());
    }
  }

  // Create a singleton instance
  const aiService = new AIService();

  export default aiService;
  export { WritingAnalysis, ConversationMemory };
