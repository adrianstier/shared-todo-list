import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ParsedSubtask {
  text: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedMinutes?: number;
}

export interface SmartParseResult {
  mainTask: {
    text: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    dueDate: string;
    assignedTo: string;
  };
  subtasks: ParsedSubtask[];
  summary: string;
  wasComplex: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { text, users } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      );
    }

    const userList = Array.isArray(users) && users.length > 0
      ? users.join(', ')
      : 'no team members registered';

    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    // Analyze text complexity to determine if we should extract subtasks
    const wordCount = text.split(/\s+/).length;
    const hasMultipleLines = text.includes('\n');
    const hasBulletPoints = /[-•*]\s/.test(text);
    const hasNumberedList = /\d+[.)]\s/.test(text);
    const isComplex = wordCount > 15 || hasMultipleLines || hasBulletPoints || hasNumberedList;

    const prompt = `You are a smart task parser for a small business team. Analyze the user's input and extract a clean, actionable task with optional subtasks.

User's input:
"""
${text}
"""

Today's date: ${today} (${dayOfWeek})
Team members: ${userList}

Analyze the input and respond ONLY with valid JSON (no markdown, no code blocks):
{
  "mainTask": {
    "text": "A clear, concise task title (under 100 chars). Start with an action verb. This is the main objective.",
    "priority": "low, medium, high, or urgent - based on urgency cues",
    "dueDate": "YYYY-MM-DD if mentioned, otherwise empty string",
    "assignedTo": "Team member name if explicitly mentioned, otherwise empty string"
  },
  "subtasks": [
    {
      "text": "Specific actionable step (under 80 chars)",
      "priority": "inherit from main or adjust based on importance",
      "estimatedMinutes": estimated time in minutes (5-480)
    }
  ],
  "summary": "1-sentence summary of what this task accomplishes",
  "wasComplex": true/false - whether the input contained multiple action items or details worth breaking down
}

Rules for main task:
- Extract the PRIMARY objective from the text
- Fix typos and grammar
- Start with a verb (Review, Send, Call, Complete, Prepare, etc.)
- Parse relative dates: "tomorrow", "next week", "by Friday", "end of month"
- Detect urgency: "ASAP", "urgent", "immediately" = urgent priority
- Only assign if a team member name is explicitly mentioned

Rules for subtasks:
- Extract 2-6 subtasks ONLY if the input is complex (multiple steps, bullet points, detailed instructions)
- For simple inputs (single sentence, clear single task), return empty subtasks array
- Each subtask should be independently actionable
- Start each with an action verb
- Order logically (dependencies first)
- Don't create artificial subtasks for simple tasks

Examples:

Simple input: "call john tmrw about the proposal"
{
  "mainTask": { "text": "Call John about the proposal", "priority": "medium", "dueDate": "2024-01-16", "assignedTo": "" },
  "subtasks": [],
  "summary": "Phone call scheduled with John to discuss proposal",
  "wasComplex": false
}

Complex input: "Meeting notes: need to 1) update the budget spreadsheet with Q4 numbers 2) send the revised proposal to client by Friday 3) schedule follow-up call with marketing team"
{
  "mainTask": { "text": "Complete meeting action items", "priority": "high", "dueDate": "2024-01-19", "assignedTo": "" },
  "subtasks": [
    { "text": "Update budget spreadsheet with Q4 numbers", "priority": "high", "estimatedMinutes": 30 },
    { "text": "Send revised proposal to client", "priority": "high", "estimatedMinutes": 20 },
    { "text": "Schedule follow-up call with marketing team", "priority": "medium", "estimatedMinutes": 10 }
  ],
  "summary": "Complete all action items from the meeting before Friday deadline",
  "wasComplex": true
}

Complex input: "Email from client: Hi, thanks for the presentation yesterday. Can you please send me the slides, update the pricing to reflect the 10% discount we discussed, and have Sarah prepare the contract? Also need this wrapped up by end of week as their team wants to review Monday."
{
  "mainTask": { "text": "Fulfill client request from presentation follow-up", "priority": "high", "dueDate": "2024-01-19", "assignedTo": "" },
  "subtasks": [
    { "text": "Send presentation slides to client", "priority": "high", "estimatedMinutes": 5 },
    { "text": "Update pricing with 10% discount", "priority": "high", "estimatedMinutes": 15 },
    { "text": "Have Sarah prepare the contract", "priority": "high", "estimatedMinutes": 30 },
    { "text": "Review all materials before sending", "priority": "medium", "estimatedMinutes": 15 }
  ],
  "summary": "Complete all client follow-up items before end of week for Monday review",
  "wasComplex": true
}

Respond with ONLY the JSON object, no other text.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to parse AI response:', responseText);
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate and clean up the response
    const validatedResult: SmartParseResult = {
      mainTask: {
        text: String(result.mainTask?.text || text).slice(0, 200),
        priority: ['low', 'medium', 'high', 'urgent'].includes(result.mainTask?.priority)
          ? result.mainTask.priority
          : 'medium',
        dueDate: result.mainTask?.dueDate || '',
        assignedTo: result.mainTask?.assignedTo || '',
      },
      subtasks: (result.subtasks || [])
        .slice(0, 6)
        .map((subtask: { text?: string; priority?: string; estimatedMinutes?: number }) => ({
          text: String(subtask.text || '').slice(0, 200),
          priority: ['low', 'medium', 'high', 'urgent'].includes(subtask.priority || '')
            ? subtask.priority
            : 'medium',
          estimatedMinutes: typeof subtask.estimatedMinutes === 'number'
            ? Math.min(Math.max(subtask.estimatedMinutes, 5), 480)
            : undefined,
        }))
        .filter((subtask: ParsedSubtask) => subtask.text.length > 0),
      summary: String(result.summary || '').slice(0, 300),
      wasComplex: Boolean(result.wasComplex) || isComplex,
    };

    return NextResponse.json({
      success: true,
      result: validatedResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in smart parse:', errorMessage, error);
    return NextResponse.json(
      { success: false, error: 'Failed to parse content', details: errorMessage },
      { status: 500 }
    );
  }
}
