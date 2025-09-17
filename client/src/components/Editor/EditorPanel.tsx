import React, { useState, useRef, useEffect } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useAIStore } from '../../store/useAIStore';
import { Button } from '../ui/button';
import { 
  Save, 
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Clock,
  Check,
  AlertCircle,
  Loader2,
  FileText,
  Maximize2,
  Minimize2
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

  const [showPreview, setShowPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save with improved UX
  useEffect(() => {
    if (autoSaveEnabled && isDirty && content.trim()) {
      const timer = setTimeout(async () => {
        try {
          setSaveStatus('saving');
          await saveContent();
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 3000);
        }
      }, 3000); // Reduced to 3 seconds for better UX

      return () => clearTimeout(timer);
    }
  }, [content, autoSaveEnabled, isDirty, saveContent]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (saveStatus !== 'idle') setSaveStatus('idle');
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
      setSaveStatus('saving');
      await saveContent();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleAISuggest = async () => {
    const textToAnalyze = selectedText || content.slice(-500); // Last 500 chars for context
    if (textToAnalyze.trim()) {
      await generateSuggestions(projectId, `Provide writing suggestions for: ${textToAnalyze}`);
    }
  };

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPreview(!showPreview);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPreview, isFullscreen]);

  const formatPreviewContent = (text: string) => {
    if (!text.trim()) return null;

    return text.split('\n\n').map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Check for headers (lines starting with #)
      if (paragraph.startsWith('#')) {
        const level = paragraph.match(/^#+/)?.[0].length || 1;
        const headerText = paragraph.replace(/^#+\s*/, '');
        const HeaderTag = `h${Math.min(level, 6)}` as keyof JSX.IntrinsicElements;
        
        const headerStyles = {
          h1: "text-2xl font-bold text-gray-900 mt-8 mb-4",
          h2: "text-xl font-semibold text-gray-800 mt-6 mb-3",
          h3: "text-lg font-medium text-gray-800 mt-5 mb-3",
          h4: "text-base font-medium text-gray-700 mt-4 mb-2",
          h5: "text-sm font-medium text-gray-700 mt-3 mb-2",
          h6: "text-sm font-medium text-gray-600 mt-2 mb-2"
        };
        
        return (
          <HeaderTag key={index} className={headerStyles[HeaderTag as keyof typeof headerStyles]}>
            {headerText}
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

  const getSaveStatusInfo = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Saving...',
          className: 'text-blue-600'
        };
      case 'saved':
        return {
          icon: <Check className="w-3 h-3" />,
          text: 'Saved',
          className: 'text-emerald-600'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          text: 'Error',
          className: 'text-red-600'
        };
      default:
        return isDirty ? {
          icon: <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>,
          text: 'Unsaved',
          className: 'text-amber-600'
        } : null;
    }
  };

  const statusInfo = getSaveStatusInfo();

  return (
    <div className={`h-full bg-gradient-to-br from-slate-50 to-blue-50/20 flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Floating Toolbar - Enhanced */}
      <div className={`absolute top-6 right-6 z-20 transition-all duration-300 ${focusMode ? 'opacity-20 hover:opacity-100' : 'opacity-100'}`}>
        <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-md rounded-xl px-4 py-3 border border-gray-200/60 shadow-lg">
          {/* Save Status */}
          {statusInfo && (
            <div className={`flex items-center space-x-2 px-2 py-1 rounded-lg bg-gray-50/80 ${statusInfo.className}`}>
              {statusInfo.icon}
              <span className="text-xs font-medium">{statusInfo.text}</span>
            </div>
          )}
          
          {/* Divider */}
          {statusInfo && <div className="w-px h-4 bg-gray-300"></div>}

          {/* Auto-save Toggle */}
          <Button
            variant={autoSaveEnabled ? "default" : "ghost"}
            size="sm"
            onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
            className={`editor-tooltip h-8 px-3 text-xs transition-all ${autoSaveEnabled ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'hover:bg-gray-100'}`}
            title={`Auto-save ${autoSaveEnabled ? 'enabled' : 'disabled'} (every 3s)`}
          >
            <Clock className="w-3 h-3 mr-1" />
            Auto
          </Button>

          {/* Focus Mode */}
          <Button
            variant={focusMode ? "default" : "ghost"}
            size="sm"
            onClick={() => setFocusMode(!focusMode)}
            className="editor-tooltip h-8 px-3 text-xs"
            title="Toggle focus mode"
          >
            {focusMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>

          {/* Preview Toggle */}
          <Button
            variant={showPreview ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className={`editor-tooltip h-8 px-3 text-xs ${showPreview ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' : 'hover:bg-gray-100'}`}
            title="Toggle preview (Ctrl+P)"
          >
            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </Button>

          {/* AI Assistant */}
          <Button
            onClick={handleAISuggest}
            disabled={aiLoading || !content.trim()}
            variant="ghost"
            size="sm"
            className="editor-tooltip h-8 px-3 text-xs text-purple-600 hover:bg-purple-50 disabled:opacity-50"
            title="Get AI writing suggestions"
          >
            {aiLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            AI
          </Button>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
            size="sm"
            className="editor-tooltip h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-medium"
            title="Save document (Ctrl+S)"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Main Writing Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Writing Space */}
        <div className={`${showPreview ? 'w-2/3' : 'w-full'} bg-transparent relative transition-all duration-300`}>
          <textarea
            ref={editorRef}
            value={content}
            onChange={handleTextareaChange}
            onSelect={handleTextSelection}
            onFocus={() => setFocusMode(true)}
            onBlur={() => setTimeout(() => setFocusMode(false), 100)}
            placeholder="Begin your story here...

Let your imagination flow. Every great story starts with a single word."
            className={`w-full h-full border-none resize-none outline-none text-gray-900 leading-relaxed bg-transparent transition-all duration-300 selection:bg-blue-200/50 placeholder:text-gray-400/70 ${focusMode ? 'bg-white/40' : 'bg-white/20'}`}
            style={{ 
              fontFamily: '"Crimson Text", Charter, Georgia, serif',
              fontSize: '20px',
              lineHeight: '1.8',
              padding: focusMode ? '100px 140px' : '80px 120px',
              letterSpacing: '0.01em'
            }}
          />
          
          {/* Enhanced Word Count */}
          <div className={`absolute bottom-6 left-6 transition-all duration-300 ${focusMode ? 'opacity-30 hover:opacity-100' : 'opacity-100'}`}>
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-200/60 shadow-sm">
              <div className="flex items-center space-x-3 text-sm">
                <div className="flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-gray-500" />
                  <span className="font-medium text-gray-700">{wordCount.toLocaleString()}</span>
                  <span className="text-gray-500">words</span>
                </div>
                <div className="text-gray-400">•</div>
                <div className="text-gray-500">
                  {content.length.toLocaleString()} characters
                </div>
                {wordCount > 0 && (
                  <>
                    <div className="text-gray-400">•</div>
                    <div className="text-gray-500">
                      {Math.ceil(wordCount / 200)} min read
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Preview Panel */}
        {showPreview && (
          <div className="w-1/3 bg-white/80 backdrop-blur-sm border-l border-gray-200/60 overflow-hidden transition-all duration-300">
            <div className="h-full flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-indigo-50 to-blue-50">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Live Preview</h3>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {content ? (
                  <div className="prose max-w-none prose-gray">
                    {formatPreviewContent(content)}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                      <FileText className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 text-sm mb-2">Preview appears here</p>
                    <p className="text-xs text-gray-400">Start writing to see your content formatted</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced AI Suggestions Panel */}
      {suggestions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50/80 to-blue-50/80 backdrop-blur-sm border-t border-gray-200/60 transition-all duration-300">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-gray-900">AI Writing Assistant</span>
                  <p className="text-xs text-gray-600">Smart suggestions for your content</p>
                </div>
              </div>
              <span className="text-xs text-gray-500 bg-white/60 px-2 py-1 rounded-full">
                {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <div key={index} className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-purple-200/50 hover:bg-white/90 transition-colors cursor-pointer">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {suggestion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help (appears on focus) */}
      {focusMode && (
        <div className="absolute bottom-6 right-6 bg-gray-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg text-xs shadow-lg border border-gray-700/50">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <kbd className="bg-gray-700/80 text-gray-200 px-1.5 py-0.5 rounded text-xs font-medium border border-gray-600/50">Ctrl+S</kbd> 
              <span className="text-gray-200">Save</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="bg-gray-700/80 text-gray-200 px-1.5 py-0.5 rounded text-xs font-medium border border-gray-600/50">Ctrl+P</kbd> 
              <span className="text-gray-200">Preview</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="bg-gray-700/80 text-gray-200 px-1.5 py-0.5 rounded text-xs font-medium border border-gray-600/50">F11</kbd> 
              <span className="text-gray-200">Fullscreen</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};