import React, { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useChatbotStore } from '../store/useChatbotStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  MessageCircle, 
  BookOpen, 
  RefreshCw,
  User,
  Bot,
  Send
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: string;
}

export const ChatbotPage: React.FC = () => {
  const { activeProject } = useProjectStore();
  const {
    suggestions: chatbotSuggestions,
    loading: chatbotLoading,
    error: chatbotError,
    getPersonalizedSuggestions,
    clearError: clearChatbotError
  } = useChatbotStore();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom of chat when new messages are added
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim() || !activeProject) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: chatInput,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input
    const currentInput = chatInput;
    setChatInput('');
    
    // Add a placeholder for the bot response
    setChatMessages(prev => [...prev, { 
      role: 'bot', 
      content: 'Thinking...',
      timestamp: new Date().toISOString()
    }]);
    
    try {
      // Get response from chatbot
      await getPersonalizedSuggestions(currentInput, activeProject.id);
      
      // Update the last message with the actual response
      setChatMessages(prev => {
        const newMessages = [...prev];
        const lastSuggestion = chatbotSuggestions[chatbotSuggestions.length - 1];
        newMessages[newMessages.length - 1] = { 
          role: 'bot', 
          content: lastSuggestion || 'I\'m not sure how to help with that. Could you be more specific?',
          timestamp: new Date().toISOString()
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Chatbot error:', error);
      // Update the last message with an error response
      setChatMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          role: 'bot', 
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString()
        };
        return newMessages;
      });
    }
  };

  const renderSuggestions = (content: string) => {
    if (!content) return null;
    
    const lines = content.split('\n').filter(line => line.trim());
    const isStructured = lines.some(line => 
      /^\s*\*\s*\*.*\*\s*\*/.test(line) || 
      /^\s*#{1,6}\s/.test(line) || 
      /^\s*\d+\.\s/.test(line) || 
      /^\s*[-*]\s/.test(line)
    );
    
    if (isStructured) {
      return (
        <div className="space-y-2">
          {lines.map((line, index) => {
            if (/^\s*\*\s*\*.*\*\s*\*/.test(line)) {
              return (
                <div key={index} className="font-semibold text-blue-800 border-b border-blue-200 pb-1">
                  {line.replace(/\*\s*\*/g, '').trim()}
                </div>
              );
            }
            else if (/^\s*\d+\.\s/.test(line)) {
              return (
                <div key={index} className="ml-2 text-gray-700 flex">
                  <span className="font-medium text-blue-600 mr-2">
                    {line.match(/^\s*\d+\./)![0]}
                  </span>
                  <span>{line.replace(/^\s*\d+\.\s*/, '')}</span>
                </div>
              );
            }
            else if (/^\s*[-*]\s/.test(line)) {
              return (
                <div key={index} className="ml-4 text-gray-600 flex">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>{line.replace(/^\s*[-*]\s*/, '')}</span>
                </div>
              );
            }
            else if (line.trim()) {
              return (
                <div key={index} className="text-gray-700 leading-relaxed">
                  {line.trim()}
                </div>
              );
            }
            return null;
          })}
        </div>
      );
    } else {
      return (
        <div className="space-y-2">
          {lines.map((line, index) => (
            <p key={index} className="text-gray-700 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      );
    }
  };

  if (!activeProject) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg mb-2">No project selected</p>
            <p className="text-gray-400">Select a project to start chatting with your AI assistant</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              <span>AI Writing Assistant Chat</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Project: {activeProject.title}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50 space-y-3 mb-4"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>Start a conversation with your AI writing assistant!</p>
                <p className="text-sm mt-1">Ask for help with your writing, character development, plot ideas, and more.</p>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md flex ${
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
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border shadow-sm'
                      }`}
                    >
                      <div className="text-sm">
                        {message.role === 'bot' && message.content !== 'Thinking...' ? 
                          renderSuggestions(message.content) : 
                          message.content
                        }
                      </div>
                      <div className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}>
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="flex space-x-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask me anything about your writing..."
              className="flex-1"
              disabled={chatbotLoading}
            />
            <Button 
              type="submit" 
              disabled={chatbotLoading || !chatInput.trim()}
              className="flex items-center space-x-1"
            >
              {chatbotLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
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
    </div>
  );
};
