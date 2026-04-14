export default function GlobalLoading() {
  return (
    <main className="page-shell">
      <section className="hero-shell animate-pulse">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="mt-4 h-10 w-2/3 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-full rounded bg-slate-200" />
        <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="surface-card animate-pulse">
            <div className="h-4 w-28 rounded bg-slate-200" />
            <div className="mt-3 h-4 w-full rounded bg-slate-200" />
            <div className="mt-2 h-4 w-4/5 rounded bg-slate-200" />
          </div>
        ))}
      </section>
    </main>
  );
}
