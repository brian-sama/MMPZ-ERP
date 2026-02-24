import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', alignItems: 'center' }}>
            <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                Previous
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 500 }}>
                Page {currentPage} of {totalPages}
            </span>
            <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;
