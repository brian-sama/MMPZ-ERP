export const PageSection = ({ title, subtitle }) => (
  <section className="rounded-2xl bg-white p-6 shadow-panel">
    <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
  </section>
);
