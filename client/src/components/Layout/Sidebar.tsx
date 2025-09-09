import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAIStore } from '../../store/useAIStore';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  BookOpen, 
  Plus, 
  Zap, 
  Brain, 
  MessageCircle, 
  BarChart3,
  Settings,
  Lightbulb,
  Target,
  Eye,
  Users,
  Database,
  ChevronRight,
  ChevronDown,
  FileText,
  Sparkles
} from 'lucide-react';

type Page = 'dashboard' | 'editor' | 'ai-tools' | 'chatbot' | 'rag';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, onTabChange, activeTab }) => {
  const { 
    projects, 
    activeProject, 
    setActiveProject, 
    createProject,
    loading: projectsLoading 
  } = useProjectStore();
  
  const { suggestions } = useAIStore();
  
  const [expandedSections, setExpandedSections] = useState({
    projects: true,
    aiTools: true
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleNewProject = async () => {
    const title = prompt('Enter project title:');
    if (title?.trim()) {
      try {
        await createProject({ 
          title: title.trim(), 
          content: '',
          type: 'draft',
          format: 'story'
        });
      } catch (error) {
        console.error('Failed to create project:', error);
        alert('Failed to create project');
      }
    }
  };

  const getProjectStats = (project: any) => {
    const content = project?.content || '';
    const words = content.split(/\s+/).filter((word: string) => word.length > 0).length;
    const chars = content.length;
    return { words, chars };
  };

  const getDailyProgress = () => {
    const dailyGoal = 500; // Default daily goal
    const todayWords = activeProject ? getProjectStats(activeProject).words : 0;
    return Math.min((todayWords / dailyGoal) * 100, 100);
  };

  return (
    <aside className="w-80 bg-white border-r shadow-sm h-screen overflow-y-auto">
      <div className="p-4 space-y-6">
        
        {/* Projects Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-base">
                <BookOpen className="mr-2 h-4 w-4" />
                Projects
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('projects')}
              >
                {expandedSections.projects ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </Button>
            </div>
          </CardHeader>
          
          {expandedSections.projects && (
            <CardContent className="space-y-3">
              <Button 
                onClick={handleNewProject} 
                className="w-full flex items-center justify-center"
                disabled={projectsLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {projects.map(project => {
                  const stats = getProjectStats(project);
                  const isActive = activeProject?.id === project.id;
                  
                  return (
                    <div
                      key={project.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                        isActive 
                          ? 'bg-blue-50 border-blue-200 shadow-sm' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveProject(project)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className={`font-medium text-sm truncate ${
                            isActive ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {project.title}
                          </h4>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-xs text-gray-500">
                              {stats.words} words
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {project.type}
                            </Badge>
                          </div>
                        </div>
                        {isActive && (
                          <div className="ml-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>

        {/* AI Tools Section */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-base">
                <Zap className="mr-2 h-4 w-4" />
                AI Tools
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('aiTools')}
              >
                {expandedSections.aiTools ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronRight className="h-4 w-4" />
                }
              </Button>
            </div>
          </CardHeader>
          
          {expandedSections.aiTools && (
            <CardContent className="space-y-2">
              <Button 
                variant={currentPage === 'dashboard' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onPageChange('dashboard')}
              >
                <Brain className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              
              <Button 
                variant={currentPage === 'editor' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onPageChange('editor')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Editor
              </Button>
              
              <Button 
                variant={currentPage === 'ai-tools' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onPageChange('ai-tools')}
              >
                <Lightbulb className="mr-2 h-4 w-4" />
                AI Tools
                {suggestions.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {suggestions.length}
                  </Badge>
                )}
              </Button>
              
              <Button 
                variant={currentPage === 'rag' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onPageChange('rag')}
              >
                <Database className="mr-2 h-4 w-4" />
                Smart Search
              </Button>
              
              <Button 
                variant={currentPage === 'chatbot' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onPageChange('chatbot')}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                AI Chat
              </Button>
              
              <Button 
                variant={activeTab === 'preferences' ? 'default' : 'outline'} 
                size="sm" 
                className="w-full justify-start"
                onClick={() => onTabChange && onTabChange('preferences')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Preferences
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Project Preferences */}
        {activeProject && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <Settings className="mr-2 h-4 w-4" />
                Project Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">{activeProject.type || 'Draft'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Format:</span>
                  <span className="font-medium">{activeProject.format || 'Story'}</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => onTabChange && onTabChange('preferences')}
              >
                Edit Project Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Daily Progress */}
        {activeProject && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-base">
                <BarChart3 className="mr-2 h-4 w-4" />
                Daily Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Daily Goal</span>
                  <span>500 words</span>
                </div>
                <Progress value={getDailyProgress()} className="h-2" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{getProjectStats(activeProject).words} written</span>
                  <span>{Math.round(getDailyProgress())}%</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-lg font-semibold text-blue-700">
                    {getProjectStats(activeProject).words}
                  </div>
                  <div className="text-xs text-gray-600">Words</div>
                </div>
                <div className="p-2 bg-green-50 rounded">
                  <div className="text-lg font-semibold text-green-700">
                    {getProjectStats(activeProject).chars}
                  </div>
                  <div className="text-xs text-gray-600">Characters</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </aside>
  );
};
