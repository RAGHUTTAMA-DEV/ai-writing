import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t py-4 mt-8">
      <div className="px-6 flex justify-between items-center text-sm text-gray-600">
        <div>
          <p>&copy; 2024 AI Writing Platform. Powered by intelligent AI.</p>
        </div>
        <div className="flex items-center space-x-4">
          <span>Made with ❤️ for writers</span>
        </div>
      </div>
    </footer>
  );
};
