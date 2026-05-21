import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    ChevronLeft,
    Plus,
    Trash2,
    DollarSign,
    FileText,
    CheckCircle,
    AlertCircle,
    Info,
    Calendar,
    MapPin,
    Layers,
    Target
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const BUDGET_CATEGORIES = [
    { value: 'personnel', label: 'Personnel' },
    { value: 'transport', label: 'Transport / Travel' },
    { value: 'refreshments', label: 'Refreshments & Catering' },
    { value: 'training_materials', label: 'Training Materials' },
    { value: 'branding', label: 'Branding' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'venue', label: 'Venue Hire' },
    { value: 'procurement', label: 'Procurement' },
    { value: 'other', label: 'Other / Contingency' },
];

export default function FundingRequestWizardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Data lists from DB
    const [projects, setProjects] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Wizard step state
    const [currentStep, setCurrentStep] = useState(1); // Steps 1 to 5

    // Form states
    const [project_id, setProjectId] = useState('');
    const [program_id, setProgramId] = useState('');
    const [indicator_id, setIndicatorId] = useState('');
    const [district_code, setDistrictCode] = useState('');
    const [district_name, setDistrictName] = useState('');
    const [activity_name, setActivityName] = useState('');
    const [narrative_justification, setNarrativeJustification] = useState('');
    
    // Dynamic budget table state
    const [items, setItems] = useState([
        { description: '', category: 'other', quantity: 1, unit_cost: 0 }
    ]);

    // Receipt or Quotient Attachment
    const [attachment, setAttachment] = useState(null);

    useEffect(() => {
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        setLoading(true);
        try {
            const [projRes, progRes, indRes] = await Promise.all([
                axios.get(`${API_BASE}/projects`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/programs`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } })
            ]);
            setProjects(projRes.data || []);
            setPrograms(progRes.data || []);
            setIndicators(indRes.data || []);
        } catch (error) {
            console.error('Failed to load wizard metadata', error);
            setErrorMsg('Failed to load projects, programs, or indicators from the database.');
        } finally {
            setLoading(false);
        }
    };

    // Filter indicators based on selected project
    const filteredIndicators = indicators.filter(
        ind => !project_id || String(ind.project_id) === String(project_id)
    );

    // Filter programs or auto-select program when project changes
    const handleProjectChange = (projId) => {
        setProjectId(projId);
        setIndicatorId(''); // Reset selected indicator
        const selectedProj = projects.find(p => String(p.id) === String(projId));
        if (selectedProj && selectedProj.program_id) {
            setProgramId(selectedProj.program_id);
        }
    };

    // Budget Calculations
    const handleItemChange = (index, field, value) => {
        const updated = [...items];
        if (field === 'quantity') {
            updated[index].quantity = Math.max(1, Number(value || 0));
        } else if (field === 'unit_cost') {
            updated[index].unit_cost = Math.max(0, parseFloat(value || 0));
        } else {
            updated[index][field] = value;
        }
        setItems(updated);
    };

    const addItemRow = () => {
        setItems([...items, { description: '', category: 'other', quantity: 1, unit_cost: 0 }]);
    };

    const deleteItemRow = (index) => {
        if (items.length === 1) return; // Keep at least one row
        setItems(items.filter((_, idx) => idx !== index));
    };

    const grandTotal = items.reduce((acc, curr) => acc + (curr.quantity * curr.unit_cost), 0);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setAttachment(e.target.files[0]);
        }
    };

    // Form Validations
    const validateStep = (step) => {
        setErrorMsg('');
        if (step === 1) {
            if (!project_id) return 'Please select a project.';
            if (!program_id) return 'Please select a program.';
            if (!activity_name.trim()) return 'Please enter an activity name.';
            if (!district_name.trim() || !district_code.trim()) return 'District details are required.';
        }
        if (step === 2) {
            if (items.some(item => !item.description.trim())) {
                return 'Please provide descriptions for all budget line items.';
            }
            if (grandTotal <= 0) {
                return 'Grand total request must be greater than zero.';
            }
        }
        if (step === 3) {
            if (!narrative_justification.trim() || narrative_justification.trim().length < 20) {
                return 'Narrative justification is required and should be at least 20 characters.';
            }
        }
        return '';
    };

    const nextStep = () => {
        const error = validateStep(currentStep);
        if (error) {
            setErrorMsg(error);
            return;
        }
        setCurrentStep(prev => Math.min(prev + 1, 5));
    };

    const prevStep = () => {
        setErrorMsg('');
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const saveAsDraft = async () => {
        setSaving(true);
        setErrorMsg('');
        try {
            await axios.post(`${API_BASE}/funding-requests`, {
                project_id: project_id ? Number(project_id) : null,
                program_id: program_id ? Number(program_id) : null,
                indicator_id: indicator_id ? Number(indicator_id) : null,
                district_code,
                district_name,
                activity_name,
                narrative_justification,
                items,
                submit: false // Saves strictly as draft in the database
            });
            alert('Draft saved successfully!');
            navigate('/submissions');
        } catch (error) {
            setErrorMsg(error.response?.data?.error || 'Failed to save draft funding request');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg('');
        try {
            await axios.post(`${API_BASE}/funding-requests`, {
                project_id: Number(project_id),
                program_id: Number(program_id),
                indicator_id: indicator_id ? Number(indicator_id) : null,
                district_code,
                district_name,
                activity_name,
                narrative_justification,
                items,
                submit: true // Triggers governance state machine transitions immediately
            });
            alert('Request for Funds submitted successfully!');
            navigate('/submissions');
        } catch (error) {
            setErrorMsg(error.response?.data?.error || 'Failed to submit funding request');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;

    const selectedProjName = projects.find(p => String(p.id) === String(project_id))?.name || 'N/A';
    const selectedProgName = programs.find(p => String(p.id) === String(program_id))?.name || 'N/A';
    const selectedIndName = indicators.find(i => String(i.id) === String(indicator_id))?.title || 'N/A';

    return (
        <div className="fade-in">
            <PageHeader
                title="New Request for Funds (RFF)"
                subtitle="Complete the guided digital operational wizard to secure activity disbursements."
            />

            {/* Step Progress Tracker */}
            <div className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '15px', left: '20px', right: '20px', height: '3px', background: 'var(--border)', zIndex: 1 }}>
                        <div style={{ width: `${((currentStep - 1) / 4) * 100}%`, height: '100%', background: 'var(--brand-primary)', transition: 'width 0.3s ease' }} />
                    </div>

                    {[1, 2, 3, 4, 5].map((step) => {
                        const isCompleted = step < currentStep;
                        const isActive = step === currentStep;
                        return (
                            <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: isCompleted ? 'var(--brand-success)' : isActive ? 'var(--brand-primary)' : 'var(--border)',
                                    color: isCompleted || isActive ? '#fff' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    boxShadow: isActive ? '0 0 0 4px rgba(27, 77, 62, 0.2)' : 'none',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {step}
                                </div>
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'var(--brand-primary)' : 'var(--text-muted)',
                                    marginTop: '8px',
                                    textAlign: 'center'
                                }}>
                                    {step === 1 && 'Activity Selection'}
                                    {step === 2 && 'Budget Grid'}
                                    {step === 3 && 'Justification'}
                                    {step === 4 && 'Preview Sheet'}
                                    {step === 5 && 'Submit'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {errorMsg && (
                <div className="surface-muted" style={{ borderColor: 'rgba(180, 35, 24, 0.28)', background: 'rgba(180, 35, 24, 0.08)', marginBottom: '20px', padding: '16px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--brand-danger)' }}>
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 600 }}>{errorMsg}</span>
                    </div>
                </div>
            )}

            {/* STEP 1: ACTIVITY SELECTION */}
            {currentStep === 1 && (
                <div className="panel" style={{ padding: '24px' }}>
                    <div className="panel-header" style={{ marginBottom: '20px' }}>
                        <h2 className="panel-title">Step 1 — Activity Selection & District Context</h2>
                        <p className="panel-subtitle">Link your request for funds to an approved project, program, and active indicator target.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label"><Layers size={14} style={{ marginRight: '4px' }} /> Project Name</label>
                            <select className="form-input" value={project_id} onChange={e => handleProjectChange(e.target.value)}>
                                <option value="">Select Associated Project...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label"><Layers size={14} style={{ marginRight: '4px' }} /> Program Context</label>
                            <select className="form-input" value={program_id} onChange={e => setProgramId(e.target.value)} disabled={!!project_id}>
                                <option value="">Select Associated Program...</option>
                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <p className="form-hint">Automatically selected based on project scope</p>
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label"><Target size={14} style={{ marginRight: '4px' }} /> Strategic Indicator</label>
                            <select className="form-input" value={indicator_id} onChange={e => setIndicatorId(e.target.value)}>
                                <option value="">Select Indicator Target (Optional)...</option>
                                {filteredIndicators.map(i => <option key={i.id} value={i.id}>{i.title} (Target: {i.target_value})</option>)}
                            </select>
                        </div>

                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Activity Name / Description Title</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Conduct Youth Peer Educator Refresher Workshop in Harare South"
                                value={activity_name}
                                onChange={e => setActivityName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label"><MapPin size={14} style={{ marginRight: '4px' }} /> District Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Harare South"
                                value={district_name}
                                onChange={e => setDistrictName(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label"><MapPin size={14} style={{ marginRight: '4px' }} /> District Code</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. ZW-HRE-01"
                                value={district_code}
                                onChange={e => setDistrictCode(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 2: DYNAMIC BUDGET GRID */}
            {currentStep === 2 && (
                <div className="panel" style={{ padding: '24px' }}>
                    <div className="panel-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 className="panel-title">Step 2 — Itemized Activity Budget Breakdown</h2>
                            <p className="panel-subtitle">Define exact line items, categorize operational elements, and specify cost parameters.</p>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={addItemRow}>
                            <Plus size={16} /> Add Budget Item
                        </button>
                    </div>

                    <div className="data-table-wrap" style={{ overflowX: 'auto', marginBottom: '20px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40%' }}>Line Item Description</th>
                                    <th style={{ width: '25%' }}>Category Classification</th>
                                    <th style={{ width: '12%', textAlign: 'right' }}>Quantity</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Unit Cost (USD)</th>
                                    <th style={{ width: '15%', textAlign: 'right' }}>Subtotal (USD)</th>
                                    <th style={{ width: '8%', textAlign: 'center' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <input
                                                type="text"
                                                className="form-input"
                                                style={{ margin: 0, height: '36px' }}
                                                placeholder="e.g. Refreshments for 30 peer educators"
                                                value={item.description}
                                                onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                className="form-input"
                                                style={{ margin: 0, height: '36px' }}
                                                value={item.category}
                                                onChange={e => handleItemChange(idx, 'category', e.target.value)}
                                            >
                                                {BUDGET_CATEGORIES.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ margin: 0, height: '36px', textAlign: 'right' }}
                                                min="1"
                                                value={item.quantity}
                                                onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                                            />
                                        </td>
                                        <td>
                                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                <DollarSign size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ margin: 0, height: '36px', paddingLeft: '20px', textAlign: 'right' }}
                                                    min="0"
                                                    step="0.01"
                                                    value={item.unit_cost}
                                                    onChange={e => handleItemChange(idx, 'unit_cost', e.target.value)}
                                                />
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--brand-primary)', verticalAlign: 'middle' }}>
                                            ${(item.quantity * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                            <button
                                                className="btn btn-ghost btn-sm text-danger"
                                                disabled={items.length === 1}
                                                onClick={() => deleteItemRow(idx)}
                                                style={{ padding: '6px' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px', background: 'var(--surface-sunken)', borderRadius: '8px' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Grand Total Requested:</div>
                            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--brand-primary)' }}>
                                ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: NARRATIVE JUSTIFICATION & UPLOADS */}
            {currentStep === 3 && (
                <div className="panel" style={{ padding: '24px' }}>
                    <div className="panel-header" style={{ marginBottom: '20px' }}>
                        <h2 className="panel-title">Step 3 — Narrative Justification & Support Attachments</h2>
                        <p className="panel-subtitle">Provide details regarding operational necessity, background information, and attach cost quotations.</p>
                    </div>

                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">Narrative Justification & Activity Outcome Goals</label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '160px', padding: '16px', lineHeight: '1.6' }}
                                placeholder="Explain why these funds are necessary, who the participants are, and what the expected outcomes or performance indicator impacts will be..."
                                value={narrative_justification}
                                onChange={e => setNarrativeJustification(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Attach Supporting Quotations / Activity Guidelines (PDF / Images)</label>
                            <input
                                type="file"
                                className="form-input"
                                onChange={handleFileChange}
                            />
                            <p className="form-hint"><Info size={12} /> Standard invoices, venue layouts, or facilitation manuals are recommended.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: PRINTABLE RFF PREVIEW */}
            {currentStep === 4 && (
                <div className="panel" style={{ padding: '24px' }}>
                    <div className="panel-header" style={{ marginBottom: '20px' }}>
                        <h2 className="panel-title">Step 4 — Printable RFF Document Preview</h2>
                        <p className="panel-subtitle">Review the exact format of the PDF invoice that will be compiled on approval.</p>
                    </div>

                    <div style={{
                        border: '1px solid var(--border)',
                        background: '#fff',
                        color: '#1a202c',
                        padding: '40px',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        maxWidth: '800px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        fontFamily: 'Outfit, Inter, sans-serif'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #1b4d3e', paddingBottom: '20px', marginBottom: '20px' }}>
                            <div>
                                <h1 style={{ color: '#1b4d3e', margin: 0, fontSize: '22px', fontWeight: 800 }}>MMPZ OPERATIONS ERP</h1>
                                <p style={{ margin: '4px 0 0', color: '#718096', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                                    Monitoring & Evaluation Fund Disbursal
                                </p>
                            </div>
                            <div style={{ background: '#e6fffa', color: '#319795', border: '1px solid #b2f5ea', borderRadius: '4px', padding: '6px 12px', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', alignSelf: 'center' }}>
                                Request For Funds
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '16px', marginBottom: '24px', fontSize: '13px' }}>
                            <div><strong>Activity Title:</strong> <span style={{ color: '#2d3748' }}>{activity_name || 'N/A'}</span></div>
                            <div><strong>Submitter:</strong> <span style={{ color: '#2d3748' }}>{user.name} ({user.role_code})</span></div>
                            <div><strong>Project Link:</strong> <span style={{ color: '#2d3748' }}>{selectedProjName}</span></div>
                            <div><strong>Program Link:</strong> <span style={{ color: '#2d3748' }}>{selectedProgName}</span></div>
                            <div><strong>District Scope:</strong> <span style={{ color: '#2d3748' }}>{district_name} ({district_code})</span></div>
                            <div><strong>Indicator Reference:</strong> <span style={{ color: '#2d3748' }}>{selectedIndName}</span></div>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1b4d3e', marginBottom: '8px' }}>
                            Activity Justification:
                        </div>
                        <div style={{ background: '#fcfcfc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', fontStyle: 'italic', fontSize: '13px', color: '#4a5568', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
                            {narrative_justification || 'No justification provided.'}
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: '#1b4d3e', marginBottom: '8px' }}>
                            Itemized Disbursal Budget:
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ background: '#1b4d3e', color: '#fff' }}>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Category</th>
                                    <th style={{ textAlign: 'right', padding: '8px' }}>Qty</th>
                                    <th style={{ textAlign: 'right', padding: '8px' }}>Unit Cost</th>
                                    <th style={{ textAlign: 'right', padding: '8px' }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '8px' }}>{item.description || 'Budget Item'}</td>
                                        <td style={{ padding: '8px', textTransform: 'uppercase', fontSize: '10px' }}><span style={{ background: '#edf2f7', padding: '2px 4px', borderRadius: '4px' }}>{item.category}</span></td>
                                        <td style={{ textAlign: 'right', padding: '8px' }}>{item.quantity}</td>
                                        <td style={{ textAlign: 'right', padding: '8px' }}>${Number(item.unit_cost).toFixed(2)}</td>
                                        <td style={{ textAlign: 'right', padding: '8px', fontWeight: 600 }}>${(item.quantity * item.unit_cost).toFixed(2)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#f7fafc', fontWeight: 'bold', borderTop: '2px solid #1b4d3e', fontSize: '14px' }}>
                                    <td colspan="4" style={{ textAlign: 'right', padding: '10px' }}>Grand Total requested (USD):</td>
                                    <td style={{ textAlign: 'right', padding: '10px', color: '#1b4d3e' }}>${grandTotal.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* STEP 5: SUBMIT & SAVE OPTIONS */}
            {currentStep === 5 && (
                <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                        <div style={{ color: 'var(--brand-success)', marginBottom: '20px' }}>
                            <CheckCircle size={64} style={{ margin: '0 auto' }} />
                        </div>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Wizard Verification Complete!</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                            Your Request for Funds package totaling <strong>${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> is ready. 
                            You can choose to save it as a local draft or submit it directly to begin governance signature routing.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                                onClick={handleSubmit}
                                disabled={saving}
                            >
                                {saving ? 'Submitting request...' : 'Submit to Governance Queue'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                                onClick={saveAsDraft}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Draft Locally'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', marginBottom: '40px' }}>
                <button
                    className="btn btn-secondary"
                    onClick={prevStep}
                    disabled={currentStep === 1 || saving}
                >
                    <ChevronLeft size={16} /> Previous Step
                </button>

                {currentStep < 5 ? (
                    <button className="btn btn-primary" onClick={nextStep}>
                        Next Step <ChevronRight size={16} />
                    </button>
                ) : null}
            </div>
        </div>
    );
}
