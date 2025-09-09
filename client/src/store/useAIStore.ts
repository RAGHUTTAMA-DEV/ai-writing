import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '../services/api';

interface AIState {
  suggestions: string[];
  themeAnalysis: string[];
  foreshadowing: string[];
  motivationStakes: string[];
  ragResults: Array<{ content: string; metadata: any }>;
  loading: boolean;
  error: string | null;
  generateSuggestions: (projectId: string, context: string) => Promise<void>;
  analyzeThemeConsistency: (text: string, theme: string) => Promise<void>;
  checkForeshadowing: (text: string, context?: string) => Promise<void>;
  evaluateMotivationAndStakes: (text: string, character: string) => Promise<void>;
  searchRAG: (query: string, limit?: number) => Promise<void>;
  clearSuggestions: () => void;
  clearError: () => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      themeAnalysis: [],
      foreshadowing: [],
      motivationStakes: [],
      ragResults: [],
      loading: false,
      error: null,

      generateSuggestions: async (projectId: string, context: string) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.generateAISuggestions(projectId, context);
          set(state => ({
            suggestions: [...state.suggestions, response.suggestions],
            loading: false
          }));
        } catch (error: any) {
          console.error('Generate suggestions error:', error);
          set({ 
            error: error.message || 'Failed to generate suggestions',
            loading: false
          });
        }
      },

      analyzeThemeConsistency: async (text: string, theme: string) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.analyzeThemeConsistency(text, theme);
          set(state => ({
            themeAnalysis: [...state.themeAnalysis, response.analysis],
            loading: false
          }));
        } catch (error: any) {
          console.error('Theme consistency analysis error:', error);
          set({ 
            error: error.message || 'Failed to analyze theme consistency',
            loading: false
          });
        }
      },

      checkForeshadowing: async (text: string, context?: string) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.checkForeshadowing(text, context);
          set(state => ({
            foreshadowing: [...state.foreshadowing, response.foreshadowing],
            loading: false
          }));
        } catch (error: any) {
          console.error('Foreshadowing check error:', error);
          set({ 
            error: error.message || 'Failed to check foreshadowing',
            loading: false
          });
        }
      },

      evaluateMotivationAndStakes: async (text: string, character: string) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.evaluateMotivationAndStakes(text, character);
          set(state => ({
            motivationStakes: [...state.motivationStakes, response.evaluation],
            loading: false
          }));
        } catch (error: any) {
          console.error('Motivation and stakes evaluation error:', error);
          set({ 
            error: error.message || 'Failed to evaluate motivation and stakes',
            loading: false
          });
        }
      },

      searchRAG: async (query: string, limit?: number) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.searchRAG(query, limit);
          set({ 
            ragResults: response.results || [],
            loading: false
          });
        } catch (error: any) {
          console.error('RAG search error:', error);
          set({ 
            error: error.message || 'Failed to search RAG',
            loading: false
          });
        }
      },

      clearSuggestions: () => {
        set({ 
          suggestions: [],
          themeAnalysis: [],
          foreshadowing: [],
          motivationStakes: [],
          ragResults: []
        });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'ai-storage'
    }
  )
);
