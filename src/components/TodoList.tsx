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
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutList, LayoutGrid, Wifi, WifiOff, Mail, Search,
  ArrowUpDown, User, Calendar, AlertTriangle, CheckSquare,
  Trash2, UserPlus, Moon, Sun, X
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';

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
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // New state for enhanced features
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('created');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set());
  const [darkMode, setDarkMode] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showProgressSummary, setShowProgressSummary] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

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
        const input = document.querySelector('input[placeholder*="task"]') as HTMLInputElement;
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
      }

      // 'd' - toggle dark mode
      if (e.key === 'd' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDarkMode(prev => !prev);
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

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const addTodo = async (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string) => {
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
    let nextDue = new Date(currentDue);

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

  // Bulk actions
  const bulkDelete = async () => {
    const idsToDelete = Array.from(selectedTodos);
    const todosToDelete = todos.filter(t => selectedTodos.has(t.id));

    setTodos((prev) => prev.filter((todo) => !selectedTodos.has(todo.id)));
    setSelectedTodos(new Set());

    const { error } = await supabase
      .from('todos')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.error('Error bulk deleting:', error);
      setTodos((prev) => [...prev, ...todosToDelete]);
    }
  };

  const bulkAssign = async (assignedTo: string) => {
    const idsToUpdate = Array.from(selectedTodos);

    setTodos((prev) =>
      prev.map((todo) =>
        selectedTodos.has(todo.id) ? { ...todo, assigned_to: assignedTo } : todo
      )
    );
    setSelectedTodos(new Set());

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

    // Apply status filter
    if (filter === 'active') {
      result = result.filter((todo) => !todo.completed);
    } else if (filter === 'completed') {
      result = result.filter((todo) => todo.completed);
    } else if (filter === 'all' && quickFilter === 'all') {
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
  }, [todos, searchQuery, quickFilter, filter, sortOption, userName]);

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
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0033A0] shadow-lg">
        <div className={`mx-auto px-4 sm:px-6 py-4 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Bealer Agency</h1>
                <p className="text-xs text-white/70">Welcome back, {userName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                title={darkMode ? 'Light mode (D)' : 'Dark mode (D)'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* View toggle */}
              <div className="flex bg-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white text-[#0033A0] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-white text-[#0033A0] shadow-md'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Connection status */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                connected
                  ? 'text-emerald-100 bg-emerald-500/20'
                  : 'text-red-100 bg-red-500/20'
              }`}>
                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {connected ? 'Live' : 'Offline'}
              </div>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`mx-auto px-4 sm:px-6 py-8 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Stats Cards */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 mb-8">
          <div className={`rounded-xl p-4 border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>{stats.total}</p>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total</p>
          </div>
          <div className={`rounded-xl p-4 border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className="text-2xl font-bold text-[#0033A0]">{stats.active}</p>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Active</p>
          </div>
          <div className={`rounded-xl p-4 border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Done</p>
          </div>
          <div className={`hidden sm:block rounded-xl p-4 border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className="text-2xl font-bold text-orange-500">{stats.dueToday}</p>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Due Today</p>
          </div>
          <div className={`hidden sm:block rounded-xl p-4 border shadow-sm ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Overdue</p>
          </div>
        </div>

        {/* Add todo */}
        <div className="mb-6">
          <AddTodo onAdd={addTodo} users={users} />
        </div>

        {/* Search and Sort Bar */}
        <div className={`flex flex-wrap gap-3 mb-4 p-3 rounded-xl ${darkMode ? 'bg-slate-800' : 'bg-white'} border ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks... (/)"
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
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className={`w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="created">Newest First</option>
              <option value="due_date">Due Date</option>
              <option value="priority">Priority</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { id: 'all' as QuickFilter, label: 'All Tasks', icon: LayoutList },
            { id: 'my_tasks' as QuickFilter, label: 'My Tasks', icon: User },
            { id: 'due_today' as QuickFilter, label: 'Due Today', icon: Calendar, count: stats.dueToday },
            { id: 'overdue' as QuickFilter, label: 'Overdue', icon: AlertTriangle, count: stats.overdue },
            { id: 'urgent' as QuickFilter, label: 'Urgent', icon: AlertTriangle },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setQuickFilter(f.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                quickFilter === f.id
                  ? 'bg-[#0033A0] text-white shadow-md'
                  : darkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
              {f.count !== undefined && f.count > 0 && (
                <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                  quickFilter === f.id ? 'bg-white/20' : 'bg-red-100 text-red-600'
                }`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Status Filter (list view only) */}
        {viewMode === 'list' && (
          <div className="flex gap-2 mb-6">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  filter === f
                    ? 'bg-[#0033A0] text-white shadow-md shadow-[#0033A0]/30'
                    : darkMode
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}

            {/* Bulk selection toggle */}
            <button
              onClick={() => {
                setShowBulkActions(!showBulkActions);
                if (showBulkActions) clearSelection();
              }}
              className={`ml-auto px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                showBulkActions
                  ? 'bg-[#D4A853] text-white'
                  : darkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <CheckSquare className="w-4 h-4 inline-block mr-2" />
              Select
            </button>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {showBulkActions && selectedTodos.size > 0 && (
          <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#0033A0]/10 border-[#0033A0]/20'} border`}>
            <span className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-[#0033A0]'}`}>
              {selectedTodos.size} selected
            </span>
            <button
              onClick={selectAll}
              className={`px-3 py-1.5 text-sm rounded-lg ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className={`px-3 py-1.5 text-sm rounded-lg ${darkMode ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Clear
            </button>
            <div className="flex-1" />
            <button
              onClick={bulkComplete}
              className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              Complete
            </button>
            <select
              onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ''; }}
              className={`px-3 py-1.5 text-sm rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              <option value="">Assign to...</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
            <button
              onClick={bulkDelete}
              className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}

        {/* List or Kanban */}
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredAndSortedTodos.length === 0 ? (
              <div className="text-center py-16">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <svg className={`w-10 h-10 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className={`font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {searchQuery ? 'No tasks match your search' : filter === 'completed' ? 'No completed tasks yet' : 'No tasks yet'}
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
                  selected={selectedTodos.has(todo.id)}
                  onSelect={showBulkActions ? handleSelectTodo : undefined}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
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
            onStatusChange={updateStatus}
            onDelete={deleteTodo}
            onAssign={assignTodo}
            onSetDueDate={setDueDate}
            onSetPriority={setPriority}
          />
        )}

        {/* Keyboard shortcuts hint */}
        <div className={`mt-8 text-center text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <span className="hidden sm:inline">
            Shortcuts: <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>N</kbd> new task
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>/</kbd> search
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>D</kbd> dark mode
            <span className="mx-2">|</span>
            <kbd className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>1-4</kbd> filters
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
    </div>
  );
}
