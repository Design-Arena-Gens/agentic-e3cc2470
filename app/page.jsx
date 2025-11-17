"use client";

export const dynamic = 'force-dynamic';

import { useCallback, useRef, useState } from 'react';
import JSZip from 'jszip';
import exifr from 'exifr';
import { nanoid } from 'nanoid';

// Lazy import pdfjs only in browser
let pdfjs = null;
async function ensurePdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('pdfjs-dist');
  const { GlobalWorkerOptions } = pdfjs;
  GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';
  return pdfjs;
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.9) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function normalizeImage(blob) {
  // Convert HEIC to JPEG
  let inputBlob = blob;
  if (/heic/i.test(blob.type) || /\.heic$/i.test(blob.name || '')) {
    const heic2any = (await import('heic2any')).default;
    inputBlob = await heic2any({ blob: blob, toType: 'image/jpeg', quality: 0.9 });
  }
  const orientation = await exifr.orientation(inputBlob).catch(() => undefined);
  const img = await createImageBitmap(inputBlob);
  const rotate = orientation === 6 ? 90 : orientation === 8 ? -90 : orientation === 3 ? 180 : 0;
  const isRotated = rotate === 90 || rotate === -90;
  const w = isRotated ? img.height : img.width;
  const h = isRotated ? img.width : img.height;

  const targetMaxWidth = 1600; // mobile-optimized page size
  const scale = Math.min(1, targetMaxWidth / w);
  const outW = Math.round(w * scale);
  const outH = Math.round(h * scale);

  const canvas = new OffscreenCanvas(outW, outH);
  const ctx = canvas.getContext('2d');
  ctx.save();
  if (rotate) {
    // translate to center and rotate
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  } else {
    ctx.drawImage(img, 0, 0, outW, outH);
  }
  ctx.restore();

  const full = await canvasToBlob(canvas, 'image/jpeg', 0.9);

  const thumbScale = Math.min(1, 300 / outW);
  const tW = Math.max(1, Math.round(outW * thumbScale));
  const tH = Math.max(1, Math.round(outH * thumbScale));
  const tCanvas = new OffscreenCanvas(tW, tH);
  const tCtx = tCanvas.getContext('2d');
  tCtx.drawImage(await createImageBitmap(full), 0, 0, tW, tH);
  const thumb = await canvasToBlob(tCanvas, 'image/jpeg', 0.7);

  return { full, thumb, width: outW, height: outH };
}

async function pdfToImages(file) {
  const { getDocument } = await ensurePdfJs();
  const ab = await readFileAsArrayBuffer(file);
  const pdf = await getDocument({ data: ab }).promise;
  const pages = [];
  const targetWidth = 1600;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport.width;
    const vp = page.getViewport({ scale });
    const canvas = new OffscreenCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const full = await canvasToBlob(canvas, 'image/jpeg', 0.9);

    const thumbScale = Math.min(1, 300 / vp.width);
    const tW = Math.max(1, Math.round(vp.width * thumbScale));
    const tH = Math.max(1, Math.round(vp.height * thumbScale));
    const tCanvas = new OffscreenCanvas(tW, tH);
    const tCtx = tCanvas.getContext('2d');
    tCtx.drawImage(await createImageBitmap(full), 0, 0, tW, tH);
    const thumb = await canvasToBlob(tCanvas, 'image/jpeg', 0.7);

    pages.push({ full, thumb, width: Math.ceil(vp.width), height: Math.ceil(vp.height) });
  }
  return pages;
}

