'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, TodoPriority, ViewMode } from '@/types/todo';
import TodoItem from './TodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import CelebrationEffect from './CelebrationEffect';
import ProgressSummary from './ProgressSummary';
import WelcomeBackNotification, { shouldShowWelcomeNotification } from './WelcomeBackNotification';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutList,
  LayoutGrid,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Trophy
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

export default function TodoList({ currentUser, onUserChange }: TodoListProps) {
  const userName = currentUser.name;
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Feature states: celebration, progress summary, welcome back
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationText, setCelebrationText] = useState('');
  const [showProgressSummary, setShowProgressSummary] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  const fetchTodos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching todos:', fetchError);
      setError('Failed to connect to database. Please check your Supabase configuration.');
    } else {
      setTodos(data || []);
      const uniqueUsers = [...new Set((data || []).map((t: Todo) => t.created_by).filter(Boolean))];
      setUsers((prev) => [...new Set([...prev, ...uniqueUsers])]);
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
        setUsers((prev) => [...new Set([...prev, userName])]);

        // Check if we should show welcome back notification
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
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        (payload) => {
          if (!isMounted) return;
          console.log('Real-time update:', payload);

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
            setTodos((prev) =>
              prev.filter((todo) => todo.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (isMounted) {
          setConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTodos, userName]);

  const addTodo = async (text: string, priority: TodoPriority, dueDate?: string) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      status: 'todo',
      priority,
      created_at: new Date().toISOString(),
      created_by: userName,
      due_date: dueDate,
    };

    setTodos((prev) => [newTodo, ...prev]);

    // Build insert object with core fields only
    // Optional fields (status, priority, due_date, assigned_to) are only included if they have values
    // This ensures compatibility with databases that may not have these columns
    const insertData: Record<string, unknown> = {
      id: newTodo.id,
      text: newTodo.text,
      completed: newTodo.completed,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    };

    // Only add optional fields if they have meaningful values
    if (newTodo.status && newTodo.status !== 'todo') {
      insertData.status = newTodo.status;
    }
    if (newTodo.priority && newTodo.priority !== 'medium') {
      insertData.priority = newTodo.priority;
    }
    if (newTodo.due_date) {
      insertData.due_date = newTodo.due_date;
    }
    if (newTodo.assigned_to) {
      insertData.assigned_to = newTodo.assigned_to;
    }

    const { error: insertError } = await supabase.from('todos').insert([insertData]);

    if (insertError) {
      console.error('Error adding todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed } : todo))
    );

    // Trigger celebration when moving to done
    if (status === 'done' && oldTodo && !oldTodo.completed) {
      setCelebrationText(oldTodo.text);
      setShowCelebration(true);
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const todoItem = todos.find(t => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

    // Trigger celebration when marking as complete
    if (completed && todoItem) {
      setCelebrationText(todoItem.text);
      setShowCelebration(true);
    }

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !completed } : todo
        )
      );
    }
  };

  const deleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);

    setTodos((prev) => prev.filter((todo) => todo.id !== id));

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
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
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
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const setPriority = async (id: string, priority: TodoPriority) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, priority } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ priority })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting priority:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };


  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    // 'all' filter now shows only active tasks (completed tasks go to 'Completed' tab)
    return !todo.completed;
  });

  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    overdue: todos.filter((t) => {
      if (!t.due_date || t.completed) return false;
      const d = new Date(t.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-cream via-white to-warm-gold/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-[20px] bg-gradient-to-br from-warm-gold to-warm-amber flex items-center justify-center shadow-lg shadow-warm-gold/30">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-4 border-white border-t-transparent rounded-full"
            />
          </div>
          <p className="text-warm-brown/70 dark:text-slate-400 font-medium">Loading your tasks...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-cream via-white to-warm-gold/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-[24px] shadow-xl max-w-md w-full text-center border border-warm-gold/20 dark:border-slate-800"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-[16px] bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-warm-brown dark:text-slate-100 mb-2">
            Configuration Required
          </h2>
          <p className="text-warm-brown/60 dark:text-slate-400 mb-4">{error}</p>
          <p className="text-sm text-warm-brown/40 dark:text-slate-500">
            See SETUP.md for instructions
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-cream via-white to-warm-gold/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative">
      {/* Artsy Background Elements */}
      <div className="artsy-background" />
      <div className="floating-shapes">
        <div className="floating-shape shape-1" />
        <div className="floating-shape shape-2" />
        <div className="floating-shape shape-3" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/95 dark:bg-slate-900/90 border-b border-warm-gold/20 dark:border-slate-800/50 shadow-sm">
        {/* Artistic Wavy Top Bar */}
        <div className="h-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-warm-gold via-warm-amber to-warm-gold" />
          <svg className="absolute bottom-0 left-0 w-full h-1" viewBox="0 0 1200 4" preserveAspectRatio="none">
            <path d="M0 2 Q150 0 300 2 T600 2 T900 2 T1200 2" stroke="rgba(255,255,255,0.3)" strokeWidth="1" fill="none"/>
          </svg>
        </div>
        <div className={`mx-auto px-4 sm:px-6 py-4 ${viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-between">
            {/* Logo & User */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {/* Artistic Logo with Hand-Drawn Feel */}
                <div className="relative">
                  <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-warm-gold to-warm-amber flex items-center justify-center shadow-lg shadow-warm-gold/30 btn-organic">
                    {/* Stylized "B" with subtle hand-drawn quality */}
                    <span className="text-white font-bold text-xl" style={{ fontFamily: 'Georgia, serif' }}>B</span>
                  </div>
                  {/* Decorative accent dot */}
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#0033A0] rounded-full border-2 border-white dark:border-slate-900" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-warm-brown dark:text-slate-100">
                    Bealer Agency
                  </h1>
                  <p className="text-xs text-warm-brown/60 dark:text-slate-400 mt-1">
                    Welcome, <span className="font-semibold text-warm-gold dark:text-amber-400">{userName}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Progress Summary Button - with organic shape */}
              <motion.button
                onClick={() => setShowProgressSummary(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-warm-gold to-warm-amber text-white btn-organic shadow-md shadow-warm-gold/30 hover:shadow-lg hover:shadow-warm-gold/40 transition-all font-medium warm-glow"
              >
                <Trophy className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">Progress</span>
              </motion.button>

              {/* View Switcher */}
              <div className="flex bg-warm-cream dark:bg-slate-800 rounded-[12px] p-1">
                <motion.button
                  onClick={() => setViewMode('list')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-2 rounded-[8px] transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-warm-gold dark:text-amber-400'
                      : 'text-warm-brown/50 dark:text-slate-400 hover:text-warm-brown dark:hover:text-slate-300'
                  }`}
                >
                  <LayoutList className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => setViewMode('kanban')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-2 rounded-[8px] transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-warm-gold dark:text-amber-400'
                      : 'text-warm-brown/50 dark:text-slate-400 hover:text-warm-brown dark:hover:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-[12px] ${
                connected
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="relative">
                  {connected ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  {connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* User Switcher */}
              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`mx-auto px-4 sm:px-6 py-8 ${viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-3xl'}`}>
        {/* Stats - with artistic accents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          {/* Total Tasks Card - with signature corners */}
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-warm-gold/20 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-warm-gold/40 transition-all signature-corners relative overflow-visible">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-warm-gold/20 to-warm-amber/20 flex items-center justify-center relative">
                <Clock className="w-6 h-6 text-warm-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warm-brown dark:text-slate-100">{stats.total}</p>
                <p className="text-xs text-warm-brown/60 dark:text-slate-400 font-medium">Total Tasks</p>
              </div>
            </div>
          </div>

          {/* Completed Card - with watercolor accent */}
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-emerald-200/50 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all relative overflow-hidden">
            {/* Decorative blob */}
            <div className="absolute -top-6 -right-6 w-20 h-20 bg-gradient-to-br from-emerald-200/30 to-emerald-100/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center gap-3 relative">
              <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-emerald-100 to-emerald-200/50 dark:from-emerald-900/50 dark:to-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warm-brown dark:text-slate-100">{stats.completed}</p>
                <p className="text-xs text-warm-brown/60 dark:text-slate-400 font-medium">Completed</p>
              </div>
            </div>
          </div>

          {/* Overdue Card - with dots pattern */}
          <div className="bg-white dark:bg-slate-900 rounded-[20px] p-5 border border-red-200/50 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-red-300 transition-all dots-pattern relative">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-red-100 to-red-200/50 dark:from-red-900/50 dark:to-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-warm-brown dark:text-slate-100">{stats.overdue}</p>
                <p className="text-xs text-warm-brown/60 dark:text-slate-400 font-medium">Overdue</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add Todo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <AddTodo onAdd={addTodo} />
        </motion.div>

        {/* Filter (for list view) */}
        {viewMode === 'list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mb-6"
          >
            <Filter className="w-4 h-4 text-warm-brown/40" />
            <div className="flex bg-warm-cream dark:bg-slate-800 rounded-[12px] p-1">
              {(['all', 'active', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 text-sm font-medium rounded-[8px] transition-all ${
                    filter === f
                      ? 'bg-white dark:bg-slate-700 text-warm-brown dark:text-slate-100 shadow-sm'
                      : 'text-warm-brown/50 dark:text-slate-400 hover:text-warm-brown dark:hover:text-slate-300'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Todo List or Kanban */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {filteredTodos.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  {/* Illustrated empty state with protective hand motif */}
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    {/* Background glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-warm-gold/20 to-warm-amber/10 rounded-full blur-2xl" />
                    {/* Main circle with hand icon suggestion */}
                    <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-warm-cream to-warm-gold/20 border-2 border-warm-gold/30 flex items-center justify-center">
                      <motion.div
                        animate={{
                          y: [0, -5, 0],
                          rotate: [0, 5, 0, -5, 0]
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                        className="w-16 h-16 rounded-[16px] bg-gradient-to-br from-warm-gold to-warm-amber flex items-center justify-center shadow-lg shadow-warm-gold/30"
                      >
                        <CheckCircle2 className="w-8 h-8 text-white" />
                      </motion.div>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-warm-brown dark:text-slate-200 mb-2">
                    {filter === 'all' ? "You're all set!" : `No ${filter} tasks`}
                  </h3>
                  <p className="text-warm-brown/60 dark:text-slate-400 max-w-xs mx-auto">
                    {filter === 'all'
                      ? "Add your first task above and we'll help you stay on track."
                      : 'Try changing the filter to see more tasks'}
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredTodos.map((todo, index) => (
                    <motion.div
                      key={todo.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <TodoItem
                        todo={todo}
                        users={users}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        onAssign={assignTodo}
                        onSetDueDate={setDueDate}
                        onSetPriority={setPriority}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <KanbanBoard
                todos={todos}
                users={users}
                onStatusChange={updateStatus}
                onDelete={deleteTodo}
                onAssign={assignTodo}
                onSetDueDate={setDueDate}
                onSetPriority={setPriority}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Celebration Effect */}
      <CelebrationEffect
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
        taskText={celebrationText}
      />

      {/* Progress Summary Modal */}
      <ProgressSummary
        show={showProgressSummary}
        onClose={() => setShowProgressSummary(false)}
        todos={todos}
        currentUser={currentUser}
        onUserUpdate={onUserChange}
      />

      {/* Welcome Back Notification */}
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
