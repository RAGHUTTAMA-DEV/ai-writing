import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Save, Lightbulb, Zap } from 'lucide-react';
import apiService from '../services/api';

interface CopilotEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onChange: (content: string) => void;
  projectId?: string;
}

interface AutocompleteSuggestion {
  text: string;
  position: number;
  type: 'autocomplete' | 'spelling' | 'grammar';
}

export const CopilotEditor: React.FC<CopilotEditorProps> = ({ 
  initialContent, 
  onSave, 
  onChange, 
  projectId 
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [suggestion, setSuggestion] = useState<AutocompleteSuggestion | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Common spelling mistakes and corrections
  const spellCorrections: Record<string, string> = {
    'teh': 'the',
    'adn': 'and',
    'recieve': 'receive',
    'seperate': 'separate',
    'definately': 'definitely',
    'occured': 'occurred',
    'begining': 'beginning',
    'writting': 'writing',
    'thier': 'their',
    'freind': 'friend',
    'becuase': 'because',
    'acheive': 'achieve',
    'beleive': 'believe',
    'neccessary': 'necessary',
    'tommorrow': 'tomorrow',
    'accomodate': 'accommodate',
    'embarass': 'embarrass',
    'occassion': 'occasion',
    'priviledge': 'privilege',
    'recomend': 'recommend'
  };

  // Check for spelling mistakes in the last word
  const checkSpelling = useCallback((text: string, cursorPos: number): AutocompleteSuggestion | null => {
    const beforeCursor = text.substring(0, cursorPos);
    const words = beforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];
    
    if (lastWord && lastWord.length > 2) {
      const correction = spellCorrections[lastWord.toLowerCase()];
      if (correction) {
        const wordStart = beforeCursor.lastIndexOf(lastWord);
        return {
          text: correction,
          position: wordStart,
          type: 'spelling'
        };
      }
    }
    
    return null;
  }, []);

  // Debounced autocomplete function
  const debouncedAutocomplete = useCallback(async (text: string, cursorPos: number) => {
    if (text.length < 10) return;
    
    // First check for spelling mistakes
    const spellingSuggestion = checkSpelling(text, cursorPos);
    if (spellingSuggestion) {
      setSuggestion(spellingSuggestion);
      setShowSuggestion(true);
      return;
    }
    
    // Then get AI autocomplete if we have a project ID
    if (!projectId) return;
    
    try {
      setIsLoadingSuggestion(true);
      const response = await apiService.generateAutocomplete(text, cursorPos, projectId);
      
      if (response.suggestion && response.suggestion.trim()) {
        setSuggestion({
          text: response.suggestion,
          position: cursorPos,
          type: 'autocomplete'
        });
        setShowSuggestion(true);
      }
    } catch (error) {
      console.error('Error getting autocomplete suggestion:', error);
    } finally {
      setIsLoadingSuggestion(false);
    }
  }, [projectId, checkSpelling]);

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(newContent);
    onChange(newContent);
    setCursorPosition(cursorPos);
    
    // Hide current suggestion when typing
    setShowSuggestion(false);
    setSuggestion(null);
    
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    
    // Quick spell check (immediate)
    const spellingSuggestion = checkSpelling(newContent, cursorPos);
    if (spellingSuggestion) {
      suggestionTimeoutRef.current = setTimeout(() => {
        setSuggestion(spellingSuggestion);
        setShowSuggestion(true);
      }, 500); // Show spelling suggestions quickly
    } else {
      // Set timeout for AI autocomplete (4 seconds)
      timeoutRef.current = setTimeout(() => {
        debouncedAutocomplete(newContent, cursorPos);
      }, 4000);
    }
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  // Accept the suggestion
  const acceptSuggestion = () => {
    if (!suggestion || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    let newContent: string;
    let newCursorPos: number;
    
    if (suggestion.type === 'spelling') {
      // Replace the misspelled word
      const beforeWord = content.substring(0, suggestion.position);
      const afterWord = content.substring(suggestion.position);
      const oldWordMatch = afterWord.match(/^\w+/);
      const oldWordLength = oldWordMatch ? oldWordMatch[0].length : 0;
      
      newContent = beforeWord + suggestion.text + content.substring(suggestion.position + oldWordLength);
      newCursorPos = suggestion.position + suggestion.text.length;
    } else {
      // Insert autocomplete suggestion
      const beforeSuggestion = content.substring(0, suggestion.position);
      const afterSuggestion = content.substring(suggestion.position);
      newContent = beforeSuggestion + suggestion.text + afterSuggestion;
      newCursorPos = suggestion.position + suggestion.text.length;
    }
    
    setContent(newContent);
    onChange(newContent);
    setSuggestion(null);
    setShowSuggestion(false);
    
    // Set cursor position after the inserted suggestion
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
      setCursorPosition(cursorPos);
      
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

  // Calculate text metrics for positioning
  const getTextMetrics = useCallback(() => {
    if (!textareaRef.current) return { lineHeight: 24, charWidth: 8 };
    
    const textarea = textareaRef.current;
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseInt(style.lineHeight) || 24;
    
    // Create a temporary element to measure character width
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
    
    // Calculate position based on suggestion position
    const beforeText = content.substring(0, suggestion.position);
    const lines = beforeText.split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    // Account for textarea padding and border
    const textareaRect = textarea.getBoundingClientRect();
    const textareaStyle = window.getComputedStyle(textarea);
    const paddingLeft = parseInt(textareaStyle.paddingLeft) || 16;
    const paddingTop = parseInt(textareaStyle.paddingTop) || 16;
    
    const top = currentLine * lineHeight + paddingTop;
    const left = currentColumn * charWidth + paddingLeft;
    
    // Different styling based on suggestion type
    const getSuggestionStyle = () => {
      const baseStyle = {
        position: 'absolute' as const,
        top: `${top}px`,
        left: `${left}px`,
        fontSize: textareaStyle.fontSize,
        fontFamily: textareaStyle.fontFamily,
        lineHeight: textareaStyle.lineHeight,
        whiteSpace: 'pre' as const,
        pointerEvents: 'none' as const,
        zIndex: 10,
        userSelect: 'none' as const,
      };
      
      switch (suggestion.type) {
        case 'spelling':
          return {
            ...baseStyle,
            color: '#ef4444',
            backgroundColor: '#fef2f2',
            padding: '1px 3px',
            borderRadius: '3px',
            border: '1px solid #fecaca',
          };
        case 'autocomplete':
          return {
            ...baseStyle,
            color: '#6b7280',
            opacity: 0.7,
          };
        default:
          return {
            ...baseStyle,
            color: '#6b7280',
            opacity: 0.6,
          };
      }
    };
    
    return (
      <div style={getSuggestionStyle()}>
        {suggestion.text}
      </div>
    );
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, []);

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {isLoadingSuggestion && (
            <div className="flex items-center text-sm text-blue-600">
              <Zap className="w-4 h-4 mr-1 animate-pulse" />
              AI thinking...
            </div>
          )}
          {showSuggestion && suggestion && (
            <div className="flex items-center text-sm">
              {suggestion.type === 'spelling' ? (
                <div className="flex items-center text-red-600">
                  <span className="w-4 h-4 mr-1">🔤</span>
                  Spelling correction available - Press Tab to fix
                </div>
              ) : (
                <div className="flex items-center text-blue-600">
                  <Lightbulb className="w-4 h-4 mr-1" />
                  AI suggestion - Press Tab to accept, Esc to dismiss
                </div>
              )}
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="flex items-center">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          className="w-full h-96 p-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-6 resize-none bg-white"
          placeholder="Start writing your story here..."
          spellCheck={false} // We handle our own spell checking
          style={{
            lineHeight: '24px',
            letterSpacing: '0.5px',
          }}
        />
        {renderSuggestionOverlay()}
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex items-center justify-between">
          <div>
            Words: {content.split(/\s+/).filter(word => word.length > 0).length} | 
            Characters: {content.length} | 
            Lines: {content.split('\n').length}
          </div>
          <div className="text-right">
            Cursor: {cursorPosition}
          </div>
        </div>
        <div className="flex items-center space-x-4 flex-wrap">
          <span className="flex items-center">
            <Zap className="w-3 h-3 mr-1" />
            AI suggestions after 4s pause
          </span>
          <span className="flex items-center">
            ⌨️ Tab to accept
          </span>
          <span className="flex items-center">
            🔤 Smart spell check
          </span>
          <span className="flex items-center">
            ➡️ Right arrow also accepts AI suggestions
          </span>
        </div>
      </div>
    </div>
  );
};
