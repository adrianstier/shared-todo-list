'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlertCircle } from 'lucide-react';
import { Todo, AuthUser } from '@/types/todo';
import { supabase } from '@/lib/supabase';

interface WelcomeBackNotificationProps {
  show: boolean;
  onClose: () => void;
  onViewProgress: () => void;
  todos: Todo[];
  currentUser: AuthUser;
  onUserUpdate: (user: AuthUser) => void;
}

const AUTO_DISMISS_MS = 5000;

export default function WelcomeBackNotification({
  show,
  onClose,
  onViewProgress,
  todos,
  currentUser,
  onUserUpdate,
}: WelcomeBackNotificationProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const markWelcomeShown = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({ welcome_shown_at: now })
      .eq('id', currentUser.id);

    if (!error) {
      onUserUpdate({
        ...currentUser,
        welcome_shown_at: now,
      });
    }
  };

  useEffect(() => {
    if (show) {
      // Calculate stats
      const pending = todos.filter(t => !t.completed).length;
      const overdue = todos.filter(t => {
        if (!t.due_date || t.completed) return false;
        const d = new Date(t.due_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        return d < today;
      }).length;

      setPendingCount(pending);
      setOverdueCount(overdue);
      setProgress(100);

      // Mark welcome as shown in database
      markWelcomeShown();

      // Auto-dismiss timer
      timerRef.current = setTimeout(() => {
        onClose();
      }, AUTO_DISMISS_MS);

      // Progress bar animation
      const step = 100 / (AUTO_DISMISS_MS / 50);
      intervalRef.current = setInterval(() => {
        setProgress(prev => Math.max(0, prev - step));
      }, 50);

      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const handleClick = () => {
    onClose();
    onViewProgress();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  // Pause auto-dismiss on hover
  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleMouseLeave = () => {
    const remaining = (progress / 100) * AUTO_DISMISS_MS;
    timerRef.current = setTimeout(() => {
      onClose();
    }, remaining);

    const step = 100 / (AUTO_DISMISS_MS / 50);
    intervalRef.current = setInterval(() => {
      setProgress(prev => Math.max(0, prev - step));
    }, 50);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 20, x: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 w-full max-w-sm cursor-pointer"
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="status"
          aria-live="polite"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Progress bar for auto-dismiss */}
            <div className="h-0.5 bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full bg-[#0033A0] transition-all duration-50"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="p-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Welcome back, {currentUser.name}
                  </p>

                  {/* Stats inline */}
                  <div className="flex items-center gap-3 mt-1.5">
                    {pendingCount > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500 dark:text-slate-400">
                          {pendingCount} pending
                        </span>
                      </div>
                    )}
                    {overdueCount > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">
                          {overdueCount} overdue
                        </span>
                      </div>
                    )}
                    {pendingCount === 0 && overdueCount === 0 && (
                      <span className="text-xs text-slate-400">
                        All tasks completed
                      </span>
                    )}
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                  aria-label="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hint text */}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Click to view details
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper to check if we should show the notification (using cloud data)
export function shouldShowWelcomeNotification(currentUser: AuthUser): boolean {
  const { last_login, welcome_shown_at } = currentUser;

  if (!last_login) return false;

  const lastLogin = new Date(last_login);
  const now = new Date();
  const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

  // Don't show if logged in less than 4 hours ago
  if (hoursSinceLogin < 4) return false;

  // Check if welcome was already shown recently
  if (welcome_shown_at) {
    const shownAt = new Date(welcome_shown_at);
    const hoursSinceShown = (now.getTime() - shownAt.getTime()) / (1000 * 60 * 60);
    // Don't show again if shown within last 4 hours
    if (hoursSinceShown < 4) return false;
  }

  return true;
}
