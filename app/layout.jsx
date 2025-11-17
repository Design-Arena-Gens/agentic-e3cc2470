import './globals.css';

export const metadata = {
  title: 'QR Album Builder',
  description: 'Create realistic page-flip digital books with QR access',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
