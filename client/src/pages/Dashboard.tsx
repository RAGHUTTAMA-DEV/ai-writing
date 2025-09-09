import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAIStore } from '../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { CopilotEditor } from '../components/CopilotEditor';
import { AIToolsPanel } from '../components/AI/AIToolsPanel';
import { ChatbotPanel } from '../components/AI/ChatbotPanel';
import { RAGSearchPanel } from '../components/AI/RAGSearchPanel';
import { AnalyticsPanel } from '../components/AI/AnalyticsPanel';
import { WelcomeScreen } from '../components/Dashboard/WelcomeScreen';
import { PreferencesPage } from './PreferencesPage';
import { 
  FileText, 
  Zap, 
  MessageCircle, 
  Database, 
  BarChart3,
  BookOpen,
  Sparkles,
  Settings
} from 'lucide-react';

interface DashboardProps {
  initialTab?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialTab }) => {
  const { 
    activeProject, 
    updateProject, 
    hasUnsavedChanges, 
    setHasUnsavedChanges 
  } = useProjectStore();
  
  const [activeTab, setActiveTab] = useState(initialTab || 'editor');

  // Update active tab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleSave = async (content: string) => {
    if (activeProject) {
      try {
        await updateProject(activeProject.id, { content });
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Save failed:', error);
        throw error;
      }
    }
  };

  const handleContentChange = (content: string) => {
    if (activeProject && content !== activeProject.content) {
      setHasUnsavedChanges(true);
    }
  };

  // Show welcome screen if no active project
  if (!activeProject) {
    return <WelcomeScreen />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Project Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {activeProject.title}
              </h2>
              <p className="text-sm text-gray-500">
                {activeProject.type} • {activeProject.format}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {hasUnsavedChanges && (
              <span className="text-sm text-orange-600 flex items-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                Unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="bg-white border-b">
            <TabsList className="ml-6 mt-4">
              <TabsTrigger value="editor" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Editor</span>
              </TabsTrigger>
              <TabsTrigger value="ai-tools" className="flex items-center space-x-2">
                <Zap className="h-4 w-4" />
                <span>AI Tools</span>
              </TabsTrigger>
              <TabsTrigger value="chatbot" className="flex items-center space-x-2">
                <MessageCircle className="h-4 w-4" />
                <span>AI Chat</span>
              </TabsTrigger>
              <TabsTrigger value="rag" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>Smart Search</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>
              <TabsTrigger value="preferences" className="flex items-center space-x-2">
                <Settings className="h-4 w-4" />
                <span>Preferences</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 p-6">
            <TabsContent value="editor" className="h-full mt-0">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <span>AI-Powered Editor</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full">
                  <CopilotEditor
                    initialContent={activeProject.content || ''}
                    onSave={handleSave}
                    onChange={handleContentChange}
                    projectId={activeProject.id}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai-tools" className="h-full mt-0">
              <AIToolsPanel projectId={activeProject.id} />
            </TabsContent>

            <TabsContent value="chatbot" className="h-full mt-0">
              <ChatbotPanel projectId={activeProject.id} />
            </TabsContent>

            <TabsContent value="rag" className="h-full mt-0">
              <RAGSearchPanel projectId={activeProject.id} />
            </TabsContent>

            <TabsContent value="analytics" className="h-full mt-0">
              <AnalyticsPanel projectId={activeProject.id} />
            </TabsContent>

            <TabsContent value="preferences" className="h-full mt-0">
              <PreferencesPage />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};
