export const WidgetCard = ({ title, icon: Icon, value, hint }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <Icon size={18} className="text-brand-700" />
    </div>
    <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{hint}</p>
  </article>
);
