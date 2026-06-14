import Link from 'next/link';
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[200px_1fr]">
      <aside className="border-r bg-secondary/30 p-4">
        <div className="text-lg font-semibold mb-6">
          <Link href="/dashboard">ArborStudio</Link>
        </div>
        <nav className="space-y-1 text-sm">
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/dashboard">
            Dashboard
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/projects">
            Projects
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/plugins">
            Plugins
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/skills">
            Skills
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/integrations">
            Integrations
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/team">
            Team
          </Link>
          <Link className="block rounded px-3 py-2 hover:bg-secondary" href="/settings">
            Settings
          </Link>
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
