import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  BarChart3, 
  Target,
  FileText,
  Users,
  Brain,
  BookOpen,
  Activity,
  RefreshCw,
  Database,
  Eye,
  Hash,
  Layers
} from 'lucide-react';
import { StructureAnalysisPanel } from './StructureAnalysisPanel';

interface AnalyticsPanelProps {
  projectId: string;
}

interface ProjectAnalytics {
  message: string;
  analysisMode: 'fast' | 'deep';
  summary?: {
    projectId: string;
    title: string;
    wordCount: number;
    lastAnalyzed: string;
    estimatedReadingTime: number;
    estimatedScenes: number;
    suggestedChapters: number;
    genre: string | null;
    writingStyle: string;
    tone?: string;
    pacing?: string;
    characters: string[];
    themes: string[];
    emotions?: string[];
    plotElements?: string[];
    strengths?: string[];
    suggestions?: string[];
    recommendations: string[];
    analytics?: {
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
    context?: {
      writingStyle: string;
      toneAnalysis: string;
      settings: string[];
      lastContextUpdate: string;
    } | null;
    hasRAGData?: boolean;
  };
  // Legacy support for old format
  basic?: {
    title: string;
    description?: string;
    format: string;
    type: string;
    createdAt: string;
    updatedAt: string;
    contentLength: number;
    wordCount: number;
  };
  analytics?: {
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
  context?: {
    writingStyle: string;
    toneAnalysis: string;
    settings: string[];
    lastContextUpdate: string;
  } | null;
  hasRAGData?: boolean;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ projectId }) => {
  const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');

  const loadAnalytics = async (mode: 'fast' | 'deep' = analysisMode) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`📊 Loading analytics for project: ${projectId} in ${mode} mode`);
      
      const data = await apiService.getProjectAnalytics(projectId, mode);
      console.log('✅ Analytics loaded:', data);
      
