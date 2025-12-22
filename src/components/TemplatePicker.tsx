'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, Share2, Lock, X, ChevronDown, Loader2 } from 'lucide-react';
import { TaskTemplate, TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';

interface TemplatePickerProps {
  currentUserName: string;
  users: string[];
  darkMode?: boolean;
  onSelectTemplate: (
    text: string,
    priority: TodoPriority,
    assignedTo?: string,
    subtasks?: Subtask[]
  ) => void;
}

export default function TemplatePicker({
  currentUserName,
  users,
  darkMode = true,
  onSelectTemplate,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newIsShared, setNewIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!currentUserName) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/templates?userName=${encodeURIComponent(currentUserName)}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const handleSelectTemplate = (template: TaskTemplate) => {
    // Convert template subtasks to task subtasks with IDs
    const subtasks: Subtask[] = template.subtasks.map((st) => ({
      id: uuidv4(),
      text: st.text,
      completed: false,
      priority: st.priority,
      estimatedMinutes: st.estimatedMinutes,
    }));

    onSelectTemplate(
      template.description || template.name,
      template.default_priority,
      template.default_assigned_to,
      subtasks.length > 0 ? subtasks : undefined
    );

    // Log template usage
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'template_used',
        user_name: currentUserName,
        details: { template_name: template.name, template_id: template.id },
      }),
    });

    setIsOpen(false);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          default_priority: newPriority,
          default_assigned_to: newAssignedTo || null,
          subtasks: [],
          created_by: currentUserName,
          is_shared: newIsShared,
        }),
      });

      if (response.ok) {
        setNewName('');
        setNewDescription('');
        setNewPriority('medium');
        setNewAssignedTo('');
        setNewIsShared(false);
        setShowCreateForm(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await fetch(`/api/templates?id=${template.id}&userName=${encodeURIComponent(currentUserName)}`, {
        method: 'DELETE',
      });
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const myTemplates = templates.filter((t) => t.created_by === currentUserName);
  const sharedTemplates = templates.filter((t) => t.is_shared && t.created_by !== currentUserName);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          darkMode
            ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <FileText className="w-4 h-4" />
        <span>Templates</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className={`absolute left-0 top-full mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                darkMode ? 'border-slate-700' : 'border-slate-200'
              }`}
            >
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Task Templates
              </h3>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateTemplate}
                className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Template name"
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${
                    darkMode
                      ? 'bg-slate-700 text-white placeholder-slate-400 border-slate-600'
                      : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200'
                  } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20`}
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Default task description (optional)"
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 resize-none ${
                    darkMode
                      ? 'bg-slate-700 text-white placeholder-slate-400 border-slate-600'
                      : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200'
                  } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20`}
                />
                <div className="flex gap-2 mb-2">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    } border focus:outline-none`}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    } border focus:outline-none`}
                  >
                    <option value="">No assignee</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label
                    className={`flex items-center gap-2 text-sm cursor-pointer ${
                      darkMode ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newIsShared}
                      onChange={(e) => setNewIsShared(e.target.checked)}
                      className="rounded"
                    />
                    Share with team
                  </label>
                  <button
                    type="submit"
                    disabled={!newName.trim() || isSaving}
                    className="px-4 py-2 rounded-lg bg-[#0033A0] text-white text-sm font-medium hover:bg-[#002878] disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                  </button>
                </div>
              </form>
            )}

            {/* Template List */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2
                    className={`w-6 h-6 animate-spin mx-auto ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  />
                </div>
              ) : templates.length === 0 ? (
                <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No templates yet</p>
                  <p className="text-xs mt-1">Create one to get started!</p>
                </div>
              ) : (
                <>
                  {/* My Templates */}
                  {myTemplates.length > 0 && (
                    <div>
                      <div
                        className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                          darkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                        }`}
                      >
                        My Templates
                      </div>
                      {myTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          darkMode={darkMode}
                          isOwner={true}
                          onSelect={() => handleSelectTemplate(template)}
                          onDelete={(e) => handleDeleteTemplate(template, e)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Shared Templates */}
                  {sharedTemplates.length > 0 && (
                    <div>
                      <div
                        className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                          darkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                        }`}
                      >
                        Shared Templates
                      </div>
                      {sharedTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          darkMode={darkMode}
                          isOwner={false}
                          onSelect={() => handleSelectTemplate(template)}
                          onDelete={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Template item component
function TemplateItem({
  template,
  darkMode,
  isOwner,
  onSelect,
  onDelete,
}: {
  template: TaskTemplate;
  darkMode: boolean;
  isOwner: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[template.default_priority];

  return (
    <button
      onClick={onSelect}
      className={`w-full px-4 py-3 text-left transition-colors flex items-start gap-3 group ${
        darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: priorityConfig.bgColor }}
      >
        <FileText className="w-4 h-4" style={{ color: priorityConfig.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {template.name}
          </span>
          {template.is_shared ? (
            <Share2 className="w-3 h-3 text-blue-500 flex-shrink-0" />
          ) : (
            <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
        </div>
        {template.description && (
          <p className={`text-xs truncate mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            {priorityConfig.label}
          </span>
          {template.default_assigned_to && (
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              → {template.default_assigned_to}
            </span>
          )}
          {template.subtasks.length > 0 && (
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {template.subtasks.length} subtask{template.subtasks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      {isOwner && (
        <button
          onClick={onDelete}
          className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
            darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </button>
  );
}
