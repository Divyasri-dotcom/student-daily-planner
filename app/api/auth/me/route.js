import { NextResponse } from 'next/server';import {getUserFromCookie} from '@/app/lib/auth';export async function GET(){const user=await getUserFromCookie();return NextResponse.json({user})}
