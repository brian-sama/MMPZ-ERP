import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { apiClient } from "../../services/apiClient";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const movementSchema = z.object({
  inventory_item: z.string().min(1, "Select an item"),
  movement_type: z.enum(["in", "out", "adjustment"]),
  quantity: z.string().min(1, "Quantity is required").refine((v) => Number(v) > 0, "Must be > 0"),
  movement_date: z.string().optional(),
});

const reorderSchema = z.object({
  reorder_level: z.string().min(1, "Enter a reorder level").refine((v) => Number(v) >= 0, "Must be ≥ 0"),
});

// ─── Field helper ─────────────────────────────────────────────────────────────
const INPUT = "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none";

function Field({ error, children }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const InventoryPage = () => {
  const [items, setItems]   = useState([]);
  const [stats, setStats]   = useState({ total_items: 0, low_stock_count: 0, total_quantity: 0 });
  const [selected, setSelected] = useState([]);
  const [query, setQuery]   = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [pageStatus, setPageStatus] = useState("");

  const movementForm = useForm({
    resolver: zodResolver(movementSchema),
    defaultValues: { inventory_item: "", movement_type: "in", quantity: "", movement_date: "" },
  });
  const reorderForm = useForm({
    resolver: zodResolver(reorderSchema),
    defaultValues: { reorder_level: "" },
  });

  const load = async () => {
    const [itemsRes, statsRes] = await Promise.all([
      apiClient.get("/inventory/", {
        params: { q: query || undefined, low_stock: lowStockOnly ? 1 : undefined, page_size: 100 },
      }),
      apiClient.get("/inventory/stats/"),
    ]);
    setItems(itemsRes.data.results || []);
    setStats(statsRes.data);
  };

  useEffect(() => {
    load().catch(() => setPageStatus("Failed to load inventory"));
  }, [query, lowStockOnly]);

  const onSubmitMovement = async (data) => {
    try {
      await apiClient.post("/inventory-stock-movements/", {
        ...data,
        quantity: Number(data.quantity),
        movement_date: data.movement_date || new Date().toISOString().slice(0, 10),
      });
      movementForm.reset();
      setPageStatus("Stock movement recorded");
      await load();
    } catch (err) {
      setPageStatus(err?.response?.data?.error?.message || "Movement failed");
    }
  };

  const onSubmitReorder = async (data) => {
    try {
      await apiClient.post("/inventory/bulk-update-reorder-level/", {
        item_ids: selected,
        reorder_level: Number(data.reorder_level),
      });
      setSelected([]);
      reorderForm.reset();
      setPageStatus("Reorder levels updated");
      await load();
    } catch { setPageStatus("Bulk update failed"); }
  };

  const exportCsv = async () => {
    const res = await apiClient.get("/inventory/export/", { responseType: "blob" });
    downloadBlob(res.data, "inventory.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
        <p className="text-sm text-slate-600">Track stock levels, movements, and low-stock alerts.</p>
      </header>

      {/* KPI strip */}
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <p className="text-xs uppercase tracking-wide text-slate-500">Items</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total_items}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Quantity</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total_quantity}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <p className="text-xs uppercase tracking-wide text-slate-500">Low Stock</p>
          <p className={`mt-1 text-2xl font-bold ${stats.low_stock_count > 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {stats.low_stock_count}
          </p>
        </article>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-panel">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm flex-1 min-w-48"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item or SKU"
          value={query}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            type="checkbox"
          />
          Low stock only
        </label>
        <Button type="button" onClick={load} className="bg-slate-800 hover:bg-slate-900">Refresh</Button>
        <Button type="button" onClick={exportCsv} className="bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50">
          Export CSV
        </Button>
      </div>

      {/* Stock movement form */}
      <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Record Stock Movement</h3>
        <form
          className="grid gap-2 md:grid-cols-4"
          onSubmit={movementForm.handleSubmit(onSubmitMovement)}
          noValidate
        >
          <Field error={movementForm.formState.errors.inventory_item?.message}>
            <select {...movementForm.register("inventory_item")} className={INPUT}>
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
              ))}
            </select>
          </Field>
          <select {...movementForm.register("movement_type")} className={INPUT}>
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <Field error={movementForm.formState.errors.quantity?.message}>
            <input
              {...movementForm.register("quantity")}
              className={INPUT}
              min="1"
              placeholder="Quantity"
              type="number"
            />
          </Field>
          <Button type="submit" disabled={movementForm.formState.isSubmitting}>
            {movementForm.formState.isSubmitting ? "Saving…" : "Record Movement"}
          </Button>
        </form>
      </div>

      {/* Bulk reorder form */}
      <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Bulk Update Reorder Level ({selected.length} selected)
        </h3>
        <form className="flex items-start gap-2" onSubmit={reorderForm.handleSubmit(onSubmitReorder)} noValidate>
          <div className="flex flex-col gap-1">
            <input
              {...reorderForm.register("reorder_level")}
              className="rounded border border-slate-300 px-3 py-2 text-sm w-40 focus:border-brand-700 focus:outline-none"
              min="0"
              placeholder="Reorder level"
              type="number"
            />
            {reorderForm.formState.errors.reorder_level && (
              <p className="text-xs text-rose-600">{reorderForm.formState.errors.reorder_level.message}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={selected.length === 0 || reorderForm.formState.isSubmitting}
            className="bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Apply to Selected
          </Button>
        </form>
      </div>

      {pageStatus && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {pageStatus}
        </p>
      )}

      {/* Inventory table */}
      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5"></th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5 text-right">On Hand</th>
              <th className="px-3 py-2.5 text-right">Reorder Level</th>
              <th className="px-3 py-2.5">Stock</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isLow = item.quantity_on_hand <= item.reorder_level;
              return (
                <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <input
                      checked={selected.includes(item.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                        )
                      }
                      type="checkbox"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.sku}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-900">
                    {item.quantity_on_hand}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{item.reorder_level}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isLow ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {isLow ? "Low" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={6}>No items found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
