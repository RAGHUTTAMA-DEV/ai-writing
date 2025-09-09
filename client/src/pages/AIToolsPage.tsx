import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { AIToolsPanel } from '../components/AI/AIToolsPanel';
import { Card, CardContent } from '../components/ui/card';
import { BookOpen } from 'lucide-react';

export const AIToolsPage: React.FC = () => {
  const { activeProject } = useProjectStore();

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No project selected</p>
            <p className="text-gray-400">Select a project to access AI writing tools</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full">
      <AIToolsPanel projectId={activeProject.id} />
    </div>
  );
};
