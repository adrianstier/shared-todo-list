'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  CollisionDetection,
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
  X,
  FileText,
  Edit3,
  CheckSquare,
  Square,
  Plus
} from 'lucide-react';
import { Todo, TodoStatus, TodoPriority, PRIORITY_CONFIG, Subtask } from '@/types/todo';
import Celebration from './Celebration';

interface KanbanBoardProps {
  todos: Todo[];
  users: string[];
  darkMode?: boolean;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
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
  onCardClick: (todo: Todo) => void;
}

function SortableCard({ todo, users, onDelete, onAssign, onSetDueDate, onSetPriority, onCardClick }: SortableCardProps) {
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
  const hasNotes = todo.notes && todo.notes.trim().length > 0;
  const subtaskCount = todo.subtasks?.length || 0;
  const completedSubtasks = todo.subtasks?.filter(s => s.completed).length || 0;

  // Handle click to open detail modal (not during drag)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on action buttons
    if ((e.target as HTMLElement).closest('button, input, select')) {
      return;
    }
    onCardClick(todo);
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group rounded-xl border-2 overflow-hidden transition-all cursor-grab active:cursor-grabbing bg-white dark:bg-slate-800 touch-manipulation ${
        isDragging
          ? 'shadow-2xl ring-2 ring-[#0033A0] border-[#0033A0]'
          : 'shadow-sm border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleCardClick}
    >
      {/* Priority bar */}
      <div
        className="h-1.5"
        style={{ backgroundColor: priorityConfig.color }}
      />

      <div className="p-3 sm:p-3">
        {/* Card content */}
        <div className="flex-1 min-w-0">
          <p className={`text-base sm:text-sm font-medium leading-snug ${
            todo.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white'
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

          {/* Notes & Subtasks indicators */}
          {(hasNotes || subtaskCount > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {hasNotes && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <FileText className="w-3 h-3" />
                  Notes
                </span>
              )}
              {subtaskCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <CheckSquare className="w-3 h-3" />
                  {completedSubtasks}/{subtaskCount}
                </span>
              )}
            </div>
          )}

          {/* Assignee & Creator */}
          <div className="flex items-center justify-between mt-2">
            {todo.assigned_to ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853]">
                <User className="w-3 h-3" />
                {todo.assigned_to}
              </span>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">Unassigned</span>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                by {todo.created_by}
              </span>
              <Edit3 className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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
              className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700"
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="date"
                  value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                  onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 text-sm sm:text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] touch-manipulation"
                />
                <select
                  value={todo.assigned_to || ''}
                  onChange={(e) => onAssign(todo.id, e.target.value || null)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex-1 text-sm sm:text-xs px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] touch-manipulation"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <motion.button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(todo.id);
                  }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-3 sm:p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors touch-manipulation flex items-center justify-center"
                  aria-label="Delete task"
                >
                  <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface DroppableColumnProps {
  id: TodoStatus;
  children: React.ReactNode;
  color: string;
  isActive: boolean;
  isCurrentOver: boolean;
}

function DroppableColumn({ id, children, color, isActive, isCurrentOver }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const showHighlight = isOver || isCurrentOver;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 p-2 sm:p-3 min-h-[180px] sm:min-h-[250px] space-y-2 sm:space-y-3 transition-all rounded-lg ${
        showHighlight
          ? 'bg-slate-100 dark:bg-slate-800'
          : isActive
            ? 'bg-slate-50 dark:bg-slate-800/50'
            : 'bg-slate-50/50 dark:bg-slate-800/30'
      }`}
      style={{
        borderLeft: showHighlight ? `4px solid ${color}` : isActive ? `4px solid ${color}40` : '4px solid transparent',
        borderRight: showHighlight ? `4px solid ${color}` : isActive ? `4px solid ${color}40` : '4px solid transparent',
        boxShadow: showHighlight ? `inset 0 0 0 2px ${color}` : 'none',
      }}
    >
      {children}
    </div>
  );
}

