import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon, LoadingIcon } from "@/components/ui/icon";
import { AILoadingState } from "@/components/ui/performance-monitor";
import apiService from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CopilotEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onChange: (content: string) => void;
  projectId?: string;
  isFullScreen?: boolean;
}

interface AutocompleteSuggestion {
  text: string;
  position: number;
  type: 'autocomplete' | 'spelling' | 'grammar';
}

interface AISuggestion {
  type: 'summary' | 'correction' | 'suggestion' | 'general';
  text: string;
  label: string;
  action?: () => void;
}

export const CopilotEditor: React.FC<CopilotEditorProps> = ({ 
  initialContent, 
  onSave, 
  onChange, 
  projectId,
  isFullScreen = false
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<AutocompleteSuggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  
  // AI Assistant state (Cursor-style)
  const [aiAssistant, setAiAssistant] = useState({
    isOpen: false,
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0,
    query: '',
    isProcessing: false,
    suggestions: [] as AISuggestion[]
  });
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide status bar
  useEffect(() => {
    if (isTyping || isLoadingSuggestion || showSuggestion || isSaving) {
      setShowStatusBar(true);
      
      if (statusBarTimeoutRef.current) {
        clearTimeout(statusBarTimeoutRef.current);
      }
      
      statusBarTimeoutRef.current = setTimeout(() => {
        if (!isLoadingSuggestion && !showSuggestion && !isSaving) {
          setShowStatusBar(false);
        }
      }, 3000);
    }
    
    return () => {
      if (statusBarTimeoutRef.current) {
        clearTimeout(statusBarTimeoutRef.current);
      }
    };
  }, [isTyping, isLoadingSuggestion, showSuggestion, isSaving]);

  // Cache for suggestions to avoid repeated API calls
  const suggestionCache = useRef<Map<string, { suggestion: string; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Optimized debounced autocomplete function with caching and cancellation
  const debouncedAutocomplete = useCallback(async (text: string, cursorPos: number) => {
    if (text.length < 10 || !projectId) return;
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create cache key based on context around cursor
    const contextStart = Math.max(0, cursorPos - 50);
    const contextEnd = Math.min(text.length, cursorPos + 20);
    const context = text.slice(contextStart, contextEnd);
    const cacheKey = `${context}_${cursorPos}`;
    
    // Check cache first (valid for 5 minutes)
    const cached = suggestionCache.current.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < 5 * 60 * 1000) {
      setSuggestion({
        text: cached.suggestion,
        position: cursorPos,
        type: 'autocomplete'
      });
      setShowSuggestion(true);
      return;
    }
    
    try {
      setIsLoadingSuggestion(true);
      
      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      const response = await apiService.generateAutocomplete(text, cursorPos, projectId, abortController.signal);
      
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      
      if (response.suggestion && response.suggestion.trim()) {
        // Cache the result
        suggestionCache.current.set(cacheKey, {
          suggestion: response.suggestion,
          timestamp: now
        });
        
        // Clean old cache entries (keep only last 20)
        if (suggestionCache.current.size > 20) {
          const entries = Array.from(suggestionCache.current.entries());
          entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
          suggestionCache.current.clear();
          entries.slice(0, 20).forEach(([key, value]) => {
            suggestionCache.current.set(key, value);
          });
        }
        
        setSuggestion({
          text: response.suggestion,
          position: cursorPos,
          type: 'autocomplete'
        });
        setShowSuggestion(true);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      console.error('Error getting autocomplete suggestion:', error);
    } finally {
      setIsLoadingSuggestion(false);
      abortControllerRef.current = null;
    }
  }, [projectId]);

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(newContent);
    onChange(newContent);
    setIsTyping(true);
    
    // Clear typing indicator after pause
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
    
    // Hide current suggestion when typing
    setShowSuggestion(false);
    setSuggestion(null);
    
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set timeout for AI autocomplete (reduced to 2 seconds for better UX)
    timeoutRef.current = setTimeout(() => {
      debouncedAutocomplete(newContent, cursorPos);
    }, 2000);
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
      return;
    }

    // Ctrl+K to open AI assistant (Cursor-style)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openAIAssistant();
      return;
    }

    // Ctrl+M to make it better
    if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
      e.preventDefault();
      makeTextBetter();
      return;
    }

    // Escape to close AI assistant
    if (e.key === 'Escape' && aiAssistant.isOpen) {
      e.preventDefault();
      closeAIAssistant();
      return;
    }

    if (e.key === 'Tab' && suggestion && showSuggestion) {
      e.preventDefault();
      acceptSuggestion();
    } else if (e.key === 'Escape' && showSuggestion) {
      e.preventDefault();
      dismissSuggestion();
    } else if (e.key === 'ArrowRight' && suggestion && showSuggestion && suggestion.type === 'autocomplete') {
      // Allow accepting with right arrow for autocomplete
      const textarea = textareaRef.current;
      if (textarea && textarea.selectionStart === suggestion.position) {
        e.preventDefault();
        acceptSuggestion();
      }
    } else {
      // Hide suggestion on most key presses
      if (showSuggestion && !['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setShowSuggestion(false);
      }
    }
  };
  
  const acceptSuggestion = () => {
    if (!suggestion || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    let newContent: string;
    let newCursorPos: number;
    
    if (suggestion.type === 'spelling') {
      const beforeWord = content.substring(0, suggestion.position);
      const afterWord = content.substring(suggestion.position);
      const oldWordMatch = afterWord.match(/^\w+/);
      const oldWordLength = oldWordMatch ? oldWordMatch[0].length : 0;
      
      newContent = beforeWord + suggestion.text + content.substring(suggestion.position + oldWordLength);
      newCursorPos = suggestion.position + suggestion.text.length;
    } else {
      const beforeSuggestion = content.substring(0, suggestion.position);
      const afterSuggestion = content.substring(suggestion.position);
      newContent = beforeSuggestion + suggestion.text + afterSuggestion;
      newCursorPos = suggestion.position + suggestion.text.length;
    }
    
    setContent(newContent);
    onChange(newContent);
    setSuggestion(null);
    setShowSuggestion(false);
    
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Dismiss the suggestion
  const dismissSuggestion = () => {
    setSuggestion(null);
    setShowSuggestion(false);
  };

  // Handle cursor position changes
  const handleSelectionChange = () => {
    if (textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      
      if (suggestion && Math.abs(cursorPos - suggestion.position) > 10) {
        setShowSuggestion(false);
      }
    }
  };

  // Save function
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
    } finally {
      setIsSaving(false);
    }
  };

  // AI Assistant Functions (Cursor-style)
  const openAIAssistant = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    setAiAssistant({
      isOpen: true,
      selectedText,
      selectionStart: start,
      selectionEnd: end,
      query: '',
      isProcessing: false,
      suggestions: []
    });
  };

  const closeAIAssistant = () => {
    setAiAssistant(prev => ({ ...prev, isOpen: false, query: '', suggestions: [], isProcessing: false }));
  };

  // Make it Better function - shows improved version in AI panel with apply option
  const makeTextBetter = async () => {
    if (!projectId) return;
    
    const fullText = content.trim();
    
    if (!fullText) {
      alert('No content to improve');
      return;
    }
    
    // Open AI panel and start processing
    setAiAssistant({
      isOpen: true,
      selectedText: '',
      selectionStart: 0,
      selectionEnd: 0,
      query: 'Make it Better',
      isProcessing: true,
      suggestions: []
    });
    
    // Generate improved version
    try {
      const response = await apiService.generateBetterVersion(fullText, projectId);
      const improvedText = response.improvedText?.trim() || fullText;
      
      if (improvedText && improvedText !== fullText) {
        // Show the improved version with apply option
        setAiAssistant(prev => ({ 
          ...prev, 
          isProcessing: false,
          suggestions: [{
            type: 'suggestion',
            text: improvedText,
            label: 'Apply Improved Version',
            action: () => {
              // Apply the improvement
              setContent(improvedText);
              onChange(improvedText);
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(0, 0);
                  textareaRef.current.focus();
                }
              }, 0);
              setAiAssistant(prev => ({ ...prev, isOpen: false }));
            }
          }]
        }));
      } else {
        setAiAssistant(prev => ({ 
          ...prev, 
          isProcessing: false,
          suggestions: [{
            type: 'summary',
            text: 'Your project is already excellently written!',
            label: 'No improvements needed'
          }]
        }));
      }
    } catch (error) {
      console.error('Make it better failed:', error);
      setAiAssistant(prev => ({ 
        ...prev, 
        isProcessing: false,
        suggestions: [{
          type: 'summary',
          text: 'Error improving your project. Please try again.',
          label: 'Error'
        }]
      }));
    }
  };
  

  // Fixed handleAIQuery function
  const handleAIQuery = async () => {
    if (!aiAssistant.query.trim() || !projectId) return;
    
    setAiAssistant(prev => ({ ...prev, isProcessing: true, suggestions: [] }));
    
    try {
      let prompt;
      
      if (aiAssistant.selectedText) {
        const contextText = content.slice(Math.max(0, aiAssistant.selectionStart - 100), aiAssistant.selectionEnd + 100);
        prompt = `Selected text: "${aiAssistant.selectedText}"
        Context: "${contextText}"
        User request: ${aiAssistant.query}
        
        Please provide suggestions to modify the selected text based on the user's request.`;
      } else {
        const recentText = content.slice(-500);
        prompt = `User is writing and needs help with: ${aiAssistant.query}
        
        Recent writing context: "${recentText}"
        
        Provide helpful writing guidance, tips, and suggestions based on their request. Include both general advice and specific examples they can use.`;
      }
      
      const response = await apiService.generateAISuggestions(projectId, prompt, 'fast');
      const responseText = response.suggestions || '';
      
      // Better parsing with fallback
      const suggestions: AISuggestion[] = [];
      
      // Extract summary
      const summaryMatch = responseText.match(/SUMMARY:\s*([\s\S]*?)(?=\nCORRECTED VERSION:|CORRECTED VERSION:|SUGGESTIONS:|$)/i);
      if (summaryMatch && summaryMatch[1].trim()) {
        suggestions.push({
          type: 'summary',
          text: summaryMatch[1].trim(),
          label: 'Analysis'
        });
      }
      
      // Extract correction
      const correctionMatch = responseText.match(/CORRECTED VERSION:\s*([\s\S]*?)(?=\nSUGGESTIONS:|SUGGESTIONS:|$)/i);
      if (correctionMatch && correctionMatch[1].trim() && 
          correctionMatch[1].trim() !== 'No corrections needed' && 
          correctionMatch[1].trim() !== aiAssistant.selectedText) {
        
        let cleanCorrectedText = correctionMatch[1].trim();
        if ((cleanCorrectedText.startsWith('"') && cleanCorrectedText.endsWith('"')) ||
            (cleanCorrectedText.startsWith("'") && cleanCorrectedText.endsWith("'"))) {
          cleanCorrectedText = cleanCorrectedText.slice(1, -1);
        }
        
        suggestions.push({
          type: 'correction', 
          text: cleanCorrectedText,
          label: 'Apply Correction'
        });
      }
      
      // Extract individual suggestions
      const suggestionsMatch = responseText.match(/SUGGESTIONS:\s*([\s\S]*?)$/i);
      if (suggestionsMatch && suggestionsMatch[1]) {
        const suggestionMatches = suggestionsMatch[1].match(/\d+\.[\s\S]*?(?=\d+\.|$)/g) || [];
        suggestionMatches.forEach((match, index) => {
          const text = match.replace(/^\d+\.\s*/, '').trim();
          if (text) {
            suggestions.push({
              type: 'suggestion',
              text: text,
              label: `Suggestion ${index + 1}`
            });
          }
        });
      }
      
      // If no structured response, add the whole response as a general suggestion
      if (suggestions.length === 0 && responseText.trim()) {
        suggestions.push({
          type: 'summary',
          text: responseText.trim(),
          label: 'AI Response'
        });
      }
      
      console.log('Final suggestions:', suggestions); // Debug log
      
      // KEY FIX: Make sure we update the state properly
      setAiAssistant(prev => ({ 
        ...prev, 
        isProcessing: false, 
        suggestions: suggestions // Make sure this is the array we built
      }));
      
    } catch (error) {
      console.error('AI query failed:', error);
      // Add error suggestion so user knows something went wrong
      setAiAssistant(prev => ({ 
        ...prev, 
        isProcessing: false,
        suggestions: [{
          type: 'summary',
          text: 'Sorry, there was an error processing your request. Please try again.',
          label: 'Error'
        }]
      }));
    }
  };

  const applySuggestion = (suggestion: AISuggestion) => {
    console.log('Apply suggestion called:', suggestion);
    console.log('Selection start:', aiAssistant.selectionStart);
    console.log('Selection end:', aiAssistant.selectionEnd);
    console.log('Selected text:', aiAssistant.selectedText);
    
    if (!textareaRef.current) {
      console.log('No textarea ref');
      return;
    }
    
    // If suggestion has a custom action, use it
    if (suggestion.action) {
      suggestion.action();
      return;
    }
    
    // Summary and general suggestions are just informational, don't apply to text
    if (suggestion.type === 'summary' || suggestion.type === 'general') {
      console.log('Read-only suggestion, closing assistant');
      closeAIAssistant();
      return;
    }
    
    // For corrections, replace the selected text only
    if (suggestion.type === 'correction') {
      const beforeText = content.substring(0, aiAssistant.selectionStart);
      const afterText = content.substring(aiAssistant.selectionEnd);
      const newContent = beforeText + suggestion.text + afterText;
      
      console.log('Before text:', beforeText);
      console.log('After text:', afterText);
      console.log('New content:', newContent);
      
      setContent(newContent);
      onChange(newContent);
      
      // Update cursor position to end of replaced text
      const newCursorPos = aiAssistant.selectionStart + suggestion.text.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
      
      closeAIAssistant();
    } else {
      console.log('Unknown suggestion type:', suggestion.type);
    }
  };

  // Calculate text metrics for positioning
  const getTextMetrics = useCallback(() => {
    if (!textareaRef.current) return { lineHeight: 24, charWidth: 8 };
    
    const textarea = textareaRef.current;
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseInt(style.lineHeight) || 24;
    
    const temp = document.createElement('span');
    temp.style.font = style.font;
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.textContent = 'M';
    document.body.appendChild(temp);
    const charWidth = temp.offsetWidth;
    document.body.removeChild(temp);
    
    return { lineHeight, charWidth };
  }, []);

  // Render the suggestion overlay with proper positioning
  const renderSuggestionOverlay = () => {
    if (!suggestion || !showSuggestion || !textareaRef.current) return null;
    
    const textarea = textareaRef.current;
    const { lineHeight, charWidth } = getTextMetrics();
    
    const beforeText = content.substring(0, suggestion.position);
    const lines = beforeText.split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    const textareaStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseInt(textareaStyle.paddingLeft) || 16;
    const paddingTop = parseInt(textareaStyle.paddingTop) || 16;
    
    const top = currentLine * lineHeight + paddingTop;
    const left = currentColumn * charWidth + paddingLeft;
    
    const getSuggestionStyle = (): React.CSSProperties => {
      const baseStyle: React.CSSProperties = {
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        fontSize: textareaStyle.fontSize,
        fontFamily: textareaStyle.fontFamily,
        lineHeight: textareaStyle.lineHeight,
        whiteSpace: 'pre',
        pointerEvents: 'none',
        zIndex: 10,
        userSelect: 'none',
      };
      
      switch (suggestion.type) {
        case 'spelling':
          return {
            ...baseStyle,
            color: '#dc2626',
            backgroundColor: '#fef2f2',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid #fecaca',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          };
        case 'autocomplete':
          return {
            ...baseStyle,
            color: '#6b7280',
            opacity: 0.6,
            fontStyle: 'italic',
          };
        default:
          return {
            ...baseStyle,
            color: '#6b7280',
            opacity: 0.5,
          };
      }
    };
    
    return (
      <div style={getSuggestionStyle()}>
        {suggestion.text}
      </div>
    );
  };

  // Cleanup timeouts and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (statusBarTimeoutRef.current) {
        clearTimeout(statusBarTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

  return (
    <>
      {/* Performance Monitor */}
      <AILoadingState operation="autocomplete" isActive={isLoadingSuggestion} />
      
      <div className="h-full flex flex-col bg-white relative">
      {/* Quick AI Access Button - Optimized positioning */}
      <div className={`absolute ${isFullScreen ? 'top-4 left-4' : 'top-4 left-4 md:top-6 md:left-6'} z-20 flex space-x-3`}>
        <button
          onClick={openAIAssistant}
          className={`
            bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white 
            ${isFullScreen ? 'p-2' : 'px-4 py-2.5'} rounded-full shadow-lg hover:shadow-xl 
            transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 group border-2 border-white
            ${isFullScreen ? 'opacity-70 hover:opacity-100' : ''}
          `}
          title="Open AI Assistant (Ctrl+K)"
        >
          <Icon name="sparkles" size="sm" className="text-white group-hover:animate-pulse" />
          {!isFullScreen && <span className="text-sm font-medium hidden sm:block">AI Assist</span>}
        </button>
        
        <button
          onClick={makeTextBetter}
          className={`
            bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white 
            ${isFullScreen ? 'p-2' : 'px-4 py-2.5'} rounded-full shadow-lg hover:shadow-xl 
            transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 group border-2 border-white
            ${isFullScreen ? 'opacity-70 hover:opacity-100' : ''}
          `}
          title="Make it Better (Ctrl+M)"
        >
          <Icon name="zap" size="sm" className="text-white group-hover:animate-pulse" />
          {!isFullScreen && <span className="text-sm font-medium hidden sm:block">Make Better</span>}
        </button>
      </div>
      
      {/* Floating Status Indicators - Minimal and auto-hiding */}
      {(isLoadingSuggestion || showSuggestion || isSaving) && (
        <div className={`absolute ${isFullScreen ? 'top-4 right-4' : 'top-6 right-6'} z-20 animate-in fade-in duration-300`}>
          <div className={`bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg ${isFullScreen ? 'px-3 py-2 text-xs' : 'px-4 py-2.5'}`}>
            {isSaving && (
              <div className="flex items-center space-x-2 text-emerald-700">
                <LoadingIcon size="xs" className="animate-spin" />
                <span className="text-sm font-medium">Saving</span>
              </div>
            )}
            {isLoadingSuggestion && (
              <div className="flex items-center space-x-2 text-blue-600">
                <LoadingIcon size="xs" className="animate-spin" />
                <span className="text-sm font-medium">AI thinking</span>
              </div>
            )}
            {showSuggestion && suggestion && (
              <div className="flex items-center space-x-2">
                <Icon 
                  name={suggestion.type === 'spelling' ? 'alert-circle' : 'lightbulb'} 
                  size="xs" 
                  className={suggestion.type === 'spelling' ? 'text-red-500' : 'text-amber-500'} 
                />
                <span className="text-sm font-medium text-gray-700">
                  Tab to {suggestion.type === 'spelling' ? 'fix' : 'accept'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen Writing Area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          className={`
            w-full h-full border-0 resize-none outline-none bg-white text-gray-900 
            placeholder-gray-400 focus:placeholder-gray-300 transition-all duration-300
            ${isFullScreen 
              ? 'px-8 py-12 md:px-16 md:py-16' 
              : 'px-6 py-8 sm:px-8 sm:py-12 md:px-12 md:py-16 lg:px-20 lg:py-20'
            }
          `}
          placeholder="Begin your story..."
          spellCheck={false}
          style={{
            fontFamily: 'Georgia, "Times New Roman", Times, serif',
            fontSize: '20px',
            lineHeight: '1.75',
            letterSpacing: '0.01em',
          }}
        />
        
        {/* Floating Suggestion Overlay */}
        {renderSuggestionOverlay()}
      </div>

      {/* Cursor-style AI Assistant Modal */}
      {aiAssistant.isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Icon name="zap" size="sm" className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                    <p className="text-sm text-gray-600">
                      {aiAssistant.selectedText ? 
                        `Selected: "${aiAssistant.selectedText.substring(0, 50)}${aiAssistant.selectedText.length > 50 ? '...' : ''}"` :
                        'Ask AI to help with your writing'
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeAIAssistant}
                  className="p-2 hover:bg-white/80 rounded-lg transition-colors"
                >
                  <Icon name="x" size="sm" className="text-gray-500" />
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="p-6 flex-shrink-0">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    What would you like me to do?
                  </label>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={aiAssistant.query}
                      onChange={(e) => setAiAssistant(prev => ({ ...prev, query: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !aiAssistant.isProcessing) {
                          handleAIQuery();
                        }
                      }}
                      placeholder="e.g., 'Fix spelling', 'Make it more formal', 'Add more details'..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleAIQuery}
                      disabled={!aiAssistant.query.trim() || aiAssistant.isProcessing}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors flex items-center space-x-2"
                    >
                      {aiAssistant.isProcessing ? (
                        <>
                          <LoadingIcon size="sm" className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="send" size="sm" />
                          <span>Ask AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Actions - Clean and Simple */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'Fix spelling and grammar',
                    'Make it more professional',
                    'Simplify the language', 
                    'Add more details',
                    'Make it shorter',
                    'Improve clarity',
                    'Give me writing tips',
                    'Suggest plot ideas',
                    'Help with dialogue'
                  ].map((quickAction) => (
                    <button
                      key={quickAction}
                      onClick={() => setAiAssistant(prev => ({ ...prev, query: quickAction }))}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors"
                    >
                      {quickAction}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Response - Scrollable */}
            {(aiAssistant.suggestions.length > 0 || aiAssistant.isProcessing) && (
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {aiAssistant.isProcessing && aiAssistant.suggestions.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <LoadingIcon size="lg" className="animate-spin text-blue-600 mx-auto mb-4" />
                      <p className="text-gray-600">AI is thinking...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Debug info */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="text-xs text-gray-400 mb-2">
                        Debug: {aiAssistant.suggestions.length} suggestions found
                      </div>
                    )}
                    
                    {/* Analysis & Correction Section */}
                    {aiAssistant.suggestions.filter(s => s.type === 'summary' || s.type === 'correction').map((suggestion, index) => (
                      <div key={`top-${index}`} className={`border rounded-xl p-4 ${
                        suggestion.type === 'summary' 
                          ? 'border-blue-200 bg-blue-50/30' 
                          : 'border-green-200 bg-green-50/50 hover:border-green-300 group'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className={`flex-1 ${suggestion.type === 'correction' ? 'pr-4' : ''}`}>
                            {suggestion.type === 'summary' && (
                              <div className="flex items-center space-x-2 mb-3">
                                <Icon name="bar-chart" size="sm" className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">Analysis</span>
                              </div>
                            )}
                            {suggestion.type === 'correction' && (
                              <div className="flex items-center space-x-2 mb-2">
                                <Icon name="check-circle" size="sm" className="text-green-600" />
                                <span className="text-sm font-medium text-green-700">Correction</span>
                              </div>
                            )}
                            <div className={`leading-relaxed markdown-content ${
                              suggestion.type === 'summary' 
                                ? 'text-gray-700 prose prose-sm max-w-none' 
                                : 'text-gray-800 prose prose-sm max-w-none'
                            }`}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {suggestion.text}
                              </ReactMarkdown>
                            </div>
                          </div>
                          {suggestion.type === 'correction' && (
                            <button
                              onClick={() => applySuggestion(suggestion)}
                              className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors opacity-0 group-hover:opacity-100 bg-green-600 hover:bg-green-700"
                            >
                              Apply Fix
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Writing Suggestions Section */}
                    {aiAssistant.suggestions.filter(s => s.type === 'suggestion').length > 0 && (
                      <div className="pb-4">
                        <h4 className="font-medium text-gray-900 mb-3 mt-6 sticky top-0 bg-white py-2 border-b border-gray-100">Writing Suggestions:</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {aiAssistant.suggestions.filter(s => s.type === 'suggestion').map((suggestion, index) => (
                            <div key={`suggestion-${index}`} className="border border-gray-200 rounded-xl p-4 bg-white hover:border-blue-300 transition-colors hover:shadow-sm group">
                              <div className="flex items-start justify-between">
                                <div className={`flex-1 ${suggestion.action ? 'pr-4' : ''}`}>
                                  <div className="flex items-center space-x-2 mb-2">
                                    <Icon 
                                      name={suggestion.label === 'Pro Tips' ? 'star' : 
                                           suggestion.label === 'Creative Ideas' ? 'sparkles' : 
                                           suggestion.action ? 'zap' :
                                           'lightbulb'} 
                                      size="sm" 
                                      className={suggestion.label === 'Pro Tips' ? 'text-purple-600' : 
                                                suggestion.label === 'Creative Ideas' ? 'text-rose-500' : 
                                                suggestion.action ? 'text-blue-600' :
                                                'text-amber-600'} 
                                    />
                                    <span 
                                      className={`text-sm font-medium ${
                                        suggestion.label === 'Pro Tips' ? 'text-purple-700' : 
                                        suggestion.label === 'Creative Ideas' ? 'text-rose-600' : 
                                        suggestion.action ? 'text-blue-700' :
                                        'text-amber-700'
                                      }`}
                                    >
                                      {suggestion.label}
                                    </span>
                                  </div>
                                  <div className="text-gray-800 leading-relaxed text-sm markdown-content prose prose-sm max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {suggestion.text}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                                {suggestion.action && (
                                  <button
                                    onClick={() => applySuggestion(suggestion)}
                                    className="px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors opacity-0 group-hover:opacity-100 bg-blue-600 hover:bg-blue-700"
                                  >
                                    Apply
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Auto-hiding Status Bar */}
      {!isFullScreen && (
        <div className={`
          transition-all duration-500 ease-in-out border-t border-gray-100 bg-white/80 backdrop-blur-sm
          ${showStatusBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
        `}>
          <div className="flex items-center justify-between px-6 py-3 text-sm lg:px-12 lg:py-4">
            <div className="flex items-center space-x-4 lg:space-x-8 text-gray-600">
              <span className="font-medium">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
              <span className="hidden sm:inline">{content.length} characters</span>
              <span className="hidden md:inline">{content.split('\n').length} lines</span>
            </div>
            
            <div className="flex items-center space-x-4 lg:space-x-6 text-xs text-gray-500">
              <div className="hidden lg:flex items-center space-x-1.5">
                <Icon name="zap" size="xs" className="text-amber-500" />
                <span>AI assists after pause • Ctrl+K for AI help • Ctrl+M to make better</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono border">⌘S</kbd>
                <span>save</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Minimal floating status for full-screen mode */}
      {isFullScreen && showStatusBar && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-30">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-2 shadow-lg text-sm text-gray-600">
            <span className="font-medium">{wordCount} words</span>
            <span className="mx-2 text-gray-400">•</span>
            <span>Ctrl+K for AI • Ctrl+M to make better</span>
          </div>
        </div>
      )}
      </div>
    </>
  );
};