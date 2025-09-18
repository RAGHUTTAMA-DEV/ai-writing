import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '../services/api';

export interface Project {
  id: string;
  title: string;
  description?: string;
  format: string;
  type: string;
  content?: string;
  quickNotes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

interface CreateProjectRequest {
  title: string;
  description?: string;
  format?: string;
  type?: string;
  content?: string;
  quickNotes?: string;
}

interface UpdateProjectRequest {
  title?: string;
  description?: string;
  format?: string;
  type?: string;
  content?: string;
  quickNotes?: string;
}

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  loading: boolean;
  error: string | null;
  getProjects: () => Promise<void>;
  getProject: (id: string) => Promise<void>;
  createProject: (project: CreateProjectRequest) => Promise<void>;
  updateProject: (id: string, project: UpdateProjectRequest) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projects: [],
      activeProject: null,
      loading: false,
      error: null,

      getProjects: async () => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.getProjects();
          set({ projects: response.projects, loading: false });
        } catch (error: any) {
          console.error('Get projects error:', error);
          set({ 
            error: error.message || 'Failed to fetch projects',
            loading: false
          });
        }
      },

      getProject: async (id: string) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.getProject(id);
          set({ 
            activeProject: response.project,
            loading: false 
          });
        } catch (error: any) {
          console.error('Get project error:', error);
          set({ 
            error: error.message || 'Failed to fetch project',
            loading: false
          });
        }
      },

      createProject: async (project: CreateProjectRequest) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.createProject(project);
          
          // Add project content to RAG system
          if (project.content) {
            try {
              await apiService.addProjectToRAG(response.project.id, project.content);
            } catch (ragError) {
              console.error('Failed to add project to RAG:', ragError);
              // Continue even if RAG indexing fails
            }
          }
          
          set(state => ({
            projects: [...state.projects, response.project],
            loading: false
          }));
        } catch (error: any) {
          console.error('Create project error:', error);
          set({ 
            error: error.message || 'Failed to create project',
            loading: false
          });
        }
      },

      updateProject: async (id: string, project: UpdateProjectRequest) => {
        try {
          set({ loading: true, error: null });
          const response = await apiService.updateProject(id, project);
          
          // Update project content in RAG system
          if (project.content) {
            try {
              await apiService.addProjectToRAG(id, project.content);
            } catch (ragError) {
              console.error('Failed to update project in RAG:', ragError);
              // Continue even if RAG indexing fails
            }
          }
          
          set(state => ({
            projects: state.projects.map(p => 
              p.id === id ? response.project : p
            ),
            activeProject: response.project,
            loading: false
          }));
        } catch (error: any) {
          console.error('Update project error:', error);
          set({ 
            error: error.message || 'Failed to update project',
            loading: false
          });
        }
      },

      deleteProject: async (id: string) => {
        try {
          set({ loading: true, error: null });
          await apiService.deleteProject(id);
          set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            activeProject: state.activeProject?.id === id ? null : state.activeProject,
            loading: false
          }));
        } catch (error: any) {
          console.error('Delete project error:', error);
          set({ 
            error: error.message || 'Failed to delete project',
            loading: false
          });
        }
      },

      setActiveProject: (project: Project | null) => {
        set({ activeProject: project });
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'project-storage'
    }
  )
);