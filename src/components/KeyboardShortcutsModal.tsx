'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  show: boolean;
  onClose: () => void;
  darkMode?: boolean;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['N'], description: 'Focus new task input' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Esc'], description: 'Clear search & selection' },
    ],
  },
  {
    title: 'Quick Filters',
    shortcuts: [
      { keys: ['1'], description: 'Show all tasks' },
      { keys: ['2'], description: 'Show my tasks' },
      { keys: ['3'], description: 'Show due today' },
      { keys: ['4'], description: 'Show urgent tasks' },
    ],
  },
  {
    title: 'Task Actions',
    shortcuts: [
      { keys: ['Enter'], description: 'Submit new task' },
      { keys: ['⌘', 'Enter'], description: 'Submit with AI enhancement' },
    ],
  },
];

export default function KeyboardShortcutsModal({
  show,
  onClose,
  darkMode = true,
}: KeyboardShortcutsModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ${
              darkMode ? 'bg-slate-800' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  darkMode ? 'bg-slate-700' : 'bg-slate-100'
                }`}>
                  <Keyboard className={`w-4 h-4 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                </div>
                <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-slate-800'}`}>
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {shortcutGroups.map((group, groupIndex) => (
                <div key={group.title} className={groupIndex > 0 ? 'mt-5' : ''}>
                  <h4 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {group.title}
                  </h4>
                  <div className="space-y-2">
                    {group.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.description}
                        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                          darkMode ? 'bg-slate-700/50' : 'bg-slate-50'
                        }`}
                      >
                        <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {shortcut.description}
                        </span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <span key={keyIndex}>
                              <kbd
                                className={`px-2 py-1 text-xs font-medium rounded ${
                                  darkMode
                                    ? 'bg-slate-600 text-slate-200 border border-slate-500'
                                    : 'bg-white text-slate-700 border border-slate-200 shadow-sm'
                                }`}
                              >
                                {key}
                              </kbd>
                              {keyIndex < shortcut.keys.length - 1 && (
                                <span className={`mx-1 text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>+</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`px-4 py-3 border-t ${
              darkMode ? 'border-slate-700 bg-slate-700/50' : 'border-slate-100 bg-slate-50'
            }`}>
              <p className={`text-xs text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Press <kbd className={`px-1.5 py-0.5 rounded text-xs ${
                  darkMode ? 'bg-slate-600' : 'bg-white border border-slate-200'
                }`}>?</kbd> anywhere to show this help
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
