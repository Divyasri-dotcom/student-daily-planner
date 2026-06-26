import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/app/lib/auth';
import { analyzeStandup } from '@/app/lib/ai';
import { createPost, listPosts } from '@/app/lib/storage';

export const runtime = 'nodejs';

const VALID_CONFIDENCE = new Set(['Low', 'Medium', 'High']);

function cleanField(value, limit = 650) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function parseStandup(body) {
  const standup = {
    yesterday: cleanField(body?.yesterday),
    today: cleanField(body?.today),
    blockers: cleanField(body?.blockers),
    confidence: VALID_CONFIDENCE.has(body?.confidence) ? body.confidence : 'Medium'
  };
  return standup;
}

function validateStandup(standup) {
  if (standup.yesterday.length < 5) return 'Add what you completed yesterday.';
  if (standup.today.length < 5) return 'Add what you plan to work on today.';
  if (standup.yesterday.length > 650 || standup.today.length > 650 || standup.blockers.length > 650) return 'Each standup field must stay under 650 characters.';
  return '';
}

export async function GET() {
  try {
    const posts = await listPosts();
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ error: 'Could not load standup updates.' }, { status: 500 });
  }
}

export async function POST(req) {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const body = await req.json();
    const standup = parseStandup(body);
    const validationError = validateStandup(standup);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const ai = await analyzeStandup(standup);
    const post = await createPost({ user, standup, ai });
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: 'Could not save this standup. Please try again.' }, { status: 500 });
  }
}
