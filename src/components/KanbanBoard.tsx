'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Flag,
  User,
  Trash2,
  Clock,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import { Todo, TodoStatus, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface KanbanBoardProps {
  todos: Todo[];
  users: string[];
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

const columns: { id: TodoStatus; title: string; icon: string; color: string; bgColor: string }[] = [
  { id: 'todo', title: 'To Do', icon: '📋', color: '#0033A0', bgColor: 'rgba(0, 51, 160, 0.08)' },
  { id: 'in_progress', title: 'In Progress', icon: '⚡', color: '#D4A853', bgColor: 'rgba(212, 168, 83, 0.08)' },
  { id: 'done', title: 'Done', icon: '✓', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.08)' },
];

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

const isOverdue = (date: string) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
};

interface SortableCardProps {
  todo: Todo;
  users: string[];
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
}

function SortableCard({ todo, users, onDelete, onAssign, onSetDueDate, onSetPriority }: SortableCardProps) {
  const [showActions, setShowActions] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group bg-white rounded-xl border-2 overflow-hidden transition-all ${
        isDragging
          ? 'shadow-2xl ring-2 ring-[#0033A0] border-[#0033A0]'
          : 'shadow-sm border-slate-100 hover:shadow-md hover:border-slate-200'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Priority bar */}
      <div
        className="h-1.5"
        style={{ backgroundColor: priorityConfig.color }}
      />

      <div className="p-3">
        {/* Drag handle and content */}
        <div className="flex gap-2">
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 pt-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4 text-slate-300" />
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium leading-snug ${
              todo.completed ? 'line-through text-slate-400' : 'text-slate-800'
            }`}>
              {todo.text}
            </p>

            {/* Metadata row */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {/* Priority */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
                style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
              >
                <Flag className="w-2.5 h-2.5" />
                {priorityConfig.label}
              </span>

              {/* Due date */}
              {todo.due_date && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
                  todo.completed
                    ? 'bg-slate-100 text-slate-400'
                    : overdue
                      ? 'bg-red-100 text-red-600'
                      : 'bg-[#0033A0]/10 text-[#0033A0]'
                }`}>
                  {overdue ? <AlertCircle className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                  {formatDueDate(todo.due_date)}
                </span>
              )}
            </div>

            {/* Assignee & Creator */}
            <div className="flex items-center justify-between mt-2">
              {todo.assigned_to ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853]">
                  <User className="w-3 h-3" />
                  {todo.assigned_to}
                </span>
              ) : (
                <span className="text-xs text-slate-400">Unassigned</span>
              )}
              <span className="text-xs text-slate-400">
                by {todo.created_by}
              </span>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-slate-100"
            >
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
                />
                <select
                  value={todo.assigned_to || ''}
                  onChange={(e) => onAssign(todo.id, e.target.value || null)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function KanbanCard({ todo }: { todo: Todo }) {
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <div className="bg-white rounded-xl shadow-2xl border-2 border-[#0033A0] overflow-hidden ring-4 ring-[#0033A0]/20">
      <div className="h-1.5" style={{ backgroundColor: priorityConfig.color }} />
      <div className="p-3">
        <p className="text-sm font-medium text-slate-800">{todo.text}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            <Flag className="w-2.5 h-2.5" />
            {priorityConfig.label}
          </span>
          {todo.due_date && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium ${
              overdue
                ? 'bg-red-100 text-red-600'
                : 'bg-[#0033A0]/10 text-[#0033A0]'
            }`}>
              <Clock className="w-2.5 h-2.5" />
              {formatDueDate(todo.due_date)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KanbanBoard({
  todos,
  users,
  onStatusChange,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const getTodosByStatus = (status: TodoStatus) => {
    return todos.filter((todo) => (todo.status || 'todo') === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const todoId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const column = columns.find((c) => c.id === overId);
    if (column) {
      onStatusChange(todoId, column.id);
      return;
    }

    // Check if dropped on another card
    const overTodo = todos.find((t) => t.id === overId);
    if (overTodo) {
      onStatusChange(todoId, overTodo.status || 'todo');
    }
  };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => {
          const columnTodos = getTodosByStatus(column.id);

          return (
            <motion.div
              key={column.id}
              layout
              className="flex flex-col bg-white rounded-2xl shadow-sm border-2 border-slate-100 overflow-hidden"
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b-2"
                style={{ backgroundColor: column.bgColor, borderColor: column.color + '30' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{column.icon}</span>
                  <h3 className="font-semibold text-slate-800">
                    {column.title}
                  </h3>
                </div>
                <span
                  className="px-2.5 py-1 rounded-lg text-sm font-bold"
                  style={{ backgroundColor: column.color, color: 'white' }}
                >
                  {columnTodos.length}
                </span>
              </div>

              {/* Column body */}
              <SortableContext
                items={columnTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
                id={column.id}
              >
                <div
                  className={`flex-1 p-3 min-h-[250px] space-y-3 transition-all ${
                    activeId ? 'bg-slate-50' : 'bg-slate-50/50'
                  }`}
                  style={{
                    borderLeft: activeId ? `3px solid ${column.color}40` : '3px solid transparent',
                    borderRight: activeId ? `3px solid ${column.color}40` : '3px solid transparent',
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {columnTodos.map((todo) => (
                      <SortableCard
                        key={todo.id}
                        todo={todo}
                        users={users}
                        onDelete={onDelete}
                        onAssign={onAssign}
                        onSetDueDate={onSetDueDate}
                        onSetPriority={onSetPriority}
                      />
                    ))}
                  </AnimatePresence>

                  {columnTodos.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-slate-400"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: column.bgColor }}
                      >
                        <span className="text-2xl">{column.icon}</span>
                      </div>
                      <p className="text-sm font-medium">Drop tasks here</p>
                    </motion.div>
                  )}
                </div>
              </SortableContext>
            </motion.div>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTodo && <KanbanCard todo={activeTodo} />}
      </DragOverlay>
    </DndContext>
  );
}
