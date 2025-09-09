import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';

// Import the new panels
import { EditorPanel } from '../components/Editor/EditorPanel';
import { AIToolsPanel } from '../components/AI/AIToolsPanel';
import { ChatbotPanel } from '../components/AI/ChatbotPanel';
import { RAGSearchPanel } from '../components/AI/RAGSearchPanel';
import { AnalyticsPanel } from '../components/AI/AnalyticsPanel';

import {
  FileText,
  Sparkles,
  MessageCircle,
  Search,
  BarChart3,
  BookOpen,
  Plus,
  RefreshCw,
  User,
  LogOut,
  Save,
  Clock,
  Brain
} from 'lucide-react';

interface DashboardPageProps {
  projectId: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState('editor');
  
  const { user, logout } = useAuthStore();
  const {
    projects,
    activeProject,
    loading: projectsLoading,
    error: projectsError,
    getProjects,
    createProject,
    setActiveProject,
    clearError: clearProjectError
  } = useProjectStore();

  useEffect(() => {
    getProjects();
  }, [getProjects]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleNewProject = async () => {
    const title = prompt('Enter project title:');
    if (title) {
      try {
        await createProject({ title, content: '' });
      } catch (error) {
        console.error('Create project failed:', error);
        alert('Failed to create project');
      }
    }
  };

  const getWritingStats = () => {
    if (!activeProject?.content) return { words: 0, characters: 0, paragraphs: 0 };
    
    const content = activeProject.content;
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    const characters = content.length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    return { words, characters, paragraphs };
  };

  const stats = getWritingStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Writing Assistant</h1>
                <p className="text-sm text-gray-500">Intelligent writing companion</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {activeProject && (
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{stats.words} words</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">Welcome, {user?.firstName}!</span>
              </div>
              <Button variant="outline" onClick={handleLogout} className="flex items-center">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BookOpen className="mr-2" />
                  Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleNewProject} 
                  className="w-full mb-4 flex items-center"
                  disabled={projectsLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
                
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    <span>Loading projects...</span>
                  </div>
                ) : projectsError ? (
                  <div className="text-center py-4">
                    <p className="text-red-500 mb-2">Error: {projectsError}</p>
                    <Button variant="outline" onClick={clearProjectError} size="sm">
                      Clear Error
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {projects.map(project => (
                      <Button
                        key={project.id}
                        variant={activeProject?.id === project.id ? "default" : "outline"}
                        className="w-full justify-start text-left"
                        onClick={() => setActiveProject(project)}
                      >
                        <BookOpen className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{project.title}</span>
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            {activeProject && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BarChart3 className="mr-2" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Words:</span>
                      <span className="font-medium">{stats.words.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Characters:</span>
                      <span className="font-medium">{stats.characters.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Paragraphs:</span>
                      <span className="font-medium">{stats.paragraphs}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeProject ? (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="editor" className="flex items-center">
                    <FileText className="mr-1 h-4 w-4" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="ai-tools" className="flex items-center">
                    <Sparkles className="mr-1 h-4 w-4" />
                    AI Tools
                  </TabsTrigger>
                  <TabsTrigger value="chatbot" className="flex items-center">
                    <MessageCircle className="mr-1 h-4 w-4" />
                    Chatbot
                  </TabsTrigger>
                  <TabsTrigger value="rag-search" className="flex items-center">
                    <Search className="mr-1 h-4 w-4" />
                    RAG Search
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center">
                    <BarChart3 className="mr-1 h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  <TabsContent value="editor" className="mt-0">
                    <EditorPanel projectId={activeProject.id} />
                  </TabsContent>

                  <TabsContent value="ai-tools" className="mt-0">
                    <div className="h-[calc(100vh-200px)]">
                      <AIToolsPanel projectId={activeProject.id} />
                    </div>
                  </TabsContent>

                  <TabsContent value="chatbot" className="mt-0">
                    <div className="h-[calc(100vh-200px)]">
                      <ChatbotPanel projectId={activeProject.id} />
                    </div>
                  </TabsContent>

                  <TabsContent value="rag-search" className="mt-0">
                    <div className="h-[calc(100vh-200px)]">
                      <RAGSearchPanel projectId={activeProject.id} />
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="mt-0">
                    <div className="h-[calc(100vh-200px)]">
                      <AnalyticsPanel projectId={activeProject.id} />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 text-lg mb-2">No project selected</p>
                    <p className="text-gray-400">Select a project or create a new one to get started</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
