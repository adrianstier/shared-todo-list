'use client';

import { useState } from 'react';
import { X, Sparkles, Check, Clock, Flag, Calendar, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { TodoPriority, Subtask } from '@/types/todo';

interface ParsedSubtask {
  text: string;
  priority: TodoPriority;
  estimatedMinutes?: number;
  included: boolean;
}

interface SmartParseResult {
  mainTask: {
    text: string;
    priority: TodoPriority;
    dueDate: string;
    assignedTo: string;
  };
  subtasks: ParsedSubtask[];
  summary: string;
}

interface SmartParseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    text: string,
    priority: TodoPriority,
    dueDate?: string,
    assignedTo?: string,
    subtasks?: Subtask[]
  ) => void;
  parsedResult: SmartParseResult;
  users: string[];
  isLoading?: boolean;
}

export default function SmartParseModal({
  isOpen,
  onClose,
  onConfirm,
  parsedResult,
  users,
  isLoading = false,
}: SmartParseModalProps) {
  const [mainTaskText, setMainTaskText] = useState(parsedResult.mainTask.text);
  const [priority, setPriority] = useState<TodoPriority>(parsedResult.mainTask.priority);
  const [dueDate, setDueDate] = useState(parsedResult.mainTask.dueDate);
  const [assignedTo, setAssignedTo] = useState(parsedResult.mainTask.assignedTo);
  const [subtasks, setSubtasks] = useState<ParsedSubtask[]>(
    parsedResult.subtasks.map(st => ({ ...st, included: true }))
  );
  const [showSubtasks, setShowSubtasks] = useState(true);

  if (!isOpen) return null;

  const toggleSubtask = (index: number) => {
    setSubtasks(prev =>
      prev.map((st, i) => (i === index ? { ...st, included: !st.included } : st))
    );
  };

  const updateSubtaskText = (index: number, text: string) => {
    setSubtasks(prev =>
      prev.map((st, i) => (i === index ? { ...st, text } : st))
    );
  };

  const handleConfirm = () => {
    const includedSubtasks: Subtask[] = subtasks
      .filter(st => st.included && st.text.trim())
      .map((st, index) => ({
        id: `new-${Date.now()}-${index}`,
        text: st.text.trim(),
        completed: false,
        priority: st.priority,
        estimatedMinutes: st.estimatedMinutes,
      }));

    onConfirm(
      mainTaskText.trim(),
      priority,
      dueDate || undefined,
      assignedTo || undefined,
      includedSubtasks.length > 0 ? includedSubtasks : undefined
    );
  };

  const includedCount = subtasks.filter(st => st.included).length;
  const totalTime = subtasks
    .filter(st => st.included && st.estimatedMinutes)
    .reduce((sum, st) => sum + (st.estimatedMinutes || 0), 0);

  const priorityColors: Record<TodoPriority, string> = {
    low: 'bg-slate-100 text-slate-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-orange-100 text-orange-600',
    urgent: 'bg-red-100 text-red-600',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-1.5rem)] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-purple-500 to-indigo-500">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-semibold text-base sm:text-lg">AI Task Organizer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 sm:p-1.5 rounded-lg hover:bg-white/20 active:bg-white/30 text-white transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Analyzing your input...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
              {/* Summary */}
              {parsedResult.summary && (
                <div className="bg-purple-50 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm text-purple-700">
                  {parsedResult.summary}
                </div>
              )}

              {/* Main Task */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">Main Task</label>
                <input
                  type="text"
                  value={mainTaskText}
                  onChange={(e) => setMainTaskText(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-slate-800 text-base min-h-[48px] touch-manipulation"
                  placeholder="Task description"
                />

                {/* Task options */}
                <div className="flex flex-wrap gap-2">
                  {/* Priority */}
                  <div className="flex items-center gap-1.5">
                    <Flag className="w-4 h-4 text-slate-400" />
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as TodoPriority)}
                      className={`text-base sm:text-sm px-3 py-2 sm:py-1 rounded-lg border-0 font-medium min-h-[44px] sm:min-h-0 touch-manipulation ${priorityColors[priority]}`}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Due date */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="text-base sm:text-sm px-3 py-2 sm:py-1 rounded-lg border border-slate-200 bg-white text-slate-700 min-h-[44px] sm:min-h-0 touch-manipulation"
                    />
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="text-base sm:text-sm px-3 py-2 sm:py-1 rounded-lg border border-slate-200 bg-white text-slate-700 min-h-[44px] sm:min-h-0 touch-manipulation"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user} value={user}>{user}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Subtasks */}
              {subtasks.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowSubtasks(!showSubtasks)}
                    className="flex items-center justify-between w-full text-sm font-medium text-slate-700 min-h-[44px] touch-manipulation"
                  >
                    <span>Subtasks ({includedCount} of {subtasks.length} selected)</span>
                    {showSubtasks ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {showSubtasks && (
                    <div className="space-y-2 bg-slate-50 rounded-lg p-2 sm:p-3">
                      {subtasks.map((subtask, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg transition-all ${
                            subtask.included
                              ? 'bg-white shadow-sm'
                              : 'bg-transparent opacity-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSubtask(index)}
                            className={`w-6 h-6 sm:w-5 sm:h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors touch-manipulation ${
                              subtask.included
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-slate-300 hover:border-purple-400'
                            }`}
                          >
                            {subtask.included && <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3" />}
                          </button>

                          <input
                            type="text"
                            value={subtask.text}
                            onChange={(e) => updateSubtaskText(index, e.target.value)}
                            disabled={!subtask.included}
                            className={`flex-1 text-base sm:text-sm bg-transparent focus:outline-none min-h-[36px] touch-manipulation ${
                              subtask.included ? 'text-slate-700' : 'text-slate-400 line-through'
                            }`}
                          />

                          {subtask.estimatedMinutes && subtask.included && (
                            <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                              <Clock className="w-3 h-3" />
                              {subtask.estimatedMinutes}m
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time estimate */}
                  {totalTime > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Total estimated time:{' '}
                        {totalTime < 60
                          ? `${totalTime} minutes`
                          : `${Math.round(totalTime / 60 * 10) / 10} hours`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 bg-slate-50">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 sm:py-2 text-slate-600 hover:text-slate-800 active:text-slate-900 font-medium transition-colors min-h-[44px] touch-manipulation order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!mainTaskText.trim()}
                className="px-5 py-2.5 sm:py-2 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 disabled:bg-slate-300 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px] touch-manipulation order-1 sm:order-2"
              >
                <Check className="w-4 h-4" />
                Add Task{includedCount > 0 ? ` + ${includedCount} Subtasks` : ''}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
