'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';

interface CelebrationEffectProps {
  show: boolean;
  onComplete: () => void;
  taskText?: string;
}

export default function CelebrationEffect({ show, onComplete, taskText }: CelebrationEffectProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onComplete, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 p-6 text-center animate-[fadeIn_0.2s_ease-out]">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <p className="text-neutral-900 dark:text-neutral-100 font-medium">Done!</p>
        {taskText && (
          <p className="text-sm text-neutral-500 mt-1 max-w-xs truncate">{taskText}</p>
        )}
      </div>
    </div>
  );
}
