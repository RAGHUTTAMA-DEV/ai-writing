import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAIStore } from '../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CopilotEditor } from '../components/CopilotEditor';
import { AIToolsPanel } from '../components/AI/AIToolsPanel';
import { ChatbotPanel } from '../components/AI/ChatbotPanel';
import { RAGSearchPanel } from '../components/AI/RAGSearchPanel';
import { AnalyticsPanel } from '../components/AI/AnalyticsPanel';
import { WelcomeScreen } from '../components/Dashboard/WelcomeScreen';
import { PreferencesPage } from './PreferencesPage';
import { Icon } from '../components/ui/icon';

interface DashboardProps {
  initialTab?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ initialTab }) => {
  const { 
    activeProject, 
    updateProject, 
    //@ts-ignore
    hasUnsavedChanges, 
    //@ts-ignore
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

  const navigationItems = [
    {
      id: 'editor',
      label: 'Editor',
      icon: 'file-text',
      gradient: 'from-indigo-500 to-purple-600'
    },
    {
      id: 'ai-tools',
      label: 'AI Tools',
      icon: 'zap',
      gradient: 'from-yellow-400 to-orange-500'
    },
    {
      id: 'chatbot',
      label: 'Chat',
      icon: 'message-circle',
      gradient: 'from-green-400 to-blue-500'
    },
    {
      id: 'rag',
      label: 'Search',
      icon: 'database',
      gradient: 'from-purple-400 to-pink-500'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: 'bar-chart',
      gradient: 'from-red-400 to-pink-500'
    },
    {
      id: 'preferences',
      label: 'Settings',
      icon: 'settings',
      gradient: 'from-gray-600 to-gray-800'
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'editor':
        return (
          <div className="h-full">
            <CopilotEditor
              initialContent={activeProject.content || ''}
              onSave={handleSave}
              onChange={handleContentChange}
              projectId={activeProject.id}
            />
          </div>
        );
      case 'ai-tools':
        return <AIToolsPanel projectId={activeProject.id} />;
      case 'chatbot':
        return <ChatbotPanel projectId={activeProject.id} />;
      case 'rag':
        return <RAGSearchPanel projectId={activeProject.id} />;
      case 'analytics':
        return <AnalyticsPanel projectId={activeProject.id} />;
      case 'preferences':
        return <PreferencesPage />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar Navigation */}
      <div className="w-20 lg:w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Brand Area */}
        <div className="p-4 lg:p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Icon name="sparkles" size="sm" className="text-white" />
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 lg:p-4 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                w-full group relative flex items-center space-x-3 px-3 py-3 lg:px-4 lg:py-3 
                rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg
                ${activeTab === item.id 
                  ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg` 
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {/* Active indicator */}
              {activeTab === item.id && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full lg:hidden" />
              )}
              
              {/* Icon */}
              <div className={`
                flex-shrink-0 w-10 h-10 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg transition-all duration-300
                ${activeTab === item.id ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white'}
              `}>
                <Icon 
                  name={item.icon as any} 
                  size="sm" 
                  className={activeTab === item.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'} 
                />
              </div>
              
              {/* Label */}
              <span className={`
                hidden lg:block text-sm font-semibold truncate transition-colors duration-300
                ${activeTab === item.id ? 'text-white' : 'text-gray-700 group-hover:text-gray-900'}
              `}>
                {item.label}
              </span>

              {/* Hover effect */}
              <div className={`
                absolute inset-0 rounded-xl transition-opacity duration-300 pointer-events-none
                bg-gradient-to-r ${item.gradient} opacity-0 group-hover:opacity-10
                ${activeTab === item.id ? 'opacity-0' : ''}
              `} />
            </button>
          ))}
        </nav>

        {/* Project Info */}
        <div className="p-3 lg:p-4 border-t border-gray-100">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="book-open" size="xs" className="text-white" />
            </div>
            <div className="hidden lg:block min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{activeProject.title}</p>
              <p className="text-xs text-gray-500">
                {(activeProject.content || '').split(/\s+/).filter(word => word.length > 0).length} words
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content */}
        <main className="flex-1">
          <div className="w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};