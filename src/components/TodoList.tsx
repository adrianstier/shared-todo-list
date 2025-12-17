'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, TodoPriority, ViewMode, SortOption, QuickFilter, RecurrencePattern, Subtask } from '@/types/todo';
import TodoItem from './TodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import CelebrationEffect from './CelebrationEffect';
import ProgressSummary from './ProgressSummary';
import WelcomeBackNotification, { shouldShowWelcomeNotification } from './WelcomeBackNotification';
import ConfirmDialog from './ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutList, LayoutGrid, Wifi, WifiOff, Search,
  ArrowUpDown, User, Calendar, AlertTriangle, CheckSquare,
  Trash2, X, Sun, Moon, ChevronDown
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';
import { useTheme } from '@/contexts/ThemeContext';

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

// Helper to check if due today
const isDueToday = (dueDate?: string) => {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
};

// Helper to check if overdue
const isOverdue = (dueDate?: string, completed?: boolean) => {
  if (!dueDate || completed) return false;
  const d = new Date(dueDate);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return d < today;
};

// Priority sort order
const priorityOrder: Record<TodoPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function TodoList({ currentUser, onUserChange }: TodoListProps) {
  const userName = currentUser.name;
  const { theme, toggleTheme } = useTheme();
  const darkMode = theme === 'dark';

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);

  // Search, sort, and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('created');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  // Bulk actions state
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Celebration and notifications
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showProgressSummary, setShowProgressSummary] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // 'n' - focus new task input
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const input = document.querySelector('textarea[placeholder*="task"]') as HTMLTextAreaElement;
        if (input) input.focus();
      }

      // '/' - focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const search = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (search) search.focus();
      }

      // 'Escape' - clear selection
      if (e.key === 'Escape') {
        setSelectedTodos(new Set());
        setSearchQuery('');
        setShowBulkActions(false);
      }

      // '1-4' - quick filter shortcuts
      if (e.key === '1') { e.preventDefault(); setQuickFilter('all'); }
      if (e.key === '2') { e.preventDefault(); setQuickFilter('my_tasks'); }
      if (e.key === '3') { e.preventDefault(); setQuickFilter('due_today'); }
      if (e.key === '4') { e.preventDefault(); setQuickFilter('urgent'); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchTodos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const [todosResult, usersResult] = await Promise.all([
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('name').order('name'),
    ]);

    if (todosResult.error) {
      console.error('Error fetching todos:', todosResult.error);
      setError('Failed to connect to database. Please check your Supabase configuration.');
    } else {
      setTodos(todosResult.data || []);
      const registeredUsers = (usersResult.data || []).map((u: { name: string }) => u.name);
      const todoUsers = [...new Set((todosResult.data || []).map((t: Todo) => t.created_by).filter(Boolean))];
      setUsers([...new Set([...registeredUsers, ...todoUsers])]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const init = async () => {
      await fetchTodos();
      if (isMounted) {
        if (shouldShowWelcomeNotification(currentUser)) {
          setShowWelcomeBack(true);
        }
      }
    };

    init();

    const channel = supabase
      .channel('todos-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            setTodos((prev) => {
              const exists = prev.some((t) => t.id === (payload.new as Todo).id);
              if (exists) return prev;
              return [payload.new as Todo, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTodos((prev) =>
              prev.map((todo) =>
                todo.id === payload.new.id ? (payload.new as Todo) : todo
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTodos((prev) => prev.filter((todo) => todo.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (isMounted) setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTodos, userName, currentUser]);

  const addTodo = async (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[]) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      status: 'todo',
      priority,
      created_at: new Date().toISOString(),
      created_by: userName,
      due_date: dueDate,
      assigned_to: assignedTo,
      subtasks: subtasks,
    };

    setTodos((prev) => [newTodo, ...prev]);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: newTodo.completed,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    if (newTodo.status && newTodo.status !== 'todo') insertData.status = newTodo.status;
    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.due_date) insertData.due_date = newTodo.due_date;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.subtasks && newTodo.subtasks.length > 0) insertData.subtasks = newTodo.subtasks;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      console.error('Error adding todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const duplicateTodo = async (todo: Todo) => {
    const newTodo: Todo = {
      ...todo,
      id: uuidv4(),
      text: `${todo.text} (copy)`,
      completed: false,
      status: 'todo',
      created_at: new Date().toISOString(),
      created_by: userName,
    };

    setTodos((prev) => [newTodo, ...prev]);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: false,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.due_date) insertData.due_date = newTodo.due_date;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.notes) insertData.notes = newTodo.notes;
    if (newTodo.recurrence) insertData.recurrence = newTodo.recurrence;

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      console.error('Error duplicating todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed } : todo))
    );

    if (status === 'done' && oldTodo && !oldTodo.completed) {
      setCelebrationText(oldTodo.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (oldTodo.recurrence) {
        createNextRecurrence(oldTodo);
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const createNextRecurrence = async (completedTodo: Todo) => {
    if (!completedTodo.recurrence || !completedTodo.due_date) return;

    const currentDue = new Date(completedTodo.due_date);
    const nextDue = new Date(currentDue);

    switch (completedTodo.recurrence) {
      case 'daily':
        nextDue.setDate(nextDue.getDate() + 1);
        break;
      case 'weekly':
        nextDue.setDate(nextDue.getDate() + 7);
        break;
      case 'monthly':
        nextDue.setMonth(nextDue.getMonth() + 1);
        break;
    }

    const newTodo: Todo = {
      ...completedTodo,
      id: uuidv4(),
      completed: false,
      status: 'todo',
      due_date: nextDue.toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };

    setTodos((prev) => [newTodo, ...prev]);

    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: false,
      status: 'todo',
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
      due_date: newTodo.due_date,
      recurrence: newTodo.recurrence,
    };

    if (newTodo.priority && newTodo.priority !== 'medium') insertData.priority = newTodo.priority;
    if (newTodo.assigned_to) insertData.assigned_to = newTodo.assigned_to;
    if (newTodo.notes) insertData.notes = newTodo.notes;

    await supabase.from('todos').insert([insertData]);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const todoItem = todos.find(t => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

    if (completed && todoItem) {
      setCelebrationText(todoItem.text);
      setShowCelebration(true);

      // Handle recurring tasks
      if (todoItem.recurrence) {
        createNextRecurrence(todoItem);
      }
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo))
      );
    }
  };

  const deleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
    setSelectedTodos((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);

    if (deleteError) {
      console.error('Error deleting todo:', deleteError);
      if (todoToDelete) {
        setTodos((prev) => [...prev, todoToDelete]);
      }
    }
  };

  const confirmDeleteTodo = (id: string) => {
    const todo = todos.find(t => t.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Task',
      message: `Are you sure you want to delete "${todo?.text}"? This cannot be undone.`,
      onConfirm: () => {
        deleteTodo(id);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const assignTodo = async (id: string, assignedTo: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, assigned_to: assignedTo || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .eq('id', id);

    if (updateError) {
      console.error('Error assigning todo:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const setDueDate = async (id: string, dueDate: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, due_date: dueDate || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ due_date: dueDate })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting due date:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const setPriority = async (id: string, priority: TodoPriority) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, priority } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ priority })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting priority:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, notes } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ notes })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating notes:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const setRecurrence = async (id: string, recurrence: RecurrencePattern) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, recurrence } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ recurrence })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting recurrence:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const updateSubtasks = async (id: string, subtasks: Subtask[]) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, subtasks } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ subtasks })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating subtasks:', updateError);
      if (oldTodo) {
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  // Bulk actions with confirmation
  const bulkDelete = async () => {
    const count = selectedTodos.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Tasks',
      message: `Are you sure you want to delete ${count} task${count > 1 ? 's' : ''}? This cannot be undone.`,
      onConfirm: async () => {
        const idsToDelete = Array.from(selectedTodos);
        const todosToDelete = todos.filter(t => selectedTodos.has(t.id));

        setTodos((prev) => prev.filter((todo) => !selectedTodos.has(todo.id)));
        setSelectedTodos(new Set());
        setShowBulkActions(false);

        const { error } = await supabase
          .from('todos')
          .delete()
          .in('id', idsToDelete);

        if (error) {
          console.error('Error bulk deleting:', error);
          setTodos((prev) => [...prev, ...todosToDelete]);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const bulkAssign = async (assignedTo: string) => {
    const idsToUpdate = Array.from(selectedTodos);

    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, assigned_to: assignedTo } : todo
      )
    );
    setSelectedTodos(new Set());
    setShowBulkActions(false);

    await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .in('id', idsToUpdate);
  };

  const bulkComplete = async () => {
    const idsToUpdate = Array.from(selectedTodos);

    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, completed: true, status: 'done' as TodoStatus } : todo
      )
    );
    setSelectedTodos(new Set());
    setShowBulkActions(false);

    await supabase
      .from('todos')
      .update({ completed: true, status: 'done' })
      .in('id', idsToUpdate);
  };

  const handleSelectTodo = (id: string, selected: boolean) => {
    setSelectedTodos((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedTodos(new Set(filteredAndSortedTodos.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTodos(new Set());
  };

  // Filter and sort todos
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...todos];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (todo) =>
          todo.text.toLowerCase().includes(query) ||
          todo.created_by.toLowerCase().includes(query) ||
          (todo.assigned_to && todo.assigned_to.toLowerCase().includes(query)) ||
          (todo.notes && todo.notes.toLowerCase().includes(query))
      );
    }

    // Apply quick filter
    switch (quickFilter) {
      case 'my_tasks':
        result = result.filter((todo) => todo.assigned_to === userName || todo.created_by === userName);
        break;
      case 'due_today':
        result = result.filter((todo) => isDueToday(todo.due_date) && !todo.completed);
        break;
      case 'overdue':
        result = result.filter((todo) => isOverdue(todo.due_date, todo.completed));
        break;
      case 'urgent':
        result = result.filter((todo) => todo.priority === 'urgent' && !todo.completed);
        break;
    }

    // Apply completed filter
    if (!showCompleted) {
      result = result.filter((todo) => !todo.completed);
    }

    // Apply sort
    switch (sortOption) {
      case 'due_date':
        result.sort((a, b) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });
        break;
      case 'priority':
        result.sort((a, b) => priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium']);
        break;
      case 'alphabetical':
        result.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'created':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return result;
  }, [todos, searchQuery, quickFilter, showCompleted, sortOption, userName]);

  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    active: todos.filter((t) => !t.completed).length,
    dueToday: todos.filter((t) => isDueToday(t.due_date) && !t.completed).length,
    overdue: todos.filter((t) => isOverdue(t.due_date, t.completed)).length,
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className="w-8 h-8 border-3 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
        <div className={`p-8 rounded-2xl shadow-xl border max-w-md w-full text-center ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Setup Required</h2>
          <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>See SETUP.md for instructions</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${darkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
      {/* Skip link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
        Skip to main content
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0033A0] shadow-lg">
        <div className={`mx-auto px-4 sm:px-6 py-3 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <div className="flex items-center justify-between gap-3">
            {/* Logo & Context Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white truncate">Bealer Agency</h1>
                {/* Show contextual info instead of "Welcome back" */}
                <p className="text-xs text-white/70 truncate">
                  {stats.active} active{stats.dueToday > 0 && ` • ${stats.dueToday} due today`}{stats.overdue > 0 && ` • ${stats.overdue} overdue`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle with labels */}
              <div className="flex bg-white/10 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-[#0033A0] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-white text-[#0033A0] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  aria-pressed={viewMode === 'kanban'}
                  aria-label="Board view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Board</span>
                </button>
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Connection status - floating indicator */}
      <div className="fixed bottom-4 right-4 z-30">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-lg ${
          connected
            ? darkMode ? 'bg-emerald-900/90 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
            : darkMode ? 'bg-red-900/90 text-red-200' : 'bg-red-100 text-red-700'
        }`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? 'Live' : 'Offline'}
        </div>
      </div>

      {/* Main */}
      <main id="main-content" className={`mx-auto px-4 sm:px-6 py-6 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Actionable Stats Cards - Reduced to 3, always visible, clickable */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => { setQuickFilter('all'); setShowCompleted(false); }}
            className={`rounded-xl p-3 border shadow-sm text-left transition-all hover:shadow-md ${
              quickFilter === 'all' && !showCompleted
                ? 'ring-2 ring-[#0033A0] border-[#0033A0]'
                : ''
            } ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <p className="text-xl sm:text-2xl font-bold text-[#0033A0]">{stats.active}</p>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>To Do</p>
          </button>
          <button
            onClick={() => setQuickFilter('due_today')}
            className={`rounded-xl p-3 border shadow-sm text-left transition-all hover:shadow-md ${
              quickFilter === 'due_today'
                ? 'ring-2 ring-orange-500 border-orange-500'
                : ''
            } ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <p className="text-xl sm:text-2xl font-bold text-orange-500">{stats.dueToday}</p>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Due Today</p>
          </button>
          <button
            onClick={() => setQuickFilter('overdue')}
            className={`rounded-xl p-3 border shadow-sm text-left transition-all hover:shadow-md ${
              quickFilter === 'overdue'
                ? 'ring-2 ring-red-500 border-red-500'
                : ''
            } ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <p className="text-xl sm:text-2xl font-bold text-red-500">{stats.overdue}</p>
            <p className={`text-xs sm:text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Overdue</p>
          </button>
        </div>

        {/* Add todo */}
        <div className="mb-6">
          <AddTodo onAdd={addTodo} users={users} darkMode={darkMode} />
        </div>

        {/* Unified Filter Bar */}
        <div className={`rounded-xl p-3 mb-4 ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          {/* Search Row */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
                className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Sort tasks"
                className={`appearance-none pl-3 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <option value="created">Newest</option>
                <option value="due_date">Due Date</option>
                <option value="priority">Priority</option>
                <option value="alphabetical">A-Z</option>
              </select>
              <ArrowUpDown className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>
          </div>

          {/* Filter Chips - Single Row */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all' as QuickFilter, label: 'All', icon: LayoutList },
              { id: 'my_tasks' as QuickFilter, label: 'My Tasks', icon: User },
              { id: 'urgent' as QuickFilter, label: 'Urgent', icon: AlertTriangle },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setQuickFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  quickFilter === f.id
                    ? 'bg-[#0033A0] text-white'
                    : darkMode
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                aria-pressed={quickFilter === f.id}
              >
                <f.icon className="w-3.5 h-3.5" />
                {f.label}
              </button>
            ))}

            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />

            {/* Show completed toggle */}
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                showCompleted
                  ? 'bg-emerald-500 text-white'
                  : darkMode
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              aria-pressed={showCompleted}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Done ({stats.completed})
            </button>

            {/* Active filter indicator */}
            {quickFilter !== 'all' && (
              <button
                onClick={() => setQuickFilter('all')}
                className="text-xs text-[#0033A0] hover:underline ml-auto"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions - Always visible checkbox in list view */}
        {viewMode === 'list' && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                if (showBulkActions) {
                  clearSelection();
                }
                setShowBulkActions(!showBulkActions);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                showBulkActions
                  ? 'bg-[#D4A853] text-white'
                  : darkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {showBulkActions ? 'Cancel' : 'Select'}
            </button>

            {/* Bulk actions bar */}
            {showBulkActions && selectedTodos.size > 0 && (
              <div className="flex items-center gap-2 flex-1">
                <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-slate-700'}`}>
                  {selectedTodos.size} selected
                </span>
                <button
                  onClick={selectAll}
                  className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  All
                </button>
                <button
                  onClick={clearSelection}
                  className={`px-2 py-1 text-xs rounded ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Clear
                </button>
                <div className="flex-1" />
                <button
                  onClick={bulkComplete}
                  className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-1.5"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Complete</span>
                </button>
                <div className="relative">
                  <select
                    onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ''; }}
                    className={`appearance-none px-3 py-1.5 pr-8 text-sm rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
                    aria-label="Assign to"
                  >
                    <option value="">Assign...</option>
                    {users.map((user) => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                </div>
                <button
                  onClick={bulkDelete}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* List or Kanban */}
        {viewMode === 'list' ? (
          <div className="space-y-2" role="list" aria-label="Task list">
            {filteredAndSortedTodos.length === 0 ? (
              <div className="text-center py-16">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Calendar className={`w-8 h-8 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                </div>
                <p className={`font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {searchQuery ? 'No tasks match your search' : showCompleted && stats.completed === 0 ? 'No completed tasks yet' : 'No tasks to show'}
                </p>
                <p className={`text-sm mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {searchQuery ? 'Try a different search term' : 'Add your first task above'}
                </p>
              </div>
            ) : (
              filteredAndSortedTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  users={users}
                  darkMode={darkMode}
                  selected={selectedTodos.has(todo.id)}
                  onSelect={showBulkActions ? handleSelectTodo : undefined}
                  onToggle={toggleTodo}
                  onDelete={confirmDeleteTodo}
                  onAssign={assignTodo}
                  onSetDueDate={setDueDate}
                  onSetPriority={setPriority}
                  onDuplicate={duplicateTodo}
                  onUpdateNotes={updateNotes}
                  onSetRecurrence={setRecurrence}
                  onUpdateSubtasks={updateSubtasks}
                />
              ))
            )}
          </div>
        ) : (
          <KanbanBoard
            todos={todos}
            users={users}
            darkMode={darkMode}
            onStatusChange={updateStatus}
            onDelete={confirmDeleteTodo}
            onAssign={assignTodo}
            onSetDueDate={setDueDate}
            onSetPriority={setPriority}
          />
        )}

        {/* Keyboard shortcuts hint */}
        <div className={`mt-8 text-center text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <span className="hidden sm:inline">
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>N</kbd> new
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>/</kbd> search
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>Esc</kbd> clear
          </span>
        </div>
      </main>

      <CelebrationEffect
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
        taskText={celebrationText}
      />

      <ProgressSummary
        show={showProgressSummary}
        onClose={() => setShowProgressSummary(false)}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <WelcomeBackNotification
        show={showWelcomeBack}
        onClose={() => setShowWelcomeBack(false)}
        onViewProgress={() => setShowProgressSummary(true)}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
