import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/app/lib/auth';
import { analyzeStandup } from '@/app/lib/ai';
import { deletePost, updatePost } from '@/app/lib/storage';

export const runtime = 'nodejs';

const VALID_CONFIDENCE = new Set(['Low', 'Medium', 'High']);

function cleanField(value, limit = 650) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function parseStandup(body) {
  return {
    yesterday: cleanField(body?.yesterday),
    today: cleanField(body?.today),
    blockers: cleanField(body?.blockers),
    confidence: VALID_CONFIDENCE.has(body?.confidence) ? body.confidence : 'Medium'
  };
}

function validateStandup(standup) {
  if (standup.yesterday.length < 5) return 'Add what you completed yesterday.';
  if (standup.today.length < 5) return 'Add what you plan to work on today.';
  if (standup.yesterday.length > 650 || standup.today.length > 650 || standup.blockers.length > 650) return 'Each standup field must stay under 650 characters.';
  return '';
}

export async function PUT(req, { params }) {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const standup = parseStandup(body);
    const validationError = validateStandup(standup);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const ai = await analyzeStandup(standup);
    const post = await updatePost({ postId: id, user, standup, ai });
    if (!post) return NextResponse.json({ error: 'Post not found or not yours' }, { status: 404 });
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: 'Could not update this standup. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const { id } = await params;
    const ok = await deletePost({ postId: id, userId: user.id });
    if (!ok) return NextResponse.json({ error: 'Post not found or not yours' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete this standup. Please try again.' }, { status: 500 });
  }
}
