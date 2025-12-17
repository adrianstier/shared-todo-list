'use client';

import { useState } from 'react';
import { Check, Trash2, Calendar, User, Flag, Copy, MessageSquare, ChevronDown, ChevronUp, Repeat, ListTree, Plus, Mail, Pencil } from 'lucide-react';
import { Todo, TodoPriority, PRIORITY_CONFIG, RecurrencePattern, Subtask } from '@/types/todo';
import Celebration from './Celebration';
import ContentToSubtasksImporter from './ContentToSubtasksImporter';

// Subtask item component with inline editing
interface SubtaskItemProps {
  subtask: Subtask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
}

function SubtaskItem({ subtask, onToggle, onDelete, onUpdate }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(subtask.text);

  const handleSave = () => {
    if (editText.trim() && editText.trim() !== subtask.text) {
      onUpdate(subtask.id, editText.trim());
    } else {
      setEditText(subtask.text);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(subtask.text);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg transition-colors ${
        subtask.completed ? 'bg-slate-50 opacity-60' : 'bg-white'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(subtask.id)}
        className={`w-6 h-6 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all touch-manipulation ${
          subtask.completed
            ? 'bg-indigo-500 border-indigo-500'
            : 'border-slate-300 hover:border-indigo-400 active:border-indigo-500'
        }`}
      >
        {subtask.completed && <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Text or edit input */}
      {isEditing ? (
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex-1 text-sm px-2 py-1 rounded border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      ) : (
        <span
          onClick={() => !subtask.completed && setIsEditing(true)}
          className={`flex-1 text-sm leading-snug cursor-pointer ${
            subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700 hover:text-indigo-600'
          }`}
          title={subtask.completed ? undefined : 'Click to edit'}
        >
          {subtask.text}
        </span>
      )}

      {/* Estimated time */}
      {subtask.estimatedMinutes && !isEditing && (
        <span className="text-xs text-slate-400 whitespace-nowrap">{subtask.estimatedMinutes}m</span>
      )}

      {/* Edit button */}
      {!isEditing && !subtask.completed && (
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 -m-1 text-slate-300 hover:text-indigo-500 active:text-indigo-600 rounded transition-colors touch-manipulation opacity-0 group-hover:opacity-100 sm:opacity-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Delete button */}
      <button
        onClick={() => onDelete(subtask.id)}
        className="p-1.5 -m-1 text-slate-300 hover:text-red-500 active:text-red-600 rounded transition-colors touch-manipulation"
      >
        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>
    </div>
  );
}

interface TodoItemProps {
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

const getDueDateStatus = (date: string, completed: boolean): 'overdue' | 'today' | 'upcoming' | 'future' => {
  if (completed) return 'future';
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  d.setHours(0, 0, 0, 0);

  if (d < today) return 'overdue';
  if (d.getTime() === today.getTime()) return 'today';
  if (d <= weekFromNow) return 'upcoming';
  return 'future';
};

const dueDateStyles = {
  overdue: 'bg-red-100 text-red-700 border border-red-200',
  today: 'bg-orange-100 text-orange-700 border border-orange-200',
  upcoming: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  future: 'bg-slate-100 text-slate-600',
};

export default function TodoItem({
  todo,
  users,
  darkMode = true,
  selected,
  onSelect,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onDuplicate,
  onUpdateNotes,
  onSetRecurrence,
  onUpdateSubtasks,
}: TodoItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [notes, setNotes] = useState(todo.notes || '');
  const [showNotes, setShowNotes] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [showContentImporter, setShowContentImporter] = useState(false);
  const priority = todo.priority || 'medium';
  const priorityConfig = PRIORITY_CONFIG[priority];
  const dueDateStatus = todo.due_date ? getDueDateStatus(todo.due_date, todo.completed) : null;

  const handleToggle = () => {
    if (!todo.completed) {
      setCelebrating(true);
    }
    onToggle(todo.id, !todo.completed);
  };

  const handleNotesBlur = () => {
    if (onUpdateNotes && notes !== todo.notes) {
      onUpdateNotes(todo.id, notes);
    }
  };

  // Subtask functions
  const subtasks = todo.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const toggleSubtask = (subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const deleteSubtask = (subtaskId: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.filter(s => s.id !== subtaskId);
    onUpdateSubtasks(todo.id, updated);
  };

  const updateSubtaskText = (subtaskId: string, newText: string) => {
    if (!onUpdateSubtasks) return;
    const updated = subtasks.map(s =>
      s.id === subtaskId ? { ...s, text: newText } : s
    );
    onUpdateSubtasks(todo.id, updated);
  };

  const addManualSubtask = () => {
    if (!onUpdateSubtasks || !newSubtaskText.trim()) return;
    const newSubtask: Subtask = {
      id: `${todo.id}-sub-${Date.now()}`,
      text: newSubtaskText.trim(),
      completed: false,
      priority: 'medium',
    };
    onUpdateSubtasks(todo.id, [...subtasks, newSubtask]);
    setNewSubtaskText('');
  };

  const handleAddImportedSubtasks = (importedSubtasks: Subtask[]) => {
    if (!onUpdateSubtasks) return;
    // Merge imported subtasks with existing ones
    onUpdateSubtasks(todo.id, [...subtasks, ...importedSubtasks]);
    setShowSubtasks(true);
    setShowContentImporter(false);
  };

  return (
    <div
      role="listitem"
      className={`group relative rounded-xl border-2 transition-all ${
        darkMode ? 'bg-slate-800' : 'bg-white'
      } ${
        todo.completed
          ? darkMode ? 'border-slate-700 opacity-60' : 'border-slate-100 opacity-60'
          : dueDateStatus === 'overdue'
            ? darkMode ? 'border-red-500/50 bg-red-900/20' : 'border-red-200 bg-red-50/30'
            : selected
              ? 'border-[#0033A0] bg-[#0033A0]/5'
              : darkMode
                ? 'border-slate-700 hover:border-[#0033A0]/50 hover:shadow-md'
                : 'border-slate-100 hover:border-[#0033A0]/30 hover:shadow-md'
      }`}
    >
      <Celebration trigger={celebrating} onComplete={() => setCelebrating(false)} />
      <div className="flex items-center gap-3 p-4">
        {/* Selection checkbox (for bulk actions) */}
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(todo.id, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-[#0033A0] focus:ring-[#0033A0] cursor-pointer"
          />
        )}

        {/* Completion checkbox */}
        <button
          onClick={handleToggle}
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
              : darkMode ? 'text-white' : 'text-slate-800'
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

            {/* Due date with color coding */}
            {todo.due_date && dueDateStatus && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                todo.completed ? 'bg-slate-100 text-slate-400' : dueDateStyles[dueDateStatus]
              }`}>
                <Calendar className="w-3 h-3" />
                {formatDueDate(todo.due_date)}
                {dueDateStatus === 'overdue' && !todo.completed && ' (overdue)'}
              </span>
            )}

            {/* Recurrence indicator */}
            {todo.recurrence && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-100 text-purple-700">
                <Repeat className="w-3 h-3" />
                {todo.recurrence}
              </span>
            )}

            {/* Notes indicator */}
            {todo.notes && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowNotes(!showNotes); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                <MessageSquare className="w-3 h-3" />
                Note
              </button>
            )}

            {/* Subtasks indicator - larger touch target */}
            {subtasks.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-2 sm:py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-600 hover:bg-indigo-200 active:bg-indigo-300 touch-manipulation"
              >
                <ListTree className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                {completedSubtasks}/{subtasks.length}
                {subtaskProgress === 100 && <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 ml-0.5" />}
              </button>
            )}

            {/* Assigned to */}
            {todo.assigned_to && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-[#D4A853]/10 text-[#D4A853]">
                <User className="w-3 h-3" />
                {todo.assigned_to}
              </span>
            )}

            {/* Created by - only show if different from assigned */}
            {(!todo.assigned_to || todo.created_by !== todo.assigned_to) && (
              <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                by {todo.created_by}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons - always visible on mobile, hover on desktop */}
        <div className="flex items-center gap-1">
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-2 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center ${
              darkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse task details' : 'Expand task details'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Duplicate */}
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(todo)}
              className={`p-2 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center ${
                darkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
              }`}
              aria-label="Duplicate task"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={() => onDelete(todo.id)}
            className={`p-2 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center ${
              darkMode ? 'hover:bg-red-900/50 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
            }`}
            aria-label="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notes display */}
      {showNotes && todo.notes && (
        <div className="mx-4 mb-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          {todo.notes}
        </div>
      )}

      {/* Subtasks display - separate toggle when not expanded */}
      {!expanded && showSubtasks && subtasks.length > 0 && (
        <div className="mx-3 sm:mx-4 mb-3 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
          {/* Progress bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs text-indigo-600 mb-1">
              <span>Progress</span>
              <span>{subtaskProgress}%</span>
            </div>
            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          </div>

          {/* Subtask list */}
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                onToggle={toggleSubtask}
                onDelete={deleteSubtask}
                onUpdate={updateSubtaskText}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded actions */}
      {expanded && !todo.completed && (
        <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* Row 1: Priority, Due date, Assign, Recurrence - grid on mobile for better layout */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {/* Priority selector */}
            <select
              value={priority}
              onChange={(e) => onSetPriority(todo.id, e.target.value as TodoPriority)}
              className="text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {/* Due date */}
            <input
              type="date"
              value={todo.due_date ? todo.due_date.split('T')[0] : ''}
              onChange={(e) => onSetDueDate(todo.id, e.target.value || null)}
              className="text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
            />

            {/* Assign to */}
            <select
              value={todo.assigned_to || ''}
              onChange={(e) => onAssign(todo.id, e.target.value || null)}
              className="text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>

            {/* Recurrence */}
            {onSetRecurrence && (
              <select
                value={todo.recurrence || ''}
                onChange={(e) => onSetRecurrence(todo.id, (e.target.value || null) as RecurrencePattern)}
                className="text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0]"
              >
                <option value="">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            )}
          </div>

          {/* Subtasks section - always visible in expanded view */}
          {onUpdateSubtasks && (
            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100 overflow-hidden">
              {/* Header with AI buttons - stacks on mobile */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <ListTree className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-indigo-700">Subtasks</span>
                  {subtasks.length > 0 && (
                    <span className="text-xs text-indigo-500">({completedSubtasks}/{subtasks.length})</span>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {/* Import button */}
                  <button
                    onClick={() => setShowContentImporter(true)}
                    className="text-xs px-2 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 active:bg-amber-300 text-amber-700 font-medium flex items-center gap-1 transition-colors touch-manipulation"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Import</span>
                  </button>
                </div>
              </div>

              {/* Progress bar - only show if subtasks exist */}
              {subtasks.length > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Subtask list with checkboxes */}
              {subtasks.length > 0 && (
                <div className="space-y-2 mb-3">
                  {subtasks.map((subtask) => (
                    <SubtaskItem
                      key={subtask.id}
                      subtask={subtask}
                      onToggle={toggleSubtask}
                      onDelete={deleteSubtask}
                      onUpdate={updateSubtaskText}
                    />
                  ))}
                </div>
              )}

              {/* Add manual subtask input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManualSubtask()}
                  placeholder="Add a subtask..."
                  className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
                <button
                  onClick={addManualSubtask}
                  disabled={!newSubtaskText.trim()}
                  className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg text-sm font-medium transition-colors touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {onUpdateNotes && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Add notes or context..."
                className="w-full text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] resize-none"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      {/* Content to Subtasks Importer Modal */}
      {showContentImporter && (
        <ContentToSubtasksImporter
          onClose={() => setShowContentImporter(false)}
          onAddSubtasks={handleAddImportedSubtasks}
          parentTaskText={todo.text}
        />
      )}
    </div>
  );
}
