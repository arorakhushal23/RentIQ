import React, { useState, useEffect } from 'react';
import { FileText, Search, RefreshCw, Download, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import AgreementModal from '../../components/agreement/AgreementModal';
import './AdminAgreements.css';

function AdminAgreements() {
    const [agreements, setAgreements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [selectedBookingId, setSelectedBookingId] = useState(null);

    const fetchAgreements = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await axiosInstance.get('/admin/agreements', { params });
            setAgreements(res.data?.agreements || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load rental agreements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAgreements();
    }, [statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchAgreements();
    };

    const handleDownloadPDF = async (agrId, agrNumber) => {
        try {
            const res = await axiosInstance.get(`/admin/agreements/${agrId}/download`, {
                responseType: 'blob'
            });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `${agrNumber}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Failed to download agreement PDF');
        }
    };

    return (
        <div className="admin-agreements-page">
            <header className="page-header">
                <div>
                    <h2>Digital Rental Agreements Management</h2>
                    <p>Audit system-generated legal contracts, track customer digital acceptances, and download signed agreements.</p>
                </div>
            </header>

            {/* Status Tabs */}
            <div className="agreements-status-tabs">
                <button
                    type="button"
                    className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                >
                    All Agreements
                </button>
                <button
                    type="button"
                    className={`status-tab ${statusFilter === 'awaiting_acceptance' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('awaiting_acceptance')}
                >
                    Awaiting Customer Acceptance
                </button>
                <button
                    type="button"
                    className={`status-tab ${statusFilter === 'accepted' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('accepted')}
                >
                    Digitally Accepted
                </button>
                <button
                    type="button"
                    className={`status-tab ${statusFilter === 'cancelled' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('cancelled')}
                >
                    Cancelled
                </button>
            </div>

            {/* Search Bar */}
            <div className="agreements-actions-bar">
                <form onSubmit={handleSearchSubmit} className="search-form">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by Agreement Ref, Customer Name, or Registration Number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="search-btn">Search</button>
                </form>

                <button type="button" className="refresh-btn" onClick={fetchAgreements} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Agreements Table */}
            <div className="agreements-table-card">
                {loading ? (
                    <div className="table-loading-wrap">
                        <Loader message="Loading agreements..." />
                    </div>
                ) : error ? (
                    <div className="table-error-banner" role="alert">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                ) : agreements.length === 0 ? (
                    <div className="empty-state-wrap">
                        <FileText size={40} className="empty-icon" />
                        <h4>No Rental Agreements Found</h4>
                        <p>No contracts match your search or filter criteria.</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Agreement Ref</th>
                                <th>Booking ID</th>
                                <th>Customer</th>
                                <th>Vehicle & Reg No</th>
                                <th>Booking Total</th>
                                <th>Status</th>
                                <th>Acceptance Details</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agreements.map((agr) => (
                                <tr key={agr.id}>
                                    <td>
                                        <code className="agr-number">{agr.agreement_number}</code>
                                        <small style={{ display: 'block', color: 'var(--text-secondary)' }}>
                                            Ver. {agr.agreement_version}
                                        </small>
                                    </td>
                                    <td><strong>#{agr.booking_id}</strong></td>
                                    <td>
                                        <strong>{agr.customer_name}</strong>
                                        <small style={{ display: 'block', color: 'var(--text-secondary)' }}>
                                            {agr.customer_email}
                                        </small>
                                    </td>
                                    <td>
                                        <strong>{agr.vehicle_brand} {agr.vehicle_name}</strong>
                                        <code className="reg-code">{agr.registration_number}</code>
                                    </td>
                                    <td>
                                        <strong>₹{Number(agr.total_price).toLocaleString('en-IN')}</strong>
                                    </td>
                                    <td>
                                        <span className={`status-pill ${agr.agreement_status}`}>
                                            {agr.agreement_status === 'accepted' ? '✓ Accepted' : agr.agreement_status === 'awaiting_acceptance' ? '⏳ Awaiting' : agr.agreement_status}
                                        </span>
                                    </td>
                                    <td>
                                        {agr.accepted_at ? (
                                            <small style={{ color: '#059669', fontWeight: 600 }}>
                                                {new Date(agr.accepted_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                            </small>
                                        ) : (
                                            <small style={{ color: 'var(--text-muted)' }}>Pending</small>
                                        )}
                                    </td>
                                    <td>
                                        <div className="row-actions">
                                            <button
                                                type="button"
                                                className="view-agr-btn"
                                                onClick={() => setSelectedBookingId(agr.booking_id)}
                                                title="View Agreement Dossier"
                                            >
                                                <Eye size={14} />
                                                <span>Review</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="download-agr-btn"
                                                onClick={() => handleDownloadPDF(agr.id, agr.agreement_number)}
                                                title="Download PDF"
                                            >
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Agreement Preview Modal */}
            {selectedBookingId && (
                <AgreementModal
                    bookingId={selectedBookingId}
                    onClose={() => setSelectedBookingId(null)}
                    onAgreementAccepted={() => fetchAgreements()}
                />
            )}
        </div>
    );
}

export default AdminAgreements;

