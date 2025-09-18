import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiService from '../services/api';
import config from '../config';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  handleGoogleCallback: (token: string) => Promise<void>;
  register: (email: string, username: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  getProfile: () => Promise<void>;
  updateProfile: (firstName: string, lastName: string, bio?: string, avatar?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        try {
          const response = await apiService.login(email, password);
          const { token, user } = response;
          
          apiService.setToken(token);
          
          set({
            user,
            token,
            isAuthenticated: true
          });
        } catch (error) {
          console.error('Login error:', error);
          throw error;
        }
      },

      loginWithGoogle: () => {
        const backendUrl = config.API_BASE_URL.replace('/api', ''); // Remove /api suffix
        window.location.href = `${backendUrl}/api/auth/google`;
      },

      handleGoogleCallback: async (token: string) => {
        try {
          apiService.setToken(token);
          
          // Fetch user profile with the token
          const response = await apiService.getProfile();
          
          set({
            user: response.user,
            token,
            isAuthenticated: true
          });
        } catch (error) {
          console.error('Google callback error:', error);
          throw error;
        }
      },

      register: async (email: string, username: string, password: string, firstName: string, lastName: string) => {
        try {
          const response = await apiService.register(email, username, password, firstName, lastName);
          const { token, user } = response;
          
          apiService.setToken(token);
          
          set({
            user,
            token,
            isAuthenticated: true
          });
        } catch (error) {
          console.error('Registration error:', error);
          throw error;
        }
      },

      logout: async () => {
        try {
          await apiService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          apiService.clearToken();
          set({
            user: null,
            token: null,
            isAuthenticated: false
          });
        }
      },

      getProfile: async () => {
        try {
          const response = await apiService.getProfile();
          set({
            user: response.user
          });
        } catch (error) {
          console.error('Get profile error:', error);
          throw error;
        }
      },

      updateProfile: async (firstName: string, lastName: string, bio?: string, avatar?: string) => {
        try {
          const response = await apiService.updateProfile(firstName, lastName, bio, avatar);
          set({
            user: response.user
          });
        } catch (error) {
          console.error('Update profile error:', error);
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state?.token) {
            apiService.setToken(state.token);
          }
        };
      }
    }
  )
);