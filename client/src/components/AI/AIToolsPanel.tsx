import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { useProjectStore } from '../../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Icon, LoadingIcon } from '../ui/icon';
import { AILoadingState } from '../ui/performance-monitor';

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
    clearThemeAnalysis,
    clearForeshadowing,
    clearMotivationStakes,
    clearError,
    resetLoadingState
  } = useAIStore();

  const { activeProject } = useProjectStore();

  const [themeInput, setThemeInput] = useState('');
  const [characterInput, setCharacterInput] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');

  const handleGenerateSuggestions = async () => {
    if (!activeProject?.content || activeProject.content.length < 50) {
      alert('Please write at least a few sentences before generating suggestions.');
      return;
    }
    try {
      // Use actual project content for better suggestions
      const context = `Project: ${activeProject.title}\n\nContent: ${activeProject.content.slice(-500)}`; // Last 500 chars for context
      console.log(`🎯 Generating suggestions in ${analysisMode} mode`);
      await generateSuggestions(projectId, context, analysisMode);
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
      console.log(`🎯 Analyzing theme consistency in ${analysisMode} mode`);
      await analyzeThemeConsistency(activeProject.content, themeInput, projectId, analysisMode);
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
      console.log(`🔮 Checking foreshadowing in ${analysisMode} mode`);
      await checkForeshadowing(activeProject.content, 'Check for foreshadowing opportunities', projectId, analysisMode);
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
      console.log(`🎭 Evaluating motivation and stakes in ${analysisMode} mode`);
      await evaluateMotivationAndStakes(activeProject.content, characterInput, projectId, analysisMode);
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
    <>
      {/* Performance Monitors for different operations */}
      <AILoadingState operation="suggestions" isActive={aiLoading} />
      
      <div className="space-y-4 animate-fade-in p-4">
      
      {/* Analysis Mode Selector */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Icon name="settings" variant="primary" size="sm" />
              <span>Analysis Mode</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setAnalysisMode('fast')}
                variant={analysisMode === 'fast' ? 'default' : 'outline'}
                size="sm"
                className={`flex items-center space-x-1.5 px-3 transition-all duration-200 ${
                  analysisMode === 'fast' 
                    ? 'bg-green-500 text-white border-green-600 shadow-md' 
                    : 'hover:border-green-400 hover:text-green-700'
                }`}
              >
                <Icon name="zap" size="xs" />
                <span>Fast</span>
              </Button>
              <Button
                onClick={() => setAnalysisMode('deep')}
                variant={analysisMode === 'deep' ? 'default' : 'outline'}
                size="sm"
                className={`flex items-center space-x-1.5 px-3 transition-all duration-200 ${
                  analysisMode === 'deep' 
                    ? 'bg-purple-500 text-white border-purple-600 shadow-md' 
                    : 'hover:border-purple-400 hover:text-purple-700'
                }`}
              >
                <Icon name="brain" size="xs" />
                <span>Deep</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              {analysisMode === 'fast' ? (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-700 font-medium">Fast Mode: Text-based analysis, quick results</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="text-purple-700 font-medium">Deep Mode: Embedding-based analysis, comprehensive insights</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {aiError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start space-x-2 animate-slide-up">
          <Icon name="alert-circle" variant="danger" size="sm" className="mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive/80 leading-relaxed">{aiError}</p>
            <Button variant="outline" size="sm" className="mt-2 h-7 px-2 text-xs hover:bg-destructive hover:text-destructive-foreground" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-muted/30 p-1 rounded-lg h-9">
          <TabsTrigger value="suggestions" className="flex items-center space-x-1.5 font-medium transition-all duration-200 text-xs">
            <Icon name="lightbulb" size="xs" />
            <span className="hidden sm:inline">Suggestions</span>
            <span className="sm:hidden">Sug</span>
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex items-center space-x-1.5 font-medium transition-all duration-200 text-xs">
            <Icon name="target" size="xs" />
            <span>Theme</span>
          </TabsTrigger>
          <TabsTrigger value="foreshadowing" className="flex items-center space-x-1.5 font-medium transition-all duration-200 text-xs">
            <Icon name="eye" size="xs" />
            <span className="hidden sm:inline">Foreshadowing</span>
            <span className="sm:hidden">Fore</span>
          </TabsTrigger>
          <TabsTrigger value="character" className="flex items-center space-x-1.5 font-medium transition-all duration-200 text-xs">
            <Icon name="users" size="xs" />
            <span className="hidden sm:inline">Character</span>
            <span className="sm:hidden">Char</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="animate-fade-in">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-base">
                  <Icon name="sparkles" variant="primary" size="sm" />
                  <span>AI Suggestions</span>
                  {suggestions.length > 0 && (
                    <Badge variant="secondary" className="bg-primary-solid/10 text-primary-solid border-primary-solid/20 text-xs">
                      {suggestions.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  onClick={handleGenerateSuggestions}
                  disabled={aiLoading}
                  variant="gradient"
                  size="default"
                  className={`flex items-center space-x-2 px-6 py-3 animate-pulse-on-hover relative overflow-hidden text-white font-bold shadow-lg hover:shadow-xl border-2 transition-all duration-300 ${
                    analysisMode === 'fast' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-green-400 hover:border-green-300'
                      : 'bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 border-purple-400 hover:border-purple-300'
                  }`}
                >
                  {aiLoading && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_100%] animate-gradient-x"></div>
                  )}
                  <div className="relative z-10 flex items-center space-x-1.5">
                    {aiLoading ? (
                      <LoadingIcon size="xs" className="text-white animate-spin" />
                    ) : (
                      <Icon name="sparkles" size="xs" className="text-white" />
                    )}
                    <span className="text-sm font-bold">
                      {aiLoading ? `Generating AI Suggestions (${analysisMode})...` : `Get AI Suggestions (${analysisMode.toUpperCase()})`}
                    </span>
                  </div>
                </Button>
                {/* Debug: Reset button if stuck */}
                {aiLoading && (
                  <Button
                    onClick={resetLoadingState}
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 ml-2"
                    title="Reset if stuck"
                  >
                    <Icon name="refresh-cw" size="xs" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
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
                  <div className="p-4 bg-muted/20 rounded-full w-fit mx-auto mb-4">
                    <Icon name="lightbulb" size="xl" variant="muted" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No suggestions yet</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed max-w-sm mx-auto">
                    Get AI-powered writing suggestions tailored to your project
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="theme" className="animate-fade-in">
          <Card className="gradient-card shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Icon name="target" variant="success" />
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
                    variant="success"
                    className={`flex items-center space-x-2 transition-all duration-300 ${
                      analysisMode === 'deep' ? 'bg-purple-500 hover:bg-purple-600 border-purple-600' : ''
                    }`}
                  >
                    {aiLoading ? <LoadingIcon /> : <Icon name="target" />}
                    <span>{aiLoading ? `Analyzing (${analysisMode})...` : `Analyze (${analysisMode.toUpperCase()})`}</span>
                  </Button>
                </div>
              </div>

              {themeAnalysis.length > 0 && (
                <div className="mt-6 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Icon name="check-circle" variant="success" />
                      <h3 className="font-semibold text-foreground">Analysis Results</h3>
                    </div>
                    <Button variant="outline" onClick={clearThemeAnalysis} size="sm">
                      Clear
                    </Button>
                  </div>
                  {renderAnalysisResult(themeAnalysis, 'theme')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="foreshadowing" className="animate-fade-in">
          <Card className="gradient-card shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Icon name="eye" className="text-purple-600" />
                  <span>Foreshadowing Analysis</span>
                </CardTitle>
                <Button 
                  onClick={handleForeshadowingCheck}
                  disabled={aiLoading}
                  className={`flex items-center space-x-2 text-white font-bold shadow-lg hover:shadow-xl border-2 px-6 py-2 transition-all duration-300 ${
                    analysisMode === 'fast' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 border-green-300 hover:border-green-200'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-purple-300 hover:border-purple-200'
                  }`}
                >
                  {aiLoading ? (
                    <LoadingIcon className="text-white" />
                  ) : (
                    <Icon name="eye" className="text-white" />
                  )}
                  <span>{aiLoading ? `Analyzing (${analysisMode})...` : `Analyze (${analysisMode.toUpperCase()})`}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {foreshadowing.length > 0 ? (
                <div className="space-y-4 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Icon name="info" variant="primary" />
                      <h3 className="font-semibold text-foreground">Foreshadowing Opportunities</h3>
                    </div>
                    <Button variant="outline" onClick={clearForeshadowing} size="sm">
                      Clear
                    </Button>
                  </div>
                  {renderAnalysisResult(foreshadowing, 'foreshadowing')}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-4 bg-purple-50 rounded-full w-fit mx-auto mb-4">
                    <Icon name="eye" size="xl" className="text-purple-400" />
                  </div>
                  <p className="text-muted-foreground">Click "Analyze" to check for foreshadowing opportunities</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="character" className="animate-fade-in">
          <Card className="gradient-card shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Icon name="users" variant="warning" />
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
                    variant="warning"
                    className={`flex items-center space-x-2 transition-all duration-300 ${
                      analysisMode === 'deep' ? 'bg-purple-500 hover:bg-purple-600 border-purple-600' : ''
                    }`}
                  >
                    {aiLoading ? <LoadingIcon /> : <Icon name="users" />}
                    <span>{aiLoading ? `Analyzing (${analysisMode})...` : `Analyze (${analysisMode.toUpperCase()})`}</span>
                  </Button>
                </div>
              </div>

              {motivationStakes.length > 0 && (
                <div className="mt-6 animate-slide-up">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Icon name="check-circle" variant="success" />
                      <h3 className="font-semibold text-foreground">Character Analysis</h3>
                    </div>
                    <Button variant="outline" onClick={clearMotivationStakes} size="sm">
                      Clear
                    </Button>
                  </div>
                  {renderAnalysisResult(motivationStakes, 'character')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
};
