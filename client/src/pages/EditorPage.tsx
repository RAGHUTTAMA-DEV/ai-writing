import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { CopilotEditor } from '../components/CopilotEditor';
import { BookOpen, Circle, Save } from 'lucide-react';

export const EditorPage: React.FC = () => {
  const {
    activeProject,
    updateProject
  } = useProjectStore();

  const [, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Header is now always visible - no auto-hide logic needed

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
      setIsSaving(true);
      try {
        await updateProject(activeProject.id, { content });
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        console.log('Content saved successfully');
      } catch (error) {
        console.error('Save failed:', error);
        alert('Failed to save content');
      } finally {
        setIsSaving(false);
      }
    }
  }, [activeProject, updateProject]);
  
  const handleManualSave = useCallback(async () => {
    if (activeProject) {
      await handleSave(activeProject.content || '');
    }
  }, [activeProject, handleSave]);

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
      {/* Header - Always visible with save button */}
      <div className="border-b border-gray-100 bg-white shadow-sm">
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
            
            <div className="flex items-center space-x-3">
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                  <Circle className="w-2 h-2 fill-current animate-pulse" />
                  <span className="text-sm font-medium">Unsaved</span>
                </div>
              )}
              
              {/* Always Visible Save Button */}
              <button
                onClick={handleManualSave}
                disabled={isSaving}
                className={`
                  flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold transition-all transform hover:scale-105
                  ${isSaving 
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed' 
                    : hasUnsavedChanges
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-md'
                  }
                `}
              >
                {isSaving ? (
                  <>
                    <Circle className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{hasUnsavedChanges ? 'Save Project' : 'Saved'}</span>
                  </>
                )}
              </button>
            </div>
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