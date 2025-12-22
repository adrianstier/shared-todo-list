'use client';

import { useState } from 'react';
import { X, FileText, Loader2, Share2, Lock } from 'lucide-react';
import { Todo, TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface SaveTemplateModalProps {
  todo: Todo;
  currentUserName: string;
  darkMode?: boolean;
  onClose: () => void;
  onSave: (name: string, isShared: boolean) => Promise<void>;
}

export default function SaveTemplateModal({
  todo,
  currentUserName,
  darkMode = true,
  onClose,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState(todo.text.slice(0, 50));
  const [isShared, setIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const priorityConfig = PRIORITY_CONFIG[todo.priority || 'medium'];
  const subtasks = todo.subtasks || [];

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a template name');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await onSave(name.trim(), isShared);
      onClose();
    } catch {
      setError('Failed to save template. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Save as Template">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-md rounded-2xl shadow-2xl ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <FileText className={`w-5 h-5 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
            <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Save as Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Template Name */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${
                darkMode
                  ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400'
                  : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
              } focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500`}
              autoFocus
            />
          </div>

          {/* Preview */}
          <div className={`p-3 rounded-lg ${darkMode ? 'bg-slate-700/50' : 'bg-slate-50'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Template Preview
            </p>

            <div className="space-y-2">
              {/* Task text */}
              <p className={`text-sm ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                {todo.text}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
                  style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
                >
                  {priorityConfig.label} priority
                </span>

                {todo.assigned_to && (
                  <span className={`text-xs px-2 py-0.5 rounded-md ${darkMode ? 'bg-slate-600 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                    Assigned to: {todo.assigned_to}
                  </span>
                )}

                {subtasks.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-md ${darkMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-indigo-100 text-indigo-600'}`}>
                    {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Subtasks preview */}
              {subtasks.length > 0 && (
                <div className={`mt-2 pl-3 border-l-2 ${darkMode ? 'border-slate-600' : 'border-slate-200'}`}>
                  {subtasks.slice(0, 3).map((st, i) => (
                    <p key={i} className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      • {st.text}
                    </p>
                  ))}
                  {subtasks.length > 3 && (
                    <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      +{subtasks.length - 3} more...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Share toggle */}
          <div className="flex items-center justify-between">
            <label
              className={`flex items-center gap-2 cursor-pointer ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
            >
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm">Share with team</span>
            </label>
            {isShared ? (
              <Share2 className="w-4 h-4 text-blue-500" />
            ) : (
              <Lock className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Info */}
          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Templates save the task description, priority, default assignee, and subtasks.
            {isShared ? ' Team members will be able to use this template.' : ' Only you will see this template.'}
          </p>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2 p-4 border-t ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode
                ? 'text-slate-300 hover:bg-slate-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Save Template
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
