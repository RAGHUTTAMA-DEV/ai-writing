import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '../services/api';

interface AIState {
  suggestions: string[];
  themeAnalysis: string[];
  foreshadowing: string[];
  motivationStakes: string[];
  ragResults: Array<{ content: string; metadata: any }>;
  ragSummary: {
    totalResults: number;
    topCharacters: string[];
    topThemes: string[];
    contentTypes: string[];
    keyFindings: string[];
    searchStrategy: string;
  } | null;
  loading: boolean;
  error: string | null;
  // Enhanced methods with analysis mode support
  generateSuggestions: (projectId: string, context: string, analysisMode?: 'fast' | 'deep') => Promise<void>;
  analyzeThemeConsistency: (text: string, theme: string, projectId?: string, analysisMode?: 'fast' | 'deep') => Promise<void>;
  checkForeshadowing: (text: string, context?: string, projectId?: string, analysisMode?: 'fast' | 'deep') => Promise<void>;
  evaluateMotivationAndStakes: (text: string, character: string, projectId?: string, analysisMode?: 'fast' | 'deep') => Promise<void>;
  searchRAG: (query: string, projectId?: string, limit?: number) => Promise<void>;
  clearSuggestions: () => void;
  clearThemeAnalysis: () => void;
  clearForeshadowing: () => void;
  clearMotivationStakes: () => void;
  clearError: () => void;
  resetLoadingState: () => void;
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      themeAnalysis: [],
      foreshadowing: [],
      motivationStakes: [],
      ragResults: [],
      ragSummary: null,
      loading: false,
      error: null,

      generateSuggestions: async (projectId: string, context: string, analysisMode: 'fast' | 'deep' = 'fast') => {
        try {
          set({ loading: true, error: null });
          console.log(`🎯 AI Store: Generating suggestions in ${analysisMode} mode`);
          
          // Add timeout to prevent stuck loading state
          const timeoutId = setTimeout(() => {
            console.warn('AI suggestions request timed out');
            set({ 
              loading: false, 
              error: 'Request timed out. Please try again.'
            });
          }, analysisMode === 'deep' ? 45000 : 30000); // Longer timeout for deep analysis
          
          const response = await apiService.generateAISuggestions(projectId, context, analysisMode);
          clearTimeout(timeoutId);
          
          console.log(`✅ AI Store: Suggestions generated successfully (${response.analysisMode || analysisMode} mode)`);
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

      analyzeThemeConsistency: async (text: string, theme: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast') => {
        try {
          set({ loading: true, error: null });
          console.log(`🎯 AI Store: Analyzing theme consistency in ${analysisMode} mode`);
          const response = await apiService.analyzeThemeConsistency(text, theme, projectId, analysisMode);
          console.log(`✅ AI Store: Theme analysis completed (${response.analysisMode || analysisMode} mode)`);
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

      checkForeshadowing: async (text: string, context?: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast') => {
        try {
          set({ loading: true, error: null });
          console.log(`🔮 AI Store: Checking foreshadowing in ${analysisMode} mode`);
          const response = await apiService.checkForeshadowing(text, context, projectId, analysisMode);
          console.log(`✅ AI Store: Foreshadowing analysis completed (${response.analysisMode || analysisMode} mode)`);
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

      evaluateMotivationAndStakes: async (text: string, character: string, projectId?: string, analysisMode: 'fast' | 'deep' = 'fast') => {
        try {
          set({ loading: true, error: null });
          console.log(`🎭 AI Store: Evaluating motivation and stakes in ${analysisMode} mode`);
          const response = await apiService.evaluateMotivationAndStakes(text, character, projectId, analysisMode);
          console.log(`✅ AI Store: Character analysis completed (${response.analysisMode || analysisMode} mode)`);
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

      searchRAG: async (query: string, projectId?: string, limit?: number) => {
        try {
          console.log('📡 AI Store: Starting RAG search...', { query, projectId, limit });
          set({ loading: true, error: null });
          
          const response = await apiService.searchRAG(query, projectId, limit);
          console.log('📨 AI Store: Received API response:', response);
          
          const results = response.results || [];
          const summary = response.summary || null;
          console.log('📄 AI Store: Setting ragResults:', results);
          console.log('📊 AI Store: Setting ragSummary:', summary);
          
          set({ 
            ragResults: results,
            ragSummary: summary,
            loading: false
          });
          
          console.log('✅ AI Store: RAG search completed successfully');
        } catch (error: any) {
          console.error('❌ AI Store RAG search error:', error);
          set({ 
            error: error.message || 'Failed to search RAG',
            loading: false,
            ragResults: []
          });
        }
      },

      clearSuggestions: () => {
        set({ suggestions: [] });
      },

      clearThemeAnalysis: () => {
        set({ themeAnalysis: [] });
      },

      clearForeshadowing: () => {
        set({ foreshadowing: [] });
      },

      clearMotivationStakes: () => {
        set({ motivationStakes: [] });
      },

      clearError: () => {
        set({ error: null });
      },

      resetLoadingState: () => {
        set({ loading: false, error: null });
      }
    }),
    {
      name: 'ai-storage',
      partialize: (state) => ({
        suggestions: state.suggestions,
        themeAnalysis: state.themeAnalysis,
        foreshadowing: state.foreshadowing,
        motivationStakes: state.motivationStakes,
        ragResults: state.ragResults,
        ragSummary: state.ragSummary,
        // Don't persist loading and error states
        // loading: state.loading,
        // error: state.error,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          // Always reset loading and error states on rehydration
          if (state) {
            state.loading = false;
            state.error = null;
          }
        };
      }
    }
  )
);
