// API service for interacting with the backend
const API_BASE_URL = 'http://localhost:5000/api';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  message: string;
}

interface Project {
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

interface AISuggestionRequest {
  projectId: string;
  context: string;
}

interface AISuggestionResponse {
  message: string;
  suggestions: string;
}

interface ChatbotSuggestionRequest {
  context: string;
  projectId?: string;
}

interface ChatbotSuggestionResponse {
  message: string;
  suggestions: string;
}

interface WritingFlowQuestion {
  question: string;
}

interface UserPreferences {
  [key: string]: string;
}

interface ThemeConsistencyRequest {
  text: string;
  theme: string;
}

interface ThemeConsistencyResponse {
  message: string;
  analysis: string;
}

interface ForeshadowingRequest {
  text: string;
  context?: string;
}

interface ForeshadowingResponse {
  message: string;
  foreshadowing: string;
}

interface MotivationStakesRequest {
  text: string;
  character: string;
}

interface MotivationStakesResponse {
  message: string;
  evaluation: string;
}

interface RAGAddProjectRequest {
  projectId: string;
  content: string;
}

interface RAGAddProjectResponse {
  message: string;
}

interface RAGSearchRequest {
  query: string;
  limit?: number;
}

interface RAGSearchResponse {
  message: string;
  results: Array<{
    content: string;
    metadata: any;
  }>;
}

class APIService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    if (this.token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.token}`,
      };
    }

    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  // Auth endpoints
  async register(email: string, username: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, firstName, lastName }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logout(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  }

  async getProfile(): Promise<{ user: any }> {
    return this.request<{ user: any }>('/auth/profile');
  }

  async updateProfile(firstName: string, lastName: string, bio?: string, avatar?: string): Promise<{ user: any }> {
    return this.request<{ user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName, bio, avatar }),
    });
  }

  // Project endpoints
  async getProjects(): Promise<{ projects: Project[] }> {
    return this.request<{ projects: Project[] }>('/projects');
  }

  async getProject(id: string): Promise<{ project: Project }> {
    return this.request<{ project: Project }>(`/projects/${id}`);
  }

  async createProject(project: CreateProjectRequest): Promise<{ message: string; project: Project }> {
    return this.request<{ message: string; project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
  }

  async updateProject(id: string, project: UpdateProjectRequest): Promise<{ message: string; project: Project }> {
    return this.request<{ message: string; project: Project }>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    });
  }

  async deleteProject(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // AI endpoints
  async generateAISuggestions(projectId: string, context: string): Promise<AISuggestionResponse> {
    return this.request<AISuggestionResponse>('/ai/suggestions', {
      method: 'POST',
      body: JSON.stringify({ projectId, context }),
    });
  }

  async generateAutocomplete(text: string, cursorPosition: number, projectId?: string): Promise<{ suggestion: string; cursorPosition: number }> {
    return this.request<{ suggestion: string; cursorPosition: number }>('/ai/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ text, cursorPosition, projectId }),
    });
  }

  async analyzeThemeConsistency(text: string, theme: string): Promise<ThemeConsistencyResponse> {
    return this.request<ThemeConsistencyResponse>('/ai/theme-consistency', {
      method: 'POST',
      body: JSON.stringify({ text, theme }),
    });
  }

  async checkForeshadowing(text: string, context?: string): Promise<ForeshadowingResponse> {
    return this.request<ForeshadowingResponse>('/ai/foreshadowing', {
      method: 'POST',
      body: JSON.stringify({ text, context }),
    });
  }

  async evaluateMotivationAndStakes(text: string, character: string): Promise<MotivationStakesResponse> {
    return this.request<MotivationStakesResponse>('/ai/motivation-stakes', {
      method: 'POST',
      body: JSON.stringify({ text, character }),
    });
  }

  async addProjectToRAG(projectId: string, content: string): Promise<RAGAddProjectResponse> {
    return this.request<RAGAddProjectResponse>('/ai/rag/add-project', {
      method: 'POST',
      body: JSON.stringify({ projectId, content }),
    });
  }

  async searchRAG(query: string, limit?: number): Promise<RAGSearchResponse> {
    return this.request<RAGSearchResponse>('/ai/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  // Chatbot endpoints
  async getPersonalizedSuggestions(context: string, projectId?: string): Promise<ChatbotSuggestionResponse> {
    return this.request<ChatbotSuggestionResponse>('/chatbot/suggestions', {
      method: 'POST',
      body: JSON.stringify({ context, projectId }),
    });
  }

  async getWritingFlowQuestions(): Promise<{ questions: string[] }> {
    return this.request<{ questions: string[] }>('/chatbot/writing-flow/questions');
  }

  async submitWritingFlowAnswers(answers: Record<string, string>): Promise<{ message: string }> {
    return this.request<{ message: string }>('/chatbot/writing-flow/answers', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  }

  async getUserPreferences(): Promise<{ preferences: UserPreferences }> {
    return this.request<{ preferences: UserPreferences }>('/chatbot/preferences');
  }

  async updateUserPreferences(preferences: UserPreferences): Promise<{ message: string }> {
    return this.request<{ message: string }>('/chatbot/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  }
}

const apiService = new APIService();
export default apiService;
