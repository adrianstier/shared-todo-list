'use client';

import { useState } from 'react';
import { Check, Trash2, Calendar, User, Flag } from 'lucide-react';
import { Todo, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface TodoItemProps {
  todo: Todo;
  users: string[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

const formatDueDate = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(d);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) return 'Today';
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const isOverdue = (date: string, completed: boolean) => {
  if (completed) return false;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

export default function TodoItem({
  todo,
  users,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
}: TodoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && isOverdue(todo.due_date, todo.completed);

  return (
    <div
      className={`group bg-white rounded-xl border-2 transition-all ${
        todo.completed
          ? 'border-slate-100 opacity-60'
          : overdue
            ? 'border-red-200 bg-red-50/30'
            : 'border-slate-100 hover:border-[#0033A0]/30 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo.id, !todo.completed)}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            todo.completed
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-slate-300 hover:border-[#0033A0] hover:bg-[#0033A0]/5'
          }`}
        >
          {todo.completed && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
          <p className={`font-medium cursor-pointer ${
            todo.completed
              ? 'text-slate-400 line-through'
              : 'text-slate-800'
          }`}>
            {todo.text}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {/* Priority */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
            >
              <Flag className="w-3 h-3" />
              {priorityConfig.label}
            </span>

            {/* Due date */}
            {todo.due_date && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                todo.completed
                  ? 'bg-slate-100 text-slate-400'
                  : overdue
                    ? 'bg-red-100 text-red-600'
                    : 'bg-[#0033A0]/10 text-[#0033A0]'
              }`}>
                <Calendar className="w-3 h-3" />
                {formatDueDate(todo.due_date)}
              </span>
            )}

            {/* Assigned to */}
            {todo.assigned_to && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[#D4A853]/10 text-[#D4A853]">
                <User className="w-3 h-3" />
                {todo.assigned_to}
              </span>
            )}

            {/* Created by */}
            <span className="text-xs text-slate-400">
              by {todo.created_by}
            </span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={() => onDelete(todo.id)}
          className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded actions */}
      {expanded && !todo.completed && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex flex-wrap gap-2">
          {/* Priority selector */}
          <select
            value={priority}
            onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
          >
            <option value="low">Low Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="high">High Priority</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* Due date */}
          <input
            type="date"
            value={todo.due_date ? todo.due_date.split('T')[0] : ''}
            onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
          />

          {/* Assign to */}
          <select
            value={todo.assigned_to || ''}
            onChange={(e) => onAssign(todo.id, e.target.value || null)}
            className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
          >
            <option value="">Unassigned</option>
            {users.map((user) => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
