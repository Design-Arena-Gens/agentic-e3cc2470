# QR Flipbook

Create highly realistic page-flip digital books/albums from images or multi-page PDFs. Generates a short URL and a QR code to open the book on mobile (no app required).

- Upload images (JPG/PNG/HEIC), PDFs, or a ZIP of assets
- Client-side processing for speed and privacy
- Automatic ordering, orientation detection, and normalization
- Optimized for mobile with thumbnails and lazy-loading
- Realistic page-flip via StPageFlip
- Storage via local `public/` in dev or Vercel Blob in production

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Deploy (Vercel)

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-e3cc2470
```
