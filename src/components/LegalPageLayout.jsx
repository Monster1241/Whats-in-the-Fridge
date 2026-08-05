import { ArrowLeft } from 'lucide-react';

export function LegalPageLayout({ title, children }) {
  return (
    <div className="app-shell min-h-full">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-16">
        <a
          href="/"
          className="text-muted mb-6 inline-flex items-center gap-2 text-sm font-semibold hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to app
        </a>
        <header className="mb-8">
          <h1 className="text-heading text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="text-muted mt-2 text-sm">Last updated: 5 August 2026</p>
        </header>
        <article className="legal-prose text-muted space-y-5 text-sm leading-relaxed">{children}</article>
      </div>
    </div>
  );
}
