import React from 'react';
import { 
  // Core UI Icons
  Brain,
  User,
  LogOut,
  Settings,
  FileText,
  Save,
  Clock,
  Bell,
  Search,
  Plus,
  BookOpen,
  Zap,
  MessageCircle,
  BarChart3,
  Database,
  Lightbulb,
  Target,
  Eye,
  Users,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Info,
  Menu,
  X,
  Home,
  Edit,
  Trash2,
  Download,
  Upload,
  Share,
  Copy,
  Star,
  Heart,
  Bookmark,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  Github,
  Twitter,
  Linkedin,
  // Additional icons for future use
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  XCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  MoreHorizontal,
  MoreVertical,
  Key,
  Lock,
  Unlock,
  LogIn,
  UserPlus,
} from 'lucide-react';

// Icon registry mapping
export const iconRegistry = {
  // Core app icons
  'brain': Brain,
  'user': User,
  'logout': LogOut,
  'settings': Settings,
  'file-text': FileText,
  'save': Save,
  'clock': Clock,
  'bell': Bell,
  'search': Search,
  'plus': Plus,
  'book-open': BookOpen,
  'zap': Zap,
  'message-circle': MessageCircle,
  'bar-chart': BarChart3,
  'database': Database,
  'lightbulb': Lightbulb,
  'target': Target,
  'eye': Eye,
  'users': Users,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'sparkles': Sparkles,
  'refresh': RefreshCw,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'info': Info,
  'menu': Menu,
  'x': X,
  'home': Home,
  'edit': Edit,
  'trash': Trash2,
  'download': Download,
  'upload': Upload,
  'share': Share,
  'copy': Copy,
  'star': Star,
  'heart': Heart,
  'bookmark': Bookmark,
  'filter': Filter,
  'sort-asc': SortAsc,
  'sort-desc': SortDesc,
  'calendar': Calendar,
  'map-pin': MapPin,
  'phone': Phone,
  'mail': Mail,
  'globe': Globe,
  'github': Github,
  'twitter': Twitter,
  'linkedin': Linkedin,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'check': Check,
  'x-circle': XCircle,
  'play': PlayCircle,
  'pause': PauseCircle,
  'stop': StopCircle,
  'volume-on': Volume2,
  'volume-off': VolumeX,
  'maximize': Maximize,
  'minimize': Minimize,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  'key': Key,
  'lock': Lock,
  'unlock': Unlock,
  'login': LogIn,
  'user-plus': UserPlus,
} as const;

export type IconName = keyof typeof iconRegistry;

// Default fallback icon
const DefaultIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <div className={`bg-gray-300 rounded-sm ${className}`} />
);

export interface IconProps {
  name: IconName;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger';
  strokeWidth?: number;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4', 
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
};

const variantClasses = {
  default: 'text-current',
  muted: 'text-gray-500',
  primary: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
};

export const Icon: React.FC<IconProps> = ({ 
  name, 
  className = '', 
  size = 'sm',
  variant = 'default',
  strokeWidth = 2,
  ...props 
}) => {
  const IconComponent = iconRegistry[name] as React.ComponentType<any>;
  
  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in registry. Using fallback.`);
    return <DefaultIcon className={className} />;
  }

  // Build size class
  const sizeClass = typeof size === 'number' 
    ? `h-${size} w-${size}` 
    : sizeClasses[size];

  // Build variant class  
  const variantClass = variantClasses[variant];

  // Combine all classes
  const combinedClassName = [
    sizeClass,
    variantClass,
    className
  ].filter(Boolean).join(' ');

  return (
    <IconComponent 
      className={combinedClassName}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
};

// Convenience components for common use cases
export const MenuIcon: React.FC<Omit<IconProps, 'name'>> = (props) => (
  <Icon name="menu" {...props} />
);

export const CloseIcon: React.FC<Omit<IconProps, 'name'>> = (props) => (
  <Icon name="x" {...props} />
);

export const LoadingIcon: React.FC<Omit<IconProps, 'name'>> = (props) => (
  <Icon name="refresh" className="animate-spin" {...props} />
);

export const BrandIcon: React.FC<Omit<IconProps, 'name'>> = (props) => (
  <Icon name="brain" variant="primary" {...props} />
);

// Hook for dynamic icon loading (for future extensibility)
export const useIcon = (name: IconName) => {
  return React.useMemo(() => {
    const IconComponent = iconRegistry[name] as React.ComponentType<any>;
    return IconComponent || DefaultIcon;
  }, [name]);
};

export default Icon;
