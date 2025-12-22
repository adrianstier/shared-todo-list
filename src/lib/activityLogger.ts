import { ActivityAction } from '@/types/todo';

interface LogActivityParams {
  action: ActivityAction;
  userName: string;
  todoId?: string;
  todoText?: string;
  details?: Record<string, unknown>;
}

export async function logActivity({ action, userName, todoId, todoText, details }: LogActivityParams): Promise<void> {
  try {
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        user_name: userName,
        todo_id: todoId,
        todo_text: todoText,
        details: details || {},
      }),
    });
  } catch (error) {
    // Silently fail - activity logging shouldn't break the app
    console.error('Failed to log activity:', error);
  }
}
