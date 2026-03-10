import React from 'react';
import PageHeader from '../../components/PageHeader';
import { BookOpen, Folder, FileText, Download } from 'lucide-react';

export default function DocumentLibraryPage() {
    return (
        <div className="fade-in">
            <PageHeader
                title="Document Library"
                subtitle="Central repository for organizational policies and resources"
                actions={<button className="btn btn-primary btn-sm">Upload Document</button>}
            />

            <div className="panels-row">
                {/* Folders */}
                <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="panel" style={{ padding: '16px' }}>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>Categories</h3>
                        {[
                            'Human Resources',
                            'Finance Forms',
                            'IT & Security',
                            'Program Guidelines',
                            'Brand Assets'
                        ].map(folder => (
                            <div key={folder} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <Folder size={14} /> <span style={{ fontSize: '13px' }}>{folder}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* File List */}
                <div className="panel" style={{ flex: 1 }}>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Date Modified</th>
                                    <th style={{ width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { name: 'Employee Handbook 2026.pdf', cat: 'Human Resources', date: 'Jan 15, 2026' },
                                    { name: 'Expense Claim Template.xlsx', cat: 'Finance Forms', date: 'Feb 02, 2026' },
                                    { name: 'Field Reporting Guidelines.docx', cat: 'Program Guidelines', date: 'Mar 10, 2026' }
                                ].map((file, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <FileText size={14} style={{ color: '#7B2CBF' }} />
                                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{file.name}</span>
                                            </div>
                                        </td>
                                        <td><span className="badge badge-info">{file.cat}</span></td>
                                        <td>{file.date}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" title="Download">
                                                <Download size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
