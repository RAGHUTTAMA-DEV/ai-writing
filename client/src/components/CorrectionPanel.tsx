import React, { useState } from 'react';
import { Icon, LoadingIcon } from "@/components/ui/icon";
import apiService from '../services/api';

interface Correction {
  type: 'spelling' | 'grammar' | 'style' | 'clarity';
  original: string;
  corrected: string;
  startIndex: number;
  endIndex: number;
  reason: string;
}

interface CorrectionPanelProps {
  text: string;
  onApplyCorrection: (correction: Correction) => void;
  projectId?: string;
  isVisible: boolean;
  onClose: () => void;
}

export const CorrectionPanel: React.FC<CorrectionPanelProps> = ({
  text,
  onApplyCorrection,
  projectId,
  isVisible,
  onClose
}) => {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [overallFeedback, setOverallFeedback] = useState<string>('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const analyzeText = async () => {
    if (!text.trim()) return;
    
    setIsLoading(true);
    try {
      const result = await apiService.generateCorrections(text, projectId);
      setCorrections(result.corrections);
      setOverallFeedback(result.overallFeedback || '');
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error analyzing text:', error);
      setCorrections([]);
      setOverallFeedback('Error analyzing text. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCorrection = (correction: Correction) => {
    onApplyCorrection(correction);
    // Remove the applied correction from the list
    setCorrections(prev => prev.filter(c => c !== correction));
  };

  const getTypeIcon = (type: Correction['type']) => {
    switch (type) {
      case 'spelling': return 'check-circle';
      case 'grammar': return 'edit';
      case 'style': return 'star';
      case 'clarity': return 'eye';
      default: return 'alert-circle';
    }
  };

  const getTypeColor = (type: Correction['type']) => {
    switch (type) {
      case 'spelling': return 'text-red-600 bg-red-50 border-red-200';
      case 'grammar': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'style': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'clarity': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Icon name="check-circle" size="sm" className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Text Corrections</h3>
                <p className="text-sm text-gray-600">
                  AI-powered spelling, grammar, and style improvements
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/80 rounded-lg transition-colors"
            >
              <Icon name="x" size="sm" className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasAnalyzed ? (
            <div className="text-center py-12">
              <div className="p-4 bg-blue-50 rounded-xl mb-6">
                <Icon name="search" size="lg" className="text-blue-600 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900 mb-2">Ready to Analyze</h4>
                <p className="text-gray-600 text-sm">
                  Click analyze to find spelling errors, grammar issues, and style improvements
                </p>
              </div>
              <button
                onClick={analyzeText}
                disabled={isLoading || !text.trim()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-colors flex items-center space-x-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <LoadingIcon size="sm" className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Icon name="search" size="sm" />
                    <span>Analyze Text</span>
                  </>
                )}
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <LoadingIcon size="lg" className="animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Analyzing your text...</p>
            </div>
          ) : corrections.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-green-50 rounded-xl">
                <Icon name="check-circle" size="lg" className="text-green-600 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900 mb-2">Great work!</h4>
                <p className="text-gray-600 text-sm">
                  No corrections needed. Your text looks good!
                </p>
                {overallFeedback && (
                  <p className="text-gray-700 text-sm mt-3 italic">
                    "{overallFeedback}"
                  </p>
                )}
              </div>
              <button
                onClick={() => setHasAnalyzed(false)}
                className="mt-6 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Analyze Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Feedback */}
              {overallFeedback && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <Icon name="info" size="sm" className="text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 mb-1">Overall Assessment</p>
                      <p className="text-blue-800 text-sm">{overallFeedback}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Corrections List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">
                    Found {corrections.length} correction{corrections.length !== 1 ? 's' : ''}
                  </h4>
                  <button
                    onClick={() => setHasAnalyzed(false)}
                    className="text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
                  >
                    Analyze Again
                  </button>
                </div>

                {corrections.map((correction, index) => (
                  <div
                    key={index}
                    className={`border rounded-xl p-4 ${getTypeColor(correction.type)} hover:shadow-sm transition-shadow`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Icon 
                            name={getTypeIcon(correction.type)} 
                            size="sm" 
                            className={getTypeColor(correction.type).split(' ')[0]} 
                          />
                          <span className={`text-sm font-medium capitalize ${getTypeColor(correction.type).split(' ')[0]}`}>
                            {correction.type}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-gray-600">From:</span>
                            <code className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                              "{correction.original}"
                            </code>
                          </div>
                          <div className="flex items-center space-x-3 text-sm">
                            <span className="text-gray-600">To:</span>
                            <code className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              "{correction.corrected}"
                            </code>
                          </div>
                          {correction.reason && (
                            <p className="text-xs text-gray-600 mt-2">
                              <Icon name="info" size="xs" className="inline mr-1" />
                              {correction.reason}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleApplyCorrection(correction)}
                        className="ml-4 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                      >
                        <Icon name="check" size="xs" />
                        <span>Apply</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};