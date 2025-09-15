import React, { useState, useEffect } from 'react';
import { useChatbotStore } from '../store/useChatbotStore';
import { useProjectStore } from '../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Settings, 
  User, 
  BookOpen, 
  Save,
  RefreshCw,
  Palette,
  Target,
  FileText,
  MessageCircle
} from 'lucide-react';

export const PreferencesPage: React.FC = () => {
  const { 
    preferences, 
    questions,
    loading: chatbotLoading,
    error: chatbotError,
    getUserPreferences,
    updateUserPreferences,
    getWritingFlowQuestions,
    submitWritingFlowAnswers,
    clearError
  } = useChatbotStore();

  const { activeProject } = useProjectStore();

  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [writingFlowAnswers, setWritingFlowAnswers] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    // Load preferences and questions when component mounts
    getUserPreferences();
    getWritingFlowQuestions();
  }, [getUserPreferences, getWritingFlowQuestions]);

  useEffect(() => {
    // Update local preferences when store preferences change
    setLocalPreferences(preferences);
  }, [preferences]);

  const handlePreferenceChange = (key: string, value: string) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value
    }));
    setHasUnsavedChanges(true);
  };

  const handleWritingFlowChange = (question: string, answer: string) => {
    setWritingFlowAnswers(prev => ({
      ...prev,
      [question]: answer
    }));
  };

  const handleSavePreferences = async () => {
    try {
      await updateUserPreferences(localPreferences);
      setHasUnsavedChanges(false);
      alert('Preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save preferences');
    }
  };

  const handleSubmitWritingFlow = async () => {
    try {
      await submitWritingFlowAnswers(writingFlowAnswers);
      setWritingFlowAnswers({});
      alert('Writing flow answers submitted successfully!');
    } catch (error) {
      console.error('Failed to submit writing flow:', error);
      alert('Failed to submit writing flow answers');
    }
  };

  const defaultPreferences = [
    { key: 'writingStyle', label: 'Writing Style', placeholder: 'e.g., Descriptive, Concise, Poetic' },
    { key: 'genre', label: 'Preferred Genre', placeholder: 'e.g., Fantasy, Romance, Thriller' },
    { key: 'toneOfVoice', label: 'Tone of Voice', placeholder: 'e.g., Formal, Casual, Humorous' },
    { key: 'targetAudience', label: 'Target Audience', placeholder: 'e.g., Young Adult, Adult, Children' },
    { key: 'dailyWordGoal', label: 'Daily Word Goal', placeholder: 'e.g., 500, 1000, 2000' },
    { key: 'preferredLength', label: 'Preferred Chapter Length', placeholder: 'e.g., 2000-3000 words' }
  ];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-sm">Preferences</span>
          {activeProject && (
            <span className="text-xs text-gray-500">
              • {activeProject.title.length > 15 ? activeProject.title.slice(0, 15) + '...' : activeProject.title}
            </span>
          )}
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-9">
          <TabsTrigger value="general" className="flex items-center space-x-1.5 text-xs">
            <User className="h-3 w-3" />
            <span className="hidden sm:inline">General</span>
            <span className="sm:hidden">Gen</span>
          </TabsTrigger>
          <TabsTrigger value="writing" className="flex items-center space-x-1.5 text-xs">
            <FileText className="h-3 w-3" />
            <span className="hidden sm:inline">Writing</span>
            <span className="sm:hidden">Write</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center space-x-1.5 text-xs">
            <MessageCircle className="h-3 w-3" />
            <span className="hidden sm:inline">AI</span>
            <span className="sm:hidden">AI</span>
          </TabsTrigger>
        </TabsList>

        {/* General Preferences */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5 text-green-600" />
                <span>Writing Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {defaultPreferences.map((pref) => (
                <div key={pref.key} className="space-y-2">
                  <Label htmlFor={pref.key}>{pref.label}</Label>
                  <Input
                    id={pref.key}
                    value={localPreferences[pref.key] || ''}
                    onChange={(e) => handlePreferenceChange(pref.key, e.target.value)}
                    placeholder={pref.placeholder}
                  />
                </div>
              ))}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setLocalPreferences(preferences);
                    setHasUnsavedChanges(false);
                  }}
                  disabled={!hasUnsavedChanges}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSavePreferences}
                  disabled={!hasUnsavedChanges || chatbotLoading}
                  className="flex items-center space-x-1"
                >
                  {chatbotLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>Save Preferences</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Preferences Display */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-purple-600" />
                <span>Current Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {defaultPreferences.map((pref) => (
                  <div key={pref.key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">{pref.label}:</span>
                    <span className="text-sm text-gray-900">
                      {preferences[pref.key] || 'Not set'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Writing Flow Questions */}
        <TabsContent value="writing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-orange-600" />
                <span>Writing Flow Questions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.length > 0 ? (
                <>
                  {questions.map((question, index) => (
                    <div key={index} className="space-y-2">
                      <Label>{question}</Label>
                      <Input
                        value={writingFlowAnswers[question] || ''}
                        onChange={(e) => handleWritingFlowChange(question, e.target.value)}
                        placeholder="Your answer..."
                      />
                    </div>
                  ))}
                  
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSubmitWritingFlow}
                      disabled={Object.keys(writingFlowAnswers).length === 0 || chatbotLoading}
                      className="flex items-center space-x-1"
                    >
                      {chatbotLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>Submit Answers</span>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No writing flow questions available.</p>
                  <Button
                    variant="outline"
                    onClick={getWritingFlowQuestions}
                    className="mt-4"
                    disabled={chatbotLoading}
                  >
                    {chatbotLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh Questions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <span>AI Assistant Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aiPersonality">AI Personality</Label>
                <Input
                  id="aiPersonality"
                  value={localPreferences['aiPersonality'] || ''}
                  onChange={(e) => handlePreferenceChange('aiPersonality', e.target.value)}
                  placeholder="e.g., Encouraging, Direct, Creative"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="feedbackStyle">Feedback Style</Label>
                <Input
                  id="feedbackStyle"
                  value={localPreferences['feedbackStyle'] || ''}
                  onChange={(e) => handlePreferenceChange('feedbackStyle', e.target.value)}
                  placeholder="e.g., Constructive, Detailed, Brief"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="suggestionFrequency">Suggestion Frequency</Label>
                <Input
                  id="suggestionFrequency"
                  value={localPreferences['suggestionFrequency'] || ''}
                  onChange={(e) => handlePreferenceChange('suggestionFrequency', e.target.value)}
                  placeholder="e.g., High, Medium, Low"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {chatbotError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{chatbotError}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearError}
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
