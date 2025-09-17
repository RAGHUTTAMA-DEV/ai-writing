import React, { useState, useEffect } from 'react';
import { Icon, LoadingIcon } from './icon';

interface PerformanceMonitorProps {
  isLoading: boolean;
  loadingText?: string;
  successText?: string;
  errorText?: string | null;
  showProgress?: boolean;
  estimatedTime?: number; // in seconds
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isLoading,
  loadingText = "Processing...",
  successText = "Complete",
  errorText = null,
  showProgress = true,
  estimatedTime = 3
}) => {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Progress simulation for better UX
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      setElapsedTime(0);
      
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 0.1);
        setProgress(prev => {
          // Simulate realistic progress curve
          const targetProgress = Math.min(95, (elapsedTime / estimatedTime) * 100);
          const diff = targetProgress - prev;
          return prev + (diff * 0.1);
        });
      }, 100);

      return () => clearInterval(interval);
    } else {
      // Complete the progress bar when done
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
  }, [isLoading, elapsedTime, estimatedTime]);

  if (!isLoading && !errorText) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 min-w-[250px] animate-slide-up">
      <div className="flex items-center space-x-3">
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {errorText ? (
            <Icon name="alert-circle" size="sm" className="text-red-500" />
          ) : isLoading ? (
            <LoadingIcon size="sm" className="text-blue-500 animate-spin" />
          ) : (
            <Icon name="check-circle" size="sm" className="text-green-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900 truncate">
              {errorText || (isLoading ? loadingText : successText)}
            </span>
            {isLoading && (
              <span className="text-xs text-gray-500 ml-2">
                {elapsedTime.toFixed(1)}s
              </span>
            )}
          </div>
          
          {/* Progress Bar */}
          {showProgress && isLoading && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          
          {/* Performance Tip */}
          {isLoading && elapsedTime > estimatedTime * 1.5 && (
            <p className="text-xs text-gray-600 mt-1">
              Taking longer than usual. Try shorter text sections for faster results.
            </p>
          )}
        </div>
      </div>
      
      {/* Quick Stats */}
      {!isLoading && !errorText && (
        <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
          ⚡ Response time: {elapsedTime.toFixed(1)}s
        </div>
      )}
    </div>
  );
};

// Enhanced loading states for different AI operations
interface AILoadingStateProps {
  operation: 'autocomplete' | 'suggestions' | 'analysis' | 'chat';
  isActive: boolean;
}

export const AILoadingState: React.FC<AILoadingStateProps> = ({ operation, isActive }) => {
  const config = {
    autocomplete: {
      text: "AI is thinking...",
      icon: "sparkles",
      color: "text-purple-500",
      estimatedTime: 2
    },
    suggestions: {
      text: "Generating suggestions...",
      icon: "lightbulb",
      color: "text-yellow-500",
      estimatedTime: 5
    },
    analysis: {
      text: "Analyzing content...",
      icon: "search",
      color: "text-blue-500",
      estimatedTime: 4
    },
    chat: {
      text: "AI assistant responding...",
      icon: "message-circle",
      color: "text-green-500",
      estimatedTime: 3
    }
  };

  const currentConfig = config[operation];

  if (!isActive) return null;

  return (
    <PerformanceMonitor
      isLoading={true}
      loadingText={currentConfig.text}
      estimatedTime={currentConfig.estimatedTime}
      showProgress={true}
    />
  );
};
