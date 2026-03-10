import { PageSection } from "./PageSection";

export const ModulePage = ({ title, subtitle, bullets }) => (
  <section className="space-y-4">
    <PageSection title={title} subtitle={subtitle} />
    <article className="rounded-2xl bg-white p-6 shadow-panel">
      <h3 className="text-sm font-semibold uppercase tracking-[0.1em] text-brand-700">Capabilities</h3>
      <ul className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
        {bullets.map((item) => (
          <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </article>
  </section>
);
