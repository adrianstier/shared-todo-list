import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const usersJson = formData.get('users') as string | null;
    const users = usersJson ? JSON.parse(usersJson) : [];

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { success: false, error: 'File must be a PDF or image' },
        { status: 400 }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const userListText = users.length > 0
      ? `\n\nAvailable team members for assignment: ${users.join(', ')}`
      : '';

    // Build content array based on file type
    type ContentBlock =
      | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } }
      | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'; data: string } }
      | { type: 'text'; text: string };

    const contentBlocks: ContentBlock[] = [];

    if (isPdf) {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      });
    } else {
      // Images use 'image' type
      let imageMediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
      if (file.type === 'image/png') imageMediaType = 'image/png';
      else if (file.type === 'image/gif') imageMediaType = 'image/gif';
      else if (file.type === 'image/webp') imageMediaType = 'image/webp';

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMediaType,
          data: base64,
        },
      });
    }

    contentBlocks.push({
      type: 'text',
      text: `You are a task extraction assistant. Analyze this ${isPdf ? 'document' : 'image'} and extract actionable tasks from it.
${userListText}

Extract the following information and respond in JSON format only (no markdown, no code blocks):

{
  "documentSummary": "Brief 1-2 sentence summary of what this document is about",
  "extractedText": "Key text content from the document (first 500 chars max)",
  "mainTask": {
    "text": "Clear, actionable main task title (concise, under 100 chars)",
    "priority": "low|medium|high|urgent based on urgency indicators in document",
    "dueDate": "YYYY-MM-DD if a date is mentioned, otherwise empty string",
    "assignedTo": "username from the team list if mentioned, otherwise empty string"
  },
  "subtasks": [
    {
      "text": "Specific actionable subtask",
      "priority": "low|medium|high|urgent",
      "estimatedMinutes": number or null
    }
  ]
}

Guidelines:
- Extract 2-6 subtasks that break down the main task
- Make tasks specific and actionable (start with verbs)
- Look for action items, requirements, deadlines, and assignments
- If this is an email or letter, focus on what the recipient needs to do
- If this is a document/report, identify key action items or follow-ups
- Infer priority from urgency words (ASAP, urgent, deadline, important)
- Parse any dates mentioned into YYYY-MM-DD format

Respond with ONLY the JSON object, no other text.`,
    });

    // Use Claude's vision capability to read and parse the document
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
    });

    // Extract JSON from response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    let result;
    try {
      // Clean the response - remove any markdown code blocks if present
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      result = JSON.parse(jsonText.trim());
    } catch {
      console.error('Failed to parse AI response:', textContent.text);
      throw new Error('Failed to parse AI response as JSON');
    }

    return NextResponse.json({
      success: true,
      documentSummary: result.documentSummary || '',
      extractedText: result.extractedText || '',
      mainTask: result.mainTask || { text: '', priority: 'medium', dueDate: '', assignedTo: '' },
      subtasks: result.subtasks || [],
    });
  } catch (error) {
    console.error('Error parsing file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse file',
      },
      { status: 500 }
    );
  }
}
