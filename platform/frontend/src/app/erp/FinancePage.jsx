import { useEffect, useState } from "react";
import { apiClient } from "../../services/apiClient";

const fmt = (n) => `$${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Approval workflow steps ──────────────────────────────────────────────────
const APPROVAL_STEPS = ["pending", "under_review", "approved", "rejected"];
const STEP_LABELS = { pending: "Pending", under_review: "Under Review", approved: "Approved", rejected: "Rejected" };

function ApprovalStepper({ status }) {
  const normalised = (status ?? "pending").toLowerCase();
  const isRejected = normalised === "rejected";
  const steps = isRejected
    ? ["pending", "under_review", "rejected"]
    : ["pending", "under_review", "approved"];

  const activeIndex = steps.indexOf(normalised);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const reject = step === "rejected" && active;
        const dotColor = reject
          ? "bg-red-500 ring-red-200"
          : active
            ? "bg-brand-700 ring-brand-200"
            : done
              ? "bg-emerald-500 ring-emerald-100"
              : "bg-slate-200 ring-transparent";

        return (
          <div key={step} className="flex items-center">
            <div className={`relative flex h-5 w-5 items-center justify-center rounded-full ring-4 ${dotColor}`}>
              {done && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {reject && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-slate-500">
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-10 ${done ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Budget vs. actual card ───────────────────────────────────────────────────
function BudgetCard({ budget }) {
  const allocated = Number(budget.allocated_amount ?? 0);
  const spent = Number(budget.spent_amount ?? 0);
  const remaining = allocated - spent;
  const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0;
  const over = spent > allocated;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">{budget.name}</div>
          <div className="text-xs text-slate-500">FY {budget.fiscal_year}</div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
          budget.status === "active"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-600"
        }`}>
          {budget.status}
        </span>
      </div>

      {/* progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>Spent: {fmt(spent)}</span>
          <span>{pct.toFixed(0)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              over ? "bg-red-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[11px]">
          <span className="text-slate-500">Allocated: {fmt(allocated)}</span>
          <span className={`font-semibold ${over ? "text-red-600" : remaining < allocated * 0.15 ? "text-amber-600" : "text-emerald-700"}`}>
            {over ? `${fmt(Math.abs(remaining))} over` : `${fmt(remaining)} remaining`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const FinancePage = () => {
  const [summary, setSummary]         = useState({ donations_total: 0, expenses_total: 0, net: 0 });
  const [budgets, setBudgets]         = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses]       = useState([]);
  const [donationForm, setDonationForm] = useState({ amount: "", donor_name: "", donated_on: "" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", expense_date: "", status: "pending", budget: "" });
  const [status, setStatus]           = useState("");
  const [activeTab, setActiveTab]     = useState("budgets");

  const load = async () => {
    const [summaryRes, budgetsRes, txRes, expensesRes] = await Promise.all([
      apiClient.get("/finance/summary"),
      apiClient.get("/finance-budgets/", { params: { page_size: 50 } }),
      apiClient.get("/finance-transactions/", { params: { page_size: 100 } }),
      apiClient.get("/finance-expenses/", { params: { page_size: 100 } }),
    ]);
    setSummary(summaryRes.data);
    setBudgets(budgetsRes.data.results ?? []);
    setTransactions(txRes.data.results ?? []);
    setExpenses(expensesRes.data.results ?? []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load finance data"));
  }, []);

  const submitDonation = async () => {
    try {
      await apiClient.post("/finance-donations/", {
        amount: donationForm.amount,
        donor_name: donationForm.donor_name,
        donated_on: donationForm.donated_on || new Date().toISOString().slice(0, 10),
      });
      setDonationForm({ amount: "", donor_name: "", donated_on: "" });
      setStatus("Donation recorded");
      await load();
    } catch { setStatus("Donation failed"); }
  };

  const submitExpense = async () => {
    try {
      const payload = {
        title: expenseForm.title,
        amount: expenseForm.amount,
        expense_date: expenseForm.expense_date || new Date().toISOString().slice(0, 10),
        status: expenseForm.status,
      };
      if (expenseForm.budget) payload.budget = expenseForm.budget;
      await apiClient.post("/finance-expenses/", payload);
      setExpenseForm({ title: "", amount: "", expense_date: "", status: "pending", budget: "" });
      setStatus("Expense submitted for approval");
      await load();
    } catch { setStatus("Expense submission failed"); }
  };

  const exportTransactions = async () => {
    const res = await apiClient.get("/finance-transactions/export/", { responseType: "blob" });
    downloadBlob(res.data, "transactions.csv");
  };

  const tabs = [
    { id: "budgets",      label: "Budget vs. Actual" },
    { id: "record",       label: "Record Transaction" },
    { id: "approvals",    label: "Expense Approvals" },
    { id: "transactions", label: "Ledger" },
  ];

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Finance Management</h2>
        <p className="text-sm text-slate-600">Budget tracking, donations, expenses, and ledger transactions.</p>
      </header>

      {/* KPI strip */}
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Donations</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{fmt(summary.donations_total)}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Expenses</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{fmt(summary.expenses_total)}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
          <p className="text-xs uppercase tracking-wide text-slate-500">Net Position</p>
          <p className={`mt-1 text-2xl font-bold ${Number(summary.net) >= 0 ? "text-brand-700" : "text-red-600"}`}>
            {fmt(summary.net)}
          </p>
        </article>
      </div>

      {/* tab bar */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {status && (
        <p className="rounded-md bg-slate-50 border border-slate-200 px-4 py-2 text-sm text-slate-700">{status}</p>
      )}

      {/* ── Budget vs. Actual ── */}
      {activeTab === "budgets" && (
        <div>
          {budgets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
              No budgets found. Create a budget to begin tracking allocations vs. spend.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {budgets.map((b) => <BudgetCard key={b.id} budget={b} />)}
            </div>
          )}
          {/* total across budgets */}
          {budgets.length > 0 && (
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Total Allocated</div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {fmt(budgets.reduce((s, b) => s + Number(b.allocated_amount ?? 0), 0))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Total Spent</div>
                  <div className="mt-1 text-lg font-bold text-rose-700">
                    {fmt(budgets.reduce((s, b) => s + Number(b.spent_amount ?? 0), 0))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Total Remaining</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">
                    {fmt(
                      budgets.reduce((s, b) => s + Number(b.allocated_amount ?? 0) - Number(b.spent_amount ?? 0), 0),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Record Transaction ── */}
      {activeTab === "record" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl bg-white border border-slate-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Record Donation</h3>
            <input
              type="number" placeholder="Amount (USD)"
              value={donationForm.amount}
              onChange={(e) => setDonationForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <input
              placeholder="Donor name"
              value={donationForm.donor_name}
              onChange={(e) => setDonationForm((p) => ({ ...p, donor_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <input
              type="date"
              value={donationForm.donated_on}
              onChange={(e) => setDonationForm((p) => ({ ...p, donated_on: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <button
              onClick={submitDonation}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Submit Donation
            </button>
          </div>

          <div className="space-y-3 rounded-xl bg-white border border-slate-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Submit Expense</h3>
            <input
              placeholder="Expense title"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <input
              type="number" placeholder="Amount (USD)"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <input
              type="date"
              value={expenseForm.expense_date}
              onChange={(e) => setExpenseForm((p) => ({ ...p, expense_date: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            />
            <select
              value={expenseForm.budget}
              onChange={(e) => setExpenseForm((p) => ({ ...p, budget: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700/30"
            >
              <option value="">No budget line</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>{b.name} (FY {b.fiscal_year})</option>
              ))}
            </select>
            <button
              onClick={submitExpense}
              className="w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Submit for Approval
            </button>
          </div>
        </div>
      )}

      {/* ── Expense Approvals ── */}
      {activeTab === "approvals" && (
        <div className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Expense Approval Workflow</h3>
            <p className="text-xs text-slate-500">Each expense moves through: Pending → Under Review → Approved/Rejected</p>
          </div>
          {expenses.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No expenses submitted yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {expenses.map((ex) => (
                <div key={ex.id} className="px-5 py-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{ex.title}</div>
                      <div className="text-xs text-slate-500">
                        {fmt(ex.amount)} · {ex.expense_date}
                        {ex.budget && <span> · Budget #{ex.budget}</span>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                      ex.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : ex.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    }`}>
                      {ex.status}
                    </span>
                  </div>
                  <div className="pb-6">
                    <ApprovalStepper status={ex.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ledger ── */}
      {activeTab === "transactions" && (
        <div className="rounded-xl bg-white border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Transactions</h3>
            <button
              onClick={exportTransactions}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 tabular-nums text-slate-600">{tx.transaction_date}</td>
                    <td className="px-5 py-3 capitalize text-slate-700">{tx.transaction_type}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium text-slate-900">{fmt(tx.amount)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                        tx.status === "posted"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>{tx.status}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{tx.reference || "—"}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
