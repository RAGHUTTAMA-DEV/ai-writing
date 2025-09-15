import React from 'react';
import { Icon, LoadingIcon } from './icon';
import { cn } from '@/lib/utils';

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: 'default' | 'primary' | 'white';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  color = 'default'
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    default: 'text-muted-foreground',
    primary: 'text-primary-solid',
    white: 'text-white'
  };

  return (
    <div className={cn('animate-spin', sizeClasses[size], colorClasses[color], className)}>
      <svg
        className="w-full h-full"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

// Skeleton Loading Component
interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  animate = true
}) => {
  return (
    <div
      className={cn(
        'bg-muted/50 rounded-md',
        animate && 'animate-pulse',
        className
      )}
    />
  );
};

// Card Skeleton Component
export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={cn('p-6 space-y-4', className)}>
    <div className="flex items-center space-x-3">
      <Skeleton className="h-10 w-10 rounded-lg" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

// Full Page Loading Component
interface PageLoadingProps {
  message?: string;
  showIcon?: boolean;
}

export const PageLoading: React.FC<PageLoadingProps> = ({
  message = 'Loading...',
  showIcon = true
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
    <div className="text-center animate-fade-in">
      {showIcon && (
        <div className="mb-6">
          <div className="p-4 gradient-primary rounded-2xl shadow-medium w-fit mx-auto">
            <Icon name="brain" size="xl" className="text-white" />
          </div>
        </div>
      )}
      <LoadingSpinner size="lg" color="primary" className="mb-4 mx-auto" />
      <p className="text-lg font-semibold text-foreground mb-2">
        {message}
      </p>
      <p className="text-muted-foreground">
        Please wait while we set things up
      </p>
    </div>
  </div>
);

// Loading Button Component
interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  variant?: 'default' | 'gradient' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading,
  children,
  loadingText = 'Loading...',
  className = '',
  variant = 'default',
  size = 'md',
  disabled,
  onClick,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    default: 'bg-primary-solid text-primary-foreground hover:bg-primary-hover shadow-soft hover:shadow-medium',
    gradient: 'gradient-primary text-white shadow-medium hover:shadow-strong hover:scale-105',
    outline: 'border border-border bg-background hover:bg-muted/80 shadow-soft hover:shadow-medium'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm h-8',
    md: 'px-4 py-2 text-sm h-10',
    lg: 'px-6 py-3 text-base h-12'
  };

  return (
    <button
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={loading || disabled}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" color={variant === 'gradient' || variant === 'default' ? 'white' : 'primary'} />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

// Progress Bar Component
interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  color?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  className = '',
  showPercentage = false,
  color = 'primary',
  animated = true
}) => {
  const colorClasses = {
    primary: 'bg-primary-solid',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive'
  };

  const backgroundClasses = {
    primary: 'bg-primary-solid/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    danger: 'bg-destructive/20'
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between mb-2">
        {showPercentage && (
          <span className="text-sm font-medium text-foreground">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className={cn('h-2 rounded-full overflow-hidden', backgroundClasses[color])}>
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            colorClasses[color],
            animated && 'animate-pulse'
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};

// Pulse Loading Component
interface PulseLoadingProps {
  lines?: number;
  className?: string;
}

export const PulseLoading: React.FC<PulseLoadingProps> = ({
  lines = 3,
  className = ''
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className="animate-pulse flex space-x-4">
        <Skeleton className="h-4 rounded w-full" />
      </div>
    ))}
  </div>
);

// Dot Loading Animation
export const DotLoading: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={cn('flex space-x-1', className)}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-primary-solid rounded-full animate-bounce"
        style={{ animationDelay: `${i * 0.1}s` }}
      />
    ))}
  </div>
);

export default {
  LoadingSpinner,
  Skeleton,
  CardSkeleton,
  PageLoading,
  LoadingButton,
  ProgressBar,
  PulseLoading,
  DotLoading
};
