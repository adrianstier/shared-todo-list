import { TodoPriority } from '@/types/todo';

const PREFERENCES_KEY = 'todo_user_preferences';

export interface UserTaskPreferences {
  lastPriority?: TodoPriority;
  lastAssignedTo?: string;
  lastUsedAt?: string;
}

interface AllUserPreferences {
  [userId: string]: UserTaskPreferences;
}

function getAllPreferences(): AllUserPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveAllPreferences(prefs: AllUserPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

export function getUserPreferences(userId: string): UserTaskPreferences {
  const all = getAllPreferences();
  return all[userId] || {};
}

export function saveUserPreferences(
  userId: string,
  preferences: Partial<UserTaskPreferences>
): void {
  const all = getAllPreferences();
  all[userId] = {
    ...all[userId],
    ...preferences,
    lastUsedAt: new Date().toISOString(),
  };
  saveAllPreferences(all);
}

export function updateLastTaskDefaults(
  userId: string,
  priority: TodoPriority,
  assignedTo?: string
): void {
  saveUserPreferences(userId, {
    lastPriority: priority,
    lastAssignedTo: assignedTo || undefined,
  });
}