async function zipEntriesToFiles(file) {
  const zip = await JSZip.loadAsync(file);
  const files = [];
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  // Sort by name natural order
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const ent of entries) {
    const ext = ent.name.split('.').pop().toLowerCase();
    if (!['jpg','jpeg','png','heic','pdf','webp'].includes(ext)) continue;
    const blob = new Blob([await ent.async('arraybuffer')], { type: ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}` });
    // Preserve name
    Object.defineProperty(blob, 'name', { value: ent.name });
    files.push(blob);
  }
  return files;
}

export default function Page() {
  const [files, setFiles] = useState([]);
  const [pages, setPages] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const slugRef = useRef(null);

  const onPick = async (e) => {
    const f = Array.from(e.target.files || []);
    await handleFiles(f);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const f = Array.from(e.dataTransfer.files || []);
    await handleFiles(f);
  };

  const handleFiles = async (incoming) => {
    let f = [];
    for (const file of incoming) {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.zip')) {
        const inside = await zipEntriesToFiles(file);
        f.push(...inside);
      } else {
        f.push(file);
      }
    }
    // order by natural name
    f.sort((a, b) => (a.name || '').localeCompare((b.name || ''), undefined, { numeric: true }));
    setFiles(f);
  };

  const processAll = useCallback(async () => {
    if (!files.length) return;
    setProcessing(true);
    setProgress(0);
    const out = [];
    let done = 0;
    for (const file of files) {
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.pdf')) {
        const arr = await pdfToImages(file);
        for (const it of arr) { out.push(it); done++; setProgress(Math.round((done / (files.length + arr.length)) * 100)); }
      } else {
        const norm = await normalizeImage(file);
        out.push(norm);
        done++;
        setProgress(Math.round((done / files.length) * 100));
      }
    }
    // Determine orientation and basic spreads
    const pagesWithMeta = out.map((p, idx) => ({
      ...p,
      index: idx,
      orientation: p.width >= p.height * 1.4 ? 'landscape' : 'portrait'
    }));
    setPages(pagesWithMeta);
    setProcessing(false);
  }, [files]);

  const uploadAll = useCallback(async () => {
    if (!pages.length) return;
    const slug = slugRef.current || nanoid(8);
    slugRef.current = slug;
    const origin = window.location.origin;

    // Upload pages
    const uploaded = [];
    let done = 0;
    for (const p of pages) {
      const pagePath = `books/${slug}/pages/${String(p.index).padStart(4,'0')}.jpg`;
      const thumbPath = `books/${slug}/thumbs/${String(p.index).padStart(4,'0')}.jpg`;

      const up1 = fetch('/api/upload', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', p.full, pagePath); fd.append('pathname', pagePath); fd.append('contentType', 'image/jpeg'); return fd; })() }).then(r => r.json());
      const up2 = fetch('/api/upload', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', p.thumb, thumbPath); fd.append('pathname', thumbPath); fd.append('contentType', 'image/jpeg'); return fd; })() }).then(r => r.json());

      const [fullSaved, thumbSaved] = await Promise.all([up1, up2]);
      uploaded.push({ url: fullSaved.url, thumbUrl: thumbSaved.url, width: p.width, height: p.height, orientation: p.orientation });
      done++;
      setProgress(Math.round((done / pages.length) * 100));
    }

    const meta = {
      slug,
      title: `Album ${slug}`,
      createdAt: new Date().toISOString(),
      pageCount: uploaded.length,
      pages: uploaded,
      display: { spread: true, rtl: false }
    };

    await fetch('/api/finalize', { method: 'POST', body: JSON.stringify(meta) });

    const url = `${origin}/b/${slug}`;
    const qrResp = await fetch(`/api/qr/${slug}`);
    const qrBlob = await qrResp.blob();
    const qrUrl = URL.createObjectURL(qrBlob);
    setResult({ slug, url, qrUrl });
  }, [pages]);

  const onPaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const blobs = await Promise.all(items.filter(i => i.kind === 'file').map(i => i.getAsFile()));
    if (blobs.length) await handleFiles(blobs);
  };

  return (
    <div className="container" onDragOver={(e)=>e.preventDefault()} onDrop={handleDrop} onPaste={onPaste}>
      <div className="card" style={{marginTop: 24}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16}}>
          <div>
            <div className="h1">Create QR Book</div>
            <div className="label">Upload images, HEIC, PDF or ZIP. Auto-order, normalize, and publish to a mobile-ready flipbook.</div>
          </div>
          <a className="btn secondary" href="https://st-pageflip.com/" target="_blank" rel="noreferrer">Flip engine: StPageFlip</a>
        </div>

        <div style={{marginTop:16, display:'flex', gap:12, flexWrap:'wrap'}}>
          <label className="btn">
            <input type="file" hidden multiple accept="image/*,application/pdf,application/zip" onChange={onPick} />
            Pick files
          </label>
          <button className="btn" onClick={processAll} disabled={!files.length || processing}>Process ({files.length})</button>
          <button className="btn" onClick={uploadAll} disabled={!pages.length}>Publish</button>
          {processing || pages.length ? (
            <div style={{minWidth:200}}>
              <div className="progress"><span style={{width: `${progress}%`}} /></div>
              <div className="label" style={{marginTop:6}}>{progress}%</div>
            </div>
          ) : null}
        </div>

        {files.length ? (
          <div style={{marginTop:16}} className="label">Input files: {files.length} (<span className="kbd">Drop</span> / <span className="kbd">Paste</span> supported)</div>
        ) : null}

        {pages.length ? (
          <div style={{marginTop:16}} className="grid">
            {pages.map((p)=>{
              const url = URL.createObjectURL(p.thumb);
              return (
                <div key={p.index}>
                  <img className="thumb" src={url} alt={`pg-${p.index}`} />
                  <div className="label" style={{marginTop:6}}>{p.width}?{p.height} ? {p.orientation}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {result ? (
          <div style={{marginTop:20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
            <img className="qr" src={result.qrUrl} alt="QR" />
            <div>
              <div className="badge">Published</div>
              <div style={{fontSize:20, fontWeight:700, marginTop:8}}>
                <a href={result.url} target="_blank" className="mono" rel="noreferrer">{result.url}</a>
              </div>
              <div className="label" style={{marginTop:4}}>Scan the QR on mobile to open the book</div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{marginTop:24}} className="card">
        <div style={{fontWeight:700, marginBottom:8}}>Tips</div>
        <ul>
          <li>Use ZIP for large batches. Files are auto-ordered by name.</li>
          <li>Landscape images are treated as double-page spreads automatically.</li>
          <li>Images are optimized for fast mobile loading with thumbnails and lazy loading.</li>
        </ul>
      </div>
    </div>
  );
}
