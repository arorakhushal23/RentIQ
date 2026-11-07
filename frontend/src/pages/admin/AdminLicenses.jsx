import { useState, useEffect, useCallback } from 'react';
import {
    IdCard,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Eye,
    Shield,
    FileText,
    ExternalLink,
    RefreshCw,
    X,
    Calendar,
    User,
    Check,
    Download
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminLicenses.css';

function AdminLicenses() {
    const [licenses, setLicenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Review Modal State
    const [selectedLicense, setSelectedLicense] = useState(null);
    const [docViewerSide, setDocViewerSide] = useState('front'); // 'front' or 'back'

    // Action State
    const [actionLoading, setActionLoading] = useState(false);
    const [showRejectPrompt, setShowRejectPrompt] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const fetchLicenses = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axiosInstance.get('/admin/licenses');
            setLicenses(res.data || []);
        } catch (err) {
            console.error('Failed to load customer licenses:', err);
            setError(err.response?.data?.message || 'Failed to retrieve licence records.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLicenses();
    }, [fetchLicenses]);

    const filteredLicenses = licenses.filter((lic) => {
        const matchesStatus =
            statusFilter === 'all' ||
            lic.verification_status.toLowerCase() === statusFilter.toLowerCase();

        const q = search.trim().toLowerCase();
        const matchesSearch =
            !q ||
            (lic.customer_name || '').toLowerCase().includes(q) ||
            (lic.customer_email || '').toLowerCase().includes(q) ||
            (lic.license_number || '').toLowerCase().includes(q) ||
            (lic.masked_license_number || '').toLowerCase().includes(q);

        return matchesStatus && matchesSearch;
    });

    const handleApprove = async (licenseId) => {
        setActionLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            await axiosInstance.patch(`/admin/licenses/${licenseId}/verify`);
            setSuccessMessage('Driving licence successfully verified and approved.');
            setSelectedLicense(null);
            fetchLicenses();
        } catch (err) {
            console.error('Approval failed:', err);
            setError(err.response?.data?.message || 'Failed to verify licence.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) return;

        setActionLoading(true);
        setError('');
        setSuccessMessage('');
        try {
            await axiosInstance.patch(`/admin/licenses/${selectedLicense.id}/reject`, {
                rejection_reason: rejectionReason.trim()
            });
            setSuccessMessage('Driving licence has been rejected with customer notification dispatched.');
            setShowRejectPrompt(false);
            setRejectionReason('');
            setSelectedLicense(null);
            fetchLicenses();
        } catch (err) {
            console.error('Rejection failed:', err);
            setError(err.response?.data?.message || 'Failed to reject licence.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownloadDoc = async (licId, side) => {
        try {
            const response = await axiosInstance.get(`/admin/licenses/${licId}/document/${side}`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `license_${side}_${licId}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            setError('Could not download document file from storage.');
        }
    };

    const getStatusPill = (status) => {
        switch (status) {
            case 'verified':
                return (
                    <span className="lic-status-badge badge-verified">
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        Verified
                    </span>
                );
            case 'pending':
                return (
                    <span className="lic-status-badge badge-pending">
                        <Clock size={13} strokeWidth={2.5} />
                        Pending Review
                    </span>
                );
            case 'rejected':
                return (
                    <span className="lic-status-badge badge-rejected">
                        <XCircle size={13} strokeWidth={2.5} />
                        Rejected
                    </span>
                );
            case 'expired':
                return (
                    <span className="lic-status-badge badge-expired">
                        <AlertTriangle size={13} strokeWidth={2.5} />
                        Expired
                    </span>
                );
            default:
                return (
                    <span className="lic-status-badge badge-not-submitted">
                        Not Submitted
                    </span>
                );
        }
    };

    return (
        <main className="admin-licenses-page">
            <header className="admin-licenses-header">
                <div>
                    <span className="admin-eyebrow">
                        <Shield size={14} /> CUSTOMER IDENTITY & COMPLIANCE
                    </span>
                    <h1>Driving Licence Verification Center</h1>
                    <p>
                        Review customer submitted driving licences, inspect front and back documents, enforce vehicle class eligibility, and manage verification approvals.
                    </p>
                </div>
            </header>

            {/* Notification messages */}
            {error && (
                <div className="admin-lic-alert alert-error">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button type="button" onClick={() => setError('')}><X size={15} /></button>
                </div>
            )}
            {successMessage && (
                <div className="admin-lic-alert alert-success">
                    <CheckCircle2 size={18} />
                    <span>{successMessage}</span>
                    <button type="button" onClick={() => setSuccessMessage('')}><X size={15} /></button>
                </div>
            )}

            {/* Toolbar */}
            <section className="admin-licenses-toolbar">
                <div className="admin-lic-search">
                    <label htmlFor="lic-search">Search Customers & Licences</label>
                    <div className="search-input-box">
                        <Search size={16} className="search-icon" />
                        <input
                            id="lic-search"
                            type="search"
                            placeholder="Search by customer name, email, or licence number..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="admin-lic-filter">
                    <label htmlFor="status-filter">Verification Status</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses ({licenses.length})</option>
                        <option value="pending">Pending Review</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="expired">Expired</option>
                    </select>
                </div>

                <button
                    type="button"
                    className="admin-lic-refresh-btn"
                    onClick={fetchLicenses}
                    disabled={loading}
                >
                    <RefreshCw size={15} className={loading ? 'spinning' : ''} />
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </section>

            {/* Summary */}
            <div className="admin-lic-summary-bar">
                <span>
                    Total Submissions: <strong>{licenses.length}</strong> | Pending Verification: <strong>{licenses.filter(l => l.verification_status === 'pending').length}</strong>
                </span>
            </div>

            {/* Table */}
            <section className="admin-lic-table-card">
                <div className="admin-lic-table-wrapper">
                    <table className="admin-lic-table">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Licence Number</th>
                                <th>Class</th>
                                <th>Submission Date</th>
                                <th>Expiry Date</th>
                                <th>Status</th>
                                <th>Documents</th>
                                <th>Review</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredLicenses.map((lic) => {
                                return (
                                    <tr key={lic.id}>
                                        <td>
                                            <div className="customer-info-cell">
                                                <div className="customer-avatar-icon">
                                                    <User size={16} />
                                                </div>
                                                <div>
                                                    <strong className="customer-name">{lic.customer_name}</strong>
                                                    <span className="customer-email">{lic.customer_email}</span>
                                                    <small className="user-id-subtext">User ID: #{lic.user_id}</small>
                                                </div>
                                            </div>
                                        </td>

                                        <td>
                                            <span className="masked-lic-pill" title="Middle characters masked for security">
                                                {lic.masked_license_number}
                                            </span>
                                        </td>

                                        <td>
                                            <span className="vehicle-class-pill">
                                                {lic.vehicle_class || 'LMV'}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="lic-date-cell">
                                                <Calendar size={13} />
                                                <span>{lic.created_at ? lic.created_at.split(' ')[0] : '—'}</span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className={`lic-date-cell ${lic.verification_status === 'expired' ? 'date-expired' : ''}`}>
                                                <Clock size={13} />
                                                <strong>{lic.expiry_date ? lic.expiry_date.split('T')[0] : '—'}</strong>
                                            </div>
                                        </td>

                                        <td>
                                            {getStatusPill(lic.verification_status)}
                                        </td>

                                        <td>
                                            <div className="doc-count-tags">
                                                {lic.has_front && <span className="doc-tag">Front</span>}
                                                {lic.has_back && <span className="doc-tag">Back</span>}
                                            </div>
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="review-doc-btn"
                                                onClick={() => {
                                                    setSelectedLicense(lic);
                                                    setDocViewerSide('front');
                                                    setShowRejectPrompt(false);
                                                }}
                                            >
                                                <Eye size={14} />
                                                Inspect & Verify
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {!loading && filteredLicenses.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="admin-lic-empty">
                                        {licenses.length === 0
                                            ? 'No driving licences submitted by customers yet.'
                                            : 'No submissions match your active filter.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Inspection & Verification Modal */}
            {selectedLicense && (
                <div
                    className="lic-modal-backdrop"
                    onClick={() => { if (!actionLoading) setSelectedLicense(null); }}
                >
                    <div className="lic-modal-container" onClick={(e) => e.stopPropagation()}>
                        <header className="lic-modal-header">
                            <div>
                                <span className="lic-modal-eyebrow">
                                    <IdCard size={14} /> LICENCE VERIFICATION DOSSIER
                                </span>
                                <h2>Review Driving Licence: {selectedLicense.customer_name}</h2>
                            </div>
                            <button
                                type="button"
                                className="lic-modal-close"
                                onClick={() => setSelectedLicense(null)}
                                disabled={actionLoading}
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="lic-modal-body">
                            {/* Customer Details Grid */}
                            <div className="lic-details-panel">
                                <h3>Licence Information</h3>
                                <div className="lic-details-grid">
                                    <div className="lic-info-item">
                                        <span>Holder Name</span>
                                        <strong>{selectedLicense.holder_name}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Customer Email</span>
                                        <strong>{selectedLicense.customer_email}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Full Licence Number</span>
                                        <strong className="unmasked-lic">{selectedLicense.full_license_number || selectedLicense.license_number}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Authorized Vehicle Class</span>
                                        <strong>{selectedLicense.vehicle_class || 'LMV'}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Date of Birth</span>
                                        <strong>{selectedLicense.date_of_birth ? selectedLicense.date_of_birth.split('T')[0] : 'Not specified'}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Issue Date</span>
                                        <strong>{selectedLicense.issue_date ? selectedLicense.issue_date.split('T')[0] : '—'}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Expiry Date</span>
                                        <strong>{selectedLicense.expiry_date ? selectedLicense.expiry_date.split('T')[0] : '—'}</strong>
                                    </div>
                                    <div className="lic-info-item">
                                        <span>Current Status</span>
                                        <div>{getStatusPill(selectedLicense.verification_status)}</div>
                                    </div>
                                </div>

                                {selectedLicense.rejection_reason && (
                                    <div className="lic-rejection-box">
                                        <span>Rejection Remarks:</span>
                                        <p>{selectedLicense.rejection_reason}</p>
                                    </div>
                                )}

                                {selectedLicense.verified_by_name && (
                                    <div className="lic-audit-trail">
                                        <CheckCircle2 size={14} />
                                        <span>Verified by {selectedLicense.verified_by_name} on {selectedLicense.verified_at}</span>
                                    </div>
                                )}
                            </div>

                            {/* Document Viewer Preview */}
                            <div className="lic-viewer-panel">
                                <div className="lic-viewer-header">
                                    <h3>Attached Document Inspection</h3>
                                    <div className="lic-side-tabs">
                                        <button
                                            type="button"
                                            className={`lic-side-btn ${docViewerSide === 'front' ? 'active' : ''}`}
                                            onClick={() => setDocViewerSide('front')}
                                            disabled={!selectedLicense.has_front}
                                        >
                                            Front Side
                                        </button>
                                        <button
                                            type="button"
                                            className={`lic-side-btn ${docViewerSide === 'back' ? 'active' : ''}`}
                                            onClick={() => setDocViewerSide('back')}
                                            disabled={!selectedLicense.has_back}
                                        >
                                            Back Side
                                        </button>
                                    </div>
                                </div>

                                <div className="lic-preview-container">
                                    <div className="lic-preview-actions">
                                        <button
                                            type="button"
                                            className="lic-preview-download-btn"
                                            onClick={() => handleDownloadDoc(selectedLicense.id, docViewerSide)}
                                        >
                                            <Download size={14} />
                                            Download {docViewerSide === 'front' ? 'Front Document' : 'Back Document'}
                                        </button>
                                    </div>

                                    <div className="lic-doc-box">
                                        <p className="lic-doc-instruction">
                                            Click the button above to securely stream and inspect the official {docViewerSide} certificate file from RentIQ storage.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rejection Prompt Form */}
                        {showRejectPrompt && (
                            <form className="lic-reject-form" onSubmit={handleReject}>
                                <div className="reject-header">
                                    <AlertTriangle size={18} className="reject-icon" />
                                    <h4>Specify Rejection Reason (Dispatched to Customer)</h4>
                                </div>
                                <textarea
                                    rows={3}
                                    required
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="e.g. Document image is illegible or blurry; Expiration date has elapsed; Licence name does not match user account."
                                />
                                <div className="reject-actions">
                                    <button
                                        type="button"
                                        className="lic-cancel-btn"
                                        onClick={() => setShowRejectPrompt(false)}
                                        disabled={actionLoading}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="lic-confirm-reject-btn"
                                        disabled={actionLoading}
                                    >
                                        {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Modal Footer with Actions */}
                        {!showRejectPrompt && (
                            <footer className="lic-modal-footer">
                                <button
                                    type="button"
                                    className="lic-cancel-btn"
                                    onClick={() => setSelectedLicense(null)}
                                    disabled={actionLoading}
                                >
                                    Close
                                </button>

                                <div className="lic-footer-action-buttons">
                                    <button
                                        type="button"
                                        className="lic-reject-action-btn"
                                        onClick={() => setShowRejectPrompt(true)}
                                        disabled={actionLoading}
                                    >
                                        <XCircle size={15} />
                                        Reject Licence
                                    </button>

                                    <button
                                        type="button"
                                        className="lic-approve-action-btn"
                                        onClick={() => handleApprove(selectedLicense.id)}
                                        disabled={actionLoading || selectedLicense.verification_status === 'verified'}
                                    >
                                        <Check size={15} strokeWidth={2.5} />
                                        {actionLoading ? 'Verifying...' : selectedLicense.verification_status === 'verified' ? 'Already Verified' : 'Approve & Verify Licence'}
                                    </button>
                                </div>
                            </footer>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}

export default AdminLicenses;

