"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';

function useMeta(slug) {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    let mounted = true;
    fetch(`/api/meta/${slug}`).then(r => r.json()).then((m)=>{ if (mounted) setMeta(m); });
    return () => { mounted = false; };
  }, [slug]);
  return meta;
}

export default function BookPage({ params }) {
  const slug = params.slug;
  const meta = useMeta(slug);
  const containerRef = useRef(null);
  const flipRef = useRef(null);

  useEffect(() => {
    if (!meta || !containerRef.current) return;
    let destroyed = false;
    (async () => {
      const { PageFlip } = await import('page-flip');
      if (destroyed) return;

      // Cleanup existing
      if (flipRef.current) {
        try { flipRef.current.destroy(); } catch {}
        flipRef.current = null;
      }

      const el = containerRef.current;
      el.innerHTML = '';
      const bookEl = document.createElement('div');
      bookEl.className = 'pageflip-book';
      el.appendChild(bookEl);

      const width = Math.min(480, Math.floor(window.innerWidth * 0.45));
      const height = Math.floor(width * 1.4);

      const pf = new PageFlip(bookEl, {
        width,
        height,
        size: 'stretch',
        maxShadowOpacity: 0.35,
        showCover: true,
        mobileScrollSupport: true,
        useMouseEvents: true,
        showPageCorners: true,
        disableFlipByClick: false,
      });

      // Create pages
      meta.pages.forEach((p, idx) => {
        const page = document.createElement('div');
        page.className = 'page';
        page.style.width = width + 'px';
        page.style.height = height + 'px';
        page.style.display = 'flex';
        page.style.alignItems = 'center';
        page.style.justifyContent = 'center';
        page.style.background = '#fff';
        page.style.boxShadow = 'inset 0 0 0 1px rgba(15,23,42,0.06)';

        const img = new Image();
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = 'page-' + idx;
        img.src = p.url;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        page.appendChild(img);

        pf.loadFromHTML([page]);
      });

      flipRef.current = pf;

      const onResize = () => {
        const w = Math.min(480, Math.floor(window.innerWidth * 0.45));
        const h = Math.floor(w * 1.4);
        pf.update({ width: w, height: h });
      };
      window.addEventListener('resize', onResize);
      return () => {
        window.removeEventListener('resize', onResize);
        try { pf.destroy(); } catch {}
      };
    })();
    return () => { destroyed = true; };
  }, [meta]);

  if (!meta) return (
    <div className="container">
      <div className="card"><div className="label">Loading?</div></div>
    </div>
  );

  return (
    <div className="container">
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}}>
        <div className="h1">{meta.title}</div>
        <a className="btn" href={`/api/qr/${slug}`} target="_blank" rel="noreferrer">Download QR</a>
      </div>
      <div className="viewer-wrap">
        <div ref={containerRef} style={{width:'100%', display:'flex', alignItems:'center', justifyContent:'center'}} />
      </div>
    </div>
  );
}
