import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invite-Only Demo',
  description: 'Invite-only phase-1 demo with explicit workflow guardrails',
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
