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

  class AIService {
    private model: ChatGoogleGenerativeAI;
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private writingPatterns: Map<string, any> = new Map();
  private readonly MAX_CONVERSATION_MEMORY_SIZE = 100;
  private readonly MAX_WRITING_PATTERNS_SIZE = 50;

    constructor() {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.warn("No API key found for Google Generative AI. AI features will not work.");
        this.model = null as any;
        return;
      }
      
      this.model = new ChatGoogleGenerativeAI({
        model: "gemini-2.0-flash",
        maxOutputTokens: 1024, // Reduced from 2048 for speed
        apiKey: apiKey,
        temperature: 0.7,
        timeout: 30000, // 30 second timeout
        maxRetries: 1, // Reduce retries for speed
      });
    }

    // Generate autocomplete suggestions (Copilot-like feature) with caching
    async generateAutocomplete(
      beforeCursor: string,
      afterCursor: string,
      projectId?: string
    ): Promise<string> {
      try {
        if (!this.model) {
          return '';
        }

        // Get the last few sentences for context (limit for performance)
        const contextLength = Math.min(beforeCursor.length, 300); // Reduced from 500
        const context = beforeCursor.slice(-contextLength);
        
        // Create cache key for autocomplete
        const cacheKey = CacheKeys.aiResponse(
          `autocomplete:${context}:${afterCursor?.slice(0, 50) || ''}:${projectId || 'none'}`,
          'gemini-2.0-flash'
        );
        
        // Try to get cached result first
        const cachedSuggestion = aiResponseCache.get<string>(cacheKey);
        if (cachedSuggestion) {
          console.log('🎯 Returning cached autocomplete suggestion');
          return cachedSuggestion;
        }
        
        console.log('🔄 Generating new autocomplete suggestion...');
        
        // Get project context from cache or generate
        const projectContext = projectId ? await this.getCachedProjectContext(projectId) : null;
        
        // Limit RAG search for performance (only 1 result for autocomplete)
        const ragResults = projectId && projectContext ? await improvedRAGService.intelligentSearch(context, {
          projectId,
          limit: 1,
          includeContext: false // Reduce overhead
        }) : null;
        const relevantChunks = ragResults?.results || [];
        
        // Quick analysis for autocomplete (simplified)
        const analysis = this.analyzeWritingQuick(beforeCursor);
        
        const suggestion = await this.generateAutocompleteSuggestion(
          context, afterCursor, projectContext, relevantChunks, analysis
        );
        
        // Cache the result for 5 minutes
        aiResponseCache.set(cacheKey, suggestion, 300);
        
        return suggestion;
      } catch (error) {
        console.error('Error generating autocomplete:', error);
        return '';
      }
    }
    
    // Internal method for generating autocomplete suggestions
    private async generateAutocompleteSuggestion(
      context: string,
      afterCursor: string,
      projectContext: ProjectContext | null,
      relevantChunks: any[],
      analysis: any
    ): Promise<string> {
      // Get the last few words to understand what we're continuing
      const contextWords = context.trim().split(/\s+/);
      const lastWords = contextWords.slice(-5).join(' '); // Last 5 words for context
      
      const prompt = `Complete this text with 1-5 words only. Just continue naturally:

Text ending: "${lastWords}"
${afterCursor ? `What comes next: "${afterCursor.slice(0, 30)}..."\n` : ''}

Provide ONLY the next few words (maximum 5 words). Do not repeat the text. Do not add quotes or explanations.

Continuation:`;

      const response = await trackAICall(
        () => this.model!.invoke(prompt),
        'Autocomplete Generation'
      );
      let suggestion = (response.content as string).trim();
      
      // Clean up the suggestion very aggressively for autocomplete
      suggestion = suggestion.replace(/^["'`]|["'`]$/g, ''); // Remove quotes
      suggestion = suggestion.replace(/^(continuation:|complete:|next:)/i, '').trim(); // Remove instruction words
      suggestion = suggestion.split('\n')[0]; // First line only
      suggestion = suggestion.split('.')[0]; // Don't include full sentences
      
      // Ensure it's short (max 5 words for autocomplete)
      const words = suggestion.trim().split(/\s+/);
      if (words.length > 5) {
        suggestion = words.slice(0, 5).join(' ');
      }
      
      // Don't return anything if it's too long or contains the original text
      if (suggestion.length > 30 || suggestion.includes(lastWords)) {
        return '';
      }
      
      return suggestion;
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
    async generateSuggestions(
      context: string,
      projectId: string,
      userId?: string
    ): Promise<string> {
      try {
        if (!this.model) {
          return 'AI features are not available due to missing API key configuration.';
        }

        console.log(`🎯 Generating suggestions for project: ${projectId}`);
        
        // Create cache key for suggestions (less aggressive caching than autocomplete)
        const contextHash = context.slice(0, 200); // Use first 200 chars for cache key
        const cacheKey = CacheKeys.aiResponse(
          `suggestions:${contextHash}:${projectId}:${userId || 'anon'}`,
          'gemini-2.0-flash'
        );
        
        // Check cache first (shorter TTL for suggestions as they should be more dynamic)
        const cachedSuggestion = aiResponseCache.get<string>(cacheKey);
        if (cachedSuggestion) {
          console.log('🎯 Returning cached suggestions');
          return cachedSuggestion;
        }

        // Get project context from cache
        const projectContext = await this.getCachedProjectContext(projectId);
        console.log(`📋 Project context retrieved:`, projectContext ? 'Found' : 'Not found');
        
        // Try to get relevant chunks from RAG with reduced overhead
        let relevantChunks: any[] = [];
        let projectStats: any = { totalChunks: 0, characters: [], themes: [], contentTypes: [] };
        
        try {
          // Reduce RAG search limit for better performance
          const ragResults = await improvedRAGService.intelligentSearch(context, {
            projectId,
            limit: 3, // Reduced from 5
            includeContext: false // Reduce overhead
          });
          relevantChunks = ragResults.results || [];
          
          // Get project stats from cache
          const statsCacheKey = CacheKeys.projectStats(projectId);
          projectStats = await projectCache.getOrSet(
            statsCacheKey,
            () => improvedRAGService.getProjectStats(projectId),
            900 // 15 minutes cache for stats
          );
          
          console.log(`🔍 RAG search found ${relevantChunks.length} relevant chunks`);
        } catch (ragError) {
          console.log(`⚠️ RAG search failed, proceeding with project context only`);
        }
        
        // Get conversation memory for personalization (with size limit for performance)
        const memory = userId ? await this.getConversationMemory(userId, projectId) : null;
        
        // Use optimized analysis for better performance
        const analysis = this.analyzeWritingOptimized(context);
        
        // Build optimized context-aware prompt
        const prompt = this.buildOptimizedPrompt({
          context,
          projectId,
          projectContext,
          relevantChunks,
          projectStats,
          memory,
          analysis,
          requestType: 'suggestions'
        });

        console.log(`🤖 Invoking AI model for suggestions...`);
        const response = await trackAICall(
          () => this.model!.invoke(prompt),
          'Suggestions Generation'
        );
        const suggestions = response.content as string;
        
        console.log(`✅ AI suggestions generated successfully`);
        
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
      
      // Build a more concise prompt for better performance
      return `You are an expert AI writing assistant. Provide helpful writing suggestions for this text.

${projectContext ? `PROJECT: "${projectContext.projectId}" - Style: ${projectContext.writingStyle || 'standard'}, Themes: ${projectContext.themes?.slice(0, 2).join(', ') || 'none'}\n` : ''}
${relevantChunks.length > 0 ? `REFERENCE: ${relevantChunks[0].pageContent.slice(0, 200)}...\n` : ''}
WRITING: Tone: ${analysis.tone}, ${analysis.wordCount} words, ${analysis.readabilityScore.toFixed(0)}/100 readability

TEXT:
"${context.slice(0, 1000)}${context.length > 1000 ? '...' : ''}"

Provide 3-4 specific, actionable suggestions to improve this writing. Focus on:
1. Flow and readability
2. Character development
3. Plot advancement
4. Thematic depth

Be concise but helpful.`;
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
  async analyzeThemeConsistency(text: string, theme: string, projectId?: string): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
      const ragResults = projectId ? await improvedRAGService.intelligentSearch(`${theme} thematic elements character development`, {
        projectId,
        limit: 5,
        themes: [theme],
        includeContext: true
      }) : null;
      const relevantChunks = ragResults?.results || [];
      const analysis = this.analyzeWriting(text);
      
      const prompt = `You are a literary scholar and professional editor specializing in thematic analysis and narrative coherence. Conduct a comprehensive theme consistency analysis.

**TARGET THEME**: "${theme}"

${projectContext ? `
**PROJECT UNIVERSE**:
- Project ID: "${projectContext.projectId}"
- Character Roster: ${projectContext.characters?.join(', ') || 'Characters developing'}
- Established Thematic Framework: ${projectContext.themes?.join(', ') || 'Themes emerging'}
- Narrative Style: ${projectContext.writingStyle || 'Style evolving'}
- Settings: ${projectContext.settings?.join(', ') || 'Settings developing'}
` : ''}

**CURRENT TEXT ANALYSIS**:
- Length: ${analysis.wordCount} words
- Emotional Register: ${analysis.tone}
- Detected Themes: ${analysis.themes.join(', ') || 'None detected'}
- Characters Present: ${analysis.characters.join(', ') || 'None identified'}
- Readability Level: ${analysis.readabilityScore.toFixed(1)}/100

${relevantChunks.length > 0 ? `
**THEMATIC CONTEXT FROM PROJECT**:
${relevantChunks.map((chunk, i) => `
[Reference ${i + 1}] ${chunk.metadata.contentType?.toUpperCase() || 'CONTENT'}:
"${chunk.pageContent.slice(0, 250)}${chunk.pageContent.length > 250 ? '...' : ''}"
Themes: ${chunk.metadata.themes?.join(', ') || 'none'}
Emotional Tone: ${chunk.metadata.emotions?.join(', ') || 'none'}
`).join('')}
` : ''}

**TEXT FOR THEMATIC ANALYSIS**:
"""${text}"""

Provide a sophisticated thematic analysis:

## 📊 THEME CONSISTENCY EVALUATION
**Score: [1-10]** with detailed justification
- How explicitly vs. subtly is the theme presented?
- Does the theme emerge naturally from character actions and plot?
- Is the thematic treatment sophisticated and nuanced?

## 🎭 THEMATIC EXPRESSION ANALYSIS
**Direct Manifestations**:
- Explicit mentions or discussions of the theme
- Character statements that directly address the theme

**Subtle Integration**:
- Actions that demonstrate the theme without stating it
- Symbolic elements that reinforce the theme
- Subtext and implications that support thematic depth

**Character-Theme Alignment**:
- How character motivations reflect the theme
- Whether character arcs support thematic development
- Consistency between character actions and thematic messages

## 💎 ENHANCEMENT OPPORTUNITIES
**Strengthen Existing Elements**:
- Specific sentences or scenes that could be deepened
- Ways to make thematic elements more sophisticated
- Opportunities to show rather than tell

**New Integration Possibilities**:
- Character moments that could be enhanced for thematic resonance
- Dialogue opportunities for thematic subtext
- Environmental or symbolic details that could reinforce the theme

## 🏗️ NARRATIVE COHERENCE
**Project-Wide Consistency**:
- How this section fits with established thematic patterns
- Whether the theme treatment matches your story's overall sophistication level
- Continuity with character development and world-building

**Reader Experience**:
- Is the theme accessible without being heavy-handed?
- Will readers discover new thematic layers on re-reading?
- Does the theme enhance rather than overshadow the story?

## 🎯 SPECIFIC ACTIONABLE RECOMMENDATIONS
Provide 3-4 concrete suggestions with examples:
- Exact phrases or scenes to modify
- New details to weave in naturally
- Ways to deepen existing thematic moments
- Maintain your established voice and style

Focus on sophisticated thematic integration that respects reader intelligence while ensuring thematic coherence throughout your narrative.`;

      const response = await this.model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error analyzing theme consistency:', error);
      return 'I encountered an error while analyzing theme consistency. Please try again, or consider manually reviewing how your chosen theme is woven through character actions, dialogue, and plot developments in this section.';
    }
  }

  // Advanced foreshadowing analysis with deep storytelling insights
  async checkForeshadowing(text: string, context: string, projectId?: string): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
      const ragResults = projectId ? await improvedRAGService.intelligentSearch('plot future events character development', {
        projectId,
        limit: 6,
        contentTypes: ['plot', 'narrative', 'character'],
        includeContext: true
      }) : null;
      const relevantChunks = ragResults?.results || [];
      const analysis = this.analyzeWriting(text);
      
      const prompt = `You are a master storytelling analyst and fiction editor with expertise in narrative craft, foreshadowing, and literary device implementation. Analyze this writing sample for foreshadowing opportunities.

${projectContext ? `
PROJECT UNIVERSE:
- Project ID: "${projectContext.projectId}"
- Established Characters: ${projectContext.characters?.join(', ') || 'Characters being developed'}
- Core Themes: ${projectContext.themes?.join(', ') || 'Themes emerging'}
- Known Plot Points: ${projectContext.plotPoints?.join(', ') || 'Plot developing organically'}
- Writing Style: ${projectContext.writingStyle || 'Style being established'}
- Settings: ${projectContext.settings?.join(', ') || 'Settings developing'}
` : ''}

CURRENT WRITING ANALYSIS:
- Detected Themes: ${analysis.themes.join(', ') || 'None detected'}
- Emotional Tone: ${analysis.tone}
- Narrative Pacing: ${analysis.pacing}
- Characters Present: ${analysis.characters.join(', ') || 'None identified'}
- Plot Elements: ${analysis.plotPoints.join(', ') || 'None detected'}

${relevantChunks.length > 0 ? `
RELATED STORY CONTENT:
${relevantChunks.map((chunk, i) => `
[Context ${i + 1}] ${chunk.metadata.contentType?.toUpperCase() || 'CONTENT'}:
"${chunk.pageContent.slice(0, 300)}${chunk.pageContent.length > 300 ? '...' : ''}"
Themes: ${chunk.metadata.themes?.join(', ') || 'none'}
Characters: ${chunk.metadata.characters?.join(', ') || 'none'}
`).join('')}
` : ''}

TEXT TO ANALYZE FOR FORESHADOWING:
"""${text}"""

BROADER NARRATIVE CONTEXT:
"""${context}"""

Provide a comprehensive foreshadowing analysis covering:

## 🔍 EXISTING FORESHADOWING ANALYSIS
- Identify current subtle hints, symbols, or setup elements
- Rate effectiveness (1-10) and explain reasoning
- Note which future events these might be pointing toward

## 💎 ENHANCEMENT OPPORTUNITIES
- Specific elements that could be strengthened for better foreshadowing
- Concrete ways to make existing hints more subtle yet powerful
- Balance between subtlety and clarity for your target audience

## 🌟 NEW FORESHADOWING POSSIBILITIES
- **Character Actions**: Small behaviors that could hint at future character arcs
- **Dialogue Subtext**: What characters say vs. what they mean - opportunities for layered meaning
- **Environmental Details**: Setting elements that could mirror or predict future events
- **Symbolic Objects**: Items that could carry deeper narrative significance
- **Emotional Undercurrents**: Subtle emotional setups for future payoffs

## 🎯 SPECIFIC IMPLEMENTATION SUGGESTIONS
Provide 3-5 concrete, actionable suggestions with examples:
- Exact sentences or phrases that could be modified
- New details that could be naturally woven in
- Character moments that could be enhanced
- Maintain your established tone and style

## 🏗️ NARRATIVE ARCHITECTURE
- How this section fits into the larger story structure
- Opportunities to plant seeds for major plot reveals
- Ways to create satisfying "aha" moments for readers on re-reading

Focus on sophisticated, literary foreshadowing that enhances rather than telegraphs future events. Consider your genre conventions and reader expectations.`;

      const response = await this.model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error checking foreshadowing:', error);
      return 'I encountered an error while analyzing foreshadowing opportunities. Please try again, or consider manually reviewing your text for subtle hints and symbolic elements that could enhance future story developments.';
    }
  }

    // Enhanced character motivation and stakes evaluation
    async evaluateMotivationAndStakes(text: string, character: string, projectId?: string): Promise<string> {
      if (!this.model) {
        return 'AI features are not available due to missing API key configuration.';
      }
      
      try {
        const projectContext = projectId ? await improvedRAGService.syncProjectContext(projectId) : null;
        const ragResults = projectId ? await improvedRAGService.intelligentSearch(`${character} motivation goals`, {
          projectId,
          limit: 4,
          characters: [character],
          contentTypes: ['character', 'narrative', 'dialogue'],
          includeContext: true
        }) : null;
        const characterChunks = ragResults?.results || [];
        const analysis = this.analyzeWriting(text);
        
        const prompt = `
          As a character development expert, analyze the motivation and stakes for "${character}" in this text.
          
          ${projectContext ? `
          PROJECT CONTEXT:
          - Project ID: ${projectContext.projectId}
          - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
          - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
          - Settings: ${projectContext.settings?.join(', ') || 'None identified'}
          ` : ''}
          
          WRITING ANALYSIS:
          - Characters Mentioned: ${analysis.characters.join(', ')}
          - Tone: ${analysis.tone}
          - Themes Present: ${analysis.themes.join(', ')}
          
          TEXT TO ANALYZE:
          "${text}"
          
          ${characterChunks.length > 0 ? `
          PREVIOUS CHARACTER DEVELOPMENT:
          ${characterChunks.map((chunk, i) => `${i + 1}. ${chunk.pageContent.slice(0, 200)}...`).join('\n')}
          ` : ''}
          
          Please evaluate:
          1. **Motivation Clarity** (1-10): How clear are ${character}'s motivations?
          2. **Internal vs External**: What drives them internally vs. external pressures?
          3. **Stakes Assessment**: What does ${character} stand to gain or lose?
          4. **Emotional Investment**: Why should readers care about ${character}'s outcome?
          5. **Character Arc**: How do current motivations serve their overall journey?
          6. **Conflict Alignment**: Do the stakes create meaningful conflict?
          7. **Improvement Strategies**: Specific ways to strengthen motivation/stakes
          
          Provide detailed analysis with specific examples and actionable suggestions.
        `;

        const response = await this.model.invoke(prompt);
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
      
      const response = await this.model.invoke(prompt);
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
      
      const response = await this.model.invoke(prompt);
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
      
      const response = await this.model.invoke(prompt);
      return response.content as string;
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
  export { AIService, WritingAnalysis, ConversationMemory };
