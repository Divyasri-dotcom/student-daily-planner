import { NextResponse } from 'next/server';
import { getUserFromCookie } from '@/app/lib/auth';
import { reactToPost } from '@/app/lib/storage';

export const runtime = 'nodejs';

const allowed = ['✅', '🚧', '🙌', '👀'];

export async function POST(req, { params }) {
  const user = await getUserFromCookie();
  if (!user) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const { emoji } = await req.json();
    if (!allowed.includes(emoji)) return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
    const { id } = await params;
    const post = await reactToPost({ postId: id, userId: user.id, emoji });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ post });
  } catch {
    return NextResponse.json({ error: 'Could not save reaction' }, { status: 500 });
  }
}
