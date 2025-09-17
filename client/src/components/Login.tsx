import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon, BrandIcon, LoadingIcon } from "@/components/ui/icon";

interface LoginProps {
  onSwitchToRegister: () => void;
}

export function Login({ onSwitchToRegister }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, loginWithGoogle } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-strong animate-scale-in gradient-card border-border/50">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 gradient-primary rounded-2xl shadow-medium">
              <BrandIcon size="xl" className="text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gradient">Welcome Back</CardTitle>
          <p className="text-muted-foreground font-medium mt-2">Sign in to your AI Writing Platform</p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-foreground">Email Address</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Icon name="mail" variant="muted" size="sm" />
                </div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                  className="pl-10 h-12 border-border/60 focus:border-primary-solid transition-colors"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-foreground">Password</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Icon name="key" variant="muted" size="sm" />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter your password"
                  className="pl-10 h-12 border-border/60 focus:border-primary-solid transition-colors"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="flex items-center space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg animate-fade-in">
                <Icon name="alert-circle" variant="danger" size="sm" />
                <p className="text-destructive text-sm font-medium">{error}</p>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full h-12 gradient-primary font-semibold text-white shadow-medium hover:shadow-strong transition-all duration-300" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <LoadingIcon className="text-white" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Icon name="login" className="text-white" />
                  <span>Sign In</span>
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-background text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>
            
            <Button 
              type="button"
              onClick={handleGoogleLogin}
              variant="outline"
              className="w-full h-12 mt-4 border-border/60 hover:border-primary-solid/20 hover:bg-primary-ghost transition-all duration-300 font-semibold"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </div>
            </Button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Button 
                variant="link" 
                onClick={onSwitchToRegister} 
                className="p-0 h-auto font-semibold text-primary-solid hover:text-primary-hover transition-colors"
              >
                Create one here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}