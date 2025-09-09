import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { 
  Lightbulb, 
  Target, 
  Eye, 
  Users, 
  RefreshCw, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';

interface AIToolsPanelProps {
  projectId: string;
}

export const AIToolsPanel: React.FC<AIToolsPanelProps> = ({ projectId }) => {
  const {
    suggestions,
    themeAnalysis,
    foreshadowing,
    motivationStakes,
    loading: aiLoading,
    error: aiError,
    generateSuggestions,
    analyzeThemeConsistency,
    checkForeshadowing,
    evaluateMotivationAndStakes,
    clearSuggestions,
    clearError
  } = useAIStore();

  const [themeInput, setThemeInput] = useState('');
  const [characterInput, setCharacterInput] = useState('');

  const handleGenerateSuggestions = async () => {
    try {
      await generateSuggestions(projectId, 'Generate writing suggestions for this project');
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    }
  };

  const handleThemeAnalysis = async () => {
    if (!themeInput.trim()) {
      alert('Please enter a theme to analyze');
      return;
    }
    try {
      await analyzeThemeConsistency(themeInput, projectId);
    } catch (error) {
      console.error('Failed to analyze theme:', error);
    }
  };

  const handleForeshadowingCheck = async () => {
    try {
      await checkForeshadowing(projectId, 'Check for foreshadowing opportunities');
    } catch (error) {
      console.error('Failed to check foreshadowing:', error);
    }
  };

  const handleMotivationStakes = async () => {
    if (!characterInput.trim()) {
      alert('Please enter a character name');
      return;
    }
    try {
      await evaluateMotivationAndStakes(characterInput, projectId);
    } catch (error) {
      console.error('Failed to evaluate motivation and stakes:', error);
    }
  };

  const renderAnalysisResult = (content: string[] | string | null, type: string) => {
    if (!content) return null;

    const contentArray = Array.isArray(content) ? content : [content];
    
    return (
      <div className="space-y-4">
        {contentArray.map((item, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-lg border">
            <div className="prose prose-sm max-w-none">
              {item.split('\n').map((line, lineIndex) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return (
                    <h4 key={lineIndex} className="font-semibold text-blue-800 border-b border-blue-200 pb-1 mb-2">
                      {line.replace(/\*\*/g, '')}
                    </h4>
                  );
                } else if (line.match(/^\d+\./)) {
                  return (
                    <div key={lineIndex} className="ml-2 flex">
                      <span className="font-medium text-blue-600 mr-2">
                        {line.match(/^\d+\./)![0]}
                      </span>
                      <span>{line.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  );
                } else if (line.startsWith('- ')) {
                  return (
                    <div key={lineIndex} className="ml-4 flex">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>{line.replace(/^-\s*/, '')}</span>
                    </div>
                  );
                } else if (line.trim()) {
                  return (
                    <p key={lineIndex} className="text-gray-700 leading-relaxed">
                      {line}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-800">Error</h4>
            <p className="text-sm text-red-700 mt-1">{aiError}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="suggestions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="suggestions" className="flex items-center space-x-2">
            <Lightbulb className="h-4 w-4" />
            <span>Suggestions</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex items-center space-x-2">
            <Target className="h-4 w-4" />
            <span>Theme</span>
          </TabsTrigger>
          <TabsTrigger value="foreshadowing" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Foreshadowing</span>
          </TabsTrigger>
          <TabsTrigger value="character" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Character</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  <span>AI Writing Suggestions</span>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {suggestions.length > 0 && (
                    <Badge variant="secondary">{suggestions.length} suggestions</Badge>
                  )}
                  <Button
                    onClick={handleGenerateSuggestions}
                    disabled={aiLoading}
                    className="flex items-center space-x-2"
                  >
                    {aiLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span>{aiLoading ? 'Generating...' : 'Generate'}</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {suggestions.length > 0 ? (
                <div className="space-y-4">
                  {renderAnalysisResult(suggestions, 'suggestions')}
                  <div className="flex justify-between items-center pt-4 border-t">
                    <Button variant="outline" onClick={clearSuggestions} size="sm">
                      Clear All
                    </Button>
                    <p className="text-xs text-gray-500">
                      Generated {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                  <p className="text-gray-500 mb-4">
                    Get AI-powered writing suggestions tailored to your project
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-600" />
                <span>Theme Consistency Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme-input">Theme to Analyze</Label>
                <div className="flex space-x-2">
                  <Input
                    id="theme-input"
                    value={themeInput}
                    onChange={(e) => setThemeInput(e.target.value)}
                    placeholder="e.g., love, betrayal, redemption, coming-of-age"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleThemeAnalysis}
                    disabled={aiLoading || !themeInput.trim()}
                  >
                    {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Analyze'}
                  </Button>
                </div>
              </div>

              {themeAnalysis.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium">Analysis Results</h3>
                  </div>
                  {renderAnalysisResult(themeAnalysis, 'theme')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="foreshadowing">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-purple-600" />
                  <span>Foreshadowing Analysis</span>
                </CardTitle>
                <Button 
                  onClick={handleForeshadowingCheck}
                  disabled={aiLoading}
                  className="flex items-center space-x-2"
                >
                  {aiLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span>Analyze</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {foreshadowing.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Info className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium">Foreshadowing Opportunities</h3>
                  </div>
                  {renderAnalysisResult(foreshadowing, 'foreshadowing')}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Click "Analyze" to check for foreshadowing opportunities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="character">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-orange-600" />
                <span>Character Development Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="character-input">Character Name</Label>
                <div className="flex space-x-2">
                  <Input
                    id="character-input"
                    value={characterInput}
                    onChange={(e) => setCharacterInput(e.target.value)}
                    placeholder="e.g., Alice, John, Sarah, protagonist"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleMotivationStakes}
                    disabled={aiLoading || !characterInput.trim()}
                  >
                    {aiLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Analyze'}
                  </Button>
                </div>
              </div>

              {motivationStakes.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium">Character Analysis</h3>
                  </div>
                  {renderAnalysisResult(motivationStakes, 'character')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
