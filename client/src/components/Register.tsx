import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon, BrandIcon, LoadingIcon } from "@/components/ui/icon";

interface RegisterProps {
  onSwitchToLogin: () => void;
}

export function Register({ onSwitchToLogin }: RegisterProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await register(email, username, password, firstName, lastName);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handleFirstNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFirstName(e.target.value);
  };

  const handleLastNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLastName(e.target.value);
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
          <CardTitle className="text-2xl font-bold text-gradient">Join Us Today</CardTitle>
          <p className="text-muted-foreground font-medium mt-2">Create your AI Writing Platform account</p>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-semibold text-foreground">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={handleFirstNameChange}
                  placeholder="John"
                  className="h-11 border-border/60 focus:border-primary-solid transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-semibold text-foreground">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={handleLastNameChange}
                  placeholder="Doe"
                  className="h-11 border-border/60 focus:border-primary-solid transition-colors"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-semibold text-foreground">Username</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Icon name="user" variant="muted" size="sm" />
                </div>
                <Input
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Choose a username"
                  className="pl-10 h-11 border-border/60 focus:border-primary-solid transition-colors"
                  required
                />
              </div>
            </div>
            
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
                  className="pl-10 h-11 border-border/60 focus:border-primary-solid transition-colors"
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
                  placeholder="Create a strong password"
                  className="pl-10 h-11 border-border/60 focus:border-primary-solid transition-colors"
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
                  <span>Creating account...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Icon name="user-plus" className="text-white" />
                  <span>Create Account</span>
                </div>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Button 
                variant="link" 
                onClick={onSwitchToLogin} 
                className="p-0 h-auto font-semibold text-primary-solid hover:text-primary-hover transition-colors"
              >
                Sign in here
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}