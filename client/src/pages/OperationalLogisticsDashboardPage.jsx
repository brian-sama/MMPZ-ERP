import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    Boxes,
    ClipboardCheck,
    FileCheck2,
    FileWarning,
    PackageCheck,
    RefreshCw,
    ShieldCheck,
    Truck,
    Car,
    WalletCards,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
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

const asList = (value) => (Array.isArray(value) ? value : []);

function AccessProfilePanel({ profile }) {
    if (!profile) return null;

    const functionalAccess = asList(profile.functional_access);
    const restrictions = asList(profile.restrictions);
    const operationalScope = profile.operational_scope || {};
    const approvalScope = profile.approval_scope || {};

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2 className="panel-title">Structured Access Profile</h2>
                    <p className="panel-subtitle">Five-layer access model for this operational role.</p>
                </div>
                <span className={`badge badge-${badgeTone(profile.sensitivity_clearance)}`}>
                    {formatStatus(profile.sensitivity_clearance)}
                </span>
            </div>
            <div className="access-profile-grid">
                <div className="surface-muted">
                    <h3>Organizational</h3>
                    <p>{profile.organizational_unit || 'Not assigned'}</p>
                </div>
                <div className="surface-muted">
                    <h3>Functional</h3>
                    <p>{functionalAccess.slice(0, 8).map(formatStatus).join(', ') || 'Not assigned'}</p>
                </div>
                <div className="surface-muted">
                    <h3>Sensitivity</h3>
                    <p>{formatStatus(profile.sensitivity_clearance || 'internal')}</p>
                </div>
                <div className="surface-muted">
                    <h3>Operational</h3>
                    <p>
                        Districts: {formatStatus(operationalScope.districts || 'assigned')}<br />
                        Activities: {formatStatus(operationalScope.activities || 'logistics_related')}
                    </p>
                </div>
                <div className="surface-muted">
                    <h3>Approval</h3>
                    <p>
                        Minor stock: {approvalScope.minor_stock_issuance ? 'Allowed' : 'No'}<br />
                        Delivery verification: {approvalScope.delivery_verification ? 'Allowed' : 'No'}<br />
                        Major procurement: {approvalScope.major_procurement ? 'Allowed' : 'No'}
                    </p>
                </div>
            </div>
            {restrictions.length > 0 && (
                <div className="access-restriction-strip">
                    {restrictions.slice(0, 6).map((restriction) => (
                        <span className="badge badge-muted" key={restriction}>{formatStatus(restriction)}</span>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function OperationalLogisticsDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState({
        metrics: {},
        pending_deliveries: [],
        low_stock: [],
        asset_returns_due: [],
        procurement_evidence_gaps: [],
        pending_store_requests: [],
        vehicle_availability: [],
        challenge_course_equipment: [],
        pending_liquidations: [],
        upcoming_activity_logistics: [],
        access_profile: null,
    });

    const fetchDashboard = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/operations/logistics-dashboard`);
            setData({
                metrics: res.data?.metrics || {},
                pending_deliveries: Array.isArray(res.data?.pending_deliveries) ? res.data.pending_deliveries : [],
                low_stock: Array.isArray(res.data?.low_stock) ? res.data.low_stock : [],
                asset_returns_due: Array.isArray(res.data?.asset_returns_due) ? res.data.asset_returns_due : [],
                procurement_evidence_gaps: Array.isArray(res.data?.procurement_evidence_gaps) ? res.data.procurement_evidence_gaps : [],
                pending_store_requests: Array.isArray(res.data?.pending_store_requests) ? res.data.pending_store_requests : [],
                vehicle_availability: Array.isArray(res.data?.vehicle_availability) ? res.data.vehicle_availability : [],
                challenge_course_equipment: Array.isArray(res.data?.challenge_course_equipment) ? res.data.challenge_course_equipment : [],
                pending_liquidations: Array.isArray(res.data?.pending_liquidations) ? res.data.pending_liquidations : [],
                upcoming_activity_logistics: Array.isArray(res.data?.upcoming_activity_logistics) ? res.data.upcoming_activity_logistics : [],
                access_profile: res.data?.access_profile || null,
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Operational logistics dashboard is unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Operational Logistics Dashboard"
                subtitle="Stock, deliveries, procurement logistics, assets, vehicles, store requests, Challenge Course equipment, and activity logistics."
                actions={
                    <button className="btn btn-secondary btn-sm" onClick={() => fetchDashboard({ silent: true })} disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                        Refresh
                    </button>
                }
            />

            {error && <div className="page-message error">{error}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Operational Backbone</div>
                    <h2>Physical operations, inventory, procurement logistics, and distribution now have a dedicated nerve center.</h2>
                    <p>
                        This dashboard keeps operational control close to stock, assets, delivery notes, vehicles, Challenge Course equipment, procurement logistics, and upcoming field deployments without exposing governance records, HR files, or sensitive beneficiary data.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Access Boundary</div>
                    <div className="hero-control-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldCheck size={28} />
                        Internal
                    </div>
                    <p>No governance records, HR files, board documents, counselling notes, viral load records, or safeguarding files are included here.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={Truck} label="Pending Deliveries" value={formatNumber(data.metrics.pending_delivery_count)} note="Awaiting verification" />
                <MetricCard icon={AlertTriangle} tone="warning" label="Low Stock Alerts" value={formatNumber(data.metrics.low_stock_count)} note="At or below threshold" />
                <MetricCard icon={ClipboardCheck} tone="info" label="Store Requests" value={formatNumber(data.metrics.pending_store_request_count)} note="Awaiting issue or closeout" />
                <MetricCard icon={PackageCheck} tone="warning" label="Asset Returns Due" value={formatNumber(data.metrics.asset_returns_due_7_days)} note={`${formatNumber(data.metrics.overdue_asset_return_count)} overdue`} />
                <MetricCard icon={Car} tone="success" label="Available Vehicles" value={formatNumber(data.metrics.available_vehicle_count)} note={`${formatNumber(data.metrics.vehicle_attention_count)} needing attention`} />
                <MetricCard icon={FileWarning} tone="info" label="Procurement Deliveries" value={formatNumber(data.metrics.pending_procurement_upload_count)} note="Missing delivery, receipt, or supplier evidence" />
                <MetricCard icon={Boxes} tone="warning" label="Course Equipment" value={formatNumber(data.metrics.challenge_equipment_attention_count)} note="Below threshold or unavailable" />
            </div>

            <AccessProfilePanel profile={data.access_profile} />

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Deliveries</h2>
                            <p className="panel-subtitle">Supplier deliveries needing verification and stock-in closeout.</p>
                        </div>
                    </div>
                    {data.pending_deliveries.length === 0 ? (
                        <EmptyState icon={Truck} title="No deliveries pending verification" />
                    ) : (
                        <div className="control-stack compact">
                            {data.pending_deliveries.map((delivery) => (
                                <div className="control-row static" key={delivery.id}>
                                    <div>
                                        <div className="control-title">{delivery.reference_number}</div>
                                        <div className="control-copy">{delivery.supplier || 'Supplier not set'} / {formatDate(delivery.delivery_date)}</div>
                                        <div className="form-hint">{delivery.procurement_title || 'No procurement link'}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(delivery.condition_status)}`}>{formatStatus(delivery.condition_status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Low Stock Alerts</h2>
                            <p className="panel-subtitle">Operational materials below minimum threshold.</p>
                        </div>
                    </div>
                    {data.low_stock.length === 0 ? (
                        <EmptyState icon={Boxes} title="No low stock alerts" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th>Available</th>
                                        <th>Minimum</th>
                                        <th>Location</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.low_stock.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{item.name}</div>
                                                <div className="form-hint">{item.category}</div>
                                            </td>
                                            <td>{formatNumber(item.available_quantity, { maximumFractionDigits: 1 })} {item.unit}</td>
                                            <td>{formatNumber(item.minimum_threshold, { maximumFractionDigits: 1 })}</td>
                                            <td>{item.storage_location || 'Not set'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Store Requests</h2>
                            <p className="panel-subtitle">Materials awaiting issue, approval, or closeout.</p>
                        </div>
                    </div>
                    {data.pending_store_requests.length === 0 ? (
                        <EmptyState icon={ClipboardCheck} title="No pending store requests" />
                    ) : (
                        <div className="control-stack compact">
                            {data.pending_store_requests.map((request) => (
                                <div className="control-row static" key={request.id}>
                                    <div>
                                        <div className="control-title">{request.title}</div>
                                        <div className="control-copy">{request.requester_name || 'Unknown requester'} / {request.district || 'No district'}</div>
                                        <div className="form-hint">
                                            {asList(request.items).slice(0, 2).map((item) => `${formatNumber(item.quantity_requested)} ${item.unit} ${item.item_name}`).join(', ') || 'Items not listed'}
                                        </div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(request.status)}`}>{formatStatus(request.status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Vehicle Availability</h2>
                            <p className="panel-subtitle">Fleet status, insurance, service dates, and current locations.</p>
                        </div>
                    </div>
                    {data.vehicle_availability.length === 0 ? (
                        <EmptyState icon={Car} title="No vehicles registered" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Status</th>
                                        <th>Insurance</th>
                                        <th>Service</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.vehicle_availability.map((vehicle) => (
                                        <tr key={vehicle.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{vehicle.asset_name}</div>
                                                <div className="form-hint">{vehicle.registration_number} / {vehicle.current_location || 'Location not set'}</div>
                                            </td>
                                            <td><span className={`badge badge-${badgeTone(vehicle.asset_status)}`}>{formatStatus(vehicle.asset_status)}</span></td>
                                            <td>{formatDate(vehicle.insurance_expiry)}</td>
                                            <td>{formatDate(vehicle.service_due_date)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Challenge Course Equipment</h2>
                        <p className="panel-subtitle">Ropes, helmets, and safety gear availability for upcoming sessions.</p>
                    </div>
                </div>
                {data.challenge_course_equipment.length === 0 ? (
                    <EmptyState icon={Boxes} title="No Challenge Course equipment registered" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Equipment</th>
                                    <th>Status</th>
                                    <th>Condition</th>
                                    <th>Stock Link</th>
                                    <th>Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.challenge_course_equipment.map((equipment) => (
                                    <tr key={equipment.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{equipment.name}</div>
                                            <div className="form-hint">{equipment.asset_code || 'No asset tag'}</div>
                                        </td>
                                        <td><span className={`badge badge-${badgeTone(equipment.status)}`}>{formatStatus(equipment.status)}</span></td>
                                        <td>{formatStatus(equipment.condition_status)}</td>
                                        <td>{equipment.inventory_item_name ? `${formatNumber(equipment.available_quantity, { maximumFractionDigits: 1 })} ${equipment.unit}` : 'Not linked'}</td>
                                        <td>{equipment.current_location || 'Not set'}</td>
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
                            <h2 className="panel-title">Asset Returns Due</h2>
                            <p className="panel-subtitle">Open custody records that need return or inspection.</p>
                        </div>
                    </div>
                    {data.asset_returns_due.length === 0 ? (
                        <EmptyState icon={ClipboardCheck} title="No asset returns due this week" />
                    ) : (
                        <div className="control-stack compact">
                            {data.asset_returns_due.map((assignment) => (
                                <div className="control-row static" key={assignment.id}>
                                    <div>
                                        <div className="control-title">{assignment.asset_name}</div>
                                        <div className="control-copy">{assignment.asset_code} / {assignment.assigned_to_name || 'Unassigned'}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(assignment.status)}`}>Due {formatDate(assignment.expected_return_date)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Procurement Evidence Gaps</h2>
                            <p className="panel-subtitle">Records missing quotations, receipts, vouchers, or delivery evidence.</p>
                        </div>
                    </div>
                    {data.procurement_evidence_gaps.length === 0 ? (
                        <EmptyState icon={FileCheck2} title="No procurement evidence gaps" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Request</th>
                                        <th>Status</th>
                                        <th>Value</th>
                                        <th>Quotes</th>
                                        <th>Receipts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.procurement_evidence_gaps.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{item.title}</div>
                                                <div className="form-hint">{item.requester_name || 'Unknown requester'}</div>
                                            </td>
                                            <td><span className={`badge badge-${badgeTone(item.status)}`}>{formatStatus(item.status)}</span></td>
                                            <td>{formatCurrency(item.total_estimated_cost)}</td>
                                            <td>{formatNumber(item.quotation_count)}</td>
                                            <td>{formatNumber(Number(item.receipt_count || 0) + Number(item.delivery_note_count || 0))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Liquidation Documents</h2>
                            <p className="panel-subtitle">Approved activity funds that still need receipt or verification closure.</p>
                        </div>
                    </div>
                    {data.pending_liquidations.length === 0 ? (
                        <EmptyState icon={WalletCards} title="No liquidation follow-ups" />
                    ) : (
                        <div className="control-stack compact">
                            {data.pending_liquidations.map((item) => (
                                <div className="control-row static" key={item.id}>
                                    <div>
                                        <div className="control-title">{item.activity_name}</div>
                                        <div className="control-copy">{item.submitter_name || 'Unknown submitter'} / {formatCurrency(item.total_requested_amount)}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(item.liquidation_status)}`}>{formatStatus(item.liquidation_status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Upcoming Activity Logistics</h2>
                            <p className="panel-subtitle">Approved and upcoming activity records with logistics-related categories.</p>
                        </div>
                    </div>
                    {data.upcoming_activity_logistics.length === 0 ? (
                        <EmptyState icon={PackageCheck} title="No upcoming logistics activity records" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Activity</th>
                                        <th>Date</th>
                                        <th>Category</th>
                                        <th>Owner</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.upcoming_activity_logistics.map((activity) => (
                                        <tr key={activity.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{activity.description || 'Activity'}</div>
                                                <div className="form-hint">{activity.project_name || activity.program_name || 'No project'}</div>
                                            </td>
                                            <td>{formatDate(activity.activity_date)}</td>
                                            <td>{formatStatus(activity.category)}</td>
                                            <td>{activity.assigned_user_name || 'Unassigned'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
