'use client';

import { useState } from 'react';
import { Check, Trash2, MoreHorizontal } from 'lucide-react';
import { Todo, TodoPriority } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  users: string[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

export default function TodoItem({
  todo,
  onToggle,
  onDelete,
}: TodoItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={`group flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors ${
      todo.completed ? 'opacity-60' : ''
    }`}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id, !todo.completed)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          todo.completed
            ? 'bg-green-500 border-green-500'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400'
        }`}
      >
        {todo.completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Text */}
      <span className={`flex-1 text-sm ${
        todo.completed
          ? 'text-neutral-400 line-through'
          : 'text-neutral-900 dark:text-neutral-100'
      }`}>
        {todo.text}
      </span>

      {/* Meta */}
      <span className="text-xs text-neutral-400 hidden sm:block">
        {todo.created_by}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
