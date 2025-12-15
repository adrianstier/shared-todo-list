'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, FileAudio } from 'lucide-react';
import VoicemailImporter from './VoicemailImporter';
import { TodoPriority } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string) => void;
  users: string[];
}

interface EnhancedTask {
  text: string;
  priority: TodoPriority;
  dueDate: string;
  assignedTo: string;
  wasEnhanced: boolean;
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

  // AI enhance then add
  const handleAiEnhance = async () => {
    if (!text.trim()) return;

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

  const resetForm = () => {
    setText('');
    setPriority('medium');
    setDueDate('');
    setAssignedTo('');
    setShowOptions(false);
    setShowEnhanced(false);
    setEnhancedTask(null);
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

  // Handle form submission on Enter (but allow Shift+Enter for newlines)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isEnhancing) {
        onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
        resetForm();
      }
    }
  };

  return (
    <form onSubmit={handleQuickAdd} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden shadow-sm">
      <div className="flex items-start gap-3 p-3">
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0 mt-1">
          {isEnhancing ? (
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
          }}
          onFocus={() => setShowOptions(true)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening... speak your task" : "What needs to be done?"}
          className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-base resize-none overflow-y-auto min-h-[24px]"
          style={{ maxHeight: '120px' }}
          disabled={isEnhancing}
          rows={1}
        />

        {/* Voice input buttons */}
        <div className="flex items-center gap-1">
          {/* Mic button for live recording */}
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isEnhancing}
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
            disabled={isEnhancing || isRecording}
            className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Import voicemails - upload multiple audio files and extract tasks"
          >
            <FileAudio className="w-4 h-4" />
          </button>
        </div>

        {showEnhanced ? (
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
              disabled={!text.trim() || isEnhancing}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              title="Use AI to enhance task - add dates, priority, assignee"
            >
              {isEnhancing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isEnhancing ? 'Enhancing...' : 'AI'}</span>
            </button>

            {/* Quick Add Button */}
            <button
              type="submit"
              disabled={!text.trim() || isEnhancing}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              title="Add task as-is"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Enhanced task indicator */}
      {showEnhanced && enhancedTask?.wasEnhanced && (
        <div className="mx-3 mb-2 px-3 py-2 bg-purple-100 rounded-lg text-sm text-purple-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>AI enhanced your task. Review above and adjust options below, then confirm.</span>
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
