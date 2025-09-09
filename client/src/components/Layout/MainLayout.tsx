import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';

type Page = 'dashboard' | 'editor' | 'ai-tools' | 'chatbot' | 'rag';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentPage, onPageChange, onLogout }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onLogout={onLogout} />
      <div className="flex">
        <Sidebar currentPage={currentPage} onPageChange={onPageChange} />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
};
