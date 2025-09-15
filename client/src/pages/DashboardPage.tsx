import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';

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
  LogOut,
  PenTool,
  Zap,
  ChevronDown,
  Crown
} from 'lucide-react';


export const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('editor');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  
  const { user, logout } = useAuthStore();
  const {
    projects,
    activeProject,
    getProjects,
    createProject,
    setActiveProject
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
    if (newProjectTitle.trim()) {
      try {
        await createProject({ 
          title: newProjectTitle.trim(), 
          content: '',
          description: newProjectDescription.trim() || undefined
        });
        setNewProjectTitle('');
        setNewProjectDescription('');
        setShowNewProjectModal(false);
      } catch (error) {
        console.error('Create project failed:', error);
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
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-white via-blue-50/30 to-purple-50/30 border-b border-gray-200/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              {/* Enhanced Logo */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="p-3 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 rounded-xl shadow-lg">
                    <div className="relative">
                      <PenTool className="h-6 w-6 text-white" />
                      <Zap className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1" />
                    </div>
                  </div>
                  <Crown className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      AI Writer
                    </h1>
                    <div className="px-2 py-0.5 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full">
                      <span className="text-xs font-semibold text-blue-700">PRO</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 font-medium">Intelligent Writing Companion</p>
                </div>
              </div>
              
              {/* Project Management Section */}
              <div className="flex items-center space-x-4">
                <div className="h-10 w-px bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200"></div>
                
                {/* Current Project Display */}
                {activeProject ? (
                  <div className="flex items-center space-x-4 bg-white/80 backdrop-blur-sm rounded-xl px-5 py-3 border border-gray-200/60 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="relative">
                          <select 
                            value={activeProject.id} 
                            onChange={(e) => {
                              const project = projects.find(p => p.id === e.target.value);
                              if (project) setActiveProject(project);
                            }}
                            className="appearance-none bg-transparent border-none outline-none text-gray-900 font-semibold cursor-pointer pr-6 min-w-[180px]"
                          >
                            {projects.map(project => (
                              <option key={project.id} value={project.id}>{project.title}</option>
                            ))}
                          </select>
                          <ChevronDown className="h-4 w-4 text-gray-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          {stats.words.toLocaleString()} words • {stats.characters.toLocaleString()} characters
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 bg-white/60 backdrop-blur-sm rounded-xl px-5 py-3 border border-dashed border-gray-300">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <BookOpen className="h-4 w-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-600">No project selected</p>
                      <p className="text-xs text-gray-500">Create or select a project to start</p>
                    </div>
                  </div>
                )}
                
                {/* New Project Modal */}
                <Dialog open={showNewProjectModal} onOpenChange={setShowNewProjectModal}>
                  <DialogTrigger asChild>
                    <Button 
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Project
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center space-x-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Plus className="h-4 w-4 text-blue-600" />
                        </div>
                        <span>Create New Project</span>
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Project Title *</label>
                        <Input
                          value={newProjectTitle}
                          onChange={(e) => setNewProjectTitle(e.target.value)}
                          placeholder="Enter project title..."
                          className="w-full"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newProjectTitle.trim()) {
                              handleNewProject();
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Description (optional)</label>
                        <Input
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          placeholder="Brief description..."
                          className="w-full"
                        />
                      </div>
                      <div className="flex space-x-3 pt-4">
                        <Button
                          onClick={() => setShowNewProjectModal(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleNewProject}
                          disabled={!newProjectTitle.trim()}
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          Create Project
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Enhanced User Menu */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 border border-gray-200/60">
                <div className="relative">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 via-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white text-sm font-bold">
                      {user?.firstName?.charAt(0)?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{user?.firstName || 'User'}</p>
                  <p className="text-xs text-gray-500">Premium Writer</p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - HUGE SPACE */}
      <div className="flex-1 overflow-hidden">
        {activeProject ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            {/* Content Area - Takes most space */}
            <div className="flex-1 overflow-hidden">
              <TabsContent value="editor" className="h-full m-0">
                <EditorPanel projectId={activeProject.id} />
              </TabsContent>

              <TabsContent value="ai-tools" className="h-full m-0">
                <AIToolsPanel projectId={activeProject.id} />
              </TabsContent>

              <TabsContent value="chatbot" className="h-full m-0">
                <ChatbotPanel projectId={activeProject.id} />
              </TabsContent>

              <TabsContent value="rag-search" className="h-full m-0">
                <RAGSearchPanel projectId={activeProject.id} />
              </TabsContent>

              <TabsContent value="analytics" className="h-full m-0">
                <AnalyticsPanel projectId={activeProject.id} />
              </TabsContent>
            </div>
            
            {/* Bottom Tabs - Like VS Code */}
            <div className="bg-white border-t border-gray-200">
              <div className="flex items-center justify-center space-x-1 px-4 py-2">
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'editor'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Write</span>
                </button>

                <button
                  onClick={() => setActiveTab('ai-tools')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'ai-tools'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>AI Tools</span>
                </button>

                <button
                  onClick={() => setActiveTab('chatbot')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'chatbot'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Chat</span>
                </button>

                <button
                  onClick={() => setActiveTab('rag-search')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'rag-search'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </button>
              </div>
            </div>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full bg-white">
            <div className="text-center">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg mb-2">No project selected</p>
              <p className="text-gray-400 mb-4">Create a new project to get started</p>
              <Button onClick={handleNewProject}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
