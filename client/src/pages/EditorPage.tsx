import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { CopilotEditor } from '../components/CopilotEditor';
import { BookOpen, Circle } from 'lucide-react';

export const EditorPage: React.FC = () => {
  const {
    activeProject,
    updateProject
  } = useProjectStore();

  const [, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const headerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show header temporarily when there are changes or on hover
  useEffect(() => {
    if (hasUnsavedChanges) {
      setIsHeaderVisible(true);
      
      // Clear existing timeout
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
      
      // Hide header after 3 seconds if no unsaved changes
      headerTimeoutRef.current = setTimeout(() => {
        if (!hasUnsavedChanges) {
          setIsHeaderVisible(false);
        }
      }, 3000);
    } else {
      setIsHeaderVisible(false);
    }

    return () => {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
    };
  }, [hasUnsavedChanges]);

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges && activeProject) {
      const autoSaveTimer = setTimeout(() => {
        handleSave(activeProject.content || '');
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasUnsavedChanges, activeProject, handleSave]);

  const handleSave = useCallback(async (content: string) => {
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
  }, [activeProject, updateProject]);

  const handleContentChange = (content: string) => {
    if (activeProject) {
      // Update the project content in store
      activeProject.content = content;
      setHasUnsavedChanges(true);
    }
  };

  if (!activeProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center rounded-full bg-gray-100">
            <BookOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">
            No project selected
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Select a project from the sidebar to start writing your story
          </p>
        </div>
      </div>
    );
  }

  const wordCount = (activeProject.content || '').split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Minimal Header - Auto-hides for distraction-free writing */}
      <div 
        className={`
          transition-all duration-500 ease-in-out border-b border-gray-100 bg-white/95 backdrop-blur-sm
          ${isHeaderVisible || hasUnsavedChanges ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        `}
        onMouseEnter={() => setIsHeaderVisible(true)}
        onMouseLeave={() => {
          if (!hasUnsavedChanges) {
            headerTimeoutRef.current = setTimeout(() => {
              setIsHeaderVisible(false);
            }, 1000);
          }
        }}
      >
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <h1 className="text-xl font-medium text-gray-900 truncate max-w-md">
                {activeProject.title}
              </h1>
              <div className="h-4 w-px bg-gray-300" />
              <span className="text-sm text-gray-500 font-medium">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>
            
            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-amber-700 bg-amber-100 px-4 py-2 rounded-full animate-pulse">
                <Circle className="w-2 h-2 fill-current" />
                <span className="text-sm font-medium">Auto-saving...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-screen Editor with maximum space */}
      <div className="flex-1 min-h-0 relative">
        <CopilotEditor
          initialContent={activeProject.content || ''}
          onSave={handleSave}
          onChange={handleContentChange}
          projectId={activeProject.id}
        />
      </div>
    </div>
  );
};