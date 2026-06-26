import { NextResponse } from 'next/server';
import { generateTeamDigest } from '@/app/lib/ai';
import { listPosts } from '@/app/lib/storage';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const posts = await listPosts();
    const digest = await generateTeamDigest(posts);
    return NextResponse.json({ digest, postCount: posts.length });
  } catch (error) {
    return NextResponse.json({ error: 'Could not generate digest.' }, { status: 500 });
  }
}
