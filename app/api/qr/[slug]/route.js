import QRCode from 'qrcode';
export const runtime = 'nodejs';

export async function GET(req, { params }) {
  const { slug } = params;
  const origin = req.nextUrl.origin;
  const url = `${origin}/b/${slug}`;
  const png = await QRCode.toBuffer(url, { margin: 1, scale: 8, color: { dark: '#111111', light: '#FFFFFF' } });
  return new Response(png, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' } });
}
