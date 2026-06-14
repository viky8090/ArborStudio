import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArborStudio',
  description: 'Web app for the Arbor autonomous research agent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
