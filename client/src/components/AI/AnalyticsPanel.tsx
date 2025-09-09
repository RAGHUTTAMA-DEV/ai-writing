import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useAIStore } from '../../store/useAIStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  BarChart3, 
  TrendingUp,
  Target,
  Clock,
  FileText,
  Users,
  Brain,
  Calendar,
  Award,
  Zap,
  BookOpen,
  PieChart,
  Activity,
  CheckCircle
} from 'lucide-react';

interface AnalyticsPanelProps {
  projectId: string;
}

interface WritingStats {
  wordsWritten: number;
  sessionsCompleted: number;
  streak: number;
  averageSessionLength: number;
  weeklyProgress: number[];
  topGenres: string[];
  completionRate: number;
}

interface ProjectInsights {
  characterCount: number;
  sceneCount: number;
  themeCount: number;
  averageSceneLength: number;
  mostActiveCharacters: string[];
  dominantThemes: string[];
  storyStructure: {
    acts: number;
    climaxPosition: number;
    pacing: 'slow' | 'moderate' | 'fast';
  };
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ projectId }) => {
  const { activeProject } = useProjectStore();
  const { loading: aiLoading } = useAIStore();
  
  const [writingStats, setWritingStats] = useState<WritingStats>({
    wordsWritten: 45726,
    sessionsCompleted: 28,
    streak: 7,
    averageSessionLength: 45,
    weeklyProgress: [2100, 1800, 2300, 1950, 2600, 2200, 1850],
    topGenres: ['Fiction', 'Drama', 'Mystery'],
    completionRate: 72
  });

  const [projectInsights, setProjectInsights] = useState<ProjectInsights>({
    characterCount: 12,
    sceneCount: 34,
    themeCount: 8,
    averageSceneLength: 1200,
    mostActiveCharacters: ['Sarah Chen', 'Marcus Rivers', 'Elena Rodriguez'],
    dominantThemes: ['Identity', 'Belonging', 'Redemption', 'Growth'],
    storyStructure: {
      acts: 3,
      climaxPosition: 75,
      pacing: 'moderate'
    }
  });

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  useEffect(() => {
    // Simulate loading project insights
    const loadInsights = async () => {
      try {
        // Load project insights - placeholder
        // In real implementation, this would set actual data from the API
      } catch (error) {
        console.error('Failed to load insights:', error);
      }
    };

    loadInsights();
  }, [projectId]);

  const getDaysOfWeek = () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-blue-500';
    if (percentage >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPacingIcon = (pacing: string) => {
    switch (pacing) {
      case 'fast': return <Zap className="w-4 h-4 text-red-500" />;
      case 'slow': return <Clock className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-green-500" />;
    }
  };

  const achievements = [
    { id: 1, name: 'Week Streak', description: '7 days in a row', icon: Award, earned: true },
    { id: 2, name: 'Word Warrior', description: '50,000 words', icon: Target, earned: false },
    { id: 3, name: 'Character Creator', description: '10+ characters', icon: Users, earned: true },
    { id: 4, name: 'Scene Master', description: '30+ scenes', icon: BookOpen, earned: true },
  ];

  return (
    <div className="h-full overflow-y-auto space-y-6 p-1">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Words Written</p>
                <p className="text-2xl font-bold text-gray-900">{writingStats.wordsWritten.toLocaleString()}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{writingStats.sessionsCompleted}</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Streak</p>
                <p className="text-2xl font-bold text-gray-900">{writingStats.streak} days</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Session</p>
                <p className="text-2xl font-bold text-gray-900">{writingStats.averageSessionLength}m</p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span>Weekly Writing Progress</span>
            </div>
            <div className="flex space-x-1">
              {(['week', 'month', 'quarter'] as const).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period)}
                  className="text-xs"
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getDaysOfWeek().map((day, index) => (
              <div key={day} className="flex items-center space-x-4">
                <div className="w-12 text-sm font-medium text-gray-600">{day}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700">
                      {writingStats.weeklyProgress[index]} words
                    </span>
                    <span className="text-xs text-gray-500">
                      {Math.round((writingStats.weeklyProgress[index] / 3000) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(writingStats.weeklyProgress[index] / 3000) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Project Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>Project Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-lg font-semibold">{projectInsights.characterCount}</p>
                <p className="text-xs text-gray-600">Characters</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <BookOpen className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-lg font-semibold">{projectInsights.sceneCount}</p>
                <p className="text-xs text-gray-600">Scenes</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Story Structure</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Acts</span>
                  <Badge variant="outline">{projectInsights.storyStructure.acts}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Pacing</span>
                  <div className="flex items-center space-x-1">
                    {getPacingIcon(projectInsights.storyStructure.pacing)}
                    <span className="text-sm capitalize">{projectInsights.storyStructure.pacing}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Climax Position</span>
                  <span className="text-sm">{projectInsights.storyStructure.climaxPosition}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-orange-600" />
              <span>Active Elements</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Top Characters</h4>
              <div className="space-y-1">
                {projectInsights.mostActiveCharacters.map((character, index) => (
                  <div key={character} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{character}</span>
                    <Badge variant="secondary" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Dominant Themes</h4>
              <div className="flex flex-wrap gap-1">
                {projectInsights.dominantThemes.map((theme) => (
                  <Badge key={theme} variant="outline" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Award className="h-5 w-5 text-yellow-600" />
            <span>Achievements</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-3 rounded-lg border ${
                  achievement.earned 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    achievement.earned ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <achievement.icon className={`w-4 h-4 ${
                      achievement.earned ? 'text-green-600' : 'text-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-sm font-medium ${
                      achievement.earned ? 'text-green-800' : 'text-gray-700'
                    }`}>
                      {achievement.name}
                    </h4>
                    <p className={`text-xs ${
                      achievement.earned ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {achievement.description}
                    </p>
                  </div>
                  {achievement.earned && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Completion Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5 text-indigo-600" />
            <span>Project Completion</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-2">
                {writingStats.completionRate}%
              </div>
              <p className="text-sm text-gray-600">Overall Progress</p>
            </div>
            
            <Progress 
              value={writingStats.completionRate} 
              className="h-3"
            />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold text-gray-800">32.5k</p>
                <p className="text-xs text-gray-600">Words Complete</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">12.8k</p>
                <p className="text-xs text-gray-600">Words Remaining</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-800">15</p>
                <p className="text-xs text-gray-600">Days to Goal</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
