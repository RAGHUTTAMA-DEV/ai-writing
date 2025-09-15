import React, { useState, useRef, useEffect } from 'react';
import { useChatbotStore } from '../../store/useChatbotStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  MessageCircle, 
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
    suggestions: chatbotSuggestions,
    loading: chatbotLoading,
    error: chatbotError,
    getPersonalizedSuggestions,
    clearError: clearChatbotError
  } = useChatbotStore();

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

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');

    // Add thinking indicator
    const thinkingMessage: ChatMessage = {
      id: 'thinking',
      role: 'bot',
      content: 'Thinking...',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, thinkingMessage]);

    try {
      // Get AI response
      await getPersonalizedSuggestions(currentInput, projectId);
      
      // Remove thinking indicator and add actual response
      setMessages(prev => {
        const newMessages = prev.filter(msg => msg.id !== 'thinking');
        const botResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: chatbotSuggestions[chatbotSuggestions.length - 1] || 'I apologize, but I encountered an issue generating a response. Could you try rephrasing your question?',
          timestamp: new Date()
        };
        return [...newMessages, botResponse];
      });
    } catch (error) {
      console.error('Chat error:', error);
      // Remove thinking indicator and add error message
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
    // Split content into paragraphs and format
    return content.split('\n').map((paragraph, index) => {
      if (!paragraph.trim()) return null;
      
      // Check for headers (lines starting with **)
      if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
        return (
          <h4 key={index} className="font-semibold text-gray-800 mt-3 mb-2">
            {paragraph.replace(/\*\*/g, '')}
          </h4>
        );
      }
      
      // Check for numbered lists
      if (paragraph.match(/^\d+\./)) {
        return (
          <div key={index} className="ml-2 mb-2 flex">
            <span className="font-medium text-blue-600 mr-2">
              {paragraph.match(/^\d+\./)![0]}
            </span>
            <span>{paragraph.replace(/^\d+\.\s*/, '')}</span>
          </div>
        );
      }
      
      // Check for bullet points
      if (paragraph.startsWith('- ') || paragraph.startsWith('• ')) {
        return (
          <div key={index} className="ml-4 mb-2 flex">
            <span className="text-blue-500 mr-2">•</span>
            <span>{paragraph.replace(/^[-•]\s*/, '')}</span>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index} className="mb-2 leading-relaxed">
          {paragraph}
        </p>
      );
    }).filter(Boolean);
  };

  const quickPrompts = [
    "Help me develop my main character",
    "Suggest plot twists for my story",
    "How can I improve my dialogue?",
    "What themes should I explore?",
    "Help me write a compelling opening",
    "Suggest ways to build tension"
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
        <Badge variant="outline" className="text-xs py-0 px-2">
          Context-Aware
        </Badge>
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
              <span className="font-medium">AI Features Active:</span>
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
                <span>Theme Analysis</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Writing History</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
