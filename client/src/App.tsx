import { useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useProjectStore } from './store/useProjectStore';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Header } from './components/Layout/Header';
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
      <>
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthView('login')} />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Stunning Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(120,119,198,0.3),transparent_50%)] animate-pulse"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,121,198,0.3),transparent_50%)] animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_80%,rgba(66,153,225,0.3),transparent_50%)] animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <Header onLogout={handleLogout} onTabChange={handleTabChange} activeTab={currentTab} />
        <main className="flex-1">
          <Dashboard initialTab={currentTab} />
        </main>
      </div>
    </div>
  );
}

export default App;
