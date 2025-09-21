import React, { useState, useRef, useEffect } from 'react';
import { useChatbotStore } from '../../store/useChatbotStore';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Send, 
  RefreshCw, 
  Brain,
  User,
  Bot,
  Sparkles,
  Clock
} from 'lucide-react';

interface ChatbotPanelProps {
  projectId: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export const ChatbotPanel: React.FC<ChatbotPanelProps> = ({ projectId }) => {
  const {
    loading: chatbotLoading,
    error: chatbotError,
    getPersonalizedSuggestions,
    clearError: clearChatbotError
  } = useChatbotStore();

  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('fast');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'bot',
      content: 'Hello! I\'m your AI writing assistant. I understand your project context and can help with plot development, character insights, writing suggestions, and more. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || chatbotLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');

    const thinkingMessage: ChatMessage = {
      id: 'thinking',
      role: 'bot',
      content: 'Thinking...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      const aiResponse = await getPersonalizedSuggestions(currentInput, projectId, analysisMode);
      
      setMessages(prev => {
        const newMessages = prev.filter(msg => msg.id !== 'thinking');
        const botResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: aiResponse || 'I apologize, but I received an empty response. Could you try rephrasing your question?',
          timestamp: new Date()
        };
        return [...newMessages, botResponse];
      });
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const newMessages = prev.filter(msg => msg.id !== 'thinking');
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: 'I apologize, but I encountered an error. Please try again or rephrase your question.',
          timestamp: new Date()
        };
        return [...newMessages, errorMessage];
      });
    }
  };

  const formatMessage = (content: string) => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      if (trimmedLine.match(/^##\s+/)) {
        elements.push(
          <div key={i} className="mb-4 mt-6 first:mt-0">
            <h2 className="text-lg font-bold border-b-2 border-blue-500 pb-2 mb-3 text-blue-900">
              {trimmedLine.replace(/^##\s+/, '')}
            </h2>
          </div>
        );
        continue;
      }

      // Sub-section headers (**TITLE**: or **TITLE**)
      if (trimmedLine.match(/^\*\*[^*]+\*\*:?\s*$/) || trimmedLine.match(/^\*\*[A-Z][^*]*\*\*$/)) {
        elements.push(
          <h3 key={i} className="text-base font-semibold mt-4 mb-2 text-purple-700">
            {trimmedLine.replace(/\*\*/g, '').replace(/:$/, '')}
          </h3>
        );
        continue;
      }

      // Score lines (Score: [1-10])
      if (trimmedLine.match(/^\*\*Score:\s*\[\d+-\d+\]\*\*/)) {
        elements.push(
          <div key={i} className="bg-blue-50 border-l-4 border-blue-400 p-3 my-3 rounded">
            <div className="flex items-center">
              <div className="text-base font-bold text-blue-700">
                {trimmedLine.replace(/\*\*/g, '')}
              </div>
            </div>
          </div>
        );
        continue;
      }

      if (trimmedLine.match(/^-\s+/)) {
        const bulletText = trimmedLine.replace(/^-\s+/, '');
        elements.push(
          <div key={i} className="flex items-start mb-2 ml-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></div>
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
              <span className="font-semibold text-blue-600 mr-3 mt-0.5">
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
        elements.push(
          <div key={i} className="text-gray-700 leading-relaxed mb-2 bg-gray-50 p-2 rounded">
            {renderInlineFormatting(trimmedLine)}
          </div>
        );
        continue;
      }

      // Regular paragraphs
      elements.push(
        <p key={i} className="text-gray-700 leading-relaxed mb-2">
          {renderInlineFormatting(trimmedLine)}
        </p>
      );
    }

    return <div className="space-y-1">{elements}</div>;
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

  const quickPrompts = [
    "Who are the main characters in my story?",
    "What themes are present in my story?",
    "Help me develop my main character",
    "Suggest plot twists for my story",
    "How can I improve my dialogue?",
    "Help me write a compelling opening"
  ];

  const handleQuickPrompt = (prompt: string) => {
    setInputMessage(prompt);
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* Compact Chat Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <Brain className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-sm">AI Chat</span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Mode Toggle */}
          <div className="flex bg-white border rounded-md p-0.5">
            <button
              onClick={() => setAnalysisMode('fast')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                analysisMode === 'fast'
                  ? 'bg-green-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚡ Fast
            </button>
            <button
              onClick={() => setAnalysisMode('deep')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                analysisMode === 'deep'
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🔍 Deep
            </button>
          </div>
          <Badge variant="outline" className="text-xs py-0 px-2">
            Context-Aware
          </Badge>
        </div>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md xl:max-w-lg flex ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                } items-start space-x-2`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white ml-2' 
                      : 'bg-purple-100 text-purple-600 mr-2'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4" />
                    ) : (
                      message.content === 'Thinking...' ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )
                    )}
                  </div>

                  {/* Message */}
                  <div className={`rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 border'
                  }`}>
                    <div className="text-sm">
                      {message.role === 'bot' && message.content !== 'Thinking...' ? (
                        <div className="prose prose-sm max-w-none">
                          {formatMessage(message.content)}
                        </div>
                      ) : (
                        <div className={message.content === 'Thinking...' ? 'italic text-gray-500' : ''}>
                          {message.content}
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp */}
                    <div className={`text-xs mt-2 flex items-center ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      <Clock className="w-3 h-3 mr-1" />
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-4 border-t bg-gray-50">
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Prompts:</h4>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.slice(0, 3).map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="text-xs"
                    disabled={chatbotLoading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="flex space-x-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything about your writing..."
                className="flex-1"
                disabled={chatbotLoading}
              />
              <Button 
                type="submit" 
                disabled={chatbotLoading || !inputMessage.trim()}
                className="flex items-center space-x-1"
              >
                {chatbotLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {chatbotError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{chatbotError}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearChatbotError}
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features Info */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="font-medium">AI Features Active ({analysisMode.toUpperCase()} Mode):</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Project Context</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Character Memory</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{analysisMode === 'fast' ? 'Full Story Access' : 'Deep RAG Analysis'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Writing History</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {analysisMode === 'fast' 
                ? '⚡ Fast mode: Direct access to your story content for instant answers'
                : '🔍 Deep mode: Advanced RAG analysis with comprehensive context search'
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
