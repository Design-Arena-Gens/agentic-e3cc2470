export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { storePublicFile } from '@/lib/storage';

export async function POST(req) {
  const form = await req.formData();
  const file = form.get('file');
  const pathname = form.get('pathname');
  const contentType = form.get('contentType') || file?.type || 'application/octet-stream';

  if (!(file && pathname)) {
    return NextResponse.json({ error: 'file and pathname required' }, { status: 400 });
  }

  const saved = await storePublicFile({ pathname, data: file, contentType });
  return NextResponse.json(saved);
}
