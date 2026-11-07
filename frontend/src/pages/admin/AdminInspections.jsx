import React, { useState, useEffect } from 'react';
import { Camera, Search, RefreshCw, Car, Eye, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import InspectionModal from '../../components/inspection/InspectionModal';
import './AdminInspections.css';

function AdminInspections() {
    const [inspections, setInspections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stageFilter, setStageFilter] = useState('all'); // 'all' | 'pickup' | 'return' | 'damage'
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [selectedBookingId, setSelectedBookingId] = useState(null);

    const fetchInspections = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (stageFilter !== 'all') params.stage = stageFilter;
            if (searchTerm.trim()) params.search = searchTerm.trim();

            const res = await axiosInstance.get('/admin/inspections', { params });
            setInspections(res.data?.inspections || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load vehicle inspections');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInspections();
    }, [stageFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchInspections();
    };

    return (
        <div className="admin-inspections-page">
            <header className="page-header">
                <div>
                    <h2>Vehicle Inspection & Handover Management</h2>
                    <p>Track before-rental and after-rental digital photo inspections, compare damages, and authorize handovers.</p>
                </div>
            </header>

            {/* Stage filter tabs */}
            <div className="inspections-filter-tabs">
                <button
                    type="button"
                    className={`stage-tab ${stageFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStageFilter('all')}
                >
                    All Inspections
                </button>
                <button
                    type="button"
                    className={`stage-tab ${stageFilter === 'pickup' ? 'active' : ''}`}
                    onClick={() => setStageFilter('pickup')}
                >
                    Pickup Inspections
                </button>
                <button
                    type="button"
                    className={`stage-tab ${stageFilter === 'return' ? 'active' : ''}`}
                    onClick={() => setStageFilter('return')}
                >
                    Return Inspections
                </button>
                <button
                    type="button"
                    className={`stage-tab ${stageFilter === 'damage' ? 'active' : ''}`}
                    onClick={() => setStageFilter('damage')}
                >
                    Damage Reports
                </button>
            </div>

            {/* Search & Actions Bar */}
            <div className="inspections-actions-bar">
                <form onSubmit={handleSearchSubmit} className="search-form">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by Booking ID, registration number, or customer name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="search-btn">Search</button>
                </form>

                <button type="button" className="refresh-btn" onClick={fetchInspections} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Inspections Table */}
            <div className="inspections-table-card">
                {loading ? (
                    <div className="table-loading-wrap">
                        <Loader message="Loading inspections..." />
                    </div>
                ) : error ? (
                    <div className="table-error-banner" role="alert">
                        <AlertTriangle size={18} />
                        <span>{error}</span>
                    </div>
                ) : inspections.length === 0 ? (
                    <div className="empty-state-wrap">
                        <Car size={40} className="empty-icon" />
                        <h4>No Vehicle Inspections Found</h4>
                        <p>No inspection records match the selected filter criteria.</p>
                    </div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Booking Ref</th>
                                <th>Vehicle</th>
                                <th>Stage</th>
                                <th>Odometer</th>
                                <th>Fuel Level</th>
                                <th>Condition</th>
                                <th>Photos</th>
                                <th>Customer Acceptance</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inspections.map((insp) => (
                                <tr key={insp.id}>
                                    <td>
                                        <strong>#{insp.booking_id}</strong>
                                        <small style={{ display: 'block', color: 'var(--text-secondary)' }}>
                                            {insp.customer_name}
                                        </small>
                                    </td>
                                    <td>
                                        <strong>{insp.vehicle_name}</strong>
                                        <code className="reg-code">{insp.registration_number}</code>
                                    </td>
                                    <td>
                                        <span className={`stage-badge ${insp.inspection_type}`}>
                                            {insp.inspection_type === 'pickup' ? 'Before Rental (Pickup)' : 'After Rental (Return)'}
                                        </span>
                                    </td>
                                    <td><strong>{insp.odometer_reading} km</strong></td>
                                    <td>
                                        <span className="fuel-pill">{insp.fuel_level}%</span>
                                    </td>
                                    <td>
                                        <span className={`condition-pill ${insp.exterior_condition}`}>
                                            {insp.exterior_condition}
                                        </span>
                                    </td>
                                    <td>
                                        <span className="photo-count-pill">
                                            <Camera size={12} />
                                            <span>{insp.photo_count || 0}</span>
                                        </span>
                                    </td>
                                    <td>
                                        {insp.customer_accepted ? (
                                            <span className="accepted-tag">✓ Confirmed</span>
                                        ) : (
                                            <span className="pending-tag">⏳ Awaiting Customer</span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="inspect-btn"
                                            onClick={() => setSelectedBookingId(insp.booking_id)}
                                        >
                                            <Eye size={14} />
                                            <span>Review / Report</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Inspection Dossier Modal */}
            {selectedBookingId && (
                <InspectionModal
                    bookingId={selectedBookingId}
                    isAdmin={true}
                    onClose={() => setSelectedBookingId(null)}
                    onInspectionUpdated={() => {
                        fetchInspections();
                    }}
                />
            )}
        </div>
    );
}

export default AdminInspections;

