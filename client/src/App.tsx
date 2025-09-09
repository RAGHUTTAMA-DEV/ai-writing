import React, { useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { Dashboard } from './pages/Dashboard';

function App() {
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [currentTab, setCurrentTab] = useState<string>('editor');
  const { isAuthenticated, logout } = useAuthStore();
  const { getProjects } = useProjectStore();

  useEffect(() => {
    if (isAuthenticated) {
      getProjects();
    }
  }, [isAuthenticated, getProjects]);

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentTab('editor'); // Reset tab on logout
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="w-full max-w-md">
          {authView === 'login' ? (
            <Login onSwitchToRegister={() => setAuthView('register')} />
          ) : (
            <Register onSwitchToLogin={() => setAuthView('login')} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLogout={handleLogout} />
      <div className="flex">
        <Sidebar 
          currentPage={'dashboard'} 
          onPageChange={() => {}}
          onTabChange={handleTabChange}
          activeTab={currentTab}
        />
        <main className="flex-1">
          <Dashboard initialTab={currentTab} />
        </main>
      </div>
    </div>
  );
}

export default App;
