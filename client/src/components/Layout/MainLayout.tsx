import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';

type Page = 'dashboard' | 'editor' | 'ai-tools' | 'chatbot' | 'rag';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: Page;
  onPageChange: (page: Page) => void;
  onLogout: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
};
