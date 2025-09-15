import React, { useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectStore } from '../../store/useProjectStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Icon, BrandIcon } from '../ui/icon';
import type { Project } from '../../store/useProjectStore';

// --- Sub-components for better organization ---

const Brand = () => (
  <div className="flex items-center space-x-3 animate-fade-in">
    <div className="p-2 gradient-primary rounded-xl shadow-medium transition-transform hover:scale-105">
      <BrandIcon size="md" className="text-white" />
    </div>
    <div className="hidden sm:block">
      <h1 className="text-xl font-bold text-gradient tracking-tight">
        StoryForge
      </h1>
      <p className="text-xs text-gray-500 -mt-1">
        AI Writing Studio
      </p>
    </div>
  </div>
);

const ProjectControls = () => {
  const { activeProject, projects, setActiveProject, createProject } = useProjectStore();

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const project = projects.find(p => p.id === e.target.value);
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
    <div className="flex items-center space-x-3">
      {projects.length > 0 && (
        <div className="relative group">
          <select 
            value={activeProject?.id || ''}
            onChange={handleProjectSelect}
            className="appearance-none bg-white border-2 border-gray-200 hover:border-indigo-300 focus:border-indigo-500 rounded-xl px-4 py-2.5 pr-10 text-sm font-medium text-gray-900 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all duration-200 hover:shadow-md focus:shadow-lg min-w-40 max-w-56 cursor-pointer"
          >
            {!activeProject && <option value="" disabled>Select Project</option>}
            {projects.map(project => (
              <option key={project.id} value={project.id} className="py-2">
                {project.title.length > 25 ? `${project.title.slice(0, 25)}...` : project.title}
              </option>
            ))}
          </select>
          
          {/* Custom dropdown arrow */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-hover:scale-110">
            <Icon name="chevron-down" size="sm" className="text-gray-500 group-hover:text-indigo-500" />
          </div>
          
          {/* Active project indicator */}
          {activeProject && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
          )}
        </div>
      )}
      
      <Button
        onClick={handleNewProject}
        variant="outline"
        size="sm"
        className="flex items-center space-x-2 bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-600 hover:text-indigo-700 font-semibold rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
      >
        <Icon name="plus" size="sm" className="text-indigo-600" />
        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </Button>
    </div>
  );
};

const ActiveProjectInfo = () => {
  const { activeProject, hasUnsavedChanges } = useProjectStore();

  const stats = useMemo(() => {
    if (!activeProject?.content) return { words: 0, characters: 0 };
    
    const content = activeProject.content;
    const words = content.split(/\s+/).filter(Boolean).length;
    const characters = content.length;
    
    return { words, characters };
  }, [activeProject?.content]);

  if (!activeProject) return null;

  return (
    <div className="flex items-center space-x-4 flex-1 min-w-0">
      <div className="flex items-center space-x-3 min-w-0 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="file-text" size="xs" className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-gray-900 text-sm truncate max-w-32">
              {activeProject.title}
            </span>
            <Badge variant="secondary" className="text-xs bg-gray-200 text-gray-600 border-0 px-2 py-0.5">
              {activeProject.type}
            </Badge>
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center space-x-1">
              <Icon name="type" size="xs" />
              <span>{stats.words} words</span>
            </span>
            <span className="flex items-center space-x-1">
              <Icon name="hash" size="xs" />
              <span>{stats.characters} chars</span>
            </span>
          </div>
        </div>
      </div>

      {hasUnsavedChanges && (
        <Badge variant="secondary" className="flex items-center space-x-1.5 animate-pulse bg-amber-50 text-amber-600 border-amber-200 text-xs px-3 py-1.5 rounded-lg">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
          <span className="hidden sm:inline font-medium">Unsaved Changes</span>
          <span className="sm:hidden font-medium">Unsaved</span>
        </Badge>
      )}
    </div>
  );
};

const UserControls: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user } = useAuthStore();

  return (
    <div className="flex items-center space-x-3">
      <div className="flex items-center space-x-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200 hover:border-gray-300 transition-all duration-200">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
          <Icon name="user" size="xs" className="text-white" />
        </div>
        <div className="hidden sm:block">
          <div className="text-gray-900 text-sm font-semibold">
            {user?.firstName}
          </div>
          <div className="text-gray-500 text-xs">
            Active User
          </div>
        </div>
      </div>
      
      <button
        onClick={onLogout}
        className="flex items-center space-x-2 bg-white hover:bg-red-50 rounded-xl px-4 py-2.5 border-2 border-gray-200 hover:border-red-200 transition-all duration-200 hover:scale-[1.02] hover:shadow-md group"
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
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const handleLogout = useCallback(() => {
    onLogout();
  }, [onLogout]);

  return (
    <header className="bg-white/98 backdrop-blur-lg border-b border-gray-200/80 sticky top-0 z-50 shadow-sm">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* Left Section */}
          <div className="flex items-center gap-6">
            <Brand />
            <ProjectControls />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <ActiveProjectInfo />
            <UserControls onLogout={handleLogout} />
          </div>
        </div>
      </div>
    </header>
  );
};