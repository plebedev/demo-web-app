import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coming Soon',
  description: 'Minimal coming soon page with backend readiness status',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
