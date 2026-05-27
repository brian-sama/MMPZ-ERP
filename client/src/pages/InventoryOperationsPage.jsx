import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    Boxes,
    ClipboardCheck,
    FileCheck2,
    PackageCheck,
    Plus,
    RefreshCw,
    Send,
    Warehouse,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const initialMovement = {
    item_id: '',
    movement_type: 'procurement',
    movement_direction: 'in',
    quantity: '',
    source: '',
    destination: '',
    delivery_note_reference: '',
    remarks: '',
};

const initialRequest = {
    title: '',
    reason: '',
    district: '',
    destination: '',
    item_id: '',
    quantity_requested: '',
};

const initialItem = {
    name: '',
    category: '',
    unit: 'unit',
    minimum_threshold: '',
    storage_location: '',
};

const initialDelivery = {
    supplier: '',
    reference_number: '',
    item_id: '',
    quantity: '',
    condition_status: 'good',
    destination: 'Main Storeroom',
    remarks: '',
};

const canManageInventory = (user) =>
    user?.system_role === 'SUPER_ADMIN' ||
    ['DIRECTOR', 'FINANCE_OFFICER', 'LOGISTICS_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'].includes(user?.role_code);

export default function InventoryOperationsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [data, setData] = useState({
        metrics: {},
        items: [],
        low_stock: [],
        movements: [],
        requests: [],
        delivery_notes: [],
    });
    const [modal, setModal] = useState('');
    const [movementForm, setMovementForm] = useState(initialMovement);
    const [requestForm, setRequestForm] = useState(initialRequest);
    const [itemForm, setItemForm] = useState(initialItem);
    const [deliveryForm, setDeliveryForm] = useState(initialDelivery);
    const [submitting, setSubmitting] = useState(false);

    const manager = canManageInventory(user);

    const fetchInventory = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/operations/inventory`);
            setData({
                metrics: res.data?.metrics || {},
                items: Array.isArray(res.data?.items) ? res.data.items : [],
                low_stock: Array.isArray(res.data?.low_stock) ? res.data.low_stock : [],
                movements: Array.isArray(res.data?.movements) ? res.data.movements : [],
                requests: Array.isArray(res.data?.requests) ? res.data.requests : [],
                delivery_notes: Array.isArray(res.data?.delivery_notes) ? res.data.delivery_notes : [],
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Inventory operations are unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const itemOptions = useMemo(
        () => data.items.filter((item) => item.status === 'active'),
        [data.items]
    );

    const pendingRequests = data.requests.filter((request) =>
        ['submitted', 'reviewed', 'approved'].includes(String(request.status || ''))
    );

    const submitMovement = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/stock-movements`, movementForm);
            setMovementForm(initialMovement);
            setModal('');
            setMessage('Stock movement recorded.');
            await fetchInventory({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not record stock movement.'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitRequest = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/stock-requests`, {
                title: requestForm.title,
                reason: requestForm.reason,
                district: requestForm.district,
                destination: requestForm.destination,
                items: [
                    {
                        item_id: requestForm.item_id,
                        quantity_requested: requestForm.quantity_requested,
                    },
                ],
            });
            setRequestForm(initialRequest);
            setModal('');
            setMessage('Stock request submitted.');
            await fetchInventory({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not submit stock request.'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitItem = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/inventory-items`, itemForm);
            setItemForm(initialItem);
            setModal('');
            setMessage('Inventory item added.');
            await fetchInventory({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not add inventory item.'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitDelivery = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/delivery-notes`, {
                ...deliveryForm,
                create_stock_in: true,
                items: [{ item_id: deliveryForm.item_id, quantity: deliveryForm.quantity }],
            });
            setDeliveryForm(initialDelivery);
            setModal('');
            setMessage('Delivery note verified and stock-in recorded.');
            await fetchInventory({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not process delivery note.'));
        } finally {
            setSubmitting(false);
        }
    };

    const actionRequest = async (requestId, action) => {
        setError('');
        try {
            await axios.patch(`${API_BASE}/operations/stock-requests/${requestId}`, { action });
            setMessage(`Stock request ${action === 'issue' ? 'issued' : `${action}d`}.`);
            await fetchInventory({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not action stock request.'));
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Inventory Operations"
                subtitle="Movement-based stock control for procurement, distribution, activities, and logistics."
                actions={
                    <div className="governance-toolbar">
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchInventory({ silent: true })} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal('request')}>
                            <Send size={14} />
                            Request Stock
                        </button>
                        {manager && (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => setModal('delivery')}>
                                    <FileCheck2 size={14} />
                                    Delivery Note
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setModal('movement')}>
                                    <Plus size={14} />
                                    Movement
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
                    <div className="domain-kicker">Operational Logistics Intelligence</div>
                    <h2>Stock balances are calculated from traceable movements.</h2>
                    <p>
                        Inventory now records why stock changed, where it came from, where it went, who approved it, and what evidence supports the transaction.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Low Stock Alerts</div>
                    <div className="hero-control-value">{formatNumber(data.metrics.low_stock_count)}</div>
                    <p>{formatNumber(data.metrics.pending_request_count)} pending issue request{Number(data.metrics.pending_request_count || 0) === 1 ? '' : 's'} in the storekeeper queue.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={Warehouse} label="Inventory Items" value={formatNumber(data.metrics.total_items)} note="Active stock master records" />
                <MetricCard icon={AlertTriangle} tone="warning" label="Below Threshold" value={formatNumber(data.metrics.low_stock_count)} note="Available balance at or below minimum" />
                <MetricCard icon={PackageCheck} tone="success" label="Stock In" value={formatNumber(data.metrics.stock_in_30_days, { maximumFractionDigits: 1 })} note="Movement quantity in the last 30 days" />
                <MetricCard icon={Boxes} tone="info" label="Stock Out" value={formatNumber(data.metrics.stock_out_30_days, { maximumFractionDigits: 1 })} note="Issued quantity in the last 30 days" />
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Current Stock</h2>
                            <p className="panel-subtitle">Balances are derived from stock-in and stock-out records.</p>
                        </div>
                        {manager && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal('item')}>
                                <Plus size={14} />
                                Item
                            </button>
                        )}
                    </div>
                    {data.items.length === 0 ? (
                        <EmptyState icon={Warehouse} title="No inventory items yet" text="Create stock master records before recording movements." />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Available</th>
                                        <th>Reserved</th>
                                        <th>Minimum</th>
                                        <th>Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.slice(0, 12).map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{item.name}</div>
                                                <div className="form-hint">{item.category} / {item.unit}</div>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${Number(item.available_quantity) <= Number(item.minimum_threshold) ? 'warning' : 'success'}`}>
                                                    {formatNumber(item.available_quantity, { maximumFractionDigits: 1 })}
                                                </span>
                                            </td>
                                            <td>{formatNumber(item.reserved_quantity, { maximumFractionDigits: 1 })}</td>
                                            <td>{formatNumber(item.minimum_threshold, { maximumFractionDigits: 1 })}</td>
                                            <td>{item.storage_location || 'Unassigned'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Stock Requests</h2>
                            <p className="panel-subtitle">Field teams request stock before inventory is reduced.</p>
                        </div>
                    </div>
                    {pendingRequests.length === 0 ? (
                        <EmptyState icon={ClipboardCheck} title="No pending stock requests" />
                    ) : (
                        <div className="control-stack compact">
                            {pendingRequests.slice(0, 8).map((request) => (
                                <div className="control-row static" key={request.id}>
                                    <div>
                                        <div className="control-title">{request.title}</div>
                                        <div className="control-copy">
                                            {request.request_number} / {request.requester_name || 'Unknown'} / {formatDate(request.created_at)}
                                        </div>
                                        <div className="form-hint">
                                            {(request.items || []).map((item) => `${formatNumber(item.quantity_requested)} ${item.item_name}`).join(', ')}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <span className={`badge badge-${badgeTone(request.status)}`}>{formatStatus(request.status)}</span>
                                        {manager && request.status === 'submitted' && (
                                            <button className="btn btn-secondary btn-sm" onClick={() => actionRequest(request.id, 'approve')}>Approve</button>
                                        )}
                                        {manager && request.status === 'approved' && (
                                            <button className="btn btn-primary btn-sm" onClick={() => actionRequest(request.id, 'issue')}>Issue</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Recent Movements</h2>
                            <p className="panel-subtitle">Every stock change has a type, direction, quantity, source, and destination.</p>
                        </div>
                    </div>
                    {data.movements.length === 0 ? (
                        <EmptyState icon={Boxes} title="No stock movements recorded" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Item</th>
                                        <th>Movement</th>
                                        <th>Quantity</th>
                                        <th>Route</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.movements.slice(0, 10).map((movement) => (
                                        <tr key={movement.id}>
                                            <td>{formatDate(movement.movement_date)}</td>
                                            <td>{movement.item_name}</td>
                                            <td>
                                                <span className={`badge badge-${movement.movement_direction === 'in' ? 'success' : movement.movement_direction === 'out' ? 'warning' : 'info'}`}>
                                                    {formatStatus(movement.movement_type)}
                                                </span>
                                            </td>
                                            <td>{movement.movement_direction === 'out' ? '-' : '+'}{formatNumber(movement.quantity, { maximumFractionDigits: 1 })} {movement.item_unit}</td>
                                            <td>{movement.source || 'Source'} to {movement.destination || 'Destination'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Delivery Notes</h2>
                            <p className="panel-subtitle">Verified deliveries can generate stock-in transactions.</p>
                        </div>
                    </div>
                    {data.delivery_notes.length === 0 ? (
                        <EmptyState icon={FileCheck2} title="No delivery notes captured" />
                    ) : (
                        <div className="control-stack compact">
                            {data.delivery_notes.slice(0, 8).map((note) => (
                                <div className="control-row static" key={note.id}>
                                    <div>
                                        <div className="control-title">{note.reference_number}</div>
                                        <div className="control-copy">{note.supplier || 'Supplier not set'} / {formatDate(note.delivery_date)}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className={`badge badge-${badgeTone(note.status)}`}>{formatStatus(note.status)}</span>
                                        <div className="form-hint">{note.movement_count || 0} movement records</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {modal && (
                <div className="modal-overlay" onMouseDown={() => setModal('')}>
                    <div className="modal-box lg" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {modal === 'movement' && 'Record Stock Movement'}
                                {modal === 'request' && 'Request Stock'}
                                {modal === 'item' && 'Add Inventory Item'}
                                {modal === 'delivery' && 'Verify Delivery Note'}
                            </h3>
                            <button className="modal-close" onClick={() => setModal('')}>x</button>
                        </div>
                        {modal === 'movement' && (
                            <form onSubmit={submitMovement}>
                                <div className="modal-body form-grid">
                                    <label className="form-field">
                                        <span>Item</span>
                                        <select className="form-input" value={movementForm.item_id} onChange={(event) => setMovementForm({ ...movementForm, item_id: event.target.value })} required>
                                            <option value="">Select item</option>
                                            {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Direction</span>
                                        <select className="form-input" value={movementForm.movement_direction} onChange={(event) => setMovementForm({ ...movementForm, movement_direction: event.target.value })}>
                                            <option value="in">Stock In</option>
                                            <option value="out">Stock Out</option>
                                            <option value="reserve">Reserve</option>
                                            <option value="release">Release Reservation</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Type</span>
                                        <select className="form-input" value={movementForm.movement_type} onChange={(event) => setMovementForm({ ...movementForm, movement_type: event.target.value })}>
                                            <option value="procurement">Procurement</option>
                                            <option value="donation">Donation</option>
                                            <option value="return">Return</option>
                                            <option value="transfer">Transfer</option>
                                            <option value="activity_distribution">Activity Distribution</option>
                                            <option value="damage_loss">Damage/Loss</option>
                                            <option value="expiry">Expiry</option>
                                            <option value="challenge_course_usage">Challenge Course Usage</option>
                                            <option value="physical_count_adjustment">Physical Count Adjustment</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Quantity</span>
                                        <input className="form-input" type="number" min="0.01" step="0.01" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Source</span>
                                        <input className="form-input" value={movementForm.source} onChange={(event) => setMovementForm({ ...movementForm, source: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Destination</span>
                                        <input className="form-input" value={movementForm.destination} onChange={(event) => setMovementForm({ ...movementForm, destination: event.target.value })} />
                                    </label>
                                    <label className="form-field full">
                                        <span>Delivery Note Reference</span>
                                        <input className="form-input" value={movementForm.delivery_note_reference} onChange={(event) => setMovementForm({ ...movementForm, delivery_note_reference: event.target.value })} />
                                    </label>
                                    <label className="form-field full">
                                        <span>Remarks</span>
                                        <textarea className="form-input" value={movementForm.remarks} onChange={(event) => setMovementForm({ ...movementForm, remarks: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Movement'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'request' && (
                            <form onSubmit={submitRequest}>
                                <div className="modal-body form-grid">
                                    <label className="form-field full">
                                        <span>Request Title</span>
                                        <input className="form-input" value={requestForm.title} onChange={(event) => setRequestForm({ ...requestForm, title: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Item</span>
                                        <select className="form-input" value={requestForm.item_id} onChange={(event) => setRequestForm({ ...requestForm, item_id: event.target.value })} required>
                                            <option value="">Select item</option>
                                            {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Quantity</span>
                                        <input className="form-input" type="number" min="0.01" step="0.01" value={requestForm.quantity_requested} onChange={(event) => setRequestForm({ ...requestForm, quantity_requested: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>District</span>
                                        <input className="form-input" value={requestForm.district} onChange={(event) => setRequestForm({ ...requestForm, district: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Destination</span>
                                        <input className="form-input" value={requestForm.destination} onChange={(event) => setRequestForm({ ...requestForm, destination: event.target.value })} />
                                    </label>
                                    <label className="form-field full">
                                        <span>Reason</span>
                                        <textarea className="form-input" value={requestForm.reason} onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'item' && (
                            <form onSubmit={submitItem}>
                                <div className="modal-body form-grid">
                                    <label className="form-field full">
                                        <span>Item Name</span>
                                        <input className="form-input" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Category</span>
                                        <input className="form-input" value={itemForm.category} onChange={(event) => setItemForm({ ...itemForm, category: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Unit</span>
                                        <input className="form-input" value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Minimum Threshold</span>
                                        <input className="form-input" type="number" min="0" step="0.01" value={itemForm.minimum_threshold} onChange={(event) => setItemForm({ ...itemForm, minimum_threshold: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Storage Location</span>
                                        <input className="form-input" value={itemForm.storage_location} onChange={(event) => setItemForm({ ...itemForm, storage_location: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Add Item'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'delivery' && (
                            <form onSubmit={submitDelivery}>
                                <div className="modal-body form-grid">
                                    <label className="form-field">
                                        <span>Supplier</span>
                                        <input className="form-input" value={deliveryForm.supplier} onChange={(event) => setDeliveryForm({ ...deliveryForm, supplier: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Delivery Note Number</span>
                                        <input className="form-input" value={deliveryForm.reference_number} onChange={(event) => setDeliveryForm({ ...deliveryForm, reference_number: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Item</span>
                                        <select className="form-input" value={deliveryForm.item_id} onChange={(event) => setDeliveryForm({ ...deliveryForm, item_id: event.target.value })} required>
                                            <option value="">Select item</option>
                                            {itemOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Quantity Received</span>
                                        <input className="form-input" type="number" min="0.01" step="0.01" value={deliveryForm.quantity} onChange={(event) => setDeliveryForm({ ...deliveryForm, quantity: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Condition</span>
                                        <select className="form-input" value={deliveryForm.condition_status} onChange={(event) => setDeliveryForm({ ...deliveryForm, condition_status: event.target.value })}>
                                            <option value="good">Good</option>
                                            <option value="damaged">Damaged</option>
                                            <option value="partial">Partial</option>
                                            <option value="rejected">Rejected</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Destination</span>
                                        <input className="form-input" value={deliveryForm.destination} onChange={(event) => setDeliveryForm({ ...deliveryForm, destination: event.target.value })} />
                                    </label>
                                    <label className="form-field full">
                                        <span>Remarks</span>
                                        <textarea className="form-input" value={deliveryForm.remarks} onChange={(event) => setDeliveryForm({ ...deliveryForm, remarks: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Verify Delivery'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
