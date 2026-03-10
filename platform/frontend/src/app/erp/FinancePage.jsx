import { useEffect, useState } from "react";

import { apiClient } from "../../services/apiClient";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const FinancePage = () => {
  const [summary, setSummary] = useState({ donations_total: 0, expenses_total: 0, net: 0 });
  const [transactions, setTransactions] = useState([]);
  const [donationForm, setDonationForm] = useState({ amount: "", donor_name: "", donated_on: "" });
  const [expenseForm, setExpenseForm] = useState({ title: "", amount: "", expense_date: "", status: "approved" });
  const [status, setStatus] = useState("");

  const load = async () => {
    const [summaryRes, txRes] = await Promise.all([
      apiClient.get("/finance/summary"),
      apiClient.get("/finance-transactions/", { params: { page_size: 100 } })
    ]);
    setSummary(summaryRes.data);
    setTransactions(txRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load finance data"));
  }, []);

  const submitDonation = async () => {
    try {
      await apiClient.post("/finance-donations/", {
        amount: donationForm.amount,
        donor_name: donationForm.donor_name,
        donated_on: donationForm.donated_on || new Date().toISOString().slice(0, 10)
      });
      setDonationForm({ amount: "", donor_name: "", donated_on: "" });
      setStatus("Donation recorded");
      await load();
    } catch {
      setStatus("Donation failed");
    }
  };

  const submitExpense = async () => {
    try {
      await apiClient.post("/finance-expenses/", {
        title: expenseForm.title,
        amount: expenseForm.amount,
        expense_date: expenseForm.expense_date || new Date().toISOString().slice(0, 10),
        status: expenseForm.status
      });
      setExpenseForm({ title: "", amount: "", expense_date: "", status: "approved" });
      setStatus("Expense recorded");
      await load();
    } catch {
      setStatus("Expense failed");
    }
  };

  const exportTransactions = async () => {
    const response = await apiClient.get("/finance-transactions/export/", { responseType: "blob" });
    downloadBlob(response.data, "transactions.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Finance Management</h2>
        <p className="text-sm text-slate-600">Donations, expenses, and ledger transactions.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Donations</h3>
          <p className="mt-1 text-2xl font-bold text-emerald-700">${Number(summary.donations_total).toLocaleString()}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Expenses</h3>
          <p className="mt-1 text-2xl font-bold text-rose-700">${Number(summary.expenses_total).toLocaleString()}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-xs uppercase tracking-wide text-slate-500">Net</h3>
          <p className="mt-1 text-2xl font-bold text-brand-700">${Number(summary.net).toLocaleString()}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-slate-900">Record Donation</h3>
          <input
            type="number"
            placeholder="Amount"
            value={donationForm.amount}
            onChange={(e) => setDonationForm((prev) => ({ ...prev, amount: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <input
            placeholder="Donor name"
            value={donationForm.donor_name}
            onChange={(e) => setDonationForm((prev) => ({ ...prev, donor_name: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="date"
            value={donationForm.donated_on}
            onChange={(e) => setDonationForm((prev) => ({ ...prev, donated_on: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submitDonation} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            Submit Donation
          </button>
        </div>
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-slate-900">Record Expense</h3>
          <input
            placeholder="Title"
            value={expenseForm.title}
            onChange={(e) => setExpenseForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="number"
            placeholder="Amount"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="date"
            value={expenseForm.expense_date}
            onChange={(e) => setExpenseForm((prev) => ({ ...prev, expense_date: e.target.value }))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submitExpense} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            Submit Expense
          </button>
        </div>
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="rounded-xl bg-white p-4 shadow-panel">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Transactions</h3>
          <button onClick={exportTransactions} className="rounded border border-slate-300 px-3 py-2 text-xs">
            Export CSV
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{tx.transaction_date}</td>
                  <td className="px-3 py-2">{tx.transaction_type}</td>
                  <td className="px-3 py-2">{tx.amount}</td>
                  <td className="px-3 py-2">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
