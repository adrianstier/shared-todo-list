import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ACTIVITY_FEED_USERS } from '@/types/todo';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET - Fetch activity log (restricted to Derrick & Adrian)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName');
    const limit = parseInt(searchParams.get('limit') || '50');
    const todoId = searchParams.get('todoId');

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    // Check if user is authorized to view activity feed
    if (!ACTIVITY_FEED_USERS.includes(userName)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by todo_id if provided (for task-level history)
    if (todoId) {
      query = query.eq('todo_id', todoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}

// POST - Log an activity (called internally when tasks are modified)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, todo_id, todo_text, user_name, details } = body;

    if (!action || !user_name) {
      return NextResponse.json({ error: 'action and user_name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        action,
        todo_id: todo_id || null,
        todo_text: todo_text || null,
        user_name,
        details: details || {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error logging activity:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
