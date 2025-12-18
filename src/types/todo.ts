export type TodoStatus = 'todo' | 'in_progress' | 'done';

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | null;

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
  priority: TodoPriority;
  estimatedMinutes?: number;
}

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  status: TodoStatus;
  priority: TodoPriority;
  created_at: string;
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  notes?: string;
  recurrence?: RecurrencePattern;
  updated_at?: string;
  updated_by?: string;
  subtasks?: Subtask[];
}

export type SortOption = 'created' | 'due_date' | 'priority' | 'alphabetical' | 'custom';
export type QuickFilter = 'all' | 'my_tasks' | 'due_today' | 'overdue' | 'urgent';

export type ViewMode = 'list' | 'kanban';

export interface User {
  id: string;
  name: string;
  color: string;
  pin_hash?: string;
  created_at?: string;
  last_login?: string;
}

export type UserRole = 'admin' | 'member';

export interface AuthUser {
  id: string;
  name: string;
  color: string;
  role: UserRole;
  created_at: string;
  last_login?: string;
  streak_count?: number;
  streak_last_date?: string;
  welcome_shown_at?: string;
}

export const PRIORITY_CONFIG: Record<TodoPriority, { label: string; color: string; bgColor: string; icon: string }> = {
  urgent: { label: 'Urgent', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)', icon: '!' },
  high: { label: 'High', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)', icon: '!!' },
  medium: { label: 'Medium', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', icon: '-' },
  low: { label: 'Low', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)', icon: '...' },
};

export const STATUS_CONFIG: Record<TodoStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.1)' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.1)' },
  done: { label: 'Done', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
};

// Chat message types
export interface ChatMessage {
  id: string;
  text: string;
  created_by: string;
  created_at: string;
  related_todo_id?: string;
  recipient?: string | null; // null = team chat, username = DM
}

// Chat conversation type
export type ChatConversation =
  | { type: 'team' }
  | { type: 'dm'; userName: string };
