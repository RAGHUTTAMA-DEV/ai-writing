import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Icon, BrandIcon } from '../ui/icon';

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
      icon: 'sparkles',
      iconVariant: 'primary' as const,
      title: "AI Writing Assistance",
      description: "Get intelligent suggestions to improve your writing style, structure, and flow."
    },
    {
      icon: 'target',
      iconVariant: 'success' as const,
      title: "Theme Analysis",
      description: "Analyze theme consistency and get recommendations for stronger narrative cohesion."
    },
    {
      icon: 'users',
      iconVariant: 'warning' as const,
      title: "Character Development",
      description: "Deep dive into character motivations, stakes, and development arcs."
    },
    {
      icon: 'message-circle',
      iconVariant: 'primary' as const,
      title: "AI Chat Assistant",
      description: "Have conversations with your AI writing companion for personalized help."
    },
    {
      icon: 'database',
      iconVariant: 'muted' as const,
      title: "Smart Search",
      description: "Search through your writing history with advanced RAG-powered search."
    },
    {
      icon: 'bar-chart',
      iconVariant: 'danger' as const,
      title: "Writing Analytics",
      description: "Track your progress with detailed writing statistics and insights."
    }
  ];

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 animate-fade-in">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-slide-up">
          <div className="flex justify-center mb-6">
            <div className="p-4 gradient-primary rounded-2xl shadow-strong animate-float">
              <BrandIcon size="xl" className="text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gradient mb-4 tracking-tight">
            Welcome to AI Writing Assistant
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Your intelligent companion for creative writing. Get AI-powered suggestions, 
            analyze themes, develop characters, and track your progress all in one place.
          </p>
          
          <Button 
            onClick={handleNewProject}
            disabled={projectsLoading}
            variant="gradient"
            size="lg"
            className="text-lg px-8 py-4 shadow-strong hover:shadow-glow transition-all duration-300 animate-bounce-in"
          >
            <Icon name="plus" className="mr-2 text-white" />
            <span className="text-white">Create Your First Project</span>
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="gradient-card shadow-medium hover:shadow-strong hover-lift transition-all duration-300 animate-slide-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-muted/20 rounded-xl">
                    <Icon name={feature.icon as any} variant={feature.iconVariant} size="lg" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm text-center leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Getting Started */}
        <Card className="gradient-card shadow-strong animate-slide-up">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center text-xl">
              <Icon name="file-text" variant="primary" className="mr-2" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-foreground">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold shadow-medium">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">Create a Project</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">Start by creating your first writing project with a descriptive title.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold shadow-medium">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">Write Your Content</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">Use our AI-powered editor to write your content with intelligent suggestions.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold shadow-medium">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">Enhance with AI Tools</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">Use our suite of AI tools to analyze themes, develop characters, and improve your writing.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 gradient-primary rounded-full flex items-center justify-center text-white text-sm font-bold shadow-medium">
                  4
                </div>
                <div>
                  <h4 className="font-bold text-foreground mb-1">Track Your Progress</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">Monitor your writing progress with detailed analytics and insights.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
