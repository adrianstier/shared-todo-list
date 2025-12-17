'use client';

import { motion } from 'framer-motion';
import { Plus, Search, CheckCircle2, Calendar, AlertTriangle, Sparkles } from 'lucide-react';

type EmptyStateVariant = 'no-tasks' | 'no-results' | 'all-done' | 'no-due-today' | 'no-overdue' | 'first-time';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  darkMode?: boolean;
  searchQuery?: string;
  onAddTask?: () => void;
  onClearSearch?: () => void;
  userName?: string;
}

const variants = {
  'no-tasks': {
    icon: Plus,
    title: 'No tasks yet',
    description: 'Create your first task to get started',
    action: 'Add Task',
    color: '#0033A0',
    bgColor: 'rgba(0, 51, 160, 0.1)',
  },
  'no-results': {
    icon: Search,
    title: 'No matches found',
    description: 'Try a different search term',
    action: 'Clear Search',
    color: '#6b7280',
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
  'all-done': {
    icon: CheckCircle2,
    title: 'All caught up!',
    description: 'You\'ve completed all your tasks',
    action: 'Add More',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  'no-due-today': {
    icon: Calendar,
    title: 'Nothing due today',
    description: 'Enjoy your free time or plan ahead',
    action: null,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  'no-overdue': {
    icon: CheckCircle2,
    title: 'No overdue tasks',
    description: 'You\'re on top of your deadlines',
    action: null,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  'first-time': {
    icon: Sparkles,
    title: 'Welcome!',
    description: 'Let\'s create your first task together',
    action: 'Get Started',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
  },
};

// Simple SVG illustrations for empty states
function TaskIllustration({ color }: { color: string }) {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clipboard */}
      <rect x="30" y="15" width="60" height="75" rx="6" fill={color} opacity="0.1" stroke={color} strokeWidth="2"/>
      <rect x="45" y="10" width="30" height="12" rx="4" fill={color} opacity="0.2"/>
      <circle cx="60" cy="16" r="3" fill={color}/>

      {/* Task lines */}
      <rect x="42" y="35" width="36" height="4" rx="2" fill={color} opacity="0.3"/>
      <rect x="42" y="47" width="28" height="4" rx="2" fill={color} opacity="0.2"/>
      <rect x="42" y="59" width="32" height="4" rx="2" fill={color} opacity="0.15"/>
      <rect x="42" y="71" width="24" height="4" rx="2" fill={color} opacity="0.1"/>

      {/* Plus icon floating */}
      <motion.g
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="95" cy="25" r="12" fill={color}/>
        <path d="M95 20V30M90 25H100" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      </motion.g>
    </svg>
  );
}

function SearchIllustration({ color }: { color: string }) {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Magnifying glass */}
      <circle cx="50" cy="45" r="25" fill={color} opacity="0.1" stroke={color} strokeWidth="3"/>
      <line x1="68" y1="63" x2="90" y2="85" stroke={color} strokeWidth="4" strokeLinecap="round"/>

      {/* Question marks */}
      <motion.text
        x="45"
        y="52"
        fill={color}
        opacity="0.5"
        fontSize="24"
        fontWeight="bold"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        ?
      </motion.text>
    </svg>
  );
}

function CelebrationIllustration({ color }: { color: string }) {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Trophy */}
      <path d="M40 30H80V50C80 61 71 70 60 70C49 70 40 61 40 50V30Z" fill={color} opacity="0.2"/>
      <path d="M40 30H30C30 30 28 45 40 45" stroke={color} strokeWidth="2" fill="none"/>
      <path d="M80 30H90C90 30 92 45 80 45" stroke={color} strokeWidth="2" fill="none"/>
      <rect x="55" y="70" width="10" height="10" fill={color} opacity="0.3"/>
      <rect x="45" y="80" width="30" height="6" rx="2" fill={color} opacity="0.4"/>

      {/* Stars */}
      <motion.g
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
      >
        <polygon points="25,25 27,31 33,31 28,35 30,41 25,37 20,41 22,35 17,31 23,31" fill={color}/>
      </motion.g>
      <motion.g
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.3 }}
      >
        <polygon points="95,20 97,26 103,26 98,30 100,36 95,32 90,36 92,30 87,26 93,26" fill={color}/>
      </motion.g>
      <motion.g
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.6 }}
      >
        <polygon points="100,55 101,58 104,58 102,60 103,63 100,61 97,63 98,60 96,58 99,58" fill={color}/>
      </motion.g>
    </svg>
  );
}

function WelcomeIllustration({ color }: { color: string }) {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rocket */}
      <motion.g
        animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ellipse cx="60" cy="45" rx="15" ry="25" fill={color} opacity="0.8"/>
        <ellipse cx="60" cy="35" rx="8" ry="10" fill="white" opacity="0.3"/>
        <path d="M45 55L40 75L60 65L80 75L75 55" fill={color} opacity="0.6"/>
        <circle cx="60" cy="40" r="5" fill="white" opacity="0.5"/>
      </motion.g>

      {/* Stars/sparkles */}
      <motion.circle
        cx="30"
        cy="30"
        r="3"
        fill={color}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
      />
      <motion.circle
        cx="90"
        cy="25"
        r="2"
        fill={color}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
      />
      <motion.circle
        cx="95"
        cy="60"
        r="2.5"
        fill={color}
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 1 }}
      />
    </svg>
  );
}

export default function EmptyState({
  variant,
  darkMode = true,
  searchQuery,
  onAddTask,
  onClearSearch,
  userName,
}: EmptyStateProps) {
  const config = variants[variant];
  const Icon = config.icon;

  const handleAction = () => {
    if (variant === 'no-results' && onClearSearch) {
      onClearSearch();
    } else if (onAddTask) {
      onAddTask();
    }
  };

  const renderIllustration = () => {
    switch (variant) {
      case 'no-tasks':
        return <TaskIllustration color={config.color} />;
      case 'no-results':
        return <SearchIllustration color={config.color} />;
      case 'all-done':
      case 'no-overdue':
        return <CelebrationIllustration color={config.color} />;
      case 'first-time':
        return <WelcomeIllustration color={config.color} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-12 px-4"
    >
      {/* Illustration */}
      <div className="mb-4">
        {renderIllustration()}
      </div>

      {/* Icon badge */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ backgroundColor: config.bgColor }}
      >
        <Icon className="w-7 h-7" style={{ color: config.color }} />
      </motion.div>

      {/* Title */}
      <h3 className={`text-lg font-semibold mb-1 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
        {variant === 'first-time' && userName ? `Welcome, ${userName}!` : config.title}
      </h3>

      {/* Description */}
      <p className={`text-sm text-center max-w-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {variant === 'no-results' && searchQuery
          ? `No tasks match "${searchQuery}"`
          : config.description}
      </p>

      {/* Action button */}
      {config.action && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={handleAction}
          className="mt-4 px-4 py-2 rounded-lg font-medium text-sm transition-all hover:shadow-md"
          style={{
            backgroundColor: config.color,
            color: 'white',
          }}
        >
          {config.action}
        </motion.button>
      )}
    </motion.div>
  );
}
