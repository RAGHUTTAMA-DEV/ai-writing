import React, { useState, useRef, useEffect } from 'react';
import { Icon } from "@/components/ui/icon";

interface RichTextEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  isFullScreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  onChange,
  onKeyDown,
  placeholder = "Begin your story...",
  isFullScreen = false,
  className = "",
  style = {}
}) => {
  const [content, setContent] = useState(initialContent);
  const [formatStates, setFormatStates] = useState({
    bold: false,
    italic: false,
    color: null as string | null
  });
  const [showPreview, setShowPreview] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update content when initialContent changes
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  // Handle text input with formatting
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setContent(newContent);
    setCursorPosition(cursorPos);
    onChange(newContent);
  };

  // Toggle formatting states
  const toggleBold = () => {
    setFormatStates(prev => ({ ...prev, bold: !prev.bold }));
    textareaRef.current?.focus();
  };

  const toggleItalic = () => {
    setFormatStates(prev => ({ ...prev, italic: !prev.italic }));
    textareaRef.current?.focus();
  };

  const setColor = (color: string) => {
    setFormatStates(prev => ({ ...prev, color: color }));
    textareaRef.current?.focus();
  };

  // Apply formatting to selected text
  const applyFormatting = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    if (selectedText) {
      let formattedText = selectedText;
      
      // Apply color first
      if (formatStates.color) {
        formattedText = `[${formattedText}]{color:${formatStates.color}}`;
      }
      
      // Apply bold
      if (formatStates.bold && !selectedText.startsWith('**')) {
        formattedText = `**${formattedText}**`;
      }
      
      // Apply italic
      if (formatStates.italic && !selectedText.startsWith('*') && !selectedText.startsWith('**')) {
        formattedText = `*${formattedText}*`;
      } else if (formatStates.italic && selectedText.startsWith('**')) {
        const innerText = selectedText.substring(2, selectedText.length - 2);
        formattedText = `***${innerText}***`;
      }

      const newContent = content.substring(0, start) + formattedText + content.substring(end);
      setContent(newContent);
      onChange(newContent);
      
      // Reset formatting toggles
      setFormatStates({ bold: false, italic: false, color: null });
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        toggleBold();
      } else if (e.key === 'i') {
        e.preventDefault();
        toggleItalic();
      } else if (e.key === 'Enter' && (formatStates.bold || formatStates.italic || formatStates.color)) {
        e.preventDefault();
        applyFormatting();
      }
    }
    
    // Call parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Parse markdown for preview
  const parseMarkdown = (text: string) => {
    return text
      .replace(/\[([^\]]+)\]\{color:([^}]+)\}/g, '<span style="color: $2">$1</span>')
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/📚/g, '📚')
      .replace(/💡/g, '💡')
      .replace(/✨/g, '✨')
      .replace(/\n/g, '<br />');
  };

  // Get current formatting status at cursor
  const getCurrentFormatting = () => {
    const beforeCursor = content.substring(0, cursorPosition);
    const afterCursor = content.substring(cursorPosition);
    
    const boldStart = beforeCursor.lastIndexOf('**');
    const boldEnd = afterCursor.indexOf('**');
    const italicStart = beforeCursor.lastIndexOf('*');
    const italicEnd = afterCursor.indexOf('*');
    
    const inBold = boldStart >= 0 && boldEnd >= 0;
    const inItalic = italicStart >= 0 && italicEnd >= 0;
    
    return { inBold, inItalic };
  };

  const formatting = getCurrentFormatting();

  return (
    <div className="h-full flex flex-col relative">
      {/* Formatting Toolbar */}
      <div className={`absolute ${isFullScreen ? 'top-2 right-2' : 'top-4 right-4'} z-10 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg p-2 flex items-center space-x-2`}>
        {/* Bold Button */}
        <button
          onClick={toggleBold}
          className={`p-2 rounded-lg transition-all ${
            formatStates.bold || formatting.inBold
              ? 'bg-blue-500 text-white shadow-md'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Bold (Ctrl+B)"
        >
          <span className="font-bold text-sm">B</span>
        </button>
        
        {/* Italic Button */}
        <button
          onClick={toggleItalic}
          className={`p-2 rounded-lg transition-all ${
            formatStates.italic || formatting.inItalic
              ? 'bg-blue-500 text-white shadow-md'
              : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Italic (Ctrl+I)"
        >
          <span className="italic text-sm">I</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Color Buttons */}
        <button
          onClick={() => setColor('red')}
          className={`p-2 rounded-lg transition-all ${
            formatStates.color === 'red' ? 'bg-red-100 ring-2 ring-red-500' : 'hover:bg-gray-100'
          }`}
          title="Red Text"
        >
          <span style={{color: 'red', fontWeight: 'bold', fontSize: '14px'}}>A</span>
        </button>
        
        <button
          onClick={() => setColor('blue')}
          className={`p-2 rounded-lg transition-all ${
            formatStates.color === 'blue' ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'
          }`}
          title="Blue Text"
        >
          <span style={{color: 'blue', fontWeight: 'bold', fontSize: '14px'}}>A</span>
        </button>
        
        <button
          onClick={() => setColor('green')}
          className={`p-2 rounded-lg transition-all ${
            formatStates.color === 'green' ? 'bg-green-100 ring-2 ring-green-500' : 'hover:bg-gray-100'
          }`}
          title="Green Text"
        >
          <span style={{color: 'green', fontWeight: 'bold', fontSize: '14px'}}>A</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300"></div>

        {/* Emoji and Special Formatting */}
        <button
          onClick={() => {
            const textarea = textareaRef.current;
            if (textarea) {
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const selectedText = content.substring(start, end);
              const newText = selectedText ? `${selectedText} ✨` : ` ✨ `;
              const beforeText = content.substring(0, start);
              const afterText = content.substring(end);
              const newContent = beforeText + newText + afterText;
              setContent(newContent);
              onChange(newContent);
            }
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Add Emoji"
        >
          <span className="text-lg">✨</span>
        </button>

        {/* Preview Toggle */}
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`p-2 rounded-lg transition-all ${
            showPreview ? 'bg-green-500 text-white' : 'hover:bg-gray-100 text-gray-700'
          }`}
          title="Toggle Preview"
        >
          <Icon name="eye" size="sm" />
        </button>
      </div>

      {/* Editor Area */}
      <div className={`flex-1 ${showPreview ? 'grid grid-cols-2 gap-4' : ''}`}>
        {/* Text Input */}
        <div className="relative h-full">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart)}
            className={`
              w-full h-full border-0 resize-none outline-none bg-white text-gray-900 
              placeholder-gray-400 focus:placeholder-gray-300 transition-all duration-300
              ${isFullScreen 
                ? 'px-8 py-12 md:px-16 md:py-16' 
                : 'px-6 py-8 sm:px-8 sm:py-12 md:px-12 md:py-16 lg:px-20 lg:py-20'
              }
              ${formatStates.bold || formatStates.italic || formatStates.color ? 'bg-blue-50/30' : ''}
              ${className}
            `}
            placeholder={placeholder}
            spellCheck={false}
            style={{
              fontFamily: 'Georgia, "Times New Roman", Times, serif',
              fontSize: '20px',
              lineHeight: '1.75',
              letterSpacing: '0.01em',
              ...style
            }}
          />
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="relative h-full border-l border-gray-200">
            <div className="absolute top-2 left-3 text-xs text-gray-400 bg-white px-2 py-1 rounded z-10">
              Live Preview
            </div>
            <div 
              className={`
                w-full h-full overflow-auto bg-gray-50/50
                ${isFullScreen 
                  ? 'px-8 py-12 md:px-16 md:py-16' 
                  : 'px-6 py-8 sm:px-8 sm:py-12 md:px-12 md:py-16 lg:px-20 lg:py-20'
                }
              `}
              dangerouslySetInnerHTML={{ 
                __html: parseMarkdown(content) || '<span class="text-gray-400 italic">Preview will appear here...</span>' 
              }}
              style={{
                fontFamily: 'Georgia, "Times New Roman", Times, serif',
                fontSize: '20px',
                lineHeight: '1.75',
                letterSpacing: '0.01em',
              }}
            />
          </div>
        )}
      </div>

      {/* Formatting Status */}
      {(formatStates.bold || formatStates.italic || formatStates.color) && (
        <div className="absolute bottom-4 left-4 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm shadow-lg">
          Formatting Active - Select text and press Enter to apply
          {formatStates.bold && " Bold"}
          {formatStates.italic && " Italic"}
          {formatStates.color && ` ${formatStates.color}`}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;