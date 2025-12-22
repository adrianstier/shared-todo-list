import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET - Fetch all templates (user's own + shared)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName');

    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }

    // Get user's own templates and shared templates
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .or(`created_by.eq.${userName},is_shared.eq.true`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST - Create a new template
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, default_priority, default_assigned_to, subtasks, created_by, is_shared } = body;

    if (!name || !created_by) {
      return NextResponse.json({ error: 'name and created_by are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('task_templates')
      .insert({
        name,
        description: description || null,
        default_priority: default_priority || 'medium',
        default_assigned_to: default_assigned_to || null,
        subtasks: subtasks || [],
        created_by,
        is_shared: is_shared || false,
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from('activity_log').insert({
      action: 'template_created',
      user_name: created_by,
      details: { template_name: name, is_shared },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// DELETE - Delete a template
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userName = searchParams.get('userName');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Only allow deletion by the creator
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('created_by', userName);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
