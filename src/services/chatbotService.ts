import ragService from './ragService';
import aiService from './aiService';
import { Document } from "langchain/document";

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
}

// Create a singleton instance
const chatbotService = new ChatbotService();

export default chatbotService;
export { ChatbotService };