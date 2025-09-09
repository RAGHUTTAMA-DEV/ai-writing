import React, { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useAIStore } from '../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Database, 
  Search, 
  BookOpen,
  RefreshCw
} from 'lucide-react';

export const RAGPage: React.FC = () => {
  const { activeProject } = useProjectStore();
  const {
    ragResults,
    loading: aiLoading,
    error: aiError,
    searchRAG,
    clearError: clearAIError
  } = useAIStore();

  const [ragQuery, setRagQuery] = useState('');

  const handleRAGSearch = async () => {
    if (ragQuery.trim()) {
      try {
        await searchRAG(ragQuery);
      } catch (error) {
        console.error('RAG search failed:', error);
      }
    } else {
      alert('Please enter a search query');
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <Database className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No project selected</p>
            <p className="text-gray-400">Select a project to search your writing history</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2" />
            RAG Search - Semantic Writing Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Input */}
            <div>
              <Label htmlFor="rag-query">Search Query</Label>
              <div className="flex space-x-2 mt-1">
                <Input
                  id="rag-query"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="Search your writing history, characters, themes, plot points..."
                  className="flex-1"
                />
                <Button 
                  onClick={handleRAGSearch} 
                  disabled={aiLoading || !ragQuery.trim()}
                  className="flex items-center"
                >
                  {aiLoading ? (
                    <RefreshCw className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {/* Quick Search Suggestions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRagQuery("main character development")}
                className="text-xs"
              >
                Character Development
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRagQuery("plot twists and reveals")}
                className="text-xs"
              >
                Plot Twists
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRagQuery("dialogue examples")}
                className="text-xs"
              >
                Dialogue Examples
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRagQuery("theme analysis")}
                className="text-xs"
              >
                Themes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Search Results</span>
            {ragResults && ragResults.length > 0 && (
              <span className="text-sm font-normal text-gray-500">
                {ragResults.length} result{ragResults.length !== 1 ? 's' : ''}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiError ? (
            <div className="text-center py-4">
              <p className="text-red-500 mb-2">Error: {aiError}</p>
              <Button variant="outline" onClick={clearAIError} size="sm">
                Clear Error
              </Button>
            </div>
          ) : aiLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Searching your writing...</span>
            </div>
          ) : ragResults && ragResults.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {ragResults.map((result, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border hover:border-blue-300 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Project:</span> {result.metadata?.projectId || activeProject.title}
                    </div>
                    {result.metadata?.score && (
                      <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {(result.metadata.score * 100).toFixed(1)}% match
                      </div>
                    )}
                  </div>
                  <div className="text-gray-800 leading-relaxed">
                    {result.content}
                  </div>
                  {result.metadata?.tags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {result.metadata.tags.map((tag: string, tagIndex: number) => (
                        <span 
                          key={tagIndex}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Enter a search query to find relevant content from your writing</p>
              <p className="text-sm mt-1">
                Search for characters, plot points, themes, or any content from your projects
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
