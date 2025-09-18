import React, { useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectStore } from '../../store/useProjectStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Icon, BrandIcon } from '../ui/icon';

// --- Sub-components for better organization ---

const Brand = () => (
  <div className="flex items-center space-x-3 animate-fade-in">
    <div className="p-2 gradient-primary rounded-xl shadow-medium transition-transform hover:scale-105">
      <BrandIcon size="md" className="text-white" />
    </div>
    <div className="hidden sm:block">
      <h1 className="text-xl font-bold text-gradient tracking-tight">
        AI Writer
      </h1>
      <p className="text-xs text-gray-500 -mt-1">
        Writing Platform
      </p>
    </div>
  </div>
);

const ProjectControls = () => {
  const { activeProject, projects, setActiveProject, createProject, getProjects } = useProjectStore();

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const project = projects.find(p => p.id === e.target.value);
    console.log('Project selected:', project);
    if (project) setActiveProject(project);
  };

  const handleNewProject = useCallback(async () => {
    const title = prompt('Enter project title:');
    if (!title?.trim()) return;

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
  }, [createProject]);

  return (
    <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
      {projects.length > 0 && (
        <div className="relative group">
          <select 
            value={activeProject?.id || ''}
            onChange={handleProjectSelect}
            className="appearance-none bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 pr-8 sm:pr-10 md:pr-12 text-xs sm:text-sm font-semibold text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-200 hover:shadow-lg focus:shadow-xl min-w-32 sm:min-w-40 md:min-w-44 max-w-40 sm:max-w-48 md:max-w-60 cursor-pointer hover:bg-white"
          >
            {!activeProject && <option value="" disabled>Select Project</option>}
            {projects.map(project => (
              <option key={project.id} value={project.id} className="py-3 px-4 font-medium">
                {project.title.length > 28 ? `${project.title.slice(0, 28)}...` : project.title}
              </option>
            ))}
          </select>
          
          {/* Enhanced dropdown arrow */}
          <div className="absolute right-2 sm:right-3 md:right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200 group-hover:scale-110 group-focus-within:rotate-180">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-md flex items-center justify-center shadow-sm">
              <Icon name="chevron-down" size="xs" className="text-white transition-transform duration-200" />
            </div>
          </div>
          
          {/* Enhanced active project indicator */}
          {activeProject && (
            <div className="absolute -top-2 -right-2 flex items-center justify-center">
              <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md animate-pulse">
                <div className="w-full h-full bg-green-400 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <Button
        onClick={handleNewProject}
        variant="outline"
        size="sm"
        className="flex items-center space-x-1 sm:space-x-2 bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:text-indigo-700 font-semibold rounded-xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] text-xs sm:text-sm"
      >
        <Icon name="plus" size="sm" className="text-indigo-600" />
        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </Button>
      
      <Button
        onClick={() => getProjects()}
        variant="outline"
        size="sm"
        className="flex items-center justify-center bg-white hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-700 font-semibold rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] min-w-[2.5rem] sm:min-w-[3rem]"
        title="Refresh projects"
      >
        <Icon name="refresh" size="sm" className="text-gray-600" />
      </Button>
    </div>
  );
};

const ActiveProjectInfo = () => {
  const { activeProject } = useProjectStore();

  const stats = useMemo(() => {
    if (!activeProject?.content) return { words: 0, characters: 0 };
    
    const content = activeProject.content || '';
    const words = content.trim() ? content.split(/\s+/).filter(word => word.length > 0).length : 0;
    const characters = content.length;
    
    return { words, characters };
  }, [activeProject?.content]);

  // Add debug logging
  console.log('ActiveProjectInfo render:', {
    activeProject: activeProject?.title,
    content: activeProject?.content?.slice(0, 100) + '...',
    stats
  });

  if (!activeProject) return null;

  return (
    <div className="hidden md:flex items-center space-x-4 flex-1 min-w-0">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 bg-gray-50 rounded-lg px-2 sm:px-3 py-2 border border-gray-200">
        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="file-text" size="xs" className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate max-w-24 sm:max-w-32">
              {activeProject.title}
            </span>
            <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600 border-0 px-1.5 sm:px-2 py-0.5 hidden sm:inline-flex">
              {activeProject.type}
            </Badge>
          </div>
          <div className="hidden sm:flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center space-x-1">
              {/* @ts-ignore */}
              <Icon name="type" size="xs" />
              <span>{stats.words} words</span>
            </span>
            <span className="flex items-center space-x-1">
              {/* @ts-ignore */}
              <Icon name="hash" size="xs" />
              <span>{stats.characters} chars</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

const UserControls: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user } = useAuthStore();

  return (
    <div className="flex items-center space-x-1 sm:space-x-2 md:space-x-3">
      <div className="flex items-center space-x-2 sm:space-x-3 bg-gray-50 rounded-xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 border border-gray-200 hover:border-gray-300 transition-all duration-200">
        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
          <Icon name="user" size="xs" className="text-white" />
        </div>
        <div className="hidden sm:block">
          <div className="text-gray-900 text-xs sm:text-sm font-semibold">
            {user?.firstName}
          </div>
          <div className="text-gray-500 text-xs hidden md:block">
            Active User
          </div>
        </div>
      </div>
      
      <button
        onClick={onLogout}
        className="flex items-center space-x-1 sm:space-x-2 bg-white hover:bg-red-50 rounded-xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 border-2 border-gray-200 hover:border-red-200 transition-all duration-200 hover:scale-[1.02] hover:shadow-md group min-w-[2.5rem] sm:min-w-auto"
      >
        <Icon name="logout" size="sm" className="text-gray-500 group-hover:text-red-500 transition-colors duration-200" />
        <span className="hidden md:inline text-sm font-medium text-gray-700 group-hover:text-red-600 transition-colors duration-200">
          Logout
        </span>
      </button>
    </div>
  );
};

// --- Main Header Component ---

interface HeaderProps {
  onLogout: () => void;
  onTabChange?: (tab: string) => void;
  activeTab?: string;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const handleLogout = useCallback(() => {
    onLogout();
  }, [onLogout]);

  return (
    <header className="bg-white/98 backdrop-blur-lg border-b border-gray-200/80 sticky top-0 z-50 shadow-sm">
      <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-2 sm:gap-x-4 md:gap-x-6 gap-y-3">
          {/* Left Section */}
          <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
            <Brand />
            <ProjectControls />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end flex-wrap">
            <ActiveProjectInfo />
            <UserControls onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </header>
  );
};