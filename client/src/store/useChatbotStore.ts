import { create } from 'zustand';
import apiService from '../services/api';

interface UserPreferences {
  [key: string]: string;
}

interface ChatbotState {
  preferences: UserPreferences;
  questions: string[];
  suggestions: string[];
  loading: boolean;
  error: string | null;
  getWritingFlowQuestions: () => Promise<void>;
  submitWritingFlowAnswers: (answers: Record<string, string>) => Promise<void>;
  getUserPreferences: () => Promise<void>;
  updateUserPreferences: (preferences: UserPreferences) => Promise<void>;
  getPersonalizedSuggestions: (context: string, projectId?: string) => Promise<string>;
  setPreferences: (preferences: UserPreferences) => void;
  addSuggestion: (suggestion: string) => void;
  clearSuggestions: () => void;
  clearError: () => void;
}

export const useChatbotStore = create<ChatbotState>()((set) => ({
  preferences: {},
  questions: [],
  suggestions: [],
  loading: false,
  error: null,

  getWritingFlowQuestions: async () => {
    try {
      set({ loading: true, error: null });
      const response = await apiService.getWritingFlowQuestions();
      set({ 
        questions: response.questions,
        loading: false 
      });
    } catch (error: any) {
      console.error('Get writing flow questions error:', error);
      set({ 
        error: error.message || 'Failed to get writing flow questions',
        loading: false
      });
    }
  },

  submitWritingFlowAnswers: async (answers: Record<string, string>) => {
    try {
      set({ loading: true, error: null });
      await apiService.submitWritingFlowAnswers(answers);
      
      // Update preferences in the store
      set(state => ({
        preferences: {
          ...state.preferences,
          ...answers
        },
        loading: false
      }));
    } catch (error: any) {
      console.error('Submit writing flow answers error:', error);
      set({ 
        error: error.message || 'Failed to submit writing flow answers',
        loading: false
      });
    }
  },

  getUserPreferences: async () => {
    try {
      set({ loading: true, error: null });
      const response = await apiService.getUserPreferences();
      set({ 
        preferences: response.preferences,
        loading: false 
      });
    } catch (error: any) {
      console.error('Get user preferences error:', error);
      set({ 
        error: error.message || 'Failed to get user preferences',
        loading: false
      });
    }
  },

  updateUserPreferences: async (preferences: UserPreferences) => {
    try {
      set({ loading: true, error: null });
      await apiService.updateUserPreferences(preferences);
      set({ 
        preferences,
        loading: false 
      });
    } catch (error: any) {
      console.error('Update user preferences error:', error);
      set({ 
        error: error.message || 'Failed to update user preferences',
        loading: false
      });
    }
  },

  getPersonalizedSuggestions: async (context: string, projectId?: string) => {
    try {
      set({ loading: true, error: null });
      console.log('🤖 Requesting personalized suggestions with context:', context.substring(0, 100));
      
      const response = await apiService.getPersonalizedSuggestions(context, projectId);
      console.log('🤖 Received response:', response);
      
      if (!response || !response.suggestions) {
        console.error('🤖 Invalid response received:', response);
        throw new Error('Invalid response from server');
      }
      
      set({ 
        suggestions: [response.suggestions],
        loading: false 
      });
      
      console.log('🤖 Successfully stored suggestions in state');
      return response.suggestions; // Return the suggestions directly
    } catch (error: any) {
      console.error('🤖 Get personalized suggestions error:', error);
      const errorMessage = error.message || 'Failed to get personalized suggestions';
      set({ 
        error: errorMessage,
        loading: false
      });
      throw new Error(errorMessage); // Re-throw with a clean error message
    }
  },

  setPreferences: (preferences: UserPreferences) => {
    set({ preferences });
  },

  addSuggestion: (suggestion: string) => {
    set(state => ({
      suggestions: [...state.suggestions, suggestion]
    }));
  },

  clearSuggestions: () => {
    set({ suggestions: [] });
  },

  clearError: () => {
    set({ error: null });
  }
}));