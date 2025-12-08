'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, TodoPriority, ViewMode } from '@/types/todo';
import TodoItem from './TodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import CelebrationEffect from './CelebrationEffect';
import ProgressSummary from './ProgressSummary';
import WelcomeBackNotification, { shouldShowWelcomeNotification } from './WelcomeBackNotification';
import { v4 as uuidv4 } from 'uuid';
import { LayoutList, LayoutGrid, Wifi, WifiOff } from 'lucide-react';
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
        setTodos((prev) => prev.map((todo) => (todo.id === id ? oldTodo : todo)));
      }
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    const todoItem = todos.find(t => t.id === id);

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

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
        prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo))
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

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return !todo.completed;
  });

  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    active: todos.filter((t) => !t.completed).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-[#0033A0] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Setup Required</h2>
          <p className="text-slate-500 text-sm mb-4">{error}</p>
          <p className="text-xs text-slate-400">See SETUP.md for instructions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            <p className="text-sm text-slate-500">Total Tasks</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <p className="text-2xl font-bold text-[#0033A0]">{stats.active}</p>
            <p className="text-sm text-slate-500">Active</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
            <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </div>
        </div>

        {/* Add todo */}
        <div className="mb-6">
          <AddTodo onAdd={addTodo} users={users} />
        </div>

        {/* Filter */}
        {viewMode === 'list' && (
          <div className="flex gap-2 mb-6">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  filter === f
                    ? 'bg-[#0033A0] text-white shadow-md shadow-[#0033A0]/30'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* List or Kanban */}
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredTodos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">
                  {filter === 'completed' ? 'No completed tasks yet' : 'No tasks yet'}
                </p>
                <p className="text-sm text-slate-400 mt-1">Add your first task above</p>
              </div>
            ) : (
              filteredTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  users={users}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                  onAssign={assignTodo}
                  onSetDueDate={setDueDate}
                  onSetPriority={setPriority}
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
