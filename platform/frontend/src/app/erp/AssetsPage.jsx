import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

export const AssetsPage = () => {
  const { user } = useOutletContext();
  const [assets, setAssets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [depreciation, setDepreciation] = useState([]);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");

  const [assetForm, setAssetForm] = useState({
    asset_code: "",
    name: "",
    category: "",
    location: "",
    purchase_date: "",
    purchase_value: "",
    current_value: "",
    status: "active"
  });
  const [locationForm, setLocationForm] = useState({ name: "", address: "", description: "" });
  const [maintenanceForm, setMaintenanceForm] = useState({
    asset: "",
    maintenance_date: "",
    cost: "",
    description: "",
    next_due_date: ""
  });
  const [depreciationForm, setDepreciationForm] = useState({
    asset: "",
    period_start: "",
    period_end: "",
    depreciation_amount: "",
    book_value: ""
  });

  const canManage = hasPermission(user, "inventory.manage");
  const filteredAssets = assets.filter((asset) => {
    if (!query.trim()) return true;
    const haystack = `${asset.asset_code} ${asset.name} ${asset.category}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const load = async () => {
    const [assetsRes, locationsRes, maintenanceRes, depreciationRes] = await Promise.all([
      apiClient.get("/assets/", { params: { page_size: 100 } }),
      apiClient.get("/asset-locations/", { params: { page_size: 100 } }),
      apiClient.get("/asset-maintenance/", { params: { page_size: 50 } }),
      apiClient.get("/asset-depreciation/", { params: { page_size: 50 } })
    ]);
    setAssets(assetsRes.data.results || []);
    setLocations(locationsRes.data.results || []);
    setMaintenance(maintenanceRes.data.results || []);
    setDepreciation(depreciationRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load assets"));
  }, []);

  const submitLocation = async () => {
    try {
      await apiClient.post("/asset-locations/", locationForm);
      setLocationForm({ name: "", address: "", description: "" });
      setStatus("Location created");
      await load();
    } catch {
      setStatus("Failed to create location");
    }
  };

  const submitAsset = async () => {
    try {
      await apiClient.post("/assets/", {
        ...assetForm,
        location: assetForm.location ? Number(assetForm.location) : null,
        purchase_value: Number(assetForm.purchase_value || 0),
        current_value: Number(assetForm.current_value || 0)
      });
      setAssetForm({
        asset_code: "",
        name: "",
        category: "",
        location: "",
        purchase_date: "",
        purchase_value: "",
        current_value: "",
        status: "active"
      });
      setStatus("Asset created");
      await load();
    } catch {
      setStatus("Failed to create asset");
    }
  };

  const submitMaintenance = async () => {
    try {
      await apiClient.post("/asset-maintenance/", {
        ...maintenanceForm,
        asset: Number(maintenanceForm.asset),
        cost: Number(maintenanceForm.cost || 0),
        next_due_date: maintenanceForm.next_due_date || null
      });
      setMaintenanceForm({ asset: "", maintenance_date: "", cost: "", description: "", next_due_date: "" });
      setStatus("Maintenance record added");
      await load();
    } catch {
      setStatus("Failed to add maintenance");
    }
  };

  const submitDepreciation = async () => {
    try {
      await apiClient.post("/asset-depreciation/", {
        ...depreciationForm,
        asset: Number(depreciationForm.asset),
        depreciation_amount: Number(depreciationForm.depreciation_amount || 0),
        book_value: Number(depreciationForm.book_value || 0)
      });
      setDepreciationForm({
        asset: "",
        period_start: "",
        period_end: "",
        depreciation_amount: "",
        book_value: ""
      });
      setStatus("Depreciation record added");
      await load();
    } catch {
      setStatus("Failed to add depreciation");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Asset Management</h2>
        <p className="text-sm text-slate-600">Track assets, locations, maintenance, and depreciation.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Assets</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{assets.length}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Locations</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{locations.length}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Maintenance Records</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{maintenance.length}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-wide text-slate-500">Depreciation Records</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{depreciation.length}</p>
        </article>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-panel">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by code, name, category"
          className="w-full rounded border border-slate-300 px-3 py-2"
        />
      </div>

      {canManage ? (
        <>
          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <input
              value={locationForm.name}
              onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Location name"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={locationForm.address}
              onChange={(event) => setLocationForm((prev) => ({ ...prev, address: event.target.value }))}
              placeholder="Address"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={locationForm.description}
              onChange={(event) => setLocationForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button onClick={submitLocation} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              Add Location
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <input
              value={assetForm.asset_code}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, asset_code: event.target.value }))}
              placeholder="Asset code"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={assetForm.name}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Asset name"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={assetForm.category}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="Category"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <select
              value={assetForm.location}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, location: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">No location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={assetForm.purchase_date}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, purchase_date: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              value={assetForm.purchase_value}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, purchase_value: event.target.value }))}
              placeholder="Purchase value"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              value={assetForm.current_value}
              onChange={(event) => setAssetForm((prev) => ({ ...prev, current_value: event.target.value }))}
              placeholder="Current value"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button onClick={submitAsset} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              Add Asset
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
            <select
              value={maintenanceForm.asset}
              onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, asset: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} - {asset.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={maintenanceForm.maintenance_date}
              onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, maintenance_date: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              value={maintenanceForm.cost}
              onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, cost: event.target.value }))}
              placeholder="Cost"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={maintenanceForm.description}
              onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button
              onClick={submitMaintenance}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Add Maintenance
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
            <select
              value={depreciationForm.asset}
              onChange={(event) => setDepreciationForm((prev) => ({ ...prev, asset: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.asset_code} - {asset.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={depreciationForm.period_start}
              onChange={(event) => setDepreciationForm((prev) => ({ ...prev, period_start: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="date"
              value={depreciationForm.period_end}
              onChange={(event) => setDepreciationForm((prev) => ({ ...prev, period_end: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="number"
              value={depreciationForm.depreciation_amount}
              onChange={(event) => setDepreciationForm((prev) => ({ ...prev, depreciation_amount: event.target.value }))}
              placeholder="Depreciation amount"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button
              onClick={submitDepreciation}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Add Depreciation
            </button>
          </div>
        </>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Current Value</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => {
              const location = locations.find((item) => item.id === asset.location);
              return (
                <tr key={asset.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{asset.asset_code}</td>
                  <td className="px-3 py-2">{asset.name}</td>
                  <td className="px-3 py-2">{asset.category}</td>
                  <td className="px-3 py-2">{location?.name || "-"}</td>
                  <td className="px-3 py-2">${Number(asset.current_value || 0).toLocaleString()}</td>
                  <td className="px-3 py-2">{asset.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
