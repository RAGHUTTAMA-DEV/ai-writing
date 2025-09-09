import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CopilotEditor } from '../components/CopilotEditor';
import { 
  BookOpen, 
  Save, 
  Clock,
  FileText,
  RefreshCw
} from 'lucide-react';

export const EditorPage: React.FC = () => {
  const {
    activeProject,
    updateProject,
    loading: projectsLoading
  } = useProjectStore();

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges && activeProject) {
      const autoSaveTimer = setTimeout(() => {
        handleSave(activeProject.content || '');
      }, 5000); // Auto-save after 5 seconds of inactivity

      return () => clearTimeout(autoSaveTimer);
    }
  }, [hasUnsavedChanges, activeProject]);

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
      // Update the project content in store
      activeProject.content = content;
      setHasUnsavedChanges(true);
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No project selected</p>
            <p className="text-gray-400">Select a project from the sidebar to start writing</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Editor Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <CardTitle>{activeProject.title}</CardTitle>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs text-orange-600">
                  Unsaved Changes
                </Badge>
              )}
              {lastSaved && !hasUnsavedChanges && (
                <Badge variant="outline" className="text-xs text-green-600">
                  <Save className="w-3 h-3 mr-1" />
                  Saved
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {lastSaved && (
                <span className="text-xs text-gray-500">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
              <Button 
                onClick={() => handleSave(activeProject.content || '')}
                disabled={!hasUnsavedChanges || projectsLoading}
                size="sm"
                className="flex items-center"
              >
                {projectsLoading ? (
                  <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </div>
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
    </div>
  );
};
