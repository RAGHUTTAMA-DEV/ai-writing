import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { CopilotEditor } from '../components/CopilotEditor';
import { AIToolsPanel } from '../components/AI/AIToolsPanel';
import { ChatbotPanel } from '../components/AI/ChatbotPanel';
import { RAGSearchPanel } from '../components/AI/RAGSearchPanel';
import { AnalyticsPanel } from '../components/AI/AnalyticsPanel';
import { StructureAnalysisPanel } from '../components/AI/StructureAnalysisPanel';
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
      gradient: 'from-gray-600 to-gray-700'
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
      id: 'structure',
      label: 'Structure',
      icon: 'layers',
      gradient: 'from-indigo-400 to-purple-500'
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
              isFullScreen={isFullScreenMode}
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
      case 'structure':
        return <StructureAnalysisPanel projectId={activeProject.id} />;
      case 'preferences':
        return <PreferencesPage />;
      default:
        return null;
    }
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(activeTab === 'editor');
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [showFullScreenNotification, setShowFullScreenNotification] = useState(false);

  // Auto-collapse sidebar when in editor mode for more writing space
  useEffect(() => {
    if (activeTab === 'editor') {
      setIsSidebarCollapsed(true);
    } else {
      setIsSidebarCollapsed(false);
    }
  }, [activeTab]);

  // Add keyboard support for full-screen mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Exit full-screen mode with Escape key
      if (event.key === 'Escape' && isFullScreenMode) {
        setIsFullScreenMode(false);
        event.preventDefault();
      }
      // Toggle full-screen mode with F11 (optional)
      if (event.key === 'F11' && activeTab === 'editor') {
        setIsFullScreenMode(!isFullScreenMode);
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreenMode, activeTab]);

  // Show notification when entering full-screen mode
  useEffect(() => {
    if (isFullScreenMode) {
      setShowFullScreenNotification(true);
      const timer = setTimeout(() => {
        setShowFullScreenNotification(false);
      }, 4000); // Hide after 4 seconds
      return () => clearTimeout(timer);
    }
  }, [isFullScreenMode]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarCollapsed && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}
      
      {/* Collapsible Sidebar Navigation */}
      <div className={`
        ${isSidebarCollapsed ? 'w-0 md:w-16' : 'w-72 md:w-20 lg:w-64'} 
        ${isFullScreenMode ? 'hidden' : ''} 
        bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'md:hover:w-20 lg:hover:w-64 hover:shadow-lg group overflow-hidden md:overflow-visible' : 'fixed md:relative'}
        ${!isSidebarCollapsed ? 'fixed md:relative z-40 shadow-2xl md:shadow-none' : 'relative z-40'}
        h-screen top-0 left-0
      `}>
        {/* Sidebar Header with Collapse Button */}
        <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-100 flex items-center justify-between md:justify-center">
          {/* Mobile close button */}
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-all duration-300"
            title="Close sidebar"
          >
            <Icon name="x" size="sm" className="text-gray-600" />
          </button>
          
          {/* Desktop collapse button */}
          {activeTab === 'editor' && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`hidden md:block p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 ${isSidebarCollapsed ? 'opacity-50 hover:opacity-100' : 'opacity-100'}`}
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Icon name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'} size="sm" className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-2 sm:p-3 lg:p-4 space-y-1 sm:space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                // Auto-close sidebar on mobile when selecting an item
                if (window.innerWidth < 768) {
                  setIsSidebarCollapsed(true);
                }
              }}
              className={`
                w-full group relative flex items-center rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg touch-manipulation
                ${isSidebarCollapsed ? 'justify-center px-2 py-3 md:py-3' : 'space-x-3 px-3 py-4 sm:py-3 lg:px-4 lg:py-3'}
                ${activeTab === item.id 
                  ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg` 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-100'
                }
              `}
            >
              {/* Active indicator */}
              {activeTab === item.id && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-full lg:hidden" />
              )}
              
              {/* Icon */}
              <div className={`
                flex-shrink-0 flex items-center justify-center rounded-lg transition-all duration-300
                ${isSidebarCollapsed ? 'w-10 h-10 md:w-10 md:h-10' : 'w-10 h-10 lg:w-8 lg:h-8'}
                ${activeTab === item.id ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-200 group-active:bg-gray-300'}
              `}>
                <Icon 
                  name={item.icon as any} 
                  size={isSidebarCollapsed ? 'md' : 'sm'}
                  className={activeTab === item.id ? 'text-white' : 'text-gray-600 group-hover:text-gray-700'} 
                />
              </div>
              
              {/* Label */}
              <span className={`
                text-sm font-semibold truncate transition-all duration-300
                ${isSidebarCollapsed 
                  ? 'opacity-0 md:group-hover:opacity-100 absolute left-full ml-3 bg-gray-900/95 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-[9999] pointer-events-none border border-gray-700 before:absolute before:top-1/2 before:-left-1 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-gray-900/95 hidden md:block' 
                  : 'block lg:block'
                }
                ${activeTab === item.id && !isSidebarCollapsed ? 'text-white' : 'text-gray-700 group-hover:text-gray-800'}
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
        <div className="p-2 sm:p-3 lg:p-4 border-t border-gray-100">
          <div className={`group relative flex items-center p-2 sm:p-3 bg-gray-50 rounded-xl transition-all duration-300 ${isSidebarCollapsed ? 'justify-center' : 'space-x-2 sm:space-x-3'}`}>
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="book-open" size="xs" className="text-white" />
            </div>
            <div className={`min-w-0 flex-1 ${isSidebarCollapsed ? 'hidden md:hidden' : 'block'}`}>
              <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{activeProject.title}</p>
              <p className="text-xs text-gray-500">
                {(activeProject.content || '').split(/\s+/).filter(word => word.length > 0).length} words
              </p>
            </div>
            
            {/* Collapsed state tooltip */}
            {isSidebarCollapsed && (
              <div className="hidden md:block opacity-0 group-hover:opacity-100 absolute left-full ml-3 bg-gray-900/95 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-[9999] pointer-events-none border border-gray-700 transition-opacity duration-300 before:absolute before:top-1/2 before:-left-1 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-gray-900/95">
                <p className="text-sm font-medium">{activeProject.title}</p>
                <p className="text-xs text-gray-300">
                  {(activeProject.content || '').split(/\s+/).filter(word => word.length > 0).length} words
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile hamburger menu button */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="md:hidden fixed top-4 left-4 z-30 p-3 bg-white/90 hover:bg-white border border-gray-200 shadow-lg rounded-lg transition-all duration-200 hover:shadow-xl hover:scale-105 backdrop-blur-sm"
            title="Open sidebar"
          >
            <Icon name="menu" size="sm" className="text-gray-600" />
          </button>
        )}
        
        {/* Full-screen toggle for writing mode */}
        {activeTab === 'editor' && (
          <button
            onClick={() => {
              setIsFullScreenMode(!isFullScreenMode);
              if (!isFullScreenMode) {
                // Entering full-screen mode - notification will show via useEffect
              }
            }}
            className={`
              ${isFullScreenMode 
                ? 'fixed top-4 right-4 z-50 p-3 bg-gray-900/90 hover:bg-gray-900 border border-gray-700 text-white backdrop-blur-sm shadow-xl animate-pulse hover:animate-none' 
                : `absolute top-4 z-30 p-2 bg-white/80 hover:bg-white border border-gray-200 shadow-sm ${isSidebarCollapsed ? 'right-4' : 'right-4 md:right-4'}`
              }
              rounded-lg transition-all duration-200 hover:shadow-md hover:scale-105
              flex items-center justify-center group touch-manipulation
            `}
            title={isFullScreenMode ? 'Exit full-screen mode (Press Esc or F11)' : 'Enter full-screen writing mode (Press F11)'}
          >
            <Icon 
              name={isFullScreenMode ? 'minimize-2' : 'maximize-2'} 
              size={isFullScreenMode ? 'md' : 'sm'} 
              className={isFullScreenMode ? 'text-white group-hover:text-gray-200' : 'text-gray-600 group-hover:text-gray-800'} 
            />
            {isFullScreenMode && (
              <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Press Esc to exit
              </span>
            )}
          </button>
        )}

        {/* Additional exit button in bottom-right corner for full-screen mode */}
        {activeTab === 'editor' && isFullScreenMode && (
          <button
            onClick={() => setIsFullScreenMode(false)}
            className="
              fixed bottom-4 right-4 z-50 p-3 sm:p-2 bg-red-600/90 hover:bg-red-700 border border-red-500 
              text-white backdrop-blur-sm shadow-xl rounded-full transition-all duration-200 
              hover:shadow-2xl hover:scale-110 group animate-bounce hover:animate-none
              touch-manipulation min-w-[3rem] min-h-[3rem] sm:min-w-0 sm:min-h-0
            "
            title="Exit full-screen mode"
          >
            <Icon 
              name="x" 
              size="sm" 
              className="text-white group-hover:text-red-100" 
            />
          </button>
        )}

        {/* Full-screen mode notification */}
        {isFullScreenMode && showFullScreenNotification && (
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 
                          bg-gray-900/95 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-2xl 
                          transition-all duration-300 animate-fade-in">
            <div className="flex items-center space-x-3">
              <Icon name="maximize-2" size="md" className="text-blue-400" />
              <div>
                <p className="font-medium text-lg">Full-screen Mode Activated</p>
                <p className="text-sm text-gray-300 mt-1">
                  Press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Esc</kbd> or 
                  <kbd className="px-2 py-1 bg-gray-800 rounded text-xs ml-1">F11</kbd> to exit, 
                  or click the buttons in the corners
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Content */}
        <main className={`flex-1 ${isFullScreenMode ? 'fixed inset-0 z-20 bg-white' : ''}`}>
          <div className={`w-full h-full ${!isFullScreenMode && isSidebarCollapsed ? 'md:pl-0' : ''}`}>
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};