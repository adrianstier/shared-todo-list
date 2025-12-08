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
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 max-w-md w-full">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
            Setup Required
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">{error}</p>
          <p className="text-xs text-neutral-500">See SETUP.md for instructions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className={`mx-auto px-4 sm:px-6 py-3 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Tasks
              </h1>
              <p className="text-sm text-neutral-500">
                {userName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-neutral-700 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded ${
                    viewMode === 'kanban'
                      ? 'bg-white dark:bg-neutral-700 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>

              {/* Connection status */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                connected
                  ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                  : 'text-red-600 bg-red-50 dark:bg-red-900/20'
              }`}>
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {connected ? 'Live' : 'Offline'}
              </div>

              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`mx-auto px-4 sm:px-6 py-6 ${viewMode === 'kanban' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        {/* Stats */}
        <div className="flex gap-4 mb-6 text-sm">
          <span className="text-neutral-500">{stats.active} active</span>
          <span className="text-neutral-400">{stats.completed} done</span>
        </div>

        {/* Add todo */}
        <div className="mb-6">
          <AddTodo onAdd={addTodo} />
        </div>

        {/* Filter */}
        {viewMode === 'list' && (
          <div className="flex gap-1 mb-4">
            {(['all', 'active', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm rounded ${
                  filter === f
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* List or Kanban */}
        {viewMode === 'list' ? (
          <div className="space-y-2">
            {filteredTodos.length === 0 ? (
              <p className="text-center text-neutral-400 py-12">
                {filter === 'completed' ? 'No completed tasks' : 'No tasks yet'}
              </p>
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
