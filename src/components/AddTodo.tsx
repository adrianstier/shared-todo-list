'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2, Mic, MicOff, ChevronDown } from 'lucide-react';
import SmartParseModal from './SmartParseModal';
import VoiceRecordingIndicator from './VoiceRecordingIndicator';
import { TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { getUserPreferences, updateLastTaskDefaults } from '@/lib/userPreferences';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string, subtasks?: Subtask[]) => void;
  users: string[];
  darkMode?: boolean;
  currentUserId?: string;
}

interface SmartParseResult {
  mainTask: {
    text: string;
    priority: TodoPriority;
    dueDate: string;
    assignedTo: string;
  };
  subtasks: Array<{
    text: string;
    priority: TodoPriority;
    estimatedMinutes?: number;
  }>;
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

export default function AddTodo({ onAdd, users, darkMode = true, currentUserId }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  // Load user preferences on mount
  useEffect(() => {
    if (currentUserId) {
      const prefs = getUserPreferences(currentUserId);
      if (prefs.lastPriority) {
        setPriority(prefs.lastPriority);
      }
      if (prefs.lastAssignedTo && users.includes(prefs.lastAssignedTo)) {
        setAssignedTo(prefs.lastAssignedTo);
      }
    }
  }, [currentUserId, users]);

  // AI modal state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedResult, setParsedResult] = useState<SmartParseResult | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Check speech support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [text]);

  // Smart parse API call
  const smartParse = useCallback(async (inputText: string): Promise<SmartParseResult | null> => {
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

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
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

  // Quick add without AI
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
    // Save preferences for next time
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
    }
    resetForm();
  };

  // Check if input might benefit from AI parsing
  const isComplexInput = () => {
    const lines = text.split('\n').filter(l => l.trim());
    const hasBullets = /^[\s]*[-•*\d.)\]]\s/.test(text);
    return text.length > 50 || lines.length > 2 || hasBullets;
  };

  // AI button - opens modal with parsed results
  const handleAiClick = async () => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setShowModal(true);

    const result = await smartParse(text.trim());

    if (result) {
      setParsedResult(result);
    } else {
      // Fallback: create simple result from original text
      setParsedResult({
        mainTask: {
          text: text.trim(),
          priority: 'medium',
          dueDate: '',
          assignedTo: '',
        },
        subtasks: [],
        summary: '',
        wasComplex: false,
      });
    }

    setIsProcessing(false);
  };

  const handleModalConfirm = (
    taskText: string,
    taskPriority: TodoPriority,
    taskDueDate?: string,
    taskAssignedTo?: string,
    subtasks?: Subtask[]
  ) => {
    onAdd(taskText, taskPriority, taskDueDate, taskAssignedTo, subtasks);
    // Save preferences for next time
    if (currentUserId) {
      updateLastTaskDefaults(currentUserId, taskPriority, taskAssignedTo);
    }
    setShowModal(false);
    resetForm();
  };

  const handleModalClose = () => {
    setShowModal(false);
    setParsedResult(null);
    setIsProcessing(false);
  };

  const resetForm = () => {
    setText('');
    setPriority('medium');
    setDueDate('');
    setAssignedTo('');
    setShowOptions(false);
    setParsedResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !isProcessing) {
        onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
        // Save preferences for next time
        if (currentUserId) {
          updateLastTaskDefaults(currentUserId, priority, assignedTo || undefined);
        }
        resetForm();
      }
    }
  };

  const priorityConfig = PRIORITY_CONFIG[priority];

  return (
    <>
      <form
        onSubmit={handleQuickAdd}
        className={`rounded-xl border shadow-sm overflow-hidden ${
          darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
        }`}
      >
        {/* Main input area */}
        <div className="p-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setShowOptions(true)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "Speak your task..." : "Add a task... (paste text for AI help)"}
                rows={1}
                disabled={isProcessing}
                aria-label="New task description"
                className={`w-full px-3 py-2.5 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 border text-sm min-h-[44px] ${
                  darkMode
                    ? 'bg-slate-700 text-white placeholder-slate-400 border-slate-600'
                    : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200'
                } ${isRecording ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                style={{ maxHeight: '120px' }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-1.5 flex-shrink-0">
              {/* Voice input - only show if supported */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : darkMode
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } disabled:opacity-50`}
                  aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                  aria-pressed={isRecording}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              {/* AI button - prominent when complex input detected */}
              {text.trim() && (
                <button
                  type="button"
                  onClick={handleAiClick}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    isComplexInput()
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : darkMode
                        ? 'bg-slate-700 text-purple-400 hover:bg-slate-600'
                        : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                  } disabled:opacity-50`}
                  aria-label="Parse with AI"
                  title={isComplexInput() ? 'Complex input detected - AI can help' : 'Parse with AI'}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Add button */}
              <button
                type="submit"
                disabled={!text.trim() || isProcessing}
                className="px-4 py-2.5 rounded-lg bg-[#0033A0] hover:bg-[#002878] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium transition-colors min-h-[44px] flex items-center gap-2"
                aria-label="Add task"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Voice recording indicator */}
        {isRecording && (
          <div className="px-3 pb-2 flex justify-center">
            <VoiceRecordingIndicator isRecording={isRecording} darkMode={darkMode} />
          </div>
        )}

        {/* Options row - visible when focused or has content */}
        {(showOptions || text) && (
          <div className={`px-3 pb-3 pt-3 border-t flex flex-wrap items-center gap-2 ${
            darkMode ? 'border-slate-700' : 'border-slate-100'
          }`}>
            {/* Priority */}
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TodoPriority)}
                aria-label="Priority"
                className={`appearance-none pl-7 pr-6 py-1.5 rounded-lg text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 min-h-[36px] ${
                  darkMode ? 'bg-slate-700' : ''
                }`}
                style={{
                  backgroundColor: darkMode ? undefined : priorityConfig.bgColor,
                  color: priorityConfig.color,
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <Flag className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: priorityConfig.color }} />
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-50" />
            </div>

            {/* Due date */}
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date"
                className={`pl-7 pr-2 py-1.5 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 min-h-[36px] ${
                  darkMode
                    ? 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                } ${dueDate ? '' : darkMode ? 'text-slate-400' : 'text-slate-400'}`}
              />
              <Calendar className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            </div>

            {/* Assignee */}
            <div className="relative">
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                aria-label="Assign to"
                className={`appearance-none pl-7 pr-6 py-1.5 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 min-h-[36px] ${
                  darkMode
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-700'
                } ${assignedTo ? '' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
              <User className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-50" />
            </div>
          </div>
        )}
      </form>

      {/* Smart Parse Modal */}
      {showModal && parsedResult && (
        <SmartParseModal
          isOpen={showModal}
          onClose={handleModalClose}
          onConfirm={handleModalConfirm}
          parsedResult={{
            ...parsedResult,
            subtasks: parsedResult.subtasks.map(st => ({ ...st, included: true })),
          }}
          users={users}
          isLoading={isProcessing}
        />
      )}

      {/* Loading modal while processing */}
      {showModal && !parsedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Processing">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={`relative rounded-2xl shadow-2xl p-8 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-3" />
              <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>Analyzing your input...</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
