import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

interface WritingState {
  projects: Project[];
  activeProjectId: string | null;
  aiSuggestions: string[];
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setActiveProject: (id: string | null) => void;
  addAISuggestion: (suggestion: string) => void;
  clearAISuggestions: () => void;
}

export const useWritingStore = create<WritingState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      aiSuggestions: [],
      
      addProject: (project) => {
        const newProject: Project = {
          ...project,
          id: Date.now().toString(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        set((state) => ({
          projects: [...state.projects, newProject],
          activeProjectId: newProject.id
        }));
      },
      
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date() }
              : project
          )
        }));
      },
      
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId
        }));
      },
      
      setActiveProject: (id) => {
        set({ activeProjectId: id });
      },
      
      addAISuggestion: (suggestion) => {
        set((state) => ({
          aiSuggestions: [...state.aiSuggestions, suggestion]
        }));
      },
      
      clearAISuggestions: () => {
        set({ aiSuggestions: [] });
      }
    }),
    {
      name: 'writing-storage',
      partialize: (state) => ({ 
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        aiSuggestions: state.aiSuggestions
      })
    }
  )
);