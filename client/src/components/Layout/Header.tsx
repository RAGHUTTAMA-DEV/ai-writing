import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectStore } from '../../store/useProjectStore';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Brain, 
  User, 
  LogOut, 
  Settings, 
  FileText, 
  Save, 
  Clock,
  Bell,
  Search
} from 'lucide-react';

interface HeaderProps {
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { user } = useAuthStore();
  const { activeProject, hasUnsavedChanges, lastSaved } = useProjectStore();

  const handleLogout = () => {
    onLogout();
  };

  const getWritingStats = () => {
    if (!activeProject?.content) return { words: 0, characters: 0 };
    
    const content = activeProject.content;
    const words = content.split(/\s+/).filter(word => word.length > 0).length;
    const characters = content.length;
    
    return { words, characters };
  };

  const stats = getWritingStats();

  return (
    <header className="bg-white border-b shadow-sm sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex justify-between items-center">
          {/* Logo and App Title */}
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI Writing Assistant
              </h1>
              <p className="text-sm text-gray-500">Your intelligent writing companion</p>
            </div>
          </div>

          {/* Center - Project Info and Stats */}
          <div className="hidden md:flex items-center space-x-6">
            {activeProject && (
              <>
                <div className="flex items-center space-x-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="font-medium text-gray-700">{activeProject.title}</span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>{stats.words} words</span>
                  <span>•</span>
                  <span>{stats.characters} chars</span>
                </div>

                <div className="flex items-center space-x-2">
                  {hasUnsavedChanges ? (
                    <Badge variant="secondary" className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Unsaved</span>
                    </Badge>
                  ) : lastSaved ? (
                    <Badge variant="outline" className="flex items-center space-x-1 text-green-600 border-green-200">
                      <Save className="h-3 w-3" />
                      <span>Saved</span>
                    </Badge>
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* Right side - User controls */}
          <div className="flex items-center space-x-3">
            {/* Search */}
            <Button variant="ghost" size="sm" className="hidden md:flex">
              <Search className="h-4 w-4" />
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </Button>

            {/* Settings */}
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>

            {/* User Info */}
            <div className="flex items-center space-x-2 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="p-1 bg-blue-100 rounded-full">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="hidden md:block">
                <div className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
            </div>

            {/* Logout */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
