import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  BookOpen,
  FileText,
  Film,
  BarChart3,
  Users,
  Target,
  Clock,
  Lightbulb,
  Eye,
  RefreshCw,
  Layers,
  ChevronRight,
  ChevronDown,
  Zap,
  Sparkles
} from 'lucide-react';
import apiService from '../../services/api';

interface ChapterBreakdown {
  chapterNumber: number;
  title: string;
  startPosition?: number;
  endPosition?: number;
  content?: string;
  themes: string[];
  characters: string[];
  plotPoints: string[];
  wordCount: number;
  summary: string;
  scenes: SceneBreakdown[];
}

interface SceneBreakdown {
  sceneNumber: number;
  title: string;
  summary: string;
  characters: string[];
  setting?: string;
  purpose?: string;
  wordCount: number;
}

interface StructureAnalysis {
  totalWordCount: number;
  suggestedChapterCount: number;
  suggestedSceneCount: number;
  chapters: ChapterBreakdown[];
  overallThemes: string[];
  mainCharacters: string[];
  narrativeStructure: string;
  pacing: string;
  recommendations: string[];
}

interface StructureAnalysisPanelProps {
  projectId: string;
}

export const StructureAnalysisPanel: React.FC<StructureAnalysisPanelProps> = ({ projectId }) => {
  const { activeProject } = useProjectStore();
  const [structureAnalysis, setStructureAnalysis] = useState<StructureAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [analysisType, setAnalysisType] = useState<'none' | 'summary' | 'quick' | 'full'>('none');

  // Load existing structure summary on component mount
  useEffect(() => {
    const loadStructureSummary = async () => {
      if (!projectId || !activeProject) return;
      
      try {
        console.log('📄 Loading structure summary for project:', projectId);
        const response = await apiService.getStructureSummary(projectId);
        
        // Convert summary to basic structure analysis format
        const basicAnalysis: StructureAnalysis = {
          totalWordCount: response.summary.wordCount || 0,
          suggestedChapterCount: response.summary.suggestedChapters || 0,
          suggestedSceneCount: response.summary.estimatedScenes || 0,
          chapters: [], // Summary doesn't include detailed chapters
          overallThemes: response.summary.themes || [],
          mainCharacters: response.summary.characters || [],
          narrativeStructure: response.summary.genre || 'Unknown structure',
          pacing: 'Analysis needed',
          recommendations: response.summary.recommendations || []
        };
        
        setStructureAnalysis(basicAnalysis);
        setAnalysisType('summary');
        console.log('✅ Structure summary loaded');
      } catch (error) {
        console.log('📄 No existing structure summary found, ready for analysis');
        // Don't show error for missing summary - it's expected for new projects
      }
    };
    
    loadStructureSummary();
  }, [projectId, activeProject]);

  const runStructureAnalysis = async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Running structure analysis for project:', projectId);
      const response = await apiService.analyzeProjectStructure(projectId);
      
      console.log('📊 Received structure analysis:', response);
      // The backend returns { message, analysis }
      setStructureAnalysis(response.analysis);
      setAnalysisType('full');
      setActiveTab('overview');
      
    } catch (err: any) {
      console.error('❌ Structure analysis failed:', err);
      setError(err.message || 'Failed to analyze project structure');
    } finally {
      setLoading(false);
    }
  };

  const getQuickSuggestions = async () => {
    if (!activeProject?.content) return;
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('🟡 Getting quick chapter suggestions...');
      const response = await apiService.getChapterSuggestions(activeProject.content);
      
      console.log('📊 Received quick suggestions:', response);
      // Map the quick suggestions response to structure analysis format
      const quickAnalysis: StructureAnalysis = {
        totalWordCount: response.contentWordCount,
        suggestedChapterCount: response.suggestedChapters,
        suggestedSceneCount: response.estimatedBreaks?.length || 0,
        chapters: [], // Quick suggestions don't include detailed chapters
        overallThemes: [], // Quick suggestions don't include themes
        mainCharacters: [], // Quick suggestions don't include characters
        narrativeStructure: 'Structure analysis needed',
        pacing: 'Analysis needed',
        recommendations: response.suggestions
      };
      
      setStructureAnalysis(quickAnalysis);
      setAnalysisType('quick');
      setActiveTab('recommendations');
      
    } catch (err: any) {
      console.error('❌ Quick suggestions failed:', err);
      setError(err.message || 'Failed to get chapter suggestions');
    } finally {
      setLoading(false);
    }
  };

  const toggleChapterExpansion = (chapterNumber: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterNumber)) {
      newExpanded.delete(chapterNumber);
    } else {
      newExpanded.add(chapterNumber);
    }
    setExpandedChapters(newExpanded);
  };

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No project selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center space-x-2">
          <Layers className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Structure Analysis</h2>
          {analysisType !== 'none' && (
            <Badge 
              variant={analysisType === 'full' ? 'default' : 'secondary'} 
              className="text-xs"
            >
              {
                analysisType === 'full' ? 'Full Analysis' :
                analysisType === 'quick' ? 'Quick Suggestions' :
                analysisType === 'summary' ? 'Basic Info' : ''
              }
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={getQuickSuggestions} 
            variant="outline" 
            size="sm"
            disabled={loading || !activeProject.content}
          >
            <Zap className="w-4 h-4 mr-2" />
            Quick Suggestions
          </Button>
          <Button 
            onClick={runStructureAnalysis} 
            disabled={loading || !activeProject.content}
            size="sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Full Analysis
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-gray-600">
                {activeTab === 'recommendations' ? 'Getting quick suggestions...' : 'Analyzing project structure...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-6">
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-red-500 mb-2">❌</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Error</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <Button onClick={runStructureAnalysis} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {!loading && !error && !structureAnalysis && activeProject?.content && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Analyze</h3>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <strong>Current project:</strong> {activeProject.title}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Word count:</strong> {activeProject.content.split(/\s+/).length.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  <strong>Estimated chapters:</strong> {Math.max(3, Math.floor(activeProject.content.split(/\s+/).length / 2500))}
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Get AI-powered insights into your story's structure, including chapter divisions, 
                scene breakdowns, and narrative flow recommendations.
              </p>
              <div className="space-y-2">
                <Button onClick={runStructureAnalysis} className="w-full">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run Full Structure Analysis
                </Button>
                <Button onClick={getQuickSuggestions} variant="outline" className="w-full">
                  <Zap className="w-4 h-4 mr-2" />
                  Get Quick Chapter Suggestions
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {!loading && !error && !structureAnalysis && !activeProject?.content && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Content Available</h3>
              <p className="text-gray-600 mb-6">
                This project doesn't have any content yet. Add some content to your project 
                to enable structure analysis.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && structureAnalysis && (
          <div className="h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mx-4 mt-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="chapters">Chapters</TabsTrigger>
                <TabsTrigger value="themes">Themes</TabsTrigger>
                <TabsTrigger value="recommendations">Tips</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Word Count</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {structureAnalysis.totalWordCount.toLocaleString()}
                            </p>
                          </div>
                          <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Chapters</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {structureAnalysis.suggestedChapterCount}
                            </p>
                          </div>
                          <BookOpen className="w-8 h-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Scenes</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {structureAnalysis.suggestedSceneCount}
                            </p>
                          </div>
                          <Film className="w-8 h-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">Reading Time</p>
                            <p className="text-2xl font-bold text-gray-900">
                              {Math.ceil(structureAnalysis.totalWordCount / 200)}m
                            </p>
                          </div>
                          <Clock className="w-8 h-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Structure Overview */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <BarChart3 className="h-5 w-5" />
                        <span>Narrative Structure</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Structure Type</p>
                          <Badge variant="outline" className="text-sm">
                            {structureAnalysis.narrativeStructure}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Pacing</p>
                          <Badge variant="outline" className="text-sm">
                            {structureAnalysis.pacing}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Characters & Themes Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span>Main Characters ({structureAnalysis.mainCharacters.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {structureAnalysis.mainCharacters.length > 0 ? (
                          <div className="space-y-2">
                            {structureAnalysis.mainCharacters.slice(0, 6).map((character, index) => (
                              <div key={character} className="flex items-center justify-between">
                                <span className="text-sm text-gray-700">{character}</span>
                                <Badge variant="secondary" className="text-xs">
                                  #{index + 1}
                                </Badge>
                              </div>
                            ))}
                            {structureAnalysis.mainCharacters.length > 6 && (
                              <p className="text-xs text-gray-500">
                                +{structureAnalysis.mainCharacters.length - 6} more
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600">No characters identified yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Target className="h-5 w-5 text-orange-600" />
                          <span>Themes ({structureAnalysis.overallThemes.length})</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {structureAnalysis.overallThemes.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {structureAnalysis.overallThemes.map((theme) => (
                              <Badge key={theme} variant="outline" className="text-xs">
                                {theme}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm text-gray-600">No themes identified yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Chapters Tab */}
                <TabsContent value="chapters" className="space-y-4">
                  {structureAnalysis.chapters.length > 0 ? (
                    <div className="space-y-4">
                      {structureAnalysis.chapters.map((chapter) => (
                        <Card key={chapter.chapterNumber}>
                          <CardHeader 
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => toggleChapterExpansion(chapter.chapterNumber)}
                          >
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center space-x-2">
                                <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                                  Ch. {chapter.chapterNumber}
                                </span>
                                <span>{chapter.title}</span>
                              </CardTitle>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-xs">
                                  {chapter.wordCount} words
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {chapter.scenes.length} scenes
                                </Badge>
                                {expandedChapters.has(chapter.chapterNumber) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          {expandedChapters.has(chapter.chapterNumber) && (
                            <CardContent className="space-y-4">
                              {/* Chapter Summary */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-700 mb-2">Summary</h4>
                                <p className="text-sm text-gray-600">{chapter.summary}</p>
                              </div>

                              {/* Chapter Details */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Characters</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {chapter.characters.map((character) => (
                                      <Badge key={character} variant="secondary" className="text-xs">
                                        {character}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Themes</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {chapter.themes.map((theme) => (
                                      <Badge key={theme} variant="outline" className="text-xs">
                                        {theme}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">Plot Points</h4>
                                  <div className="space-y-1">
                                    {chapter.plotPoints.map((point, index) => (
                                      <p key={index} className="text-xs text-gray-600">• {point}</p>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Scenes */}
                              {chapter.scenes.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                                    Scenes ({chapter.scenes.length})
                                  </h4>
                                  <div className="grid gap-2">
                                    {chapter.scenes.map((scene) => (
                                      <div key={scene.sceneNumber} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <h5 className="text-sm font-medium">
                                            Scene {scene.sceneNumber}: {scene.title}
                                          </h5>
                                          <Badge variant="outline" className="text-xs">
                                            {scene.wordCount} words
                                          </Badge>
                                        </div>
                                        <div className="space-y-2">
                                          <p className="text-xs text-gray-600">{scene.summary}</p>
                                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                            {scene.setting && (
                                              <div>
                                                <span className="font-medium">Setting:</span> {scene.setting}
                                              </div>
                                            )}
                                            {scene.purpose && (
                                              <div>
                                                <span className="font-medium">Purpose:</span> {scene.purpose}
                                              </div>
                                            )}
                                            {scene.characters.length > 0 && (
                                              <div className="col-span-2">
                                                <span className="font-medium">Characters:</span> {scene.characters.join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        {analysisType === 'summary' ? 'Basic project info loaded' :
                         analysisType === 'quick' ? 'Quick suggestions available' :
                         'No chapter analysis available'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {analysisType === 'none' ? 'Run a full structure analysis to see detailed chapters' :
                         'Run a full structure analysis to see detailed chapter breakdowns'}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Themes Tab */}
                <TabsContent value="themes" className="space-y-4">
                  {structureAnalysis.overallThemes.length > 0 ? (
                    <div className="grid gap-4">
                      {structureAnalysis.overallThemes.map((theme) => (
                        <Card key={theme}>
                          <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500" />
                              <span className="capitalize">{theme}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {/* Show chapters where this theme appears */}
                            <div className="space-y-3">
                              {structureAnalysis.chapters.length > 0 ? (
                                <>
                                  <p className="text-sm text-gray-600">
                                    This theme appears in {structureAnalysis.chapters.filter(ch => ch.themes.some(t => t.toLowerCase().includes(theme.toLowerCase()))).length} chapter(s)
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {structureAnalysis.chapters
                                      .filter(ch => ch.themes.some(t => t.toLowerCase().includes(theme.toLowerCase())))
                                      .map(ch => (
                                        <Badge key={ch.chapterNumber} variant="outline" className="text-xs">
                                          Chapter {ch.chapterNumber}: {ch.title}
                                        </Badge>
                                      ))}
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-gray-600">
                                  This theme was identified in your overall narrative structure.
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">
                        {analysisType === 'summary' ? 'Basic themes from project context' :
                         analysisType === 'quick' ? 'Themes not available in quick mode' :
                         'No thematic analysis available'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {analysisType === 'quick' ? 'Run a full structure analysis to identify detailed themes' :
                         'Run a full structure analysis to identify themes'}
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Recommendations Tab */}
                <TabsContent value="recommendations" className="space-y-4">
                  {structureAnalysis.recommendations.length > 0 ? (
                    <div className="space-y-4">
                      {structureAnalysis.recommendations.map((recommendation, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold text-white">{index + 1}</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-700">{recommendation}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No recommendations available</p>
                      <p className="text-sm text-gray-500">Run an analysis to get personalized recommendations</p>
                    </div>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
};
