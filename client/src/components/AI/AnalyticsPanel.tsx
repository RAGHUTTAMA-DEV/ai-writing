import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAIStore } from '../../store/useAIStore';
import apiService from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  BarChart3, 
  TrendingUp,
  Target,
  Clock,
  FileText,
  Users,
  Brain,
  Calendar,
  Award,
  Zap,
  BookOpen,
  PieChart,
  Activity,
  CheckCircle,
  RefreshCw,
  Database,
  Eye,
  Hash
} from 'lucide-react';

interface AnalyticsPanelProps {
  projectId: string;
}

interface ProjectAnalytics {
  basic: {
    title: string;
    description?: string;
    format: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    contentLength: number;
    wordCount: number;
  };
  analytics: {
    characters: string[];
    themes: string[];
    contentTypes: string[];
    emotions: string[];
    plotElements: string[];
    semanticTags: string[];
    totalDocuments: number;
    totalChunks: number;
    totalWordCount: number;
    averageImportance: number;
    lastUpdated?: string;
  };
  context: {
    writingStyle: string;
    toneAnalysis: string;
    settings: string[];
    lastContextUpdate: string;
  } | null;
  hasRAGData: boolean;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ projectId }) => {
  const { activeProject } = useProjectStore();
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📊 Loading analytics for project:', projectId);
      
      const data = await apiService.getProjectAnalytics(projectId);
      console.log('✅ Analytics loaded:', data);
      
      setAnalytics(data);
    } catch (err: any) {
      console.error('❌ Failed to load analytics:', err);
      setError(err.message || 'Failed to load project analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadAnalytics();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto space-y-6 p-1">
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600">Loading project analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto space-y-6 p-1">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-red-500 mb-2">❌</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadAnalytics} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="h-full overflow-y-auto space-y-6 p-1">
        <div className="flex items-center justify-center h-32">
          <span className="text-gray-600">No analytics data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Analytics</h2>
        </div>
        <Button onClick={loadAnalytics} variant="outline" size="sm" className="h-7 px-2">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Project Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Words</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.basic.wordCount.toLocaleString()}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Characters</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.analytics.characters.length}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Themes</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.analytics.themes.length}</p>
              </div>
              <Target className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">RAG Data</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.hasRAGData ? 'Yes' : 'No'}</p>
              </div>
              <Database className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Characters & Themes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Characters ({analytics.analytics.characters.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.analytics.characters.length > 0 ? (
              <div className="space-y-2">
                {analytics.analytics.characters.slice(0, 8).map((character, index) => (
                  <div key={character} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{character}</span>
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                ))}
                {analytics.analytics.characters.length > 8 && (
                  <p className="text-xs text-gray-500 mt-2">
                    +{analytics.analytics.characters.length - 8} more characters
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">No characters detected yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-orange-600" />
              <span>Themes ({analytics.analytics.themes.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.analytics.themes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {analytics.analytics.themes.map((theme) => (
                  <Badge key={theme} variant="outline" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">No themes detected yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Emotions & Plot Elements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-purple-600" />
              <span>Emotions ({analytics.analytics.emotions.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.analytics.emotions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {analytics.analytics.emotions.map((emotion) => (
                  <Badge key={emotion} variant="secondary" className="text-xs">
                    {emotion}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Activity className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">No emotions detected yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              <span>Plot Elements ({analytics.analytics.plotElements.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.analytics.plotElements.length > 0 ? (
              <div className="space-y-1">
                {analytics.analytics.plotElements.slice(0, 6).map((element) => (
                  <div key={element} className="text-sm text-gray-700">
                    • {element}
                  </div>
                ))}
                {analytics.analytics.plotElements.length > 6 && (
                  <p className="text-xs text-gray-500 mt-2">
                    +{analytics.analytics.plotElements.length - 6} more elements
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">No plot elements detected yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Writing Style & Context */}
      {analytics.context && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-indigo-600" />
              <span>Writing Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Writing Style</h4>
                <Badge variant="outline" className="text-sm">
                  {analytics.context.writingStyle || 'Not analyzed'}
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tone Analysis</h4>
                <Badge variant="outline" className="text-sm">
                  {analytics.context.toneAnalysis || 'Not analyzed'}
                </Badge>
              </div>
            </div>
            
            {analytics.context.settings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Settings</h4>
                <div className="flex flex-wrap gap-1">
                  {analytics.context.settings.map((setting) => (
                    <Badge key={setting} variant="secondary" className="text-xs">
                      {setting}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Project Metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Hash className="h-5 w-5 text-gray-600" />
            <span>Project Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-600">Format</p>
              <p className="text-sm text-gray-900">{analytics.basic.format}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Type</p>
              <p className="text-sm text-gray-900">{analytics.basic.type}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Content Length</p>
              <p className="text-sm text-gray-900">{analytics.basic.contentLength} chars</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-600">Last Updated</p>
              <p className="text-sm text-gray-900">
                {new Date(analytics.basic.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {analytics.hasRAGData && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-gray-600 mb-2">RAG Analytics</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Documents:</span> {analytics.analytics.totalDocuments}
                </div>
                <div>
                  <span className="text-gray-600">Word Count:</span> {analytics.analytics.totalWordCount}
                </div>
              </div>
            </div>
          )}
          
          {analytics.analytics.semanticTags.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-gray-600 mb-2">Semantic Tags</p>
              <div className="flex flex-wrap gap-1">
                {analytics.analytics.semanticTags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
