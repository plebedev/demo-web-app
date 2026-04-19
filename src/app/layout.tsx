import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frontend BFF | Coming Soon",
  description: "Frontend/BFF starter service scaffold"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
