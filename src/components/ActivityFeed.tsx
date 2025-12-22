'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, User, FileText, CheckCircle2, Circle, ArrowRight, Flag, Calendar, StickyNote, ListTodo, Trash2, RefreshCw, X } from 'lucide-react';
import { ActivityLogEntry, ActivityAction, ACTIVITY_FEED_USERS, PRIORITY_CONFIG } from '@/types/todo';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase';

interface ActivityFeedProps {
  currentUserName: string;
  darkMode?: boolean;
  onClose?: () => void;
}

const ACTION_CONFIG: Record<ActivityAction, { icon: React.ElementType; label: string; color: string }> = {
  task_created: { icon: Circle, label: 'created task', color: '#10b981' },
  task_updated: { icon: RefreshCw, label: 'updated task', color: '#3b82f6' },
  task_deleted: { icon: Trash2, label: 'deleted task', color: '#ef4444' },
  task_completed: { icon: CheckCircle2, label: 'completed task', color: '#10b981' },
  task_reopened: { icon: Circle, label: 'reopened task', color: '#f59e0b' },
  status_changed: { icon: ArrowRight, label: 'changed status', color: '#8b5cf6' },
  priority_changed: { icon: Flag, label: 'changed priority', color: '#f59e0b' },
  assigned_to_changed: { icon: User, label: 'reassigned task', color: '#3b82f6' },
  due_date_changed: { icon: Calendar, label: 'updated due date', color: '#3b82f6' },
  subtask_added: { icon: ListTodo, label: 'added subtask', color: '#10b981' },
  subtask_completed: { icon: CheckCircle2, label: 'completed subtask', color: '#10b981' },
  subtask_deleted: { icon: Trash2, label: 'removed subtask', color: '#ef4444' },
  notes_updated: { icon: StickyNote, label: 'updated notes', color: '#8b5cf6' },
  template_created: { icon: FileText, label: 'created template', color: '#10b981' },
  template_used: { icon: FileText, label: 'used template', color: '#3b82f6' },
};

export default function ActivityFeed({ currentUserName, darkMode = true, onClose }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!ACTIVITY_FEED_USERS.includes(currentUserName)) {
      setIsAuthorized(false);
      setIsLoading(false);
      return;
    }

    setIsAuthorized(true);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/activity?userName=${encodeURIComponent(currentUserName)}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isAuthorized) return;

    const channel = supabase
      .channel('activity-feed')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
        },
        (payload) => {
          setActivities((prev) => [payload.new as ActivityLogEntry, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthorized]);

  if (!isAuthorized) {
    return null;
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityLogEntry[]>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className={`h-full flex flex-col ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Activity className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
          <h2 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Activity Feed</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Activity List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto ${darkMode ? 'border-slate-400' : 'border-slate-600'}`} />
            <p className={`mt-3 text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Loading activity...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No activity yet</p>
            <p className="text-sm mt-1">Task changes will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date Header */}
                <div className={`px-4 py-2 text-xs font-medium uppercase tracking-wide sticky top-0 ${darkMode ? 'bg-slate-900/80 text-slate-400 backdrop-blur-sm' : 'bg-slate-50 text-slate-500'}`}>
                  {formatDate(date)}
                </div>

                {/* Activities for this date */}
                <div className="divide-y divide-slate-700/30">
                  {dayActivities.map((activity) => (
                    <ActivityItem key={activity.id} activity={activity} darkMode={darkMode} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ activity, darkMode }: { activity: ActivityLogEntry; darkMode: boolean }) {
  const config = ACTION_CONFIG[activity.action];
  const Icon = config.icon;
  const details = activity.details as Record<string, string | number | undefined>;

  const renderDetails = () => {
    switch (activity.action) {
      case 'status_changed':
        return (
          <span className="flex items-center gap-1">
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to}</span>
          </span>
        );
      case 'priority_changed':
        const fromPriority = PRIORITY_CONFIG[details.from as keyof typeof PRIORITY_CONFIG];
        const toPriority = PRIORITY_CONFIG[details.to as keyof typeof PRIORITY_CONFIG];
        return (
          <span className="flex items-center gap-1">
            <span style={{ color: fromPriority?.color }}>{details.from}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: toPriority?.color }}>{details.to}</span>
          </span>
        );
      case 'assigned_to_changed':
        return (
          <span className="flex items-center gap-1">
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from || 'Unassigned'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'Unassigned'}</span>
          </span>
        );
      case 'due_date_changed':
        return (
          <span className="flex items-center gap-1">
            <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{details.from || 'No date'}</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium" style={{ color: config.color }}>{details.to || 'No date'}</span>
          </span>
        );
      case 'subtask_added':
      case 'subtask_completed':
      case 'subtask_deleted':
        return details.subtask_text ? (
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            &quot;{details.subtask_text}&quot;
          </span>
        ) : null;
      case 'template_created':
      case 'template_used':
        return details.template_name ? (
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Template: {details.template_name}
          </span>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className={`px-4 py-3 flex items-start gap-3 ${darkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'} transition-colors`}>
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {activity.user_name}
          </span>
          <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
            {config.label}
          </span>
        </div>

        {activity.todo_text && (
          <p className={`text-sm truncate mt-0.5 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            {activity.todo_text}
          </p>
        )}

        {renderDetails() && (
          <div className="mt-1 text-xs">
            {renderDetails()}
          </div>
        )}

        <div className={`flex items-center gap-1 mt-1 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