function KanbanCard({ todo }: { todo: Todo }) {
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const overdue = todo.due_date && !todo.completed && isOverdue(todo.due_date);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-[#0033A0] overflow-hidden ring-4 ring-[#0033A0]/20">
      <div className="h-1.5" style={{ backgroundColor: priorityConfig.color }} />
      <div className="p-3">
        <p className="text-sm font-medium text-slate-800 dark:text-white">{todo.text}</p>
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
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
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

// Task Detail Modal Component
interface TaskDetailModalProps {
  todo: Todo;
  users: string[];
  darkMode?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange: (id: string, status: TodoStatus) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
}

function TaskDetailModal({
  todo,
  users,
  darkMode,
  onClose,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onStatusChange,
  onUpdateNotes,
  onUpdateText,
  onUpdateSubtasks,
}: TaskDetailModalProps) {
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState(todo.text);
  const [notes, setNotes] = useState(todo.notes || '');
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const subtasks = todo.subtasks || [];

  const handleSaveText = () => {
    if (onUpdateText && text.trim() !== todo.text) {
      onUpdateText(todo.id, text.trim());
    }
    setEditingText(false);
  };

  const handleSaveNotes = () => {
    if (onUpdateNotes && notes !== (todo.notes || '')) {
      onUpdateNotes(todo.id, notes);
    }
  };

  const handleToggleSubtask = (index: number) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map((s, i) =>
      i === index ? { ...s, completed: !s.completed } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const handleAddSubtask = () => {
    if (!onUpdateSubtasks || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `subtask-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false,
      priority: 'medium',
    };
    onUpdateSubtasks(todo.id, [...subtasks, newSubtask]);
    setNewSubtaskText('');
  };

  const handleDeleteSubtask = (index: number) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.filter((_, i) => i !== index);
    onUpdateSubtasks(todo.id, updated);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl ${
          darkMode ? 'bg-slate-800' : 'bg-white'
        }`}
      >
        {/* Priority bar */}
        <div className="h-2" style={{ backgroundColor: priorityConfig.color }} />

        {/* Header */}
        <div className={`flex items-start justify-between p-4 border-b ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex-1 min-w-0 pr-4">
            {editingText ? (
              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-base font-medium resize-none ${
                    darkMode
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-slate-200 text-slate-800'
                  } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  rows={2}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveText}
                    className="px-3 py-1.5 bg-[#0033A0] text-white text-sm rounded-lg hover:bg-[#002878] transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setText(todo.text);
                      setEditingText(false);
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => onUpdateText && setEditingText(true)}
                className={`text-lg font-semibold cursor-pointer hover:opacity-80 ${
                  darkMode ? 'text-white' : 'text-slate-800'
                } ${todo.completed ? 'line-through opacity-60' : ''}`}
              >
                {todo.text}
                {onUpdateText && (
                  <Edit3 className="inline-block w-4 h-4 ml-2 opacity-40" />
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Status, Priority, Due Date, Assignee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Status
              </label>
              <select
                value={todo.status || 'todo'}
                onChange={(e) => onStatusChange(todo.id, e.target.value as TodoStatus)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                {columns.map((col) => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Due Date
              </label>
              <input
                type="date"
                value={todo.due_date ? todo.due_date.split('T')[0] : ''}
                onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              />
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Assigned To
              </label>
              <select
                value={todo.assigned_to || ''}
                onChange={(e) => onAssign(todo.id, e.target.value || null)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-200 text-slate-800'
                } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <FileText className="inline-block w-3.5 h-3.5 mr-1" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add notes or context..."
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border text-sm resize-none ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
            />
          </div>

          {/* Subtasks */}
          {onUpdateSubtasks && (
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                <CheckSquare className="inline-block w-3.5 h-3.5 mr-1" />
                Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
              </label>

              <div className="space-y-1.5">
                {subtasks.map((subtask, index) => (
                  <div
                    key={subtask.id || index}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      darkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleSubtask(index)}
                      className={`flex-shrink-0 ${
                        subtask.completed
                          ? 'text-green-500'
                          : darkMode ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      {subtask.completed ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${
                      subtask.completed
                        ? 'line-through opacity-60'
                        : darkMode ? 'text-white' : 'text-slate-800'
                    }`}>
                      {subtask.text}
                    </span>
                    <button
                      onClick={() => handleDeleteSubtask(index)}
                      className={`p-1 rounded transition-colors ${
                        darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-400'
                      } hover:text-red-500`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add subtask */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      darkMode
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500'
                        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
                    } focus:outline-none focus:ring-2 focus:ring-[#0033A0]/30`}
                  />
                  <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskText.trim()}
                    className="px-3 py-2 bg-[#0033A0] text-white rounded-lg hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Meta info */}
          <div className={`pt-3 border-t text-xs ${
            darkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'
          }`}>
            Created by {todo.created_by} • {new Date(todo.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between p-4 border-t ${
          darkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <button
            onClick={() => {
              onDelete(todo.id);
              onClose();
            }}
            className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete Task
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#0033A0] text-white rounded-lg hover:bg-[#002878] transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function KanbanBoard({
  todos,
  users,
  darkMode = true,
  onStatusChange,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onUpdateNotes,
  onUpdateText,
  onUpdateSubtasks,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Custom collision detection that prioritizes columns over cards
  const collisionDetection: CollisionDetection = (args) => {
    // Get all collisions using pointer within
    const pointerCollisions = pointerWithin(args);

    // Also get rect intersections as fallback
    const rectCollisions = rectIntersection(args);

    // Combine and prioritize column droppables
    const allCollisions = [...pointerCollisions, ...rectCollisions];
    const columnIds = columns.map(c => c.id);

    // First try to find a column collision
    const columnCollision = allCollisions.find(
      collision => columnIds.includes(collision.id as TodoStatus)
    );

    if (columnCollision) {
      return [columnCollision];
    }

    // If no column found, return all collisions (for card-to-card)
    return allCollisions.length > 0 ? allCollisions : [];
  };

  const getTodosByStatus = (status: TodoStatus) => {
    return todos.filter((todo) => (todo.status || 'todo') === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    console.log('Drag ended:', { activeId: active.id, overId: over?.id });

    if (!over) {
      console.log('No drop target');
      return;
    }

    const todoId = active.id as string;
    const targetId = over.id as string;
    const draggedTodo = todos.find((t) => t.id === todoId);
    const previousStatus = draggedTodo?.status || 'todo';

    console.log('Dragged todo:', { todoId, targetId, previousStatus, draggedTodo });

    // Check if dropped on a column
    const column = columns.find((c) => c.id === targetId);
    if (column) {
      console.log('Dropped on column:', column.id, 'Previous status:', previousStatus);
      // Only change if different column
      if (previousStatus !== column.id) {
        console.log('Calling onStatusChange:', todoId, column.id);
        // Celebrate if moving to done column
        if (column.id === 'done') {
          setCelebrating(true);
        }
        onStatusChange(todoId, column.id);
      } else {
        console.log('Same column, no change needed');
      }
      return;
    }

    // Check if dropped on another card
    const overTodo = todos.find((t) => t.id === targetId);
    if (overTodo) {
      const targetStatus = overTodo.status || 'todo';
      console.log('Dropped on card:', { targetId, targetStatus });
      // Only change if different column
      if (previousStatus !== targetStatus) {
        console.log('Calling onStatusChange:', todoId, targetStatus);
        // Celebrate if moving to done column
        if (targetStatus === 'done') {
          setCelebrating(true);
        }
        onStatusChange(todoId, targetStatus);
      }
    } else {
      console.log('No matching column or card found for targetId:', targetId);
    }
  };

  const activeTodo = activeId ? todos.find((t) => t.id === activeId) : null;

  return (
    <div className="relative">
      <Celebration trigger={celebrating} onComplete={() => setCelebrating(false)} />
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {columns.map((column) => {
          const columnTodos = getTodosByStatus(column.id);

          return (
            <motion.div
              key={column.id}
              layout
              className="flex flex-col bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border-2 border-slate-100 dark:border-slate-700 overflow-hidden"
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b-2"
                style={{ backgroundColor: column.bgColor, borderColor: column.color + '30' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg">{column.icon}</span>
                  <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-100">
                    {column.title}
                  </h3>
                </div>
                <span
                  className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-bold"
                  style={{ backgroundColor: column.color, color: 'white' }}
                >
                  {columnTodos.length}
                </span>
              </div>

              {/* Column body */}
              <SortableContext
                items={columnTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <DroppableColumn id={column.id} color={column.color} isActive={!!activeId} isCurrentOver={overId === column.id}>
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
                        onCardClick={setSelectedTodo}
                      />
                    ))}
                  </AnimatePresence>

                  {columnTodos.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-8 sm:py-12 text-slate-400 dark:text-slate-500"
                    >
                      <div
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-3"
                        style={{ backgroundColor: column.bgColor }}
                      >
                        <span className="text-xl sm:text-2xl">{column.icon}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium">Drop tasks here</p>
                    </motion.div>
                  )}
                </DroppableColumn>
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

      {/* Task Detail Modal */}
      <AnimatePresence>
        {selectedTodo && (
          <TaskDetailModal
            todo={selectedTodo}
            users={users}
            darkMode={darkMode}
            onClose={() => setSelectedTodo(null)}
            onDelete={onDelete}
            onAssign={onAssign}
            onSetDueDate={onSetDueDate}
            onSetPriority={onSetPriority}
            onStatusChange={onStatusChange}
            onUpdateNotes={onUpdateNotes}
            onUpdateText={onUpdateText}
            onUpdateSubtasks={onUpdateSubtasks}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
