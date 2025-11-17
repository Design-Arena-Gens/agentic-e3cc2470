import { put, list } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';

export const isVercel = !!process.env.VERCEL;

const localRoot = path.join(process.cwd(), 'public');

async function ensureLocalDir(dir) {
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
}

export async function storePublicFile({ pathname, data, contentType }) {
  // If not on Vercel (local dev), write into public/
  if (!isVercel) {
    const full = path.join(localRoot, pathname);
    await ensureLocalDir(path.dirname(full));
    await fs.writeFile(full, Buffer.from(await data.arrayBuffer ? await data.arrayBuffer() : data));
    return {
      url: `/${pathname.replace(/\\/g, '/')}`,
      pathname,
    };
  }
  const res = await put(pathname, data, { access: 'public', contentType });
  return { url: res.url, pathname };
}

export async function findMeta(slug) {
  // Try local first
  const localMetaPath = path.join(localRoot, 'books', slug, 'meta.json');
  try {
    const buf = await fs.readFile(localMetaPath);
    return JSON.parse(buf.toString('utf-8'));
  } catch {}

  // Try blob listing when on Vercel
  try {
    const { blobs } = await list({ prefix: `books/${slug}/meta.json`, mode: 'folded' });
    const metaBlob = blobs?.[0];
    if (!metaBlob) return null;
    const resp = await fetch(metaBlob.url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
