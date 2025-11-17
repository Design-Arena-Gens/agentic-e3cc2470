export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { storePublicFile } from '@/lib/storage';

export async function POST(req) {
  const meta = await req.json();
  const { slug } = meta || {};
  if (!slug) return NextResponse.json({ error: 'missing slug' }, { status: 400 });

  const data = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
  const saved = await storePublicFile({ pathname: `books/${slug}/meta.json`, data, contentType: 'application/json' });
  return NextResponse.json({ ok: true, metaUrl: saved.url });
}
