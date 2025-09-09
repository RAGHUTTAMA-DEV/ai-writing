import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useAIStore } from '../../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  FileText, 
  Save, 
  RotateCcw, 
  RotateCw, 
  Type, 
  Eye,
  EyeOff,
  Maximize,
  Minimize,
  RefreshCw,
  Sparkles,
  Settings,
  Download,
  Upload,
  WordCount,
  Clock,
  Target
} from 'lucide-react';

interface EditorPanelProps {
  projectId: string;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ projectId }) => {
  const {
    content,
    setContent,
    selectedText,
    setSelectedText,
    wordCount,
    characterCount,
    lastSaved,
    isDirty,
    saveContent,
    autoSaveEnabled,
    setAutoSaveEnabled
  } = useEditorStore();

  const {
    suggestions,
    loading: aiLoading,
    generateSuggestions
  } = useAIStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [wordGoal, setWordGoal] = useState(2000);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoSaveEnabled && isDirty) {
      const timer = setTimeout(() => {
        saveContent();
      }, 5000); // Auto-save every 5 seconds

      return () => clearTimeout(timer);
    }
  }, [content, autoSaveEnabled, isDirty, saveContent]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleTextSelection = () => {
    if (editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      const selected = content.substring(start, end);
      setSelectedText(selected);
    }
  };

  const handleSave = async () => {
    try {
      await saveContent();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleAISuggest = async () => {
    const textToAnalyze = selectedText || content;
    if (textToAnalyze.trim()) {
      await generateSuggestions(projectId, `Provide writing suggestions for: ${textToAnalyze}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleFileDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writing-project-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatPreviewContent = (text: string) => {
    return text.split('\n\n').map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Check for headers (lines starting with #)
      if (paragraph.startsWith('#')) {
        const level = paragraph.match(/^#+/)?.[0].length || 1;
        const text = paragraph.replace(/^#+\s*/, '');
        const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        return (
          <HeaderTag key={index} className="font-bold text-gray-800 mt-6 mb-3">
            {text}
          </HeaderTag>
        );
      }
      
      return (
        <p key={index} className="mb-4 leading-relaxed text-gray-700">
          {paragraph}
        </p>
      );
    }).filter(Boolean);
  };

  const getProgressPercentage = () => {
    return Math.min(100, (wordCount / wordGoal) * 100);
  };

  const getReadingTime = () => {
    const wordsPerMinute = 200;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  return (
    <div className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''}`}>
      {/* Editor Header */}
      <Card className="border-b rounded-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Writing Editor</span>
              {isDirty && <Badge variant="outline" className="text-xs">Unsaved</Badge>}
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {/* Auto-save toggle */}
              <Button
                variant={autoSaveEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                className="text-xs"
              >
                <Clock className="w-3 h-3 mr-1" />
                Auto-save
              </Button>

              {/* View controls */}
              <Button
                variant={showStats ? "default" : "outline"}
                size="sm"
                onClick={() => setShowStats(!showStats)}
              >
                <WordCount className="w-4 h-4" />
              </Button>

              <Button
                variant={showPreview ? "default" : "outline"}
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>

              {/* File operations */}
              <div className="flex space-x-1">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <Upload className="w-4 h-4" />
                    </span>
                  </Button>
                </label>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFileDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>

              {/* Main actions */}
              <Button
                onClick={handleAISuggest}
                disabled={aiLoading || !content.trim()}
                variant="outline"
                size="sm"
                className="text-purple-600 border-purple-300"
              >
                {aiLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
              </Button>

              <Button
                onClick={handleSave}
                disabled={!isDirty}
                className="flex items-center space-x-1"
              >
                <Save className="w-4 h-4" />
                <span>Save</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Bar */}
      {showStats && (
        <Card className="border-b rounded-none">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Words:</span>{' '}
                  <span className="text-blue-600 font-semibold">{wordCount.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Characters:</span>{' '}
                  <span className="text-gray-600">{characterCount.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Reading time:</span>{' '}
                  <span className="text-gray-600">{getReadingTime()} min</span>
                </div>
                {selectedText && (
                  <div className="text-sm">
                    <span className="font-medium text-yellow-600">Selected:</span>{' '}
                    <span className="text-yellow-700">{selectedText.split(' ').length} words</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Word goal progress */}
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-green-600" />
                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Goal:</span>{' '}
                    <span className="text-green-600">{getProgressPercentage().toFixed(1)}%</span>
                  </div>
                </div>
                
                {lastSaved && (
                  <div className="text-xs text-gray-500">
                    Last saved: {lastSaved.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Text Editor */}
        <div className={`${showPreview ? 'w-1/2 border-r' : 'w-full'} flex flex-col`}>
          <textarea
            ref={editorRef}
            value={content}
            onChange={handleTextareaChange}
            onSelect={handleTextSelection}
            placeholder="Start writing your story..."
            className="flex-1 w-full p-4 border-none resize-none outline-none text-gray-800 leading-relaxed"
            style={{ 
              fontFamily: 'Georgia, serif',
              fontSize: '16px',
              lineHeight: '1.6'
            }}
          />
        </div>

        {/* Preview Panel */}
        {showPreview && (
          <div className="w-1/2 bg-gray-50 overflow-y-auto">
            <div className="p-6">
              <div className="prose max-w-none">
                <div className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                  Preview
                </div>
                {content ? (
                  formatPreviewContent(content)
                ) : (
                  <p className="text-gray-500 italic">
                    Your writing preview will appear here...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Suggestions Overlay */}
      {suggestions.length > 0 && (
        <div className="border-t bg-yellow-50 p-4 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800 flex items-center">
              <Sparkles className="w-4 h-4 mr-1 text-purple-600" />
              AI Suggestions
            </h4>
            <Badge variant="outline" className="text-xs">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="space-y-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <div key={index} className="text-sm p-2 bg-white rounded border">
                <p className="text-gray-700">{suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
