import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Save, Lightbulb } from 'lucide-react';
import apiService from '../services/api';

interface EnhancedEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onChange: (content: string) => void;
  projectId?: string;
}

interface AutocompleteSuggestion {
  text: string;
  position: number;
}

export const EnhancedEditor: React.FC<EnhancedEditorProps> = ({ 
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
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorPosition = useRef<number>(0);

  // Debounced autocomplete function
  const debouncedAutocomplete = useCallback(async (text: string, cursorPos: number) => {
    if (!projectId || text.length < 10) return;
    
    try {
      setIsLoadingSuggestion(true);
      const response = await apiService.generateAutocomplete(text, cursorPos, projectId);
      
      if (response.suggestion && response.suggestion.trim()) {
        setSuggestion({
          text: response.suggestion,
          position: cursorPos
        });
        setShowSuggestion(true);
      }
    } catch (error) {
      console.error('Error getting autocomplete suggestion:', error);
    } finally {
      setIsLoadingSuggestion(false);
    }
  }, [projectId]);

  // Handle text changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(newContent);
    onChange(newContent);
    
    // Hide current suggestion when typing
    setShowSuggestion(false);
    setSuggestion(null);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout for autocomplete
    timeoutRef.current = setTimeout(() => {
      lastCursorPosition.current = cursorPos;
      debouncedAutocomplete(newContent, cursorPos);
    }, 4000); // 4 second delay as requested
  };

  // Handle key presses
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && suggestion && showSuggestion) {
      e.preventDefault();
      acceptSuggestion();
    } else if (e.key === 'Escape' && showSuggestion) {
      e.preventDefault();
      dismissSuggestion();
    } else {
      // Hide suggestion on any other key press
      if (showSuggestion && !['Tab', 'Escape'].includes(e.key)) {
        setShowSuggestion(false);
      }
    }
  };

  // Accept the suggestion
  const acceptSuggestion = () => {
    if (!suggestion || !textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const beforeSuggestion = content.substring(0, suggestion.position);
    const afterSuggestion = content.substring(suggestion.position);
    const newContent = beforeSuggestion + suggestion.text + afterSuggestion;
    
    setContent(newContent);
    onChange(newContent);
    setSuggestion(null);
    setShowSuggestion(false);
    
    // Set cursor position after the inserted suggestion
    setTimeout(() => {
      const newCursorPos = suggestion.position + suggestion.text.length;
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
      if (suggestion && Math.abs(cursorPos - suggestion.position) > 5) {
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

  // Spell check function (basic implementation)
  const getSpellingSuggestions = (word: string): string[] => {
    // This is a basic implementation. In a real app, you'd use a proper spell-check library
    const commonMisspellings: Record<string, string> = {
      'teh': 'the',
      'adn': 'and',
      'recieve': 'receive',
      'seperate': 'separate',
      'definately': 'definitely',
      'occured': 'occurred',
      'begining': 'beginning',
      'writting': 'writing',
      'thier': 'their',
      'freind': 'friend'
    };
    
    return commonMisspellings[word.toLowerCase()] ? [commonMisspellings[word.toLowerCase()]] : [];
  };

  // Render suggestion overlay
  const renderSuggestionOverlay = () => {
    if (!suggestion || !showSuggestion || !textareaRef.current) return null;
    
    const textarea = textareaRef.current;
    const beforeText = content.substring(0, suggestion.position);
    const lines = beforeText.split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    // Calculate approximate position (this is simplified)
    const lineHeight = 24; // Approximate line height
    const charWidth = 8; // Approximate character width
    const top = currentLine * lineHeight + 40; // 40px for padding
    const left = currentColumn * charWidth + 16; // 16px for padding
    
    return (
      <div
        className="absolute pointer-events-none z-10"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          color: '#6b7280',
          fontSize: '14px',
          fontFamily: 'monospace',
          whiteSpace: 'pre'
        }}
      >
        {suggestion.text}
      </div>
    );
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {isLoadingSuggestion && (
            <div className="flex items-center text-sm text-gray-500">
              <Lightbulb className="w-4 h-4 mr-1 animate-pulse" />
              Getting suggestions...
            </div>
          )}
          {showSuggestion && suggestion && (
            <div className="flex items-center text-sm text-blue-600">
              <Lightbulb className="w-4 h-4 mr-1" />
              Press Tab to accept suggestion, Esc to dismiss
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
          className="w-full h-96 p-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-6 resize-none"
          placeholder="Start writing your story here..."
          spellCheck={true}
          style={{
            lineHeight: '24px',
            letterSpacing: '0.5px'
          }}
        />
        {renderSuggestionOverlay()}
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <div>
          Words: {content.split(/\s+/).filter(word => word.length > 0).length} | 
          Characters: {content.length} | 
          Lines: {content.split('\n').length}
        </div>
        <div className="flex items-center space-x-4">
          <span>💡 AI suggestions appear after 4 seconds of inactivity</span>
          <span>⌨️ Press Tab to accept suggestions</span>
          <span>🔤 Built-in spell check enabled</span>
        </div>
      </div>
    </div>
  );
};
