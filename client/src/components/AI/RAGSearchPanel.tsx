import React, { useState } from 'react';
import { useAIStore } from '../../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
  Search, 
  FileText, 
  Brain,
  Filter,
  RefreshCw,
  BookOpen,
  Users,
  MapPin,
  Calendar,
  Star,
  Target,
  Layers
} from 'lucide-react';

interface RAGSearchPanelProps {
  projectId: string;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: 'character' | 'scene' | 'plot' | 'theme' | 'note';
  relevanceScore: number;
  metadata?: {
    chapter?: string;
    tags?: string[];
    lastModified?: Date;
  };
}

export const RAGSearchPanel: React.FC<RAGSearchPanelProps> = ({ projectId }) => {
  const {
    ragResults: searchResults,
    ragSummary: searchSummary,
    loading: ragLoading,
    error: ragError,
    searchRAG,
    clearError: clearRagError
  } = useAIStore();
  
  // Debug: log the current state
  React.useEffect(() => {
    console.log('🔥 RAGSearchPanel state update:', {
      searchResults,
      searchSummary,
      ragLoading,
      ragError,
      resultCount: searchResults?.length || 0
    });
  }, [searchResults, searchSummary, ragLoading, ragError]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'character' | 'scene' | 'plot' | 'theme'>('all');
  const [hasSearched, setHasSearched] = useState(false);

  // Convert RAG results to SearchResult format
  const results: SearchResult[] = React.useMemo(() => {
    console.log('🔍 Processing search results:', searchResults);
    
    if (!searchResults || searchResults.length === 0) {
      console.log('❌ No search results to process');
      return [];
    }
    
    const processedResults = searchResults.map((result, index) => {
      console.log(`Processing result ${index + 1}:`, result);
      
      const contentType = result.metadata?.contentType || 'note';
      const mappedType: SearchResult['type'] = contentType === 'narrative' ? 'scene' : 
                                              contentType === 'character' ? 'character' :
                                              contentType === 'plot' ? 'plot' :
                                              contentType === 'theme' ? 'theme' : 'note';
      
      // Generate a better title based on content and metadata
      let title = result.metadata?.title;
      if (!title) {
        const projectTitle = result.metadata?.projectTitle?.trim() || 'Project';
        const characters = result.metadata?.characters || [];
        
        if (characters.length > 0) {
          title = `${contentType.charAt(0).toUpperCase() + contentType.slice(1)}: ${characters[0]} - ${projectTitle}`;
        } else {
          title = `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} from ${projectTitle}`;
        }
      }
      
      const processedResult = {
        id: `${index}`,
        title,
        content: result.content || '',
        type: mappedType,
        relevanceScore: result.metadata?.relevanceScore || (result as any).relevanceScore || 0.8,
        metadata: {
          chapter: result.metadata?.chapter,
          tags: result.metadata?.semanticTags || result.metadata?.themes || [],
          lastModified: result.metadata?.timestamp ? new Date(result.metadata.timestamp) : undefined
        }
      };
      
      console.log(`✅ Processed result ${index + 1}:`, processedResult);
      return processedResult;
    });
    
    // Filter by search type
    const filteredResults = processedResults.filter(result => 
      searchType === 'all' || result.type === searchType
    );
    
    console.log(`📊 Final filtered results (${filteredResults.length}/${processedResults.length}):`, filteredResults);
    return filteredResults;
  }, [searchResults, searchType]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim() || ragLoading) return;

    console.log('🚀 Starting search for:', searchQuery, 'Project ID:', projectId);
    setHasSearched(true);
    
    try {
      console.log('🗺️ Before searchRAG call');
      await searchRAG(searchQuery, projectId);
      console.log('✅ searchRAG completed, results should be in store now');
      // Results will be handled by the store and accessed via searchResults
    } catch (error) {
      console.error('❌ RAG search error:', error);
    }
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'character': return <Users className="w-4 h-4" />;
      case 'scene': return <MapPin className="w-4 h-4" />;
      case 'plot': return <BookOpen className="w-4 h-4" />;
      case 'theme': return <Target className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'character': return 'bg-blue-100 text-blue-800';
      case 'scene': return 'bg-green-100 text-green-800';
      case 'plot': return 'bg-purple-100 text-purple-800';
      case 'theme': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRelevanceScore = (score: number) => {
    return `${Math.round(score * 100)}% relevance`;
  };

  const quickSearches = [
    { query: "Main character motivations", icon: Users },
    { query: "Plot points and twists", icon: BookOpen },
    { query: "Setting descriptions", icon: MapPin },
    { query: "Dialogue examples", icon: FileText },
    { query: "Theme analysis", icon: Target },
    { query: "Character relationships", icon: Users }
  ];

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="h-full flex flex-col space-y-3">
      {/* Compact Search Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-sm">Smart Search</span>
          </div>
          <Badge variant="outline" className="text-xs py-0 px-2">
            RAG
          </Badge>
        </div>
        
        <form onSubmit={handleSearch} className="space-y-3 px-3">
            {/* Search Input */}
            <div className="flex space-x-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your project content..."
                className="flex-1"
                disabled={ragLoading}
              />
              <Button 
                type="submit" 
                disabled={ragLoading || !searchQuery.trim()}
                className="flex items-center space-x-1"
              >
                {ragLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search</span>
              </Button>
            </div>

            {/* Search Filters */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <div className="flex space-x-1">
                {['all', 'character', 'scene', 'plot', 'theme'].map((type) => (
                  <Button
                    key={type}
                    variant={searchType === type ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSearchType(type as typeof searchType)}
                    className="text-xs"
                    type="button"
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </form>
        </div>

      {/* Quick Searches */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Searches:</h4>
          <div className="grid grid-cols-2 gap-2">
            {quickSearches.map((item, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickSearch(item.query)}
                className="justify-start text-xs h-8"
                disabled={ragLoading}
              >
                <item.icon className="w-3 h-3 mr-2" />
                {item.query}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search Summary */}
      {searchSummary && hasSearched && !ragLoading && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center space-x-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <span>Search Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Results Overview */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-600">Results Overview</h4>
                <p className="text-sm">{searchSummary.totalResults} documents found</p>
                <p className="text-xs text-gray-500">{searchSummary.searchStrategy}</p>
              </div>
              
              {/* Characters */}
              {searchSummary.topCharacters.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600">Characters</h4>
                  <div className="flex flex-wrap gap-1">
                    {searchSummary.topCharacters.slice(0, 3).map((char, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Users className="w-3 h-3 mr-1" />
                        {char}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Themes */}
              {searchSummary.topThemes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600">Themes</h4>
                  <div className="flex flex-wrap gap-1">
                    {searchSummary.topThemes.slice(0, 3).map((theme, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Target className="w-3 h-3 mr-1" />
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Key Findings */}
            {searchSummary.keyFindings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-600">Key Findings</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {searchSummary.keyFindings.map((finding, index) => (
                    <li key={index} className="flex items-center space-x-1">
                      <Star className="w-3 h-3 text-yellow-500" />
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search Results */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Search Results</span>
            {results.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {results.length} result{results.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {(() => {
            console.log('🎨 Rendering decision:', {
              hasSearched,
              ragError,
              ragLoading,
              resultsLength: results.length,
              searchResultsLength: searchResults?.length || 0
            });
            
            if (!hasSearched) {
              return (
                <div className="text-center text-gray-500 py-8">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">Search your project content using semantic search</p>
                  <p className="text-xs mt-2">Find characters, scenes, themes, and plot points</p>
                </div>
              );
            }
            
            if (ragError) {
              return (
                <div className="text-center text-red-500 py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-red-300" />
                  <p className="text-sm">Search failed</p>
                  <p className="text-xs mt-2">{ragError}</p>
                </div>
              );
            }
            
            if (ragLoading) {
              return (
                <div className="text-center text-gray-500 py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-500" />
                  <p className="text-sm">Searching...</p>
                </div>
              );
            }
            
            if (results.length === 0) {
              return (
                <div className="text-center text-gray-500 py-8">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-sm">No results found</p>
                  <p className="text-xs mt-2">Try different keywords or search terms</p>
                  <p className="text-xs mt-1 text-red-500">Debug: {searchResults?.length || 0} raw results from API</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Result Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(result.type)}
                        <h3 className="font-semibold text-gray-800">{result.title}</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getTypeColor(result.type)}`}
                        >
                          {result.type}
                        </Badge>
                        <div className="flex items-center text-xs text-gray-500">
                          <Star className="w-3 h-3 mr-1" />
                          {formatRelevanceScore(result.relevanceScore)}
                        </div>
                      </div>
                    </div>

                    {/* Result Content */}
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                      {result.content}
                    </p>

                    {/* Result Metadata */}
                    {result.metadata && (
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-4">
                          {result.metadata.chapter && (
                            <div className="flex items-center">
                              <BookOpen className="w-3 h-3 mr-1" />
                              {result.metadata.chapter}
                            </div>
                          )}
                          {result.metadata.lastModified && (
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 mr-1" />
                              {result.metadata.lastModified.toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {result.metadata.tags && (
                          <div className="flex space-x-1">
                            {result.metadata.tags.slice(0, 3).map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Error Display */}
      {ragError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-700">{ragError}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearRagError}
                className="text-red-600 hover:text-red-700"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Info */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-600">
            <div className="flex items-center space-x-2 mb-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span className="font-medium">Search Capabilities:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Semantic Understanding</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Context Awareness</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Relevance Scoring</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Type Filtering</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
