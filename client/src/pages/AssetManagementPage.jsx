import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Car,
    ClipboardCheck,
    Laptop,
    Plus,
    QrCode,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    Wrench,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatCurrency,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const initialAsset = {
    asset_code: '',
    name: '',
    asset_type: 'equipment',
    serial_number: '',
    purchase_date: '',
    purchase_value: '',
    condition_status: 'good',
    current_location: '',
    warranty_expiry: '',
    vehicle_registration: '',
    insurance_expiry: '',
    service_due_date: '',
    mileage: '',
};

const initialCheckout = {
    asset_id: '',
    assigned_to_user_id: '',
    expected_return_date: '',
    destination: '',
    checkout_condition: 'good',
    remarks: '',
};

const canManageAssets = (user) =>
    user?.system_role === 'SUPER_ADMIN' ||
    ['DIRECTOR', 'LOGISTICS_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'].includes(user?.role_code);

export default function AssetManagementPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [data, setData] = useState({ metrics: {}, assets: [], assignments: [], vehicles: [] });
    const [users, setUsers] = useState([]);
    const [modal, setModal] = useState('');
    const [assetForm, setAssetForm] = useState(initialAsset);
    const [checkoutForm, setCheckoutForm] = useState(initialCheckout);
    const [submitting, setSubmitting] = useState(false);

    const manager = canManageAssets(user);

    const fetchAssets = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const [assetRes, usersRes] = await Promise.allSettled([
                axios.get(`${API_BASE}/operations/assets`),
                axios.get(`${API_BASE}/users`),
            ]);
            if (assetRes.status === 'fulfilled') {
                setData({
                    metrics: assetRes.value.data?.metrics || {},
                    assets: Array.isArray(assetRes.value.data?.assets) ? assetRes.value.data.assets : [],
                    assignments: Array.isArray(assetRes.value.data?.assignments) ? assetRes.value.data.assignments : [],
                    vehicles: Array.isArray(assetRes.value.data?.vehicles) ? assetRes.value.data.vehicles : [],
                });
            } else {
                throw assetRes.reason;
            }
            if (usersRes.status === 'fulfilled') {
                setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
            }
        } catch (err) {
            setError(getErrorMessage(err, 'Asset management data is unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAssets();
    }, []);

    const availableAssets = useMemo(
        () => data.assets.filter((asset) => asset.status === 'available'),
        [data.assets]
    );

    const activeAssignments = data.assignments.filter((assignment) =>
        ['checked_out', 'approved', 'overdue'].includes(String(assignment.status || ''))
    );

    const submitAsset = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const payload = {
                ...assetForm,
                vehicle: assetForm.vehicle_registration
                    ? {
                          registration_number: assetForm.vehicle_registration,
                          insurance_expiry: assetForm.insurance_expiry,
                          service_due_date: assetForm.service_due_date,
                          mileage: assetForm.mileage,
                      }
                    : null,
            };
            await axios.post(`${API_BASE}/operations/assets`, payload);
            setAssetForm(initialAsset);
            setModal('');
            setMessage('Asset registered.');
            await fetchAssets({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not register asset.'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitCheckout = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/asset-checkouts`, checkoutForm);
            setCheckoutForm(initialCheckout);
            setModal('');
            setMessage('Asset checked out.');
            await fetchAssets({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not checkout asset.'));
        } finally {
            setSubmitting(false);
        }
    };

    const returnAssignment = async (assignment) => {
        setError('');
        try {
            await axios.patch(`${API_BASE}/operations/asset-checkouts/${assignment.id}/return`, {
                return_condition: assignment.checkout_condition || 'good',
                current_location: 'Returned to store',
            });
            setMessage('Asset return recorded.');
            await fetchAssets({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not return asset.'));
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Enterprise Asset Management"
                subtitle="Custody, QR tags, vehicle compliance, maintenance alerts, and checkout accountability."
                actions={
                    <div className="governance-toolbar">
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchAssets({ silent: true })} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        {manager && (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => setModal('checkout')}>
                                    <ClipboardCheck size={14} />
                                    Checkout
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setModal('asset')}>
                                    <Plus size={14} />
                                    Asset
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {error && <div className="page-message error">{error}</div>}
            {message && <div className="page-message success">{message}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Digital Custody Tracking</div>
                    <h2>Assets are accountable from purchase to checkout, return, maintenance, and disposal.</h2>
                    <p>
                        The asset register connects equipment profiles, assigned users, current location, QR payloads, vehicle insurance, and sign-in/out history.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Checked Out</div>
                    <div className="hero-control-value">{formatNumber(data.metrics.checked_out_assets)}</div>
                    <p>{formatNumber(data.metrics.overdue_checkout_count)} overdue return{Number(data.metrics.overdue_checkout_count || 0) === 1 ? '' : 's'} need follow-up.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={Laptop} label="Total Assets" value={formatNumber(data.metrics.total_assets)} note="Registered enterprise assets" />
                <MetricCard icon={ClipboardCheck} tone="warning" label="Checked Out" value={formatNumber(data.metrics.checked_out_assets)} note="Active custody transactions" />
                <MetricCard icon={Wrench} tone="info" label="Maintenance" value={formatNumber(data.metrics.maintenance_assets)} note="Assets currently unavailable" />
                <MetricCard icon={ShieldAlert} tone="warning" label="Vehicle Alerts" value={formatNumber(data.metrics.vehicle_alert_count)} note="Insurance or service due within 30 days" />
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Asset Register</h2>
                        <p className="panel-subtitle">Every asset carries a code, condition, current holder, and QR payload.</p>
                    </div>
                </div>
                {data.assets.length === 0 ? (
                    <EmptyState icon={Laptop} title="No assets registered" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Asset</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Holder</th>
                                    <th>Location</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.assets.slice(0, 16).map((asset) => (
                                    <tr key={asset.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{asset.name}</div>
                                            <div className="form-hint">{asset.asset_code} / {asset.serial_number || 'No serial'}</div>
                                        </td>
                                        <td>{formatStatus(asset.asset_type)}</td>
                                        <td><span className={`badge badge-${badgeTone(asset.status)}`}>{formatStatus(asset.status)}</span></td>
                                        <td>{asset.assigned_user_name || 'Unassigned'}</td>
                                        <td>{asset.current_location || 'Not set'}</td>
                                        <td>{asset.purchase_value ? formatCurrency(asset.purchase_value) : 'Not set'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Active Checkouts</h2>
                            <p className="panel-subtitle">Custody remains open until return and inspection are recorded.</p>
                        </div>
                    </div>
                    {activeAssignments.length === 0 ? (
                        <EmptyState icon={ClipboardCheck} title="No active checkouts" />
                    ) : (
                        <div className="control-stack compact">
                            {activeAssignments.slice(0, 10).map((assignment) => (
                                <div className="control-row static" key={assignment.id}>
                                    <div>
                                        <div className="control-title">{assignment.asset_name}</div>
                                        <div className="control-copy">
                                            {assignment.asset_code} / {assignment.assigned_to_name || 'Unassigned'} / due {formatDate(assignment.expected_return_date)}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <span className={`badge badge-${badgeTone(assignment.status)}`}>{formatStatus(assignment.status)}</span>
                                        {manager && assignment.status === 'checked_out' && (
                                            <button className="btn btn-secondary btn-sm" onClick={() => returnAssignment(assignment)}>
                                                <RotateCcw size={14} />
                                                Return
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Vehicle Compliance</h2>
                            <p className="panel-subtitle">Insurance, service due dates, driver history, and mileage are asset-linked.</p>
                        </div>
                    </div>
                    {data.vehicles.length === 0 ? (
                        <EmptyState icon={Car} title="No vehicle profiles" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Registration</th>
                                        <th>Insurance</th>
                                        <th>Service Due</th>
                                        <th>Mileage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.vehicles.map((vehicle) => (
                                        <tr key={vehicle.id}>
                                            <td>{vehicle.asset_name}</td>
                                            <td>{vehicle.registration_number}</td>
                                            <td>{formatDate(vehicle.insurance_expiry)}</td>
                                            <td>{formatDate(vehicle.service_due_date)}</td>
                                            <td>{formatNumber(vehicle.mileage, { maximumFractionDigits: 1 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {modal && (
                <div className="modal-overlay" onMouseDown={() => setModal('')}>
                    <div className="modal-box lg" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{modal === 'asset' ? 'Register Asset' : 'Checkout Asset'}</h3>
                            <button className="modal-close" onClick={() => setModal('')}>x</button>
                        </div>
                        {modal === 'asset' && (
                            <form onSubmit={submitAsset}>
                                <div className="modal-body form-grid">
                                    <label className="form-field">
                                        <span>Asset Code</span>
                                        <input className="form-input" value={assetForm.asset_code} onChange={(event) => setAssetForm({ ...assetForm, asset_code: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Asset Name</span>
                                        <input className="form-input" value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Type</span>
                                        <select className="form-input" value={assetForm.asset_type} onChange={(event) => setAssetForm({ ...assetForm, asset_type: event.target.value })}>
                                            <option value="equipment">Equipment</option>
                                            <option value="laptop">Laptop</option>
                                            <option value="printer">Printer</option>
                                            <option value="projector">Projector</option>
                                            <option value="vehicle">Vehicle</option>
                                            <option value="challenge_course">Challenge Course</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Serial Number</span>
                                        <input className="form-input" value={assetForm.serial_number} onChange={(event) => setAssetForm({ ...assetForm, serial_number: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Purchase Date</span>
                                        <input className="form-input" type="date" value={assetForm.purchase_date} onChange={(event) => setAssetForm({ ...assetForm, purchase_date: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Purchase Value</span>
                                        <input className="form-input" type="number" min="0" step="0.01" value={assetForm.purchase_value} onChange={(event) => setAssetForm({ ...assetForm, purchase_value: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Condition</span>
                                        <select className="form-input" value={assetForm.condition_status} onChange={(event) => setAssetForm({ ...assetForm, condition_status: event.target.value })}>
                                            <option value="excellent">Excellent</option>
                                            <option value="good">Good</option>
                                            <option value="fair">Fair</option>
                                            <option value="poor">Poor</option>
                                            <option value="damaged">Damaged</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Location</span>
                                        <input className="form-input" value={assetForm.current_location} onChange={(event) => setAssetForm({ ...assetForm, current_location: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Warranty Expiry</span>
                                        <input className="form-input" type="date" value={assetForm.warranty_expiry} onChange={(event) => setAssetForm({ ...assetForm, warranty_expiry: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Vehicle Registration</span>
                                        <input className="form-input" value={assetForm.vehicle_registration} onChange={(event) => setAssetForm({ ...assetForm, vehicle_registration: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Insurance Expiry</span>
                                        <input className="form-input" type="date" value={assetForm.insurance_expiry} onChange={(event) => setAssetForm({ ...assetForm, insurance_expiry: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Service Due</span>
                                        <input className="form-input" type="date" value={assetForm.service_due_date} onChange={(event) => setAssetForm({ ...assetForm, service_due_date: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Asset'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'checkout' && (
                            <form onSubmit={submitCheckout}>
                                <div className="modal-body form-grid">
                                    <label className="form-field">
                                        <span>Asset</span>
                                        <select className="form-input" value={checkoutForm.asset_id} onChange={(event) => setCheckoutForm({ ...checkoutForm, asset_id: event.target.value })} required>
                                            <option value="">Select asset</option>
                                            {availableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_code} / {asset.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Assigned To</span>
                                        <select className="form-input" value={checkoutForm.assigned_to_user_id} onChange={(event) => setCheckoutForm({ ...checkoutForm, assigned_to_user_id: event.target.value })} required>
                                            <option value="">Select user</option>
                                            {users.map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Expected Return</span>
                                        <input className="form-input" type="date" value={checkoutForm.expected_return_date} onChange={(event) => setCheckoutForm({ ...checkoutForm, expected_return_date: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Destination</span>
                                        <input className="form-input" value={checkoutForm.destination} onChange={(event) => setCheckoutForm({ ...checkoutForm, destination: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Condition Out</span>
                                        <select className="form-input" value={checkoutForm.checkout_condition} onChange={(event) => setCheckoutForm({ ...checkoutForm, checkout_condition: event.target.value })}>
                                            <option value="excellent">Excellent</option>
                                            <option value="good">Good</option>
                                            <option value="fair">Fair</option>
                                            <option value="poor">Poor</option>
                                        </select>
                                    </label>
                                    <label className="form-field full">
                                        <span>Remarks</span>
                                        <textarea className="form-input" value={checkoutForm.remarks} onChange={(event) => setCheckoutForm({ ...checkoutForm, remarks: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        <QrCode size={16} />
                                        {submitting ? 'Saving...' : 'Checkout'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
