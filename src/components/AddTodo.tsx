'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, FileAudio, X, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import VoicemailImporter from './VoicemailImporter';
import { TodoPriority, Subtask } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[]) => void;
  users: string[];
}

interface EnhancedTask {
  text: string;
  priority: TodoPriority;
  dueDate: string;
  assignedTo: string;
  wasEnhanced: boolean;
}

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
  wasComplex: boolean;
}

// SpeechRecognition types for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export default function AddTodo({ onAdd, users }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [enhancedTask, setEnhancedTask] = useState<EnhancedTask | null>(null);

  // Smart parse state
  const [isParsing, setIsParsing] = useState(false);
  const [showSmartPreview, setShowSmartPreview] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);
  const [editableSubtasks, setEditableSubtasks] = useState<ParsedSubtask[]>([]);
  const [showSubtaskDetails, setShowSubtaskDetails] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showVoicemailImporter, setShowVoicemailImporter] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      // Set height to scrollHeight, but cap at max
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  // Detect complex input that might benefit from smart parsing
  const isComplexInput = useCallback((inputText: string): boolean => {
    const wordCount = inputText.split(/\s+/).filter(Boolean).length;
    const hasMultipleLines = inputText.includes('\n');
    const hasBulletPoints = /[-•*]\s/.test(inputText);
    const hasNumberedList = /\d+[.)]\s/.test(inputText);
    const hasMultipleSentences = (inputText.match(/[.!?]\s+[A-Z]/g) || []).length >= 2;

    return wordCount > 20 || hasMultipleLines || hasBulletPoints || hasNumberedList || hasMultipleSentences;
  }, []);

  const smartParse = useCallback(async (inputText: string) => {
    setIsParsing(true);
    try {
      const response = await fetch('/api/ai/smart-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, users }),
      });

      if (!response.ok) {
        console.error('Failed to smart parse');
        return null;
      }

      const data = await response.json();
      if (data.success && data.result) {
        return data.result as SmartParseResult;
      }
      return null;
    } catch (error) {
      console.error('Error in smart parse:', error);
      return null;
    } finally {
      setIsParsing(false);
    }
  }, [users]);

  const enhanceTask = useCallback(async (taskText: string): Promise<EnhancedTask | null> => {
    try {
      const response = await fetch('/api/ai/enhance-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: taskText, users }),
      });

      if (!response.ok) {
        console.error('Failed to enhance task');
        return null;
      }

      const data = await response.json();
      if (data.success && data.enhanced) {
        return data.enhanced as EnhancedTask;
      }
      return null;
    } catch (error) {
      console.error('Error enhancing task:', error);
      return null;
    }
  }, [users]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (finalTranscript) {
            setText(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsRecording(false);
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Toggle voice recording
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      setShowOptions(true);
    }
  };

  // Handle adding multiple tasks from voicemail importer
  const handleAddMultipleTasks = (tasks: Array<{ text: string; priority: TodoPriority; dueDate?: string; assignedTo?: string }>) => {
    tasks.forEach(task => {
      onAdd(task.text, task.priority, task.dueDate, task.assignedTo);
    });
  };

  // Quick add without AI
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
    resetForm();
  };

  // AI enhance then add (for simple tasks)
  const handleAiEnhance = async () => {
    if (!text.trim()) return;

    // Check if input is complex - use smart parse instead
    if (isComplexInput(text.trim())) {
      handleSmartParse();
      return;
    }

    setIsEnhancing(true);
    const enhanced = await enhanceTask(text.trim());
    setIsEnhancing(false);

    if (enhanced) {
      setEnhancedTask(enhanced);
      setText(enhanced.text);
      setPriority(enhanced.priority);
      if (enhanced.dueDate) setDueDate(enhanced.dueDate);
      if (enhanced.assignedTo) setAssignedTo(enhanced.assignedTo);
      setShowEnhanced(true);
      setShowOptions(true);
    }
  };

  // Smart parse for complex input
  const handleSmartParse = async () => {
    if (!text.trim()) return;

    setIsParsing(true);
    const result = await smartParse(text.trim());
    setIsParsing(false);

    if (result) {
      setParsedResult(result);
      setText(result.mainTask.text);
      setPriority(result.mainTask.priority);
      if (result.mainTask.dueDate) setDueDate(result.mainTask.dueDate);
      if (result.mainTask.assignedTo) setAssignedTo(result.mainTask.assignedTo);

      // Initialize editable subtasks with 'included' flag
      setEditableSubtasks(result.subtasks.map(st => ({ ...st, included: true })));
      setShowSmartPreview(true);
      setShowOptions(true);
      setShowSubtaskDetails(result.subtasks.length > 0);
    }
  };

  const resetForm = () => {
    setText('');
    setPriority('medium');
    setDueDate('');
    setAssignedTo('');
    setShowOptions(false);
    setShowEnhanced(false);
    setEnhancedTask(null);
    setShowSmartPreview(false);
    setParsedResult(null);
    setEditableSubtasks([]);
    setShowSubtaskDetails(false);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleConfirm = () => {
    if (text.trim()) {
      onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
      resetForm();
    }
  };

  // Confirm smart parsed task with subtasks
  const handleConfirmSmartParse = () => {
    if (!text.trim()) return;

    const includedSubtasks: Subtask[] = editableSubtasks
      .filter(st => st.included)
      .map((st, index) => ({
        id: `new-${Date.now()}-${index}`,
        text: st.text,
        completed: false,
        priority: st.priority,
        estimatedMinutes: st.estimatedMinutes,
      }));

    onAdd(
      text.trim(),
      priority,
      dueDate || undefined,
      assignedTo || undefined,
      includedSubtasks.length > 0 ? includedSubtasks : undefined
    );
    resetForm();
  };

  // Toggle subtask inclusion
  const toggleSubtaskIncluded = (index: number) => {
    setEditableSubtasks(prev =>
      prev.map((st, i) => i === index ? { ...st, included: !st.included } : st)
    );
  };

  // Update subtask text
  const updateSubtaskText = (index: number, newText: string) => {
    setEditableSubtasks(prev =>
      prev.map((st, i) => i === index ? { ...st, text: newText } : st)
    );
  };

  // Handle form submission on Enter (but allow Shift+Enter for newlines)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isEnhancing && !isParsing) {
        // For complex input, trigger smart parse instead of quick add
        if (isComplexInput(text.trim())) {
          handleSmartParse();
        } else {
          onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
          resetForm();
        }
      }
    }
  };

  const includedCount = editableSubtasks.filter(st => st.included).length;
  const totalEstimatedTime = editableSubtasks
    .filter(st => st.included && st.estimatedMinutes)
    .reduce((sum, st) => sum + (st.estimatedMinutes || 0), 0);

  return (
    <form onSubmit={handleQuickAdd} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden shadow-sm">
      <div className="flex items-start gap-3 p-3">
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0 mt-1">
          {isEnhancing || isParsing ? (
            <Loader2 className="w-4 h-4 text-[#D4A853] animate-spin" />
          ) : isRecording ? (
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          ) : (
            <Plus className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (showEnhanced) setShowEnhanced(false);
            if (showSmartPreview) setShowSmartPreview(false);
          }}
          onFocus={() => setShowOptions(true)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening... speak your task" : "What needs to be done? Paste notes, emails, or meeting minutes for AI to organize"}
          className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-base resize-none overflow-y-auto min-h-[24px]"
          style={{ maxHeight: '120px' }}
          disabled={isEnhancing || isParsing}
          rows={1}
        />

        {/* Voice input buttons */}
        <div className="flex items-center gap-1">
          {/* Mic button for live recording */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isEnhancing || isParsing}
            className={`p-2 rounded-lg transition-colors ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isRecording ? "Stop recording" : "Start voice input"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Import voicemails button */}
          <button
            type="button"
            onClick={() => setShowVoicemailImporter(true)}
            disabled={isEnhancing || isParsing || isRecording}
            className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Import voicemails - upload multiple audio files and extract tasks"
          >
            <FileAudio className="w-4 h-4" />
          </button>
        </div>

        {showSmartPreview ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSmartParse}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Add{includedCount > 0 ? ` (${includedCount} subtasks)` : ''}
            </button>
          </div>
        ) : showEnhanced ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] text-white rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* AI Enhance Button */}
            <button
              type="button"
              onClick={handleAiEnhance}
              disabled={!text.trim() || isEnhancing || isParsing}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              title={isComplexInput(text) ? "Smart parse - extract task + subtasks from complex input" : "Use AI to enhance task"}
            >
              {isEnhancing || isParsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isParsing ? 'Parsing...' : isEnhancing ? 'Enhancing...' : 'AI'}</span>
            </button>

            {/* Quick Add Button */}
            <button
              type="submit"
              disabled={!text.trim() || isEnhancing || isParsing}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              title="Add task as-is"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Smart parse preview with subtasks */}
      {showSmartPreview && parsedResult && editableSubtasks.length > 0 && (
        <div className="mx-3 mb-2">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
            {/* Header */}
            <div className="px-3 py-2 bg-purple-100/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">
                  AI organized your input into {editableSubtasks.length} subtasks
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSubtaskDetails(!showSubtaskDetails)}
                className="p-1 hover:bg-purple-200/50 rounded transition-colors"
              >
                {showSubtaskDetails ? (
                  <ChevronUp className="w-4 h-4 text-purple-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-purple-600" />
                )}
              </button>
            </div>

            {/* Summary */}
            {parsedResult.summary && (
              <div className="px-3 py-2 border-b border-purple-100">
                <p className="text-xs text-purple-700">{parsedResult.summary}</p>
              </div>
            )}

            {/* Subtask list */}
            {showSubtaskDetails && (
              <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
                {editableSubtasks.map((subtask, index) => (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                      subtask.included ? 'bg-white' : 'bg-slate-100 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtaskIncluded(index)}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        subtask.included
                          ? 'bg-purple-500 border-purple-500 text-white'
                          : 'border-slate-300 hover:border-purple-400'
                      }`}
                    >
                      {subtask.included && <Check className="w-3 h-3" />}
                    </button>
                    <input
                      type="text"
                      value={subtask.text}
                      onChange={(e) => updateSubtaskText(index, e.target.value)}
                      className={`flex-1 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-300 rounded px-1 ${
                        subtask.included ? 'text-slate-700' : 'text-slate-400 line-through'
                      }`}
                      disabled={!subtask.included}
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

            {/* Footer stats */}
            <div className="px-3 py-2 bg-purple-50 border-t border-purple-100 flex items-center justify-between text-xs text-purple-600">
              <span>{includedCount} of {editableSubtasks.length} subtasks selected</span>
              {totalEstimatedTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Est. {totalEstimatedTime < 60 ? `${totalEstimatedTime}m` : `${Math.round(totalEstimatedTime / 60 * 10) / 10}h`}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced task indicator (simple enhancement) */}
      {showEnhanced && enhancedTask?.wasEnhanced && !showSmartPreview && (
        <div className="mx-3 mb-2 px-3 py-2 bg-purple-100 rounded-lg text-sm text-purple-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>AI enhanced your task. Review above and adjust options below, then confirm.</span>
        </div>
      )}

      {/* Complex input hint */}
      {!showSmartPreview && !showEnhanced && text.trim() && isComplexInput(text.trim()) && (
        <div className="mx-3 mb-2 px-3 py-2 bg-indigo-50 rounded-lg text-sm text-indigo-600 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>Complex input detected. Click AI to parse into task + subtasks.</span>
        </div>
      )}

      {/* Options row */}
      {showOptions && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          {/* Priority */}
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-slate-400" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
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
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
            />
          </div>

          {/* Assign to */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Voicemail Importer Modal */}
      {showVoicemailImporter && (
        <VoicemailImporter
          onClose={() => setShowVoicemailImporter(false)}
          onAddTasks={handleAddMultipleTasks}
          users={users}
        />
      )}
    </form>
  );
}
