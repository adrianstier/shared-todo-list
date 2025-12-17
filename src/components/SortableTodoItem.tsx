'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import TodoItem from './TodoItem';
import { Todo, TodoPriority, RecurrencePattern, Subtask } from '@/types/todo';

interface SortableTodoItemProps {
  todo: Todo;
  users: string[];
  darkMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onDuplicate?: (todo: Todo) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  isDragEnabled?: boolean;
}

export default function SortableTodoItem({
  todo,
  isDragEnabled = true,
  darkMode,
  ...props
}: SortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'shadow-2xl' : ''}`}
    >
      {isDragEnabled && (
        <div
          {...attributes}
          {...listeners}
          className={`absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 ${
            darkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
          }`}
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className={isDragEnabled ? 'pl-7' : ''}>
        <TodoItem todo={todo} darkMode={darkMode} {...props} />
      </div>
    </div>
  );
}
