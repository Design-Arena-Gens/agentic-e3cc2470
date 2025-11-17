export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { findMeta } from '@/lib/storage';

export async function GET(_req, { params }) {
  const slug = params.slug;
  const meta = await findMeta(slug);
  if (!meta) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(meta);
}
