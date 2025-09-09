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
    loading: ragLoading,
    error: ragError,
    searchRAG,
    clearError: clearRagError
  } = useAIStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'character' | 'scene' | 'plot' | 'theme'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim() || ragLoading) return;

    setHasSearched(true);
    try {
      await searchRAG(searchQuery);
      
      // Mock search results for demonstration
      const mockResults: SearchResult[] = [
        {
          id: '1',
          title: 'Character Development: Sarah Chen',
          content: 'Sarah Chen is the protagonist who undergoes significant character growth throughout the story. Her journey from a hesitant newcomer to a confident leader mirrors the central theme of self-discovery...',
          type: 'character',
          relevanceScore: 0.92,
          metadata: {
            chapter: 'Chapter 3',
            tags: ['protagonist', 'character-arc', 'growth'],
            lastModified: new Date('2024-01-15')
          }
        },
        {
          id: '2',
          title: 'Climactic Scene: The Revelation',
          content: 'The revelation scene takes place in the abandoned library where Sarah discovers the truth about her family\'s past. The setting creates an atmosphere of mystery and discovery...',
          type: 'scene',
          relevanceScore: 0.87,
          metadata: {
            chapter: 'Chapter 12',
            tags: ['climax', 'revelation', 'library'],
            lastModified: new Date('2024-01-14')
          }
        },
        {
          id: '3',
          title: 'Theme: Identity and Belonging',
          content: 'The theme of identity and belonging runs throughout the narrative, exploring how characters find their place in the world and connect with their heritage...',
          type: 'theme',
          relevanceScore: 0.81,
          metadata: {
            tags: ['identity', 'belonging', 'heritage'],
            lastModified: new Date('2024-01-13')
          }
        }
      ];
      
      setResults(mockResults.filter(result => 
        searchType === 'all' || result.type === searchType
      ));
    } catch (error) {
      console.error('RAG search error:', error);
      setResults([]);
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
    <div className="h-full flex flex-col space-y-4">
      {/* Search Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <span>RAG Search</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Semantic Search
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSearch} className="space-y-4">
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
        </CardContent>
      </Card>

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
          {!hasSearched ? (
            <div className="text-center text-gray-500 py-8">
              <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">Search your project content using semantic search</p>
              <p className="text-xs mt-2">Find characters, scenes, themes, and plot points</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-2">Try different keywords or search terms</p>
            </div>
          ) : (
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
          )}
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