      setAnalytics(data);
    } catch (err: any) {
      console.error('❌ Failed to load analytics:', err);
      setError(err.message || 'Failed to load project analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode: 'fast' | 'deep') => {
    setAnalysisMode(mode);
    loadAnalytics(mode);
  };

  const handleRefresh = () => {
    loadAnalytics();
  };

  // Helper functions to safely access data from both new and legacy formats
  const getTitle = () => analytics?.summary?.title || analytics?.basic?.title || 'Unknown Project';
  const getWordCount = () => analytics?.summary?.wordCount || analytics?.basic?.wordCount || 0;
  const getCharacters = () => analytics?.summary?.characters || analytics?.analytics?.characters || [];
  const getThemes = () => analytics?.summary?.themes || analytics?.analytics?.themes || [];
  const getEmotions = () => analytics?.summary?.emotions || analytics?.analytics?.emotions || [];
  const getPlotElements = () => analytics?.summary?.plotElements || analytics?.analytics?.plotElements || [];
  const getRecommendations = () => analytics?.summary?.recommendations || [];
  const getStrengths = () => analytics?.summary?.strengths || [];
  const getSuggestions = () => analytics?.summary?.suggestions || [];
  const getTone = () => analytics?.summary?.tone || 'neutral';
  const getPacing = () => analytics?.summary?.pacing || 'moderate';
  const getType = () => analytics?.basic?.type || analytics?.summary?.genre || 'Unknown';
  const getEstimatedReadingTime = () => analytics?.summary?.estimatedReadingTime || Math.ceil(getWordCount() / 200);
  const getSuggestedChapters = () => analytics?.summary?.suggestedChapters || Math.ceil(getWordCount() / 2500);

  useEffect(() => {
    if (projectId) {
      loadAnalytics();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading analytics...</p>
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
            <Button onClick={handleRefresh} variant="outline">
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Project Analytics</h2>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            {analytics.analysisMode === 'fast' ? '⚡ Fast Mode' : '🔍 Deep Mode'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Mode Toggle */}
          <div className="flex items-center space-x-1 bg-white rounded-md p-1">
            <button
              onClick={() => handleModeChange('fast')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                analysisMode === 'fast'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚡ Fast
            </button>
            <button
              onClick={() => handleModeChange('deep')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                analysisMode === 'deep'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🔍 Deep
            </button>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mx-4 mt-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="structure">
              <Layers className="w-4 h-4 mr-2" />
              Structure
            </TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="overview" className="h-full p-4 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Words</p>
                        <p className="text-2xl font-bold text-gray-900">{getWordCount().toLocaleString()}</p>
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
                        <p className="text-2xl font-bold text-gray-900">{getCharacters().length}</p>
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
                        <p className="text-2xl font-bold text-gray-900">{getThemes().length}</p>
                      </div>
                      <Target className="w-8 h-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Characters Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <span>Characters ({getCharacters().length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getCharacters().length > 0 ? (
                    <div className="space-y-2">
                      {getCharacters().slice(0, 8).map((character, index) => (
                        <div key={character} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">{character}</span>
                          <Badge variant="secondary" className="text-xs">
                            #{index + 1}
                          </Badge>
                        </div>
                      ))}
                      {getCharacters().length > 8 && (
                        <p className="text-xs text-gray-500 mt-2">
                          +{getCharacters().length - 8} more characters
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">No characters detected yet</p>
                      <p className="text-xs text-gray-500">Add more content to see character analysis</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Themes Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    <span>Themes ({getThemes().length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {getThemes().length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getThemes().map((theme) => (
                        <Badge key={theme} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600">No themes detected yet</p>
                      <p className="text-xs text-gray-500">Add more content to see theme analysis</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Emotions Section */}
              {getEmotions().length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Activity className="h-5 w-5 text-red-600" />
                      <span>Emotions ({getEmotions().length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {getEmotions().map((emotion) => (
                        <Badge key={emotion} variant="outline" className="text-xs bg-red-50">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Plot Elements Section */}
              {getPlotElements().length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <BookOpen className="h-5 w-5 text-green-600" />
                      <span>Plot Elements ({getPlotElements().length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getPlotElements().slice(0, 6).map((element) => (
                        <div key={element} className="p-2 bg-green-50 rounded text-sm text-green-800">
                          {element}
                        </div>
                      ))}
                      {getPlotElements().length > 6 && (
                        <p className="text-xs text-gray-500 mt-2">
                          +{getPlotElements().length - 6} more elements
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {getRecommendations().length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {getRecommendations().map((rec, index) => (
                        <li key={index} className="text-sm text-gray-700 flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="structure" className="h-full">
              <StructureAnalysisPanel projectId={projectId} />
            </TabsContent>

            <TabsContent value="insights" className="h-full p-4 space-y-6">
              {/* Project Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Hash className="h-5 w-5 text-gray-600" />
                    <span>Project Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Title:</span>
                      <p className="font-medium">{getTitle()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Reading Time:</span>
                      <p className="font-medium">{getEstimatedReadingTime()} minutes</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Suggested Chapters:</span>
                      <p className="font-medium">{getSuggestedChapters()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Genre:</span>
                      <p className="font-medium">{getType()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Tone:</span>
                      <p className="font-medium">{getTone()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Pacing:</span>
                      <p className="font-medium">{getPacing()}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Writing Style:</span>
                      <p className="font-medium">{analytics?.summary?.writingStyle || 'Not analyzed'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Suggestions */}
              {(getStrengths().length > 0 || getSuggestions().length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getStrengths().length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-green-700">
                          <Activity className="h-5 w-5" />
                          <span>Strengths</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getStrengths().map((strength, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <span className="text-green-500 mr-2">✓</span>
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {getSuggestions().length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2 text-blue-700">
                          <Brain className="h-5 w-5" />
                          <span>Suggestions</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getSuggestions().map((suggestion, index) => (
                            <li key={index} className="text-sm text-gray-700 flex items-start">
                              <span className="text-blue-500 mr-2">💡</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Analytics Data (Deep mode only) */}
              {analytics.summary?.analytics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Database className="h-5 w-5 text-gray-600" />
                      <span>Deep Analysis Data</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Documents:</span> 
                      <span>{analytics.summary.analytics.totalDocuments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Word Count:</span> 
                      <span>{analytics.summary.analytics.totalWordCount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Chunks:</span> 
                      <span>{analytics.summary.analytics.totalChunks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg. Importance:</span> 
                      <span>{analytics.summary.analytics.averageImportance.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};