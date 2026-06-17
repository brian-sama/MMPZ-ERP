import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useOutletContext } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

// ─── Schemas ──────────────────────────────────────────────────────────────────
const locationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  address: z.string().optional(),
  description: z.string().optional(),
});

const assetSchema = z.object({
  asset_code: z.string().min(1, "Asset code is required"),
  name: z.string().min(1, "Asset name is required"),
  category: z.string().optional(),
  location: z.string().optional(),
  purchase_date: z.string().optional(),
  purchase_value: z.string().optional(),
  current_value: z.string().optional(),
  status: z.string().default("active"),
});

const maintenanceSchema = z.object({
  asset: z.string().min(1, "Select an asset"),
  maintenance_date: z.string().min(1, "Date is required"),
  cost: z.string().optional(),
  description: z.string().optional(),
  next_due_date: z.string().optional(),
});

const depreciationSchema = z.object({
  asset: z.string().min(1, "Select an asset"),
  period_start: z.string().min(1, "Start date is required"),
  period_end: z.string().min(1, "End date is required"),
  depreciation_amount: z.string().optional(),
  book_value: z.string().optional(),
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

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h3>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const AssetsPage = () => {
  const { user } = useOutletContext();
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [depreciation, setDepreciation] = useState([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const canManage = hasPermission(user, "inventory.manage");

  const locationForm = useForm({
    resolver: zodResolver(locationSchema),
    defaultValues: { name: "", address: "", description: "" },
  });
  const assetForm = useForm({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      asset_code: "", name: "", category: "", location: "",
      purchase_date: "", purchase_value: "", current_value: "", status: "active",
    },
  });
  const maintenanceForm = useForm({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: { asset: "", maintenance_date: "", cost: "", description: "", next_due_date: "" },
  });
  const depreciationForm = useForm({
    resolver: zodResolver(depreciationSchema),
    defaultValues: { asset: "", period_start: "", period_end: "", depreciation_amount: "", book_value: "" },
  });

  const load = async () => {
    const [assetsRes, locationsRes, maintenanceRes, depreciationRes] = await Promise.all([
      apiClient.get("/assets/", { params: { page_size: 100 } }),
      apiClient.get("/asset-locations/", { params: { page_size: 100 } }),
      apiClient.get("/asset-maintenance/", { params: { page_size: 50 } }),
      apiClient.get("/asset-depreciation/", { params: { page_size: 50 } }),
    ]);
    setAssets(assetsRes.data.results || []);
    setLocations(locationsRes.data.results || []);
    setMaintenance(maintenanceRes.data.results || []);
    setDepreciation(depreciationRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load assets"));
  }, []);

  const onSubmitLocation = async (data) => {
    try {
      await apiClient.post("/asset-locations/", data);
      locationForm.reset();
      setStatus("Location created");
      await load();
    } catch { setStatus("Failed to create location"); }
  };

  const onSubmitAsset = async (data) => {
    try {
      await apiClient.post("/assets/", {
        ...data,
        location: data.location ? Number(data.location) : null,
        purchase_value: Number(data.purchase_value || 0),
        current_value: Number(data.current_value || 0),
      });
      assetForm.reset();
      setStatus("Asset created");
      await load();
    } catch { setStatus("Failed to create asset"); }
  };

  const onSubmitMaintenance = async (data) => {
    try {
      await apiClient.post("/asset-maintenance/", {
        ...data,
        asset: Number(data.asset),
        cost: Number(data.cost || 0),
        next_due_date: data.next_due_date || null,
      });
      maintenanceForm.reset();
      setStatus("Maintenance record added");
      await load();
    } catch { setStatus("Failed to add maintenance"); }
  };

  const onSubmitDepreciation = async (data) => {
    try {
      await apiClient.post("/asset-depreciation/", {
        ...data,
        asset: Number(data.asset),
        depreciation_amount: Number(data.depreciation_amount || 0),
        book_value: Number(data.book_value || 0),
      });
      depreciationForm.reset();
      setStatus("Depreciation record added");
      await load();
    } catch { setStatus("Failed to add depreciation"); }
  };

  const filteredAssets = assets.filter((a) => {
    const q = query.trim().toLowerCase();
    return !q || `${a.asset_code} ${a.name} ${a.category}`.toLowerCase().includes(q);
  });

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Asset Management</h2>
        <p className="text-sm text-slate-600">Track assets, locations, maintenance, and depreciation.</p>
      </header>

      {/* KPI strip */}
      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        {[
          { label: "Assets",               value: assets.length      },
          { label: "Locations",            value: locations.length   },
          { label: "Maintenance Records",  value: maintenance.length },
          { label: "Depreciation Records", value: depreciation.length},
        ].map(({ label, value }) => (
          <article key={label}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
          </article>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-xl bg-white p-4 shadow-panel">
        <input
          className={INPUT}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code, name, category"
          value={query}
        />
      </div>

      {canManage && (
        <>
          {/* Location form */}
          <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
            <SectionHeader title="Add Location" />
            <form
              className="grid gap-2 md:grid-cols-4"
              onSubmit={locationForm.handleSubmit(onSubmitLocation)}
              noValidate
            >
              <Field error={locationForm.formState.errors.name?.message}>
                <input {...locationForm.register("name")} className={INPUT} placeholder="Location name" />
              </Field>
              <input {...locationForm.register("address")} className={INPUT} placeholder="Address" />
              <input {...locationForm.register("description")} className={INPUT} placeholder="Description" />
              <Button type="submit" disabled={locationForm.formState.isSubmitting}>Add Location</Button>
            </form>
          </div>

          {/* Asset form */}
          <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
            <SectionHeader title="Register Asset" />
            <form
              className="grid gap-2 md:grid-cols-4"
              onSubmit={assetForm.handleSubmit(onSubmitAsset)}
              noValidate
            >
              <Field error={assetForm.formState.errors.asset_code?.message}>
                <input {...assetForm.register("asset_code")} className={INPUT} placeholder="Asset code" />
              </Field>
              <Field error={assetForm.formState.errors.name?.message}>
                <input {...assetForm.register("name")} className={INPUT} placeholder="Asset name" />
              </Field>
              <input {...assetForm.register("category")} className={INPUT} placeholder="Category" />
              <select {...assetForm.register("location")} className={INPUT}>
                <option value="">No location</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input {...assetForm.register("purchase_date")} className={INPUT} type="date" />
              <input {...assetForm.register("purchase_value")} className={INPUT} placeholder="Purchase value" type="number" min="0" />
              <input {...assetForm.register("current_value")} className={INPUT} placeholder="Current value" type="number" min="0" />
              <Button type="submit" disabled={assetForm.formState.isSubmitting}>Add Asset</Button>
            </form>
          </div>

          {/* Maintenance form */}
          <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
            <SectionHeader title="Log Maintenance" />
            <form
              className="grid gap-2 md:grid-cols-5"
              onSubmit={maintenanceForm.handleSubmit(onSubmitMaintenance)}
              noValidate
            >
              <Field error={maintenanceForm.formState.errors.asset?.message}>
                <select {...maintenanceForm.register("asset")} className={INPUT}>
                  <option value="">Select asset</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_code} — {a.name}</option>)}
                </select>
              </Field>
              <Field error={maintenanceForm.formState.errors.maintenance_date?.message}>
                <input {...maintenanceForm.register("maintenance_date")} className={INPUT} type="date" />
              </Field>
              <input {...maintenanceForm.register("cost")} className={INPUT} placeholder="Cost" type="number" min="0" />
              <input {...maintenanceForm.register("description")} className={INPUT} placeholder="Description" />
              <Button type="submit" disabled={maintenanceForm.formState.isSubmitting}>Add Maintenance</Button>
            </form>
          </div>

          {/* Depreciation form */}
          <div className="rounded-xl bg-white p-4 shadow-panel space-y-3">
            <SectionHeader title="Record Depreciation" />
            <form
              className="grid gap-2 md:grid-cols-5"
              onSubmit={depreciationForm.handleSubmit(onSubmitDepreciation)}
              noValidate
            >
              <Field error={depreciationForm.formState.errors.asset?.message}>
                <select {...depreciationForm.register("asset")} className={INPUT}>
                  <option value="">Select asset</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_code} — {a.name}</option>)}
                </select>
              </Field>
              <Field error={depreciationForm.formState.errors.period_start?.message}>
                <input {...depreciationForm.register("period_start")} className={INPUT} type="date" />
              </Field>
              <Field error={depreciationForm.formState.errors.period_end?.message}>
                <input {...depreciationForm.register("period_end")} className={INPUT} type="date" />
              </Field>
              <input {...depreciationForm.register("depreciation_amount")} className={INPUT} placeholder="Depreciation amount" type="number" min="0" />
              <Button type="submit" disabled={depreciationForm.formState.isSubmitting}>Add Depreciation</Button>
            </form>
          </div>
        </>
      )}

      {status && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{status}</p>
      )}

      {/* Assets table */}
      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Location</th>
              <th className="px-3 py-2.5 text-right">Current Value</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => {
              const loc = locations.find((l) => l.id === asset.location);
              return (
                <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{asset.asset_code}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">{asset.name}</td>
                  <td className="px-3 py-2 text-slate-600">{asset.category || "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{loc?.name || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-900">
                    ${Number(asset.current_value || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                      asset.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filteredAssets.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={6}>No assets found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
