// Global configuration for the application
// Change this URL to switch between environments

export const config = {
  // Backend API URL - Uses environment variable if available, otherwise fallback
  API_BASE_URL: import.meta.env.VITE_API_URL || 'https://ai-writing-zpuh.onrender.com/api',
  
  // Alternative URLs for easy switching:
  // Development: 'http://localhost:5000/api'
  // Production: 'https://ai-writing-zpuh.onrender.com/api'
  // Environment: Uses VITE_API_URL if set
  
  // Other app settings
  APP_NAME: 'AI Writing Platform',
  VERSION: '1.0.0',
  
  // Environment detection
  IS_DEVELOPMENT: import.meta.env.DEV,
  IS_PRODUCTION: import.meta.env.PROD,
} as const;

// Export individual values for convenience
export const { API_BASE_URL, APP_NAME, VERSION, IS_DEVELOPMENT, IS_PRODUCTION } = config;

// Default export for easier imports
export default config;
