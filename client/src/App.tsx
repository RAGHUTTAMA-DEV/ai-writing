import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { useAIStore } from './store/useAIStore';
import { useChatbotStore } from './store/useChatbotStore';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, Car dTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  BookOpen, 
  User, 
  Zap, 
  Plus, 
  LogOut, 
  MessageCircle, 
  Settings, 
  Search, 
  Lightbulb, 
  Target, 
  Eye, 
  Database,
  Save,
  RefreshCw,
  TrendingUp,
  Users,
  Clock,
  FileText,
  Brain,
  Sparkles,
  BarChart3
} from 'lucide-react';
import { CopilotEditor } from './components/CopilotEditor';

function App() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const { user, isAuthenticated, logout } = useAuthStore();
  const { 
    projects, 
    activeProject, 
    loading: projectsLoading, 
    error: projectsError,
    getProjects, 
    createProject, 
    updateProject, 
    setActiveProject,
    clearError: clearProjectError
  } = useProjectStore();
  
  const { 
    suggestions, 
    themeAnalysis,
    foreshadowing,
    motivationStakes,
    ragResults,
    loading: aiLoading, 
    error: aiError,
    generateSuggestions, 
    analyzeThemeConsistency,
    checkForeshadowing,
    evaluateMotivationAndStakes,
    searchRAG,
    clearSuggestions, 
    clearError: clearAIError
  } = useAIStore();
  
  const {
    preferences,
    questions,
    suggestions: chatbotSuggestions,
    loading: chatbotLoading,
    error: chatbotError,
    getWritingFlowQuestions,
    submitWritingFlowAnswers,
    getUserPreferences,
    getPersonalizedSuggestions,
    clearError: clearChatbotError
  } = useChatbotStore();

  // AI input states
  const [themeInput, setThemeInput] = useState('');
  const [characterInput, setCharacterInput] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  
  // Chatbot state
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string, timestamp?: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Writing flow answers state
  const [writingFlowAnswers, setWritingFlowAnswers] = useState<Record<string, string>>({});

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Initialize projects if user is authenticated
    if (isAuthenticated) {
      getProjects();
      getUserPreferences();
      getWritingFlowQuestions();
    }
  }, [isAuthenticated, getProjects, getUserPreferences, getWritingFlowQuestions]);

  useEffect(() => {
    // Scroll to bottom of chat when new messages are added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges && activeProject) {
      const autoSaveTimer = setTimeout(() => {
        handleSave(activeProject.content || '');
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasUnsavedChanges, activeProject]);

  const handleLogout = async () => {
    try {
      await logout();
      setChatMessages([]);
      setWritingFlowAnswers({});
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSave = async (content: string) => {
    if (activeProject) {
      try {
        await updateProject(activeProject.id, { content });
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        console.log('Content saved successfully');
      } catch (error) {
        console.error('Save failed:', error);
        alert('Failed to save content');
      }
    }
  };

  const handleContentChange = (content: string) => {
    if (activeProject) {
      setActiveProject({ ...activeProject, content });
      setHasUnsavedChanges(true);
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

  const handleAISuggestions = async () => {
    if (activeProject) {
      try {
        await generateSuggestions(activeProject.id, activeProject.content || '');
      } catch (error) {
        console.error('AI suggestions failed:', error);
      }
    }
  };

  const handleThemeAnalysis = async () => {
    if (activeProject && themeInput.trim()) {
      try {
        await analyzeThemeConsistency(activeProject.content || '', themeInput);
      } catch (error) {
        console.error('Theme analysis failed:', error);
      }
    } else {
      alert('Please enter a theme to analyze');
    }
  };

  const handleForeshadowing = async () => {
    if (activeProject) {
      try {
        await checkForeshadowing(activeProject.content || '', activeProject.content || '');
      } catch (error) {
        console.error('Foreshadowing check failed:', error);
      }
    }
  };

  const handleMotivationStakes = async () => {
    if (activeProject && characterInput.trim()) {
      try {
        await evaluateMotivationAndStakes(activeProject.content || '', characterInput);
      } catch (error) {
        console.error('Motivation and stakes evaluation failed:', error);
      }
    } else {
      alert('Please enter a character name');
    }
  };

  const handleRAGSearch = async () => {
    if (ragQuery.trim()) {
      try {
        await searchRAG(ragQuery);
      } catch (error) {
        console.error('RAG search failed:', error);
      }
    } else {
      alert('Please enter a search query');
    }
  };

  const handleChatbotSuggestions = async () => {
    if (activeProject) {
      try {
        await getPersonalizedSuggestions(activeProject.content || '', activeProject.id);
      } catch (error) {
        console.error('Chatbot suggestions failed:', error);
      }
    }
  };

  const handleWritingFlowSubmit = async () => {
    try {
      await submitWritingFlowAnswers(writingFlowAnswers);
      alert('Writing flow answers submitted successfully!');
      setWritingFlowAnswers({});
    } catch (error) {
      console.error('Writing flow submission failed:', error);
      alert('Failed to submit writing flow answers');
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim()) return;
    
    // Add user message to chat
    const userMessage = { 
      role: 'user', 
      content: chatInput,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input
    const currentInput = chatInput;
    setChatInput('');
    
    // Add a placeholder for the bot response
    setChatMessages(prev => [...prev, { 
      role: 'bot', 
      content: 'Thinking...',
      timestamp: new Date().toISOString()
    }]);
    
    try {
      // Get response from chatbot
      await getPersonalizedSuggestions(currentInput, activeProject?.id);
      
      // Update the last message with the actual response
      setChatMessages(prev => {
        const newMessages = [...prev];
        const lastSuggestion = chatbotSuggestions[chatbotSuggestions.length - 1];
        newMessages[newMessages.length - 1] = { 
          role: 'bot', 
          content: lastSuggestion || 'I\'m not sure how to help with that. Could you be more specific?',
          timestamp: new Date().toISOString()
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Chatbot error:', error);
      // Update the last message with an error response
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          role: 'bot', 
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString()
        };
        return newMessages;
      });
    }
  };

  // Function to render suggestions with better formatting
  const renderSuggestions = (suggestion: string) => {
    if (!suggestion) return null;
    
    // Split the suggestion into lines
    const lines = suggestion.split('\n').filter(line => line.trim());
    
    // Check if it's a structured response with numbered points or headers
    const isStructured = lines.some(line => 
      /^\s*\*\s*\*.*\*\s*\*/.test(line) || // **Header**
      /^\s*#{1,6}\s/.test(line) || // # Header
      /^\s*\d+\.\s/.test(line) || // 1. Numbered
      /^\s*[-*]\s/.test(line) // - Bullet
    );
    
    if (isStructured) {
      return (
        <div className="space-y-3">
          {lines.map((line, index) => {
            // Check if it's a main heading with **text**
            if (/^\s*\*\s*\*.*\*\s*\*/.test(line)) {
              return (
                <div key={index} className="font-semibold text-lg text-blue-800 border-b border-blue-200 pb-1">
                  {line.replace(/\*\s*\*/g, '').trim()}
                </div>
              );
            }
            // Check if it's a markdown header
            else if (/^\s*#{1,6}\s/.test(line)) {
              const level = line.match(/^#+/)?.[0].length || 1;
              const text = line.replace(/^#+\s*/, '');
              const className = level === 1 ? 'text-xl font-bold text-gray-800' :
                              level === 2 ? 'text-lg font-semibold text-gray-700' :
                              'text-base font-medium text-gray-600';
              return (
                <div key={index} className={className}>
                  {text}
                </div>
              );
            }
            // Check if it's a numbered point
            else if (/^\s*\d+\.\s/.test(line)) {
              return (
                <div key={index} className="ml-2 text-gray-700 flex">
                  <span className="font-medium text-blue-600 mr-2">
                    {line.match(/^\s*\d+\./)?.[0]}
                  </span>
                  <span>{line.replace(/^\s*\d+\.\s*/, '')}</span>
                </div>
              );
            }
            // Check if it's a bullet point
            else if (/^\s*[-*]\s/.test(line)) {
              return (
                <div key={index} className="ml-4 text-gray-600 flex">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>{line.replace(/^\s*[-*]\s*/, '')}</span>
                </div>
              );
            }
            // Regular text
            else if (line.trim()) {
              return (
                <div key={index} className="text-gray-700 leading-relaxed">
                  {line.trim()}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    } else {
      // For unstructured text, render as paragraphs
      return (
        <div className="space-y-3">
          {lines.map((line, index) => (
            <p key={index} className="text-gray-700 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      );
    }
  };

  // Calculate writing statistics
  const getWritingStats = () => {
    if (!activeProject?.content) return { words: 0, characters: 0, paragraphs: 0 };
    
    const content = activeProject.content;
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    const characters = content.length;
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    
    return { words, characters, paragraphs };
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="w-full max-w-md">
          {authView === 'login' ? (
            <Login onSwitchToRegister={() => setAuthView('register')} />
          ) : (
            <Register onSwitchToLogin={() => setAuthView('login')} />
          )}
        </div>
      </div>
    );
  }

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
                  {hasUnsavedChanges && (
                    <span className="text-orange-600 flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      Unsaved
                    </span>
                  )}
                  {lastSaved && !hasUnsavedChanges && (
                    <span className="text-green-600 flex items-center">
                      <Save className="h-3 w-3 mr-1" />
                      Saved
                    </span>
                  )}
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
            
            {/* Writing Flow Questions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="mr-2" />
                  Writing Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                {questions.length > 0 ? (
                  <div className="space-y-4">
                    {questions.slice(0, 2).map((question, index) => (
                      <div key={index}>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          {question}
                        </Label>
                        <Input
                          type="text"
                          className="w-full"
                          placeholder="Your answer..."
                          value={writingFlowAnswers[question] || ''}
                          onChange={(e) => setWritingFlowAnswers(prev => ({
                            ...prev,
                            [question]: e.target.value
                          }))}
                        />
                      </div>
                    ))}
                    <Button 
                      onClick={handleWritingFlowSubmit} 
                      size="sm" 
                      className="w-full"
                      disabled={Object.keys(writingFlowAnswers).length === 0}
                    >
                      Submit Answers
                    </Button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No writing flow questions available.</p>
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
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="editor" className="flex items-center">
                    <FileText className="mr-1 h-4 w-4" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex items-center">
                    <Zap className="mr-1 h-4 w-4" />
                    AI Tools
                  </TabsTrigger>
                  <TabsTrigger value="rag" className="flex items-center">
                    <Database className="mr-1 h-4 w-4" />
                    RAG
                  </TabsTrigger>
                  <TabsTrigger value="chatbot" className="flex items-center">
                    <MessageCircle className="mr-1 h-4 w-4" />
                    Chatbot
                  </TabsTrigger>
                  <TabsTrigger value="stats" className="flex items-center">
                    <TrendingUp className="mr-1 h-4 w-4" />
                    Analytics
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="editor">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center">
                          <BookOpen className="mr-2" />
                          {activeProject.title}
                        </div>
                        <Button 
                          onClick={() => handleSave(activeProject.content || '')}
                          disabled={!hasUnsavedChanges}
                          size="sm"
                          className="flex items-center"
                        >
                          <Save className="mr-1 h-4 w-4" />
                          Save
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CopilotEditor 
                        initialContent={activeProject.content || ''} 
                        onSave={handleSave}
                        onChange={handleContentChange}
                        projectId={activeProject.id}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="ai">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Zap className="mr-2" />
                        AI Writing Tools
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="suggestions">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="suggestions">
                            <Lightbulb className="mr-1 h-4 w-4" />
                            Suggestions
                          </TabsTrigger>
                          <TabsTrigger value="theme">
                            <Target className="mr-1 h-4 w-4" />
                            Theme
                          </TabsTrigger>
                          <TabsTrigger value="foreshadowing">
                            <Eye className="mr-1 h-4 w-4" />
                            Foreshadowing
                          </TabsTrigger>
                          <TabsTrigger value="motivation">
                            <Users className="mr-1 h-4 w-4" />
                            Character
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="suggestions">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium">AI Writing Suggestions</h3>
                              <Button 
                                onClick={handleAISuggestions} 
                                disabled={aiLoading}
                                className="flex items-center"
                              >
                                {aiLoading ? (
                                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                Generate
                              </Button>
                            </div>
                            
                            {aiLoading ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                <span>Generating suggestions...</span>
                              </div>
                            ) : aiError ? (
                              <div className="text-center py-4">
                                <p className="text-red-500 mb-2">Error: {aiError}</p>
                                <Button variant="outline" onClick={clearAIError} size="sm">
                                  Clear Error
                                </Button>
                              </div>
                            ) : suggestions.length > 0 ? (
                              <div className="space-y-4">
                                {suggestions.map((suggestion, index) => (
                                  <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    {renderSuggestions(suggestion)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <Lightbulb className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                                <p>No suggestions yet. Click "Generate" to get AI-powered writing suggestions.</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="theme">
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="theme-input">Theme to Analyze</Label>
                              <div className="flex space-x-2 mt-1">
                                <Input
                                  id="theme-input"
                                  value={themeInput}
                                  onChange={(e) => setThemeInput(e.target.value)}
                                  placeholder="e.g., love, betrayal, redemption"
                                  className="flex-1"
                                />
                                <Button 
                                  onClick={handleThemeAnalysis} 
                                  disabled={aiLoading || !themeInput.trim()}
                                >
                                  Analyze
                                </Button>
                              </div>
                            </div>

                            {themeAnalysis && themeAnalysis.length > 0 && (
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                {renderSuggestions(themeAnalysis.join('\n\n'))}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="foreshadowing">
                          <div className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-medium">Foreshadowing Analysis</h3>
                              <Button 
                                onClick={handleForeshadowing} 
                                disabled={aiLoading}
                              >
                                Check Foreshadowing
                              </Button>
                            </div>
                            
                            
                            {foreshadowing && foreshadowing.length > 0 && (
                              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                {renderSuggestions(foreshadowing.join('\n\n'))}
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="motivation">
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="character-input">Character Name</Label>
                              <div className="flex space-x-2 mt-1">
                                <Input
                                  id="character-input"
                                  value={characterInput}
                                  onChange={(e) => setCharacterInput(e.target.value)}
                                  placeholder="e.g., Alice, John, Sarah"
                                  className="flex-1"
                                />
                                <Button 
                                  onClick={handleMotivationStakes} 
                                  disabled={aiLoading || !characterInput.trim()}
                                >
                                  Analyze
                                </Button>
                              </div>
                            </div>
                            
                           {motivationStakes && motivationStakes.length > 0 && (
  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
    {renderSuggestions(motivationStakes.join('\n\n'))}
  </div>
)}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rag">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Database className="mr-2" />
                        RAG Search
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="rag-query">Search Query</Label>
                          <div className="flex space-x-2 mt-1">
                            <Input
                              id="rag-query"
                              value={ragQuery}
                              onChange={(e) => setRagQuery(e.target.value)}
                              placeholder="Search your writing history..."
                              className="flex-1"
                            />
                            <Button 
                              onClick={handleRAGSearch} 
                              disabled={aiLoading || !ragQuery.trim()}
                              className="flex items-center"
                            >
                              <Search className="mr-1 h-4 w-4" />
                              Search
                            </Button>
                          </div>
                        </div>
                        
                        {ragResults && ragResults.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="font-medium">Search Results</h3>
                            {ragResults.map((result, index) => (
                              <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                <div className="text-sm text-gray-600 mb-1">
                                  Project: {result.metadata?.projectId || 'Unknown'}
                                </div>
                                <div className="text-gray-800">
                                  {result.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="chatbot">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageCircle className="mr-2" />
                        AI Writing Assistant Chat
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Chat Messages */}
                        <div 
                          ref={chatContainerRef}
                          className="h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50 space-y-3"
                        >
                          {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                              <p>Start a conversation with your AI writing assistant!</p>
                              <p className="text-sm mt-1">Ask for help with your writing, character development, plot ideas, and more.</p>
                            </div>
                          ) : (
                            chatMessages.map((message, index) => (
                              <div
                                key={index}
                                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                    message.role === 'user'
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-white border shadow-sm'
                                  }`}
                                >
                                  <div className="text-sm">
                                    {message.role === 'bot' ? renderSuggestions(message.content) : message.content}
                                  </div>
                                  {message.timestamp && (
                                    <div className={`text-xs mt-1 ${
                                      message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                                    }`}>
                                      {new Date(message.timestamp).toLocaleTimeString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleChatSubmit} className="flex space-x-2">
                          <Input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask me anything about your writing..."
                            className="flex-1"
                            disabled={chatbotLoading}
                          />
                          <Button 
                            type="submit" 
                            disabled={chatbotLoading || !chatInput.trim()}
                            className="flex items-center"
                          >
                            {chatbotLoading ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <MessageCircle className="h-4 w-4" />
                            )}
                          </Button>
                        </form>

                        {/* Personalized Suggestions */}
                        {chatbotSuggestions.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="font-medium">Personalized Suggestions</h3>
                            {chatbotSuggestions.map((suggestion, index) => (
                              <div key={index} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                {renderSuggestions(suggestion)}
                              </div>
                            ))}
                            <Button onClick={handleChatbotSuggestions} disabled={chatbotLoading}>
                              Get More Personalized Suggestions
                            </Button>
                          </div>
                        )}

                        {chatbotError && (
                          <div className="text-center py-4">
                            <p className="text-red-500 mb-2">Error: {chatbotError}</p>
                            <Button variant="outline" onClick={clearChatbotError} size="sm">
                              Clear Error
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="stats">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <TrendingUp className="mr-2" />
                        Writing Analytics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Writing Statistics */}
                        <div className="space-y-4">
                          <h3 className="font-medium">Writing Statistics</h3>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center">
                                <FileText className="h-5 w-5 text-blue-600 mr-2" />
                                <span>Total Words</span>
                              </div>
                              <span className="font-semibold text-blue-600">{stats.words.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                              <div className="flex items-center">
                                <BarChart3 className="h-5 w-5 text-green-600 mr-2" />
                                <span>Characters</span>
                              </div>
                              <span className="font-semibold text-green-600">{stats.characters.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                              <div className="flex items-center">
                                <Users className="h-5 w-5 text-purple-600 mr-2" />
                                <span>Paragraphs</span>
                              </div>
                              <span className="font-semibold text-purple-600">{stats.paragraphs}</span>
                            </div>
                          </div>
                        </div>

                        {/* Project Progress */}
                        <div className="space-y-4">
                          <h3 className="font-medium">Project Progress</h3>
                          <div className="space-y-3">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600">Daily Goal</span>
                                <span className="text-sm font-medium">500 words</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${Math.min((stats.words / 500) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm text-gray-600 mb-1">Last Updated</div>
                              <div className="font-medium">
                                {lastSaved ? lastSaved.toLocaleString() : 'Never'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
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
}

export default App;
