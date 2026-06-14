import Link from 'next/link';

export default function MarketingHome() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">ArborStudio</h1>
        <p className="text-lg text-muted-foreground">
          A real-time web app for the Arbor autonomous research agent.
          Propose hypotheses, run experiments, watch the Idea Tree grow —
          all from your browser.
        </p>
        <p className="text-sm text-muted-foreground">
          100% on Cloudflare. Workers · Durable Objects · Containers · D1 · R2 · Pages.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <Link
            href="/signup"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Log in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground pt-8">
          Phase 0 — Foundations. See{' '}
          <a
            className="underline hover:text-foreground"
            href="https://github.com/viky8090/Arbor"
          >
            github.com/viky8090/Arbor
          </a>
          .
        </p>
      </div>
    </main>
  );
}
