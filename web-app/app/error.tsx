'use client';

import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Surface runtime faults in browser logs for quicker production triage.
    console.error('Unhandled UI error:', error);
  }, [error]);

  return (
    <main className="page-shell">
      <section className="surface-card border-red-200 bg-red-50">
        <p className="section-kicker text-red-700">Unexpected Error</p>
        <h1 className="mt-2 text-2xl font-bold text-red-900">The page failed to load correctly.</h1>
        <p className="mt-2 text-sm text-red-800">
          Please retry. If the issue persists, check API gateway and backend service health.
        </p>
        <button type="button" className="btn-primary mt-5" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}
