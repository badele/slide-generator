import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Slide Generator',
  description: 'Generate social media slides from YAML templates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 h-full">{children}</body>
    </html>
  );
}
