// Explain screen — placeholder shell. Build it with docs/PROMPTS.md prompt 3.
export default function ExplainPage() {
  return (
    <section className="mt-10 rounded-2xl bg-sx-sky p-8 sm:p-12">
      <h1 className="text-4xl sm:text-5xl">Paste a failed deploy log. Get the fix.</h1>
      <p className="mt-4 max-w-2xl text-sx-mute">
        FixLoop reads build and deployment logs, finds the root cause, and tells you exactly what to change.
      </p>
      <p className="mt-6 text-sm text-sx-subtle">Explain screen coming next (prompt 3).</p>
    </section>
  );
}
