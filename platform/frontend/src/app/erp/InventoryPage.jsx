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

export const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total_items: 0, low_stock_count: 0, total_quantity: 0 });
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [reorderLevel, setReorderLevel] = useState("");
  const [movement, setMovement] = useState({ inventory_item: "", movement_type: "in", quantity: "", movement_date: "" });
  const [status, setStatus] = useState("");

  const load = async () => {
    const [itemsRes, statsRes] = await Promise.all([
      apiClient.get("/inventory/", {
        params: { q: query || undefined, low_stock: lowStockOnly ? 1 : undefined, page_size: 100 }
      }),
      apiClient.get("/inventory/stats/")
    ]);
    setItems(itemsRes.data.results || []);
    setStats(statsRes.data);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load inventory"));
  }, [query, lowStockOnly]);

  const submitMovement = async () => {
    try {
      await apiClient.post("/inventory-stock-movements/", {
        ...movement,
        quantity: Number(movement.quantity),
        movement_date: movement.movement_date || new Date().toISOString().slice(0, 10)
      });
      setMovement({ inventory_item: "", movement_type: "in", quantity: "", movement_date: "" });
      setStatus("Stock movement recorded");
      await load();
    } catch (error) {
      setStatus(error?.response?.data?.error?.message || "Movement failed");
    }
  };

  const bulkUpdateReorder = async () => {
    try {
      await apiClient.post("/inventory/bulk-update-reorder-level/", {
        item_ids: selected,
        reorder_level: Number(reorderLevel)
      });
      setSelected([]);
      setReorderLevel("");
      setStatus("Reorder levels updated");
      await load();
    } catch {
      setStatus("Bulk update failed");
    }
  };

  const exportCsv = async () => {
    const response = await apiClient.get("/inventory/export/", { responseType: "blob" });
    downloadBlob(response.data, "inventory.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Inventory Management</h2>
        <p className="text-sm text-slate-600">Track stock levels, movements, and low-stock alerts.</p>
      </header>
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
          <p className="mt-1 text-2xl font-bold text-rose-700">{stats.low_stock_count}</p>
        </article>
      </div>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search item or SKU"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
        <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
        <button onClick={exportCsv} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Export CSV
        </button>
      </div>

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        <select
          value={movement.inventory_item}
          onChange={(e) => setMovement((prev) => ({ ...prev, inventory_item: e.target.value }))}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">Select item</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.sku})
            </option>
          ))}
        </select>
        <select
          value={movement.movement_type}
          onChange={(e) => setMovement((prev) => ({ ...prev, movement_type: e.target.value }))}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
          <option value="adjustment">Adjustment</option>
        </select>
        <input
          type="number"
          value={movement.quantity}
          onChange={(e) => setMovement((prev) => ({ ...prev, quantity: e.target.value }))}
          placeholder="Quantity"
          className="rounded border border-slate-300 px-3 py-2"
        />
        <button onClick={submitMovement} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
          Record Movement
        </button>
      </div>

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-3">
        <input
          type="number"
          placeholder="Bulk reorder level"
          value={reorderLevel}
          onChange={(e) => setReorderLevel(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        />
        <button onClick={bulkUpdateReorder} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Bulk Update Reorder Level
        </button>
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Sel</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">On Hand</th>
              <th className="px-3 py-2">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">{item.name}</td>
                <td className="px-3 py-2">{item.sku}</td>
                <td className="px-3 py-2">{item.quantity_on_hand}</td>
                <td className="px-3 py-2">{item.reorder_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
