import ragService from './ragService';
import aiService from './aiService';
import { Document } from "langchain/document";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ChatbotService {
  // Store user preferences and behavior
  private userPreferences: Map<string, any> = new Map();
  private userInteractionHistory: Map<string, any[]> = new Map();

  // Set user preferences
  setUserPreferences(userId: string, preferences: any) {
    this.userPreferences.set(userId, preferences);
  }

  // Get user preferences
  getUserPreferences(userId: string) {
    return this.userPreferences.get(userId) || {};
  }

  // Record user interaction
  recordUserInteraction(userId: string, interaction: any) {
    if (!this.userInteractionHistory.has(userId)) {
      this.userInteractionHistory.set(userId, []);
    }
    
    const history = this.userInteractionHistory.get(userId);
    if (history) {
      history.push({
        ...interaction,
        timestamp: new Date().toISOString()
      });
      
      // Keep only the last 100 interactions
      if (history.length > 100) {
        history.shift();
      }
    }
  }

  // Get user interaction history
  getUserInteractionHistory(userId: string) {
    return this.userInteractionHistory.get(userId) || [];
  }

  // Generate personalized suggestions based on user behavior
  async generatePersonalizedSuggestions(userId: string, context: string, projectId?: string) {
    try {
      // Get user preferences
      const preferences = this.getUserPreferences(userId);
      
      // Get user interaction history
      const history = this.getUserInteractionHistory(userId);
      
      // Search for relevant content in RAG system
      let relevantChunks: Document[] = [];
      if (context) {
        //@ts-ignore
        relevantChunks = await ragService.search(context, 3);
      }
      
      // If the context is very short, provide a more conversational response
      if (context.length < 10) {
        const shortResponse = await aiService.generateSuggestions(
          `The user said: "${context}". Please provide a brief, helpful response that acknowledges their input and asks how you can help with their writing project.`,
          projectId || 'default'
        );
        return shortResponse;
      }
      
      // Create a prompt that incorporates user preferences and history
      const prompt = `
        You are an AI writing assistant helping a writer with their project.
        
        User Preferences:
        ${JSON.stringify(preferences, null, 2)}
        
        User's Recent Interactions:
        ${history.slice(-5).map(i => `- ${i.type}: ${i.content}`).join('\n')}
        
        Current Context:
        "${context}"
        
        Relevant Information from User's Previous Work:
        ${relevantChunks.map(chunk => `- ${chunk.pageContent}`).join('\n')}
        
        Please provide personalized suggestions for the writer's next steps, focusing on:
        1. Story consistency and continuity
        2. Character development
        3. Plot progression
        4. Style and tone matching their preferences
        5. Potential improvements or directions
        
        Keep your response concise and actionable.
      `;
      
      const response = await aiService.generateSuggestions(context, projectId || 'default');
      return response;
    } catch (error) {
      console.error('Error generating personalized suggestions:', error);
      return 'Sorry, I encountered an error while generating personalized suggestions. Please try again later.';
    }
  }

  // Ask user about their writing flow and preferences
  async askAboutWritingFlow(userId: string) {
    const preferences = this.getUserPreferences(userId);
    
    const questions = [
      "What type of writing are you working on? (e.g., novel, screenplay, short story)",
      "What genre do you prefer? (e.g., fantasy, sci-fi, mystery, romance)",
      "What's your preferred writing style? (e.g., descriptive, dialogue-heavy, action-packed)",
      "Do you have any specific themes you want to explore?",
      "What's your typical writing schedule like?",
      "Do you prefer planning your story in advance or discovering it as you write?"
    ];
    
    // Filter out questions that have already been answered
    const unansweredQuestions = questions.filter(q => !preferences[q]);
    
    return unansweredQuestions;
  }

  // Process user's answers to writing flow questions
  processWritingFlowAnswers(userId: string, answers: Record<string, string>) {
    const preferences = this.getUserPreferences(userId);
    
    // Update user preferences with new answers
    this.setUserPreferences(userId, {
      ...preferences,
      ...answers
    });
    
    // Record this interaction
    this.recordUserInteraction(userId, {
      type: 'writing_flow_questionnaire',
      content: JSON.stringify(answers)
    });
  }

  // Fast chat mode - quick responses without complex processing but with rich context
  async fastChat(userId: string, message: string, projectId?: string): Promise<string> {
    try {
      // Record the user interaction for context
      this.recordUserInteraction(userId, {
        type: 'fast_chat',
        content: message
      });

      // Get user preferences for personalized responses
      const preferences = this.getUserPreferences(userId);
      
      // Get recent interaction history for context
      const recentHistory = this.getUserInteractionHistory(userId).slice(-5);
      
      // Get user's other projects data for cross-project references
      const userProjectsData = await this.getUserProjectsData(userId, projectId);
      
      // Build enriched context for fast but intelligent responses
      let enrichedContext = message;
      
      // Add user preferences context
      if (Object.keys(preferences).length > 0) {
        enrichedContext += `\n\n[USER PREFERENCES]\n`;
        enrichedContext += `Writing Style: ${preferences.writingStyle || 'Not specified'}\n`;
        enrichedContext += `Preferred Genre: ${preferences.genre || 'Not specified'}\n`;
        enrichedContext += `Tone Preference: ${preferences.tonePreference || 'Not specified'}\n`;
        enrichedContext += `Favorite Themes: ${preferences.themes?.join(', ') || 'Not specified'}\n`;
        enrichedContext += `Writing Goals: ${preferences.writingGoals?.join(', ') || 'Not specified'}`;
      }
      
      // Add cross-project context if available
      if (userProjectsData && userProjectsData.length > 0) {
        enrichedContext += `\n\n[USER'S OTHER PROJECTS CONTEXT]\n`;
        userProjectsData.forEach((project, index) => {
          enrichedContext += `Project ${index + 1}: "${project.title}"\n`;
          if (project.characters?.length > 0) {
            enrichedContext += `- Characters: ${project.characters.join(', ')}\n`;
          }
          if (project.themes?.length > 0) {
            enrichedContext += `- Themes: ${project.themes.join(', ')}\n`;
          }
          if (project.description) {
            enrichedContext += `- Description: ${project.description.slice(0, 100)}...\n`;
          }
          enrichedContext += `\n`;
        });
      }
      
      // Add recent conversation context
      if (recentHistory.length > 0) {
        enrichedContext += `\n\n[RECENT CONVERSATION CONTEXT]\n`;
        enrichedContext += recentHistory.map(h => `${h.type}: ${h.content.slice(0, 150)}...`).join('\n');
      }
      
      enrichedContext += `\n\n[INSTRUCTION]\nBased on the user's preferences and their other projects' context above, provide a helpful, personalized response. Focus on answering exactly what they asked for:
      - If they ask for plot twists, provide creative plot twist ideas
      - If they ask for character development, give character suggestions  
      - If they ask for dialogue help, provide dialogue examples
      - If they ask for themes, suggest relevant themes
      - Always give direct, actionable advice that matches their request

      User's question: "${message}"
      Please provide specific, helpful suggestions that directly address what they're asking for.`;

      // Use AI service's intelligent response with the user's actual question as primary context
      const response = await aiService.generateIntelligentResponse(
        message, // Use the original message as the primary input
        userId,
        projectId,
        enrichedContext // Pass enriched context as additional context
      );

      // Record the AI response
      this.recordUserInteraction(userId, {
        type: 'fast_chat_response',
        content: response
      });

      return response;
    } catch (error) {
      console.error('Error in fast chat:', error);
      return 'Sorry, I encountered an error while processing your message. Please try again.';
    }
  }

  // Simple question answering without embedding but with rich user context
  async quickAnswer(userId: string, question: string, projectId?: string): Promise<string> {
    try {
      // Get user preferences from both memory and database
      const memoryPreferences = this.getUserPreferences(userId);
      
      // Get database preferences for richer context
      const dbPreferences = await prisma.userPreferences.findUnique({
        where: { userId }
      });
      
      // Get recent interaction history for context
      const recentHistory = this.getUserInteractionHistory(userId).slice(-3);
      
      // Get user's other projects data for cross-project references
      const userProjectsData = await this.getUserProjectsData(userId, projectId);
      
      // Build enriched context-aware prompt
      let contextualPrompt = `User question: "${question}"`;
      
      // Add comprehensive user preferences
      if (dbPreferences || Object.keys(memoryPreferences).length > 0) {
        contextualPrompt += `\n\n[USER WRITING PREFERENCES]\n`;
        contextualPrompt += `Writing Style: ${dbPreferences?.writingStyle || memoryPreferences.writingStyle || 'Not specified'}\n`;
        contextualPrompt += `Preferred Genre: ${dbPreferences?.genre || memoryPreferences.genre || 'Not specified'}\n`;
        contextualPrompt += `Tone Preference: ${dbPreferences?.tonePreference || memoryPreferences.tonePreference || 'Not specified'}\n`;
        contextualPrompt += `Favorite Themes: ${(dbPreferences?.themes || memoryPreferences.themes || []).join(', ') || 'Not specified'}\n`;
        contextualPrompt += `Writing Goals: ${(dbPreferences?.writingGoals || memoryPreferences.writingGoals || []).join(', ') || 'Not specified'}\n`;
        if (dbPreferences?.dailyWordGoal) {
          contextualPrompt += `Daily Word Goal: ${dbPreferences.dailyWordGoal}\n`;
        }
      }
      
      // Add cross-project context for "other projects" references
      if (userProjectsData && userProjectsData.length > 0) {
        contextualPrompt += `\n\n[USER'S OTHER PROJECTS REFERENCE]\n`;
        userProjectsData.forEach((project, index) => {
          contextualPrompt += `Project ${index + 1}: "${project.title}" (${project.format})\n`;
          if (project.characters.length > 0) {
            contextualPrompt += `- Main Characters: ${project.characters.slice(0, 5).join(', ')}\n`;
          }
          if (project.themes.length > 0) {
            contextualPrompt += `- Themes: ${project.themes.join(', ')}\n`;
          }
          if (project.genre) {
            contextualPrompt += `- Genre: ${project.genre}\n`;
          }
          if (project.plotPoints.length > 0) {
            contextualPrompt += `- Key Plot Elements: ${project.plotPoints.slice(0, 3).join(', ')}\n`;
          }
          contextualPrompt += `\n`;
        });
      }
      
      // Add recent conversation context
      if (recentHistory.length > 0) {
        contextualPrompt += `\n\n[RECENT CONVERSATION CONTEXT]\n`;
        contextualPrompt += recentHistory.map(h => `${h.type}: ${h.content.slice(0, 100)}...`).join('\n');
      }
      
      contextualPrompt += `\n\n[INSTRUCTION]\nBased on the user's writing preferences and their other projects' context above, provide a helpful, personalized answer. Focus on answering exactly what they asked:
      - If they ask for plot twists, provide specific plot twist ideas
      - If they ask for character help, give character development suggestions
      - If they ask for dialogue, provide dialogue examples  
      - If they ask for themes, suggest relevant themes
      - Always give direct, actionable advice that matches their specific question
      
      User's question: "${question}"
      Please provide specific, helpful answers that directly address what they're asking for.`;
      
      // Record the interaction
      this.recordUserInteraction(userId, {
        type: 'quick_question',
        content: question
      });

      // Use AI service intelligent response for intent-aware answers
      const answer = await aiService.generateIntelligentResponse(
        question, // Use the original question as primary input
        userId,
        projectId,
        contextualPrompt // Pass as additional context
      );

      // Record the response
      this.recordUserInteraction(userId, {
        type: 'quick_answer',
        content: answer
      });

      return answer;
    } catch (error) {
      console.error('Error in quick answer:', error);
      return 'I\'m having trouble processing your question right now. Please try asking again in a moment.';
    }
  }

  // Get user's other projects data for cross-project references using existing AI-analyzed data
  private async getUserProjectsData(userId: string, currentProjectId?: string): Promise<any[]> {
    try {
      // Get user's projects (excluding current project if specified)
      const whereClause: any = { ownerId: userId };
      if (currentProjectId) {
        whereClause.id = { not: currentProjectId };
      }
      
      const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
          contexts: {
            where: { contextType: 'GENERAL' }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: 5 // Limit to 5 most recent projects for performance
      });

      // Transform the data to include AI-analyzed context
      const projectsData = projects.map(project => {
        const context = project.contexts && project.contexts.length > 0 ? project.contexts[0] : null; // Get the general context
        
        return {
          id: project.id,
          title: project.title,
          description: project.description,
          format: project.format,
          type: project.type,
          // Use AI-analyzed data from ProjectContext
          characters: context?.characters || [],
          themes: context?.themes || [],
          plotPoints: context?.plotPoints || [],
          settings: context?.settings || [],
          genre: context?.genre,
          writingStyle: context?.writingStyle,
          toneAnalysis: context?.toneAnalysis,
          wordCount: context?.wordCount || 0,
          chapterCount: context?.chapterCount || 0,
          lastAnalyzed: context?.lastAnalyzed,
          lastUpdated: project.updatedAt
        };
      });

      return projectsData;
    } catch (error) {
      console.error('Error getting user projects data:', error);
      return [];
    }
  }
}

// Create a singleton instance
const chatbotService = new ChatbotService();

export default chatbotService;
export { ChatbotService };
