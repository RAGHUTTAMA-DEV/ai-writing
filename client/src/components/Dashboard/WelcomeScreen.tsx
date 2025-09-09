import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { 
  BookOpen, 
  Plus, 
  Sparkles, 
  FileText,
  Users,
  Target,
  MessageCircle,
  Database,
  BarChart3
} from 'lucide-react';

export const WelcomeScreen: React.FC = () => {
  const { createProject, loading: projectsLoading } = useProjectStore();

  const handleNewProject = async () => {
    const title = prompt('Enter project title:');
    if (title) {
      try {
        await createProject({ title, content: '' });
      } catch (error) {
        console.error('Create project failed:', error);
        alert('Failed to create project');
      }
    }
  };

  const features = [
    {
      icon: <Sparkles className="h-8 w-8 text-blue-600" />,
      title: "AI Writing Assistance",
      description: "Get intelligent suggestions to improve your writing style, structure, and flow."
    },
    {
      icon: <Target className="h-8 w-8 text-green-600" />,
      title: "Theme Analysis",
      description: "Analyze theme consistency and get recommendations for stronger narrative cohesion."
    },
    {
      icon: <Users className="h-8 w-8 text-purple-600" />,
      title: "Character Development",
      description: "Deep dive into character motivations, stakes, and development arcs."
    },
    {
      icon: <MessageCircle className="h-8 w-8 text-orange-600" />,
      title: "AI Chat Assistant",
      description: "Have conversations with your AI writing companion for personalized help."
    },
    {
      icon: <Database className="h-8 w-8 text-indigo-600" />,
      title: "Smart Search",
      description: "Search through your writing history with advanced RAG-powered search."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-red-600" />,
      title: "Writing Analytics",
      description: "Track your progress with detailed writing statistics and insights."
    }
  ];

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600 rounded-full shadow-lg">
              <BookOpen className="h-16 w-16 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to AI Writing Assistant
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Your intelligent companion for creative writing. Get AI-powered suggestions, 
            analyze themes, develop characters, and track your progress all in one place.
          </p>
          
          <Button 
            onClick={handleNewProject}
            disabled={projectsLoading}
            size="lg"
            className="text-lg px-8 py-3 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Your First Project
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white/80 backdrop-blur-sm border-0 shadow-md hover:shadow-lg transition-all duration-200">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-3">
                  {feature.icon}
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm text-center">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Getting Started */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center">
              <FileText className="mr-2 h-6 w-6 text-blue-600" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-gray-700">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Create a Project</h4>
                  <p className="text-sm text-gray-600">Start by creating your first writing project with a descriptive title.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Write Your Content</h4>
                  <p className="text-sm text-gray-600">Use our AI-powered editor to write your content with intelligent suggestions.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Enhance with AI Tools</h4>
                  <p className="text-sm text-gray-600">Use our suite of AI tools to analyze themes, develop characters, and improve your writing.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold">Track Your Progress</h4>
                  <p className="text-sm text-gray-600">Monitor your writing progress with detailed analytics and insights.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
