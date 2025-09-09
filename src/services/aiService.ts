import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import ragService, { ProjectContext } from './ragService';
import dotenv from "dotenv";
dotenv.config();

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

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn("No API key found for Google Generative AI. AI features will not work.");
      this.model = null as any;
      return;
    }
    
    this.model = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      maxOutputTokens: 2048,
      apiKey: apiKey,
      temperature: 0.7,
    });
  }

  // Generate autocomplete suggestions (Copilot-like feature)
  async generateAutocomplete(
    beforeCursor: string,
    afterCursor: string,
    projectId?: string
  ): Promise<string> {
    try {
      if (!this.model) {
        return '';
      }

      // Get the last few sentences for context
      const contextLength = Math.min(beforeCursor.length, 500);
      const context = beforeCursor.slice(-contextLength);
      
      // Get project context if available
      const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
      const relevantChunks = projectId ? await ragService.search(context, projectId, 2) : [];
      
      // Analyze the current writing style
      const analysis = this.analyzeWriting(beforeCursor);
      
      // Build autocomplete prompt
      const prompt = `
        You are an AI writing assistant providing autocomplete suggestions. Generate a natural continuation that:
        1. Maintains the current writing style and tone
        2. Flows naturally from the existing text
        3. Is contextually appropriate
        4. Provides 1-3 words or a short phrase (maximum 20 words)
        5. Fixes any obvious spelling mistakes in the last word if needed
        
        ${projectContext ? `
        PROJECT CONTEXT:
        - Title: ${projectContext.title}
        - Genre: ${projectContext.genre || 'Unknown'}
        - Characters: ${projectContext.characters?.join(', ') || 'None'}
        - Themes: ${projectContext.themes?.join(', ') || 'None'}
        ` : ''}
        
        WRITING STYLE ANALYSIS:
        - Tone: ${analysis.tone}
        - Pacing: ${analysis.pacing}
        - Average sentence length: ${analysis.wordCount / Math.max(analysis.sentenceCount, 1)}
        
        ${relevantChunks.length > 0 ? `
        RELEVANT PROJECT CONTENT:
        ${relevantChunks.map(chunk => chunk.pageContent.slice(0, 150)).join('\n')}
        ` : ''}
        
        TEXT BEFORE CURSOR:
        "${context}"
        
        ${afterCursor ? `TEXT AFTER CURSOR: "${afterCursor.slice(0, 100)}"` : ''}
        
        Provide ONLY the autocomplete suggestion text, nothing else. Keep it short and natural.
      `;

      const response = await this.model.invoke(prompt);
      let suggestion = (response.content as string).trim();
      
      // Clean up the suggestion
      suggestion = suggestion.replace(/^["']|["']$/g, ''); // Remove quotes
      suggestion = suggestion.replace(/\n.*$/s, ''); // Take only first line
      suggestion = suggestion.slice(0, 100); // Limit length
      
      return suggestion;
    } catch (error) {
      console.error('Error generating autocomplete:', error);
      return '';
    }
  }

  // Enhanced suggestion generation with project context and conversation memory
  async generateSuggestions(
    context: string,
    projectId: string,
    userId?: string
  ): Promise<string> {
    try {
      if (!this.model) {
        return 'AI features are not available due to missing API key configuration.';
      }

      // Get project context and relevant chunks
      const projectContext = ragService.getProjectContext(projectId);
      const relevantChunks = await ragService.search(context, projectId, 5);
      const projectStats = await ragService.getProjectStats(projectId);
      
      // Get conversation memory for personalization
      const memory = userId ? this.getConversationMemory(userId, projectId) : null;
      
      // Analyze the current writing
      const analysis = this.analyzeWriting(context);
      
      // Build comprehensive context-aware prompt
      const prompt = this.buildIntelligentPrompt({
        context,
        projectId,
        projectContext,
        relevantChunks,
        projectStats,
        memory,
        analysis,
        requestType: 'suggestions'
      });

      const response = await this.model.invoke(prompt);
      const suggestions = response.content as string;
      
      // Store in conversation memory
      if (userId) {
        this.updateConversationMemory(userId, projectId, 'user', context);
        this.updateConversationMemory(userId, projectId, 'assistant', suggestions);
      }
      
      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return 'I encountered an error while generating suggestions. Please try again later.';
    }
  }

  // Intelligent writing analysis
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

  // Enhanced theme consistency analysis with project context
  async analyzeThemeConsistency(text: string, theme: string, projectId?: string): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
      const relevantChunks = projectId ? await ragService.search(`theme ${theme}`, projectId, 3) : [];
      const analysis = this.analyzeWriting(text);
      
      const prompt = `
        As an expert writing analyst, analyze the following text for consistency with the theme "${theme}".
        
        ${projectContext ? `
        PROJECT CONTEXT:
        - Title: ${projectContext.title}
        - Genre: ${projectContext.genre || 'Unknown'}
        - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
        - Existing Themes: ${projectContext.themes?.join(', ') || 'None identified'}
        ` : ''}
        
        CURRENT TEXT ANALYSIS:
        - Word Count: ${analysis.wordCount}
        - Detected Tone: ${analysis.tone}
        - Detected Themes: ${analysis.themes.join(', ')}
        - Readability Score: ${analysis.readabilityScore.toFixed(1)}
        
        TEXT TO ANALYZE:
        "${text}"
        
        ${relevantChunks.length > 0 ? `
        RELATED CONTENT FROM PROJECT:
        ${relevantChunks.map((chunk, i) => `${i + 1}. ${chunk.pageContent.slice(0, 200)}...`).join('\n')}
        ` : ''}
        
        Please provide:
        1. **Theme Consistency Score** (1-10): How well does this text align with the "${theme}" theme?
        2. **Specific Examples**: Point out specific elements that support or contradict the theme
        3. **Improvement Suggestions**: Concrete ways to strengthen theme integration
        4. **Continuity Check**: How well does this align with the existing project themes?
        5. **Character Alignment**: Do character actions/dialogue support the theme?
        
        Format your response with clear headings and actionable advice.
      `;

      const response = await this.model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error analyzing theme consistency:', error);
      return 'Unable to analyze theme consistency at this time.';
    }
  }

  // Enhanced foreshadowing analysis with project awareness
  async checkForeshadowing(text: string, context: string, projectId?: string): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
      const relevantChunks = projectId ? await ragService.search('plot future events', projectId, 4) : [];
      const analysis = this.analyzeWriting(text);
      
      const prompt = `
        As a master storytelling analyst, examine this text for foreshadowing opportunities and effectiveness.
        
        ${projectContext ? `
        PROJECT CONTEXT:
        - Title: ${projectContext.title}
        - Plot Points: ${projectContext.plotPoints?.join(', ') || 'None identified'}
        - Characters: ${projectContext.characters?.join(', ') || 'None identified'}
        - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
        ` : ''}
        
        WRITING ANALYSIS:
        - Detected Plot Points: ${analysis.plotPoints.join(', ')}
        - Tone: ${analysis.tone}
        - Pacing: ${analysis.pacing}
        
        CURRENT TEXT:
        "${text}"
        
        BROADER CONTEXT:
        "${context}"
        
        ${relevantChunks.length > 0 ? `
        RELATED PROJECT CONTENT:
        ${relevantChunks.map((chunk, i) => `${i + 1}. ${chunk.pageContent.slice(0, 150)}...`).join('\n')}
        ` : ''}
        
        Please analyze:
        1. **Existing Foreshadowing**: What subtle hints or setup are already present?
        2. **Missed Opportunities**: What elements could be enhanced for better foreshadowing?
        3. **Future Plot Points**: What upcoming events could be subtly hinted at here?
        4. **Symbolic Elements**: Objects, dialogue, or actions that could carry deeper meaning
        5. **Character Behavior**: How character actions now could hint at future development
        6. **Specific Implementation**: Concrete suggestions for adding foreshadowing
        
        Provide actionable, specific advice that maintains the current tone and style.
      `;

      const response = await this.model.invoke(prompt);
      return response.content as string;
    } catch (error) {
      console.error('Error checking foreshadowing:', error);
      return 'Unable to check for foreshadowing opportunities at this time.';
    }
  }

  // Enhanced character motivation and stakes evaluation
  async evaluateMotivationAndStakes(text: string, character: string, projectId?: string): Promise<string> {
    if (!this.model) {
      return 'AI features are not available due to missing API key configuration.';
    }
    
    try {
      const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
      const characterChunks = projectId ? await ragService.search(`${character} motivation goals`, projectId, 4) : [];
      const analysis = this.analyzeWriting(text);
      
      const prompt = `
        As a character development expert, analyze the motivation and stakes for "${character}" in this text.
        
        ${projectContext ? `
        PROJECT CONTEXT:
        - Title: ${projectContext.title}
        - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
        - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
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
      const memory = this.getConversationMemory(userId, projectId);
      const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
      
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
  private getConversationMemory(userId: string, projectId?: string): ConversationMemory {
    const key = `${userId}_${projectId || 'general'}`;
    if (!this.conversationMemory.has(key)) {
      this.conversationMemory.set(key, {
        userId,
        projectId,
        messages: [],
        userPreferences: {},
        //@ts-ignore
        projectContext: projectId ? ragService.getProjectContext(projectId) : undefined
      });
    }
    return this.conversationMemory.get(key)!;
  }

  private updateConversationMemory(
    userId: string,
    projectId: string | undefined,
    role: 'user' | 'assistant',
    content: string,
    context?: string
  ): void {
    const memory = this.getConversationMemory(userId, projectId);
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
    const projectContext = projectId ? ragService.getProjectContext(projectId) : null;
    
    const prompt = `
      Help brainstorm creative ideas based on this request:
      
      "${userInput}"
      
      ${projectContext ? `
      Project Context:
      - Title: ${projectContext.title}
      - Genre: ${projectContext.genre || 'Unknown'}
      - Themes: ${projectContext.themes?.join(', ') || 'None'}
      - Characters: ${projectContext.characters?.join(', ') || 'None'}
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
    const memory = this.getConversationMemory(userId, projectId);
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
      - Title: "${projectContext.title}"
      - Genre: ${projectContext.genre || 'Not specified'}
      - Known Characters: ${projectContext.characters?.join(', ') || 'None identified'}
      - Themes: ${projectContext.themes?.join(', ') || 'None identified'}
      - Writing Style: ${projectContext.writingStyle || 'Not specified'}
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
      
      RELEVANT CONTEXT FROM PROJECT:
      ${relevantChunks.map((chunk, i) => `
      ${i + 1}. [${chunk.metadata.contentType || 'unknown'}] ${chunk.pageContent.slice(0, 300)}...
      `).join('\n')}
      
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
    // This would use the same logic as the RAG service but with additional sophistication
    return ragService['extractThemes'] ? ragService['extractThemes'](text) : [];
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
