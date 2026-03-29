import React, { useState } from 'react';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import {
    FilePieChart, Download, FileText, Table,
    Filter, Calendar, ChevronRight, BarChartHorizontal
} from 'lucide-react';

const REPORT_TEMPLATES = [
    { id: 'me_monthly', name: 'M&E Monthly Progress Report', icon: FilePieChart, desc: 'Detailed breakdown of indicator achievements vs monthly targets.' },
    { id: 'finance_utilization', name: 'Finance Utilization Report', icon: Table, desc: 'Grant burn rates and budget line availability summary.' },
    { id: 'facilitator_activity', name: 'Facilitator Field Activity', icon: FileText, desc: 'Log of all field activities and attendance for the selected period.' },
    { id: 'procurement_audit', name: 'Procurement Audit Trail', icon: BarChartHorizontal, desc: 'Full lifecycle of all purchase requests and management approvals.' }
];

export default function ReportsPage() {
    const { user } = useAuth();
    const [selectedReport, setSelectedReport] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [format, setFormat] = useState('pdf');

    const handleGenerate = async () => {
        if (!selectedReport) return;
        setGenerating(true);
        const previewWindow = format === 'pdf' ? window.open('', '_blank', 'noopener,noreferrer') : null;
        try {
            const endpoint = format === 'pdf' ? '/reports/pdf' : '/reports/excel';
            const res = await axios.get(`${API_BASE}${endpoint}`, {
                params: {
                    from: dateFrom,
                    to: dateTo,
                    type: selectedReport.id,
                    userId: user.id,
                },
                responseType: 'blob',
            });

            const blob = new Blob([res.data], {
                type:
                    res.headers['content-type'] ||
                    (format === 'pdf' ? 'text/html;charset=utf-8' : 'text/csv;charset=utf-8'),
            });
            const blobUrl = window.URL.createObjectURL(blob);

            if (format === 'pdf') {
                if (previewWindow) {
                    previewWindow.location = blobUrl;
                } else {
                    window.open(blobUrl, '_blank', 'noopener,noreferrer');
                }
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
            } else {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `report_${selectedReport.id}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(blobUrl);
            }
        } catch (err) {
            if (previewWindow) previewWindow.close();
            alert('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="System Reports"
                subtitle="Extract strategic data and operational insights for stakeholder reporting."
            />

            <div className="panels-row">
                <div className="panel" style={{ flex: '0 0 450px' }}>
                    <div className="panel-header">
                        <h2 className="panel-title">Report Templates</h2>
                    </div>
                    <div className="report-list">
                        {REPORT_TEMPLATES.map(rep => (
                            <div
                                key={rep.id}
                                className={`report-item ${selectedReport?.id === rep.id ? 'active' : ''}`}
                                onClick={() => setSelectedReport(rep)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div className="kpi-icon-wrap" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                    <rep.icon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{rep.name}</div>
                                    <div className="form-hint" style={{ fontSize: '12px' }}>{rep.desc}</div>
                                </div>
                                <ChevronRight size={18} className="text-muted" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel">
                    {selectedReport ? (
                        <div className="animate-slide-in" style={{ padding: '32px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <div className="kpi-icon-wrap" style={{ margin: '0 auto 16px', width: '64px', height: '64px', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                    <selectedReport.icon size={32} />
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedReport.name}</h2>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '8px auto' }}>{selectedReport.desc}</p>
                            </div>

                            <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label className="form-label">Select Date Range</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label className="form-label">Output Format</label>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <label style={{ flex: 1, padding: '12px', border: format === 'pdf' ? '2px solid var(--brand-primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: format === 'pdf' ? 'var(--brand-primary-light)' : 'transparent' }}>
                                            <input type="radio" name="format" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
                                            <span>PDF Document</span>
                                        </label>
                                        <label style={{ flex: 1, padding: '12px', border: format === 'excel' ? '2px solid var(--brand-primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: format === 'excel' ? 'var(--brand-primary-light)' : 'transparent' }}>
                                            <input type="radio" name="format" checked={format === 'excel'} onChange={() => setFormat('excel')} />
                                            <span>Excel Spreadsheet</span>
                                        </label>
                                    </div>
                                </div>

                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', padding: '12px', height: '48px' }}
                                    onClick={handleGenerate}
                                    disabled={generating}
                                >
                                    <Download size={18} style={{ marginRight: '8px' }} /> {generating ? 'Generating...' : 'Generate & Download Report'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ height: '100%', minHeight: '400px' }}>
                            <div className="empty-state-icon"><BarChartHorizontal size={48} /></div>
                            <div className="empty-state-title">Select a report template</div>
                            <p className="empty-state-text">Choose a template from the left to configure your export.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
