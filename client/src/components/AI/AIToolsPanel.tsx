import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useProjectStore } from '../../store/useProjectStore';
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

  const { activeProject } = useProjectStore();

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
    if (!activeProject?.content) {
      alert('No project content found to analyze');
      return;
    }
    try {
      await analyzeThemeConsistency(activeProject.content, themeInput, projectId);
    } catch (error) {
      console.error('Failed to analyze theme:', error);
    }
  };

  const handleForeshadowingCheck = async () => {
    if (!activeProject?.content) {
      alert('No project content found to analyze');
      return;
    }
    try {
      await checkForeshadowing(activeProject.content, 'Check for foreshadowing opportunities', projectId);
    } catch (error) {
      console.error('Failed to check foreshadowing:', error);
    }
  };

  const handleMotivationStakes = async () => {
    if (!characterInput.trim()) {
      alert('Please enter a character name');
      return;
    }
    if (!activeProject?.content) {
      alert('No project content found to analyze');
      return;
    }
    try {
      await evaluateMotivationAndStakes(activeProject.content, characterInput, projectId);
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
          <div key={index} className={`bg-white border rounded-lg shadow-sm overflow-hidden ${
            type === 'foreshadowing' ? 'border-purple-200' :
            type === 'theme' ? 'border-green-200' :
            type === 'character' ? 'border-orange-200' :
            'border-gray-200'
          }`}>
            <div className="p-6">
              {renderFormattedContent(item, type)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFormattedContent = (content: string, type: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;

      // Main section headers with emojis (## 📊 TITLE or just ## TITLE)
      if (trimmedLine.match(/^##\s+/)) {
        const color = type === 'foreshadowing' ? 'border-purple-500 text-purple-900' :
                     type === 'theme' ? 'border-green-500 text-green-900' :
                     type === 'character' ? 'border-orange-500 text-orange-900' :
                     'border-indigo-500 text-gray-900';
        
        elements.push(
          <div key={i} className="mb-6 mt-8 first:mt-0">
            <h2 className={`text-xl font-bold border-b-2 pb-2 mb-4 ${color}`}>
              {trimmedLine.replace(/^##\s+/, '')}
            </h2>
          </div>
        );
        continue;
      }

      // Sub-section headers (**TITLE**: or **TITLE**)
      if (trimmedLine.match(/^\*\*[^*]+\*\*:?\s*$/) || trimmedLine.match(/^\*\*[A-Z][^*]*\*\*$/)) {
        const color = type === 'foreshadowing' ? 'text-purple-700' :
                     type === 'theme' ? 'text-green-700' :
                     type === 'character' ? 'text-orange-700' :
                     'text-indigo-700';
        
        elements.push(
          <h3 key={i} className={`text-lg font-semibold text-gray-800 mt-6 mb-3 ${color}`}>
            {trimmedLine.replace(/\*\*/g, '').replace(/:$/, '')}
          </h3>
        );
        continue;
      }

      // Score lines (Score: [1-10])
      if (trimmedLine.match(/^\*\*Score:\s*\[\d+-\d+\]\*\*/)) {
        elements.push(
          <div key={i} className="bg-blue-50 border-l-4 border-blue-400 p-4 my-4">
            <div className="flex items-center">
              <div className="text-lg font-bold text-blue-700">
                {trimmedLine.replace(/\*\*/g, '')}
              </div>
            </div>
          </div>
        );
        continue;
      }

      // Bullet points (- item)
      if (trimmedLine.match(/^-\s+/)) {
        const bulletText = trimmedLine.replace(/^-\s+/, '');
        elements.push(
          <div key={i} className="flex items-start mb-2 ml-4">
            <div className="w-2 h-2 bg-indigo-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
            <div className="text-gray-700 leading-relaxed">
              {renderInlineFormatting(bulletText)}
            </div>
          </div>
        );
        continue;
      }

      // Numbered lists (1. item)
      if (trimmedLine.match(/^\d+\.\s+/)) {
        const numberMatch = trimmedLine.match(/^(\d+\.)\s+(.*)/);
        if (numberMatch) {
          elements.push(
            <div key={i} className="flex items-start mb-2">
              <span className="font-semibold text-indigo-600 mr-3 mt-0.5">
                {numberMatch[1]}
              </span>
              <div className="text-gray-700 leading-relaxed flex-1">
                {renderInlineFormatting(numberMatch[2])}
              </div>
            </div>
          );
        }
        continue;
      }

      // Handle special analysis patterns
      if (trimmedLine.includes('**') && !trimmedLine.match(/^\*\*[^*]+\*\*:?\s*$/)) {
        // Lines with mixed bold content
        elements.push(
          <div key={i} className="text-gray-700 leading-relaxed mb-3 bg-gray-50 p-3 rounded">
            {renderInlineFormatting(trimmedLine)}
          </div>
        );
        continue;
      }

      // Regular paragraphs
      elements.push(
        <p key={i} className="text-gray-700 leading-relaxed mb-3">
          {renderInlineFormatting(trimmedLine)}
        </p>
      );
    }

    return <div className="space-y-2">{elements}</div>;
  };

  const renderInlineFormatting = (text: string) => {
    // Handle bold text **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.match(/^\*\*[^*]+\*\*$/)) {
            return (
              <strong key={index} className="font-semibold text-gray-900">
                {part.replace(/\*\*/g, '')}
              </strong>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
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
