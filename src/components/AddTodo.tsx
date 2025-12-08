'use client';

import { useState } from 'react';
import { Plus, Calendar, Flag } from 'lucide-react';
import { TodoPriority } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string) => void;
}

export default function AddTodo({ onAdd }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim(), priority, dueDate || undefined);
      setText('');
      setPriority('medium');
      setDueDate('');
      setShowOptions(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
          <Plus className="w-4 h-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setShowOptions(true)}
          placeholder="Add a new task..."
          className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-base"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {/* Options row */}
      {showOptions && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          {/* Priority */}
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-slate-400" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-600"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-600"
            />
          </div>
        </div>
      )}
    </form>
  );
}
