import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Icon } from './icon';
import { cn } from '@/lib/utils';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: React.ReactNode;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
}

// Toast Context
const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      removeToast(id);
    }, duration);

    return id;
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => {
    return addToast({ type: 'success', title, description });
  }, [addToast]);

  const error = useCallback((title: string, description?: string) => {
    return addToast({ type: 'error', title, description, duration: 7000 });
  }, [addToast]);

  const warning = useCallback((title: string, description?: string) => {
    return addToast({ type: 'warning', title, description });
  }, [addToast]);

  const info = useCallback((title: string, description?: string) => {
    return addToast({ type: 'info', title, description });
  }, [addToast]);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Individual Toast Component
interface ToastComponentProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getToastStyles = () => {
    const baseStyles = 'flex items-start p-4 rounded-lg shadow-strong backdrop-blur-sm border transition-all duration-300';
    
    const typeStyles = {
      success: 'bg-success/10 border-success/20 text-success',
      error: 'bg-destructive/10 border-destructive/20 text-destructive',
      warning: 'bg-warning/10 border-warning/20 text-warning',
      info: 'bg-primary-solid/10 border-primary-solid/20 text-primary-solid',
    };

    const animationStyles = isLeaving 
      ? 'translate-x-full opacity-0 scale-95'
      : isVisible 
        ? 'translate-x-0 opacity-100 scale-100'
        : 'translate-x-full opacity-0 scale-95';

    return cn(baseStyles, typeStyles[toast.type], animationStyles);
  };

  const getIcon = () => {
    const iconMap = {
      success: 'check-circle',
      error: 'x-circle',
      warning: 'alert-circle',
      info: 'info',
    } as const;

    return iconMap[toast.type];
  };

  const getIconVariant = () => {
    const variantMap = {
      success: 'success' as const,
      error: 'danger' as const,
      warning: 'warning' as const,
      info: 'primary' as const,
    };

    return variantMap[toast.type];
  };

  return (
    <div className={getToastStyles()}>
      <div className="flex-shrink-0 mr-3 mt-0.5">
        <Icon name={getIcon()} variant={getIconVariant()} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-foreground mb-1">
          {toast.title}
        </h4>
        {toast.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {toast.description}
          </p>
        )}
        {toast.action && (
          <div className="mt-3">
            {toast.action}
          </div>
        )}
      </div>
      
      <button
        onClick={handleRemove}
        className="flex-shrink-0 ml-3 p-1 hover:bg-muted/20 rounded-md transition-colors"
        aria-label="Close notification"
      >
        <Icon name="x" size="sm" variant="muted" />
      </button>
    </div>
  );
};

// Toast Container Component
interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 right-0 z-50 p-4 space-y-3 max-w-sm w-full">
      {toasts.map(toast => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
};

// Example usage hook for common toast patterns
export const useToastActions = () => {
  const { success, error, warning, info } = useToast();

  return {
    showSaveSuccess: () => success('Saved successfully', 'Your changes have been saved.'),
    showSaveError: () => error('Save failed', 'Unable to save your changes. Please try again.'),
    showDeleteSuccess: () => success('Deleted successfully', 'The item has been removed.'),
    showDeleteError: () => error('Delete failed', 'Unable to delete the item. Please try again.'),
    showCopySuccess: () => success('Copied to clipboard', 'The content has been copied.'),
    showNetworkError: () => error('Connection error', 'Please check your internet connection.'),
    showValidationWarning: (message: string) => warning('Validation warning', message),
    showInfo: (title: string, message?: string) => info(title, message),
  };
};

export default {
  ToastProvider,
  useToast,
  useToastActions,
};
