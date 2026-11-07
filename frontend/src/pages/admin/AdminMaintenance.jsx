import React, { useState, useEffect } from 'react';
import {
    Wrench,
    AlertTriangle,
    Calendar,
    Clock,
    DollarSign,
    Plus,
    Search,
    Filter,
    FileText,
    CheckCircle,
    XCircle,
    Download,
    Eye,
    Car,
    RefreshCw,
    Edit3,
    Trash2
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminMaintenance.css';

const CATEGORY_LABELS = {
    regular_service: 'Regular Servicing',
    engine_repair: 'Engine Repair',
    oil_change: 'Oil Change',
    tyre_replacement: 'Tyre Replacement',
    brake_servicing: 'Brake Servicing',
    battery_replacement: 'Battery Replacement',
    electrical_repairs: 'Electrical Repairs',
    accident_repairs: 'Accident Repairs',
    other: 'Other Maintenance'
};

const STATUS_BADGES = {
    scheduled: { label: 'Scheduled', class: 'status-scheduled' },
    in_progress: { label: 'In Progress', class: 'status-in-progress' },
    completed: { label: 'Completed', class: 'status-completed' },
    cancelled: { label: 'Cancelled', class: 'status-cancelled' }
};

function AdminMaintenance() {
    const [activeTab, setActiveTab] = useState('records'); // 'records' | 'reminders' | 'history'
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [records, setRecords] = useState([]);
    const [reminders, setReminders] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Filters for Records Tab
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // History Tab State
    const [historyVehicleId, setHistoryVehicleId] = useState('');
    const [historyData, setHistoryData] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [formData, setFormData] = useState({
        vehicle_id: '',
        maintenance_category: 'regular_service',
        service_date: new Date().toISOString().split('T')[0],
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        odometer_reading: '',
        service_center: '',
        description: '',
        parts_replaced: '',
        cost: '',
        next_service_date: '',
        next_service_odometer: '',
        status: 'in_progress',
        notes: ''
    });
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [modalError, setModalError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Reschedule reminder state
    const [rescheduleModal, setRescheduleModal] = useState({ open: false, reminderId: null, date: '' });

    const fetchDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            const [statsRes, recordsRes, remindersRes, vehRes] = await Promise.all([
                axiosInstance.get('/maintenance/stats'),
                axiosInstance.get('/maintenance/records', {
                    params: {
                        category: selectedCategory || undefined,
                        status: selectedStatus || undefined,
                        vehicle_id: selectedVehicle || undefined,
                        search: searchTerm || undefined
                    }
                }),
                axiosInstance.get('/maintenance/reminders'),
                axiosInstance.get('/vehicles')
            ]);

            setStats(statsRes.data);
            setRecords(recordsRes.data?.records || []);
            setReminders(remindersRes.data || []);
            setVehicles(vehRes.data?.vehicles || vehRes.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, [selectedCategory, selectedStatus, selectedVehicle]);

    // Load History when historyVehicleId changes
    const loadVehicleHistory = async (vId) => {
        if (!vId) return;
        setHistoryLoading(true);
        try {
            const res = await axiosInstance.get(`/maintenance/vehicle/${vId}`);
            setHistoryData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load vehicle history');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history' && historyVehicleId) {
            loadVehicleHistory(historyVehicleId);
        }
    }, [activeTab, historyVehicleId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchDashboardData();
    };

    const openCreateModal = () => {
        setIsEditMode(false);
        setSelectedRecordId(null);
        setFormData({
            vehicle_id: vehicles[0]?.vehicle_id || '',
            maintenance_category: 'regular_service',
            service_date: new Date().toISOString().split('T')[0],
            start_date: new Date().toISOString().split('T')[0],
            end_date: '',
            odometer_reading: '',
            service_center: '',
            description: '',
            parts_replaced: '',
            cost: '',
            next_service_date: '',
            next_service_odometer: '',
            status: 'in_progress',
            notes: ''
        });
        setInvoiceFile(null);
        setModalError('');
        setIsModalOpen(true);
    };

    const openEditModal = (rec) => {
        setIsEditMode(true);
        setSelectedRecordId(rec.id);
        setFormData({
            vehicle_id: rec.vehicle_id,
            maintenance_category: rec.maintenance_category,
            service_date: rec.service_date ? rec.service_date.split('T')[0] : '',
            start_date: rec.start_date ? rec.start_date.split('T')[0] : '',
            end_date: rec.end_date ? rec.end_date.split('T')[0] : '',
            odometer_reading: rec.odometer_reading || '',
            service_center: rec.service_center || '',
            description: rec.description || '',
            parts_replaced: rec.parts_replaced || '',
            cost: rec.cost || '',
            next_service_date: rec.next_service_date ? rec.next_service_date.split('T')[0] : '',
            next_service_odometer: rec.next_service_odometer || '',
            status: rec.status,
            notes: rec.notes || ''
        });
        setInvoiceFile(null);
        setModalError('');
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setModalError('');

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
                    data.append(key, formData[key]);
                }
            });

            if (invoiceFile) {
                data.append('invoice', invoiceFile);
            }

            if (isEditMode) {
                await axiosInstance.put(`/maintenance/records/${selectedRecordId}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setSuccessMsg('Maintenance record updated successfully.');
            } else {
                await axiosInstance.post('/maintenance/records', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setSuccessMsg('Maintenance record created successfully and availability updated.');
            }

            setIsModalOpen(false);
            fetchDashboardData();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            setModalError(err.response?.data?.message || 'Error saving maintenance record.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteRecord = async (id) => {
        if (!window.confirm('Are you sure you want to delete this maintenance record?')) return;
        try {
            await axiosInstance.delete(`/maintenance/records/${id}`);
            setSuccessMsg('Record deleted successfully.');
            fetchDashboardData();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete record');
        }
    };

    const handleDownloadInvoice = async (recordId) => {
        try {
            const res = await axiosInstance.get(`/maintenance/records/${recordId}/invoice`, {
                responseType: 'blob'
            });
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `Maintenance-Invoice-${recordId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Invoice file not available for this record');
        }
    };

    const handleUpdateReminder = async (id, status, rescheduledDate = null) => {
        try {
            await axiosInstance.put(`/maintenance/reminders/${id}`, {
                status,
                rescheduled_date: rescheduledDate
            });
            setSuccessMsg(`Reminder status updated to ${status}.`);
            fetchDashboardData();
            setRescheduleModal({ open: false, reminderId: null, date: '' });
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert('Failed to update reminder status');
        }
    };

    if (loading && !stats) {
        return (
            <div className="maintenance-page">
                <Loader message="Loading Maintenance Dashboard..." />
            </div>
        );
    }

    return (
        <div className="maintenance-page">
            {/* Header */}
            <div className="maintenance-header">
                <div>
                    <h1 className="maintenance-title">Vehicle Maintenance Management</h1>
                    <p className="maintenance-subtitle">
                        Monitor fleet health, manage scheduled servicing, track lifetime expenses, and prevent booking conflicts.
                    </p>
                </div>
                <div className="header-actions">
                    <button className="btn-refresh" onClick={fetchDashboardData} title="Refresh">
                        <RefreshCw size={16} />
                    </button>
                    <button className="btn-primary" onClick={openCreateModal}>
                        <Plus size={18} /> Add Maintenance Record
                    </button>
                </div>
            </div>

            {/* Notification messages */}
            {successMsg && <div className="alert-banner alert-success">{successMsg}</div>}
            {error && <div className="alert-banner alert-danger">{error}</div>}

            {/* KPI Cards */}
            {stats && (
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-icon icon-blue">
                            <Car size={24} />
                        </div>
                        <div className="kpi-info">
                            <span className="kpi-label">Registered Fleet</span>
                            <span className="kpi-value">{stats.totalVehicles}</span>
                            <span className="kpi-sub">Total fleet vehicles</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon icon-orange">
                            <Wrench size={24} />
                        </div>
                        <div className="kpi-info">
                            <span className="kpi-label">Under Maintenance</span>
                            <span className="kpi-value text-orange">{stats.vehiclesUnderMaintenance}</span>
                            <span className="kpi-sub">Unavailable for booking</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon icon-cyan">
                            <Calendar size={24} />
                        </div>
                        <div className="kpi-info">
                            <span className="kpi-label">Upcoming Scheduled</span>
                            <span className="kpi-value">{stats.upcomingMaintenance}</span>
                            <span className="kpi-sub">Future service blocks</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon icon-red">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="kpi-info">
                            <span className="kpi-label">Overdue Reminders</span>
                            <span className="kpi-value text-red">{stats.overdueMaintenance}</span>
                            <span className="kpi-sub">Action urgently needed</span>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon icon-green">
                            <DollarSign size={24} />
                        </div>
                        <div className="kpi-info">
                            <span className="kpi-label">Lifetime Expenses</span>
                            <span className="kpi-value text-green">₹{stats.totalMaintenanceExpenses?.toLocaleString('en-IN')}</span>
                            <span className="kpi-sub">Total parts & repairs</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="tab-nav">
                <button
                    className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
                    onClick={() => setActiveTab('records')}
                >
                    <Wrench size={16} /> All Maintenance Records ({records.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'reminders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reminders')}
                >
                    <Clock size={16} /> Automated Reminders ({reminders.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <Car size={16} /> Vehicle Lifetime History
                </button>
            </div>

            {/* TAB 1: ALL RECORDS */}
            {activeTab === 'records' && (
                <div className="tab-pane">
                    {/* Filter Bar */}
                    <div className="filters-bar">
                        <form className="search-form" onSubmit={handleSearchSubmit}>
                            <Search size={18} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by vehicle, registration, workshop, or work..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </form>

                        <div className="filter-selects">
                            <select
                                value={selectedVehicle}
                                onChange={(e) => setSelectedVehicle(e.target.value)}
                            >
                                <option value="">All Vehicles</option>
                                {vehicles.map(v => (
                                    <option key={v.vehicle_id} value={v.vehicle_id}>
                                        {v.brand} {v.name} ({v.registration_number})
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {Object.keys(CATEGORY_LABELS).map(catKey => (
                                    <option key={catKey} value={catKey}>{CATEGORY_LABELS[catKey]}</option>
                                ))}
                            </select>

                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                            >
                                <option value="">All Statuses</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>

                    {/* Records Table */}
                    {records.length === 0 ? (
                        <div className="empty-state">
                            <Wrench size={48} className="empty-icon" />
                            <h3>No Maintenance Records Found</h3>
                            <p>No maintenance logs match your filter criteria.</p>
                            <button className="btn-primary" onClick={openCreateModal}>
                                <Plus size={16} /> Add First Record
                            </button>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Vehicle</th>
                                        <th>Category</th>
                                        <th>Service Date</th>
                                        <th>Window</th>
                                        <th>Odometer</th>
                                        <th>Workshop</th>
                                        <th>Cost</th>
                                        <th>Status</th>
                                        <th>Invoice</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(rec => {
                                        const badge = STATUS_BADGES[rec.status] || { label: rec.status, class: '' };
                                        return (
                                            <tr key={rec.id}>
                                                <td>
                                                    <div className="veh-cell">
                                                        <strong>{rec.vehicle_brand} {rec.vehicle_name}</strong>
                                                        <span className="reg-badge">{rec.registration_number}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="cat-chip">
                                                        {CATEGORY_LABELS[rec.maintenance_category] || rec.maintenance_category}
                                                    </span>
                                                </td>
                                                <td>{rec.service_date ? rec.service_date.split('T')[0] : 'N/A'}</td>
                                                <td>
                                                    <span className="date-window">
                                                        {rec.start_date ? rec.start_date.split('T')[0] : ''}
                                                        {rec.end_date ? ` to ${rec.end_date.split('T')[0]}` : ' (ongoing)'}
                                                    </span>
                                                </td>
                                                <td>{rec.odometer_reading ? `${rec.odometer_reading.toLocaleString()} km` : '-'}</td>
                                                <td>{rec.service_center}</td>
                                                <td><strong>₹{Number(rec.cost || 0).toLocaleString('en-IN')}</strong></td>
                                                <td>
                                                    <span className={`badge ${badge.class}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {rec.invoice_file_path ? (
                                                        <button
                                                            className="btn-icon"
                                                            title="Download Invoice"
                                                            onClick={() => handleDownloadInvoice(rec.id)}
                                                        >
                                                            <Download size={16} className="text-blue" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            className="btn-icon"
                                                            title="Edit Record"
                                                            onClick={() => openEditModal(rec)}
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                        <button
                                                            className="btn-icon btn-delete"
                                                            title="Delete Record"
                                                            onClick={() => handleDeleteRecord(rec.id)}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: REMINDERS */}
            {activeTab === 'reminders' && (
                <div className="tab-pane">
                    <div className="reminders-header-bar">
                        <h3>Automated Preventive Maintenance Alerts</h3>
                        <p className="text-muted">
                            Alerts are automatically triggered based on upcoming scheduled dates, overdue intervals, and odometer readings.
                        </p>
                    </div>

                    {reminders.length === 0 ? (
                        <div className="empty-state">
                            <CheckCircle size={48} className="empty-icon text-green" />
                            <h3>All Vehicles Are Up to Date</h3>
                            <p>No pending maintenance alerts or service reminders at this time.</p>
                        </div>
                    ) : (
                        <div className="reminders-grid">
                            {reminders.map(rem => {
                                const isOverdue = rem.reminder_type === 'overdue';
                                const isOdo = rem.reminder_type === 'odometer_due';
                                return (
                                    <div key={rem.id} className={`reminder-card ${isOverdue ? 'border-red' : ''}`}>
                                        <div className="reminder-header">
                                            <span className={`reminder-type-tag ${rem.reminder_type}`}>
                                                {rem.reminder_type.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <span className="reminder-status">{rem.status}</span>
                                        </div>
                                        <h4 className="reminder-title">{rem.title}</h4>
                                        <p className="reminder-desc">{rem.description}</p>
                                        <div className="reminder-meta">
                                            {rem.due_date && (
                                                <span><strong>Due Date:</strong> {rem.due_date.split('T')[0]}</span>
                                            )}
                                            {rem.due_odometer && (
                                                <span><strong>Target Odometer:</strong> {rem.due_odometer.toLocaleString()} km</span>
                                            )}
                                        </div>
                                        <div className="reminder-actions">
                                            <button
                                                className="btn-sm btn-success"
                                                onClick={() => handleUpdateReminder(rem.id, 'completed')}
                                            >
                                                <CheckCircle size={14} /> Mark Done
                                            </button>
                                            <button
                                                className="btn-sm btn-secondary"
                                                onClick={() => setRescheduleModal({ open: true, reminderId: rem.id, date: '' })}
                                            >
                                                <Clock size={14} /> Reschedule
                                            </button>
                                            <button
                                                className="btn-sm btn-outline"
                                                onClick={() => handleUpdateReminder(rem.id, 'dismissed')}
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: VEHICLE LIFETIME HISTORY */}
            {activeTab === 'history' && (
                <div className="tab-pane">
                    <div className="history-picker-bar">
                        <label><strong>Select Vehicle to Inspect:</strong></label>
                        <select
                            value={historyVehicleId}
                            onChange={(e) => setHistoryVehicleId(e.target.value)}
                        >
                            <option value="">-- Choose a vehicle --</option>
                            {vehicles.map(v => (
                                <option key={v.vehicle_id} value={v.vehicle_id}>
                                    {v.brand} {v.name} ({v.registration_number})
                                </option>
                            ))}
                        </select>
                    </div>

                    {historyLoading && <Loader message="Loading vehicle service history..." />}

                    {!historyLoading && !historyData && (
                        <div className="empty-state">
                            <Car size={48} className="empty-icon" />
                            <h3>Select a Vehicle</h3>
                            <p>Choose any vehicle from the dropdown above to inspect its complete lifetime maintenance record.</p>
                        </div>
                    )}

                    {!historyLoading && historyData && (
                        <div className="vehicle-history-details">
                            {/* Summary bar */}
                            <div className="history-summary-grid">
                                <div className="hist-card">
                                    <span className="hist-lbl">Total Services</span>
                                    <span className="hist-val">{historyData.summary.totalServices}</span>
                                </div>
                                <div className="hist-card">
                                    <span className="hist-lbl">Lifetime Maintenance Cost</span>
                                    <span className="hist-val text-green">₹{historyData.summary.lifetimeCost?.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="hist-card">
                                    <span className="hist-lbl">Average Service Cost</span>
                                    <span className="hist-val">₹{Math.round(historyData.summary.averageServiceCost)?.toLocaleString('en-IN')}</span>
                                </div>
                                <div className="hist-card">
                                    <span className="hist-lbl">Latest Known Odometer</span>
                                    <span className="hist-val">{historyData.summary.latestOdometer ? `${historyData.summary.latestOdometer.toLocaleString()} km` : '-'}</span>
                                </div>
                            </div>

                            {/* Service Records Table */}
                            <h4>Historical Service & Repair Logs</h4>
                            {historyData.records.length === 0 ? (
                                <p className="text-muted">No maintenance records logged yet for this vehicle.</p>
                            ) : (
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Category</th>
                                                <th>Odometer</th>
                                                <th>Workshop</th>
                                                <th>Work Description</th>
                                                <th>Parts Replaced</th>
                                                <th>Cost</th>
                                                <th>Status</th>
                                                <th>Invoice</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyData.records.map(r => (
                                                <tr key={r.id}>
                                                    <td>{r.service_date ? r.service_date.split('T')[0] : ''}</td>
                                                    <td>{CATEGORY_LABELS[r.maintenance_category] || r.maintenance_category}</td>
                                                    <td>{r.odometer_reading ? `${r.odometer_reading.toLocaleString()} km` : '-'}</td>
                                                    <td>{r.service_center}</td>
                                                    <td>{r.description}</td>
                                                    <td>{r.parts_replaced || '-'}</td>
                                                    <td><strong>₹{Number(r.cost).toLocaleString('en-IN')}</strong></td>
                                                    <td>
                                                        <span className={`badge ${STATUS_BADGES[r.status]?.class || ''}`}>
                                                            {STATUS_BADGES[r.status]?.label || r.status}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {r.invoice_file_path ? (
                                                            <button
                                                                className="btn-icon"
                                                                onClick={() => handleDownloadInvoice(r.id)}
                                                            >
                                                                <Download size={16} />
                                                            </button>
                                                        ) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* CREATE / EDIT MAINTENANCE MODAL */}
            {isModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content modal-lg">
                        <div className="modal-header">
                            <h3>{isEditMode ? 'Edit Maintenance Record' : 'Record Vehicle Maintenance'}</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>

                        {modalError && <div className="alert-banner alert-danger">{modalError}</div>}

                        <form onSubmit={handleFormSubmit} className="modal-form">
                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Vehicle <span className="req">*</span></label>
                                    <select
                                        value={formData.vehicle_id}
                                        onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                                        required
                                        disabled={isEditMode}
                                    >
                                        <option value="">-- Choose Vehicle --</option>
                                        {vehicles.map(v => (
                                            <option key={v.vehicle_id} value={v.vehicle_id}>
                                                {v.brand} {v.name} ({v.registration_number})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Maintenance Category <span className="req">*</span></label>
                                    <select
                                        value={formData.maintenance_category}
                                        onChange={(e) => setFormData({ ...formData, maintenance_category: e.target.value })}
                                        required
                                    >
                                        {Object.keys(CATEGORY_LABELS).map(catKey => (
                                            <option key={catKey} value={catKey}>{CATEGORY_LABELS[catKey]}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-row-3">
                                <div className="form-group">
                                    <label>Service Date <span className="req">*</span></label>
                                    <input
                                        type="date"
                                        value={formData.service_date}
                                        onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Start Date (Blocks Bookings)</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>End Date (Optional)</label>
                                    <input
                                        type="date"
                                        value={formData.end_date}
                                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-row-3">
                                <div className="form-group">
                                    <label>Odometer Reading (km) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 45000"
                                        value={formData.odometer_reading}
                                        onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Service Center / Workshop <span className="req">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Workshop name"
                                        value={formData.service_center}
                                        onChange={(e) => setFormData({ ...formData, service_center: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Total Maintenance Cost (₹) <span className="req">*</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g. 3500.00"
                                        value={formData.cost}
                                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Description of Work Performed <span className="req">*</span></label>
                                <textarea
                                    rows="2"
                                    placeholder="Detailed overview of repairs or maintenance actions taken..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Parts Replaced (comma-separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Engine Oil 5W30, Oil Filter, Air Filter, Front Brake Pads"
                                    value={formData.parts_replaced}
                                    onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
                                />
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Next Service Date Target</label>
                                    <input
                                        type="date"
                                        value={formData.next_service_date}
                                        onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Next Service Odometer (km)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 55000"
                                        value={formData.next_service_odometer}
                                        onChange={(e) => setFormData({ ...formData, next_service_odometer: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-row-2">
                                <div className="form-group">
                                    <label>Record Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="in_progress">In Progress (Vehicle marked Unavailable)</option>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="completed">Completed (Vehicle restored if compliant)</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Attach Invoice / Receipt (PDF / Image)</label>
                                    <input
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(e) => setInvoiceFile(e.target.files[0])}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Internal Notes</label>
                                <textarea
                                    rows="2"
                                    placeholder="Optional administrative notes..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : (isEditMode ? 'Update Record' : 'Save Maintenance Record')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RESCHEDULE REMINDER MODAL */}
            {rescheduleModal.open && (
                <div className="modal-backdrop">
                    <div className="modal-content modal-sm">
                        <div className="modal-header">
                            <h3>Reschedule Maintenance</h3>
                            <button className="close-btn" onClick={() => setRescheduleModal({ open: false, reminderId: null, date: '' })}>×</button>
                        </div>
                        <div className="modal-form">
                            <div className="form-group">
                                <label>New Due Date</label>
                                <input
                                    type="date"
                                    value={rescheduleModal.date}
                                    onChange={(e) => setRescheduleModal({ ...rescheduleModal, date: e.target.value })}
                                />
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="btn-secondary"
                                    onClick={() => setRescheduleModal({ open: false, reminderId: null, date: '' })}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary"
                                    onClick={() => handleUpdateReminder(rescheduleModal.reminderId, 'rescheduled', rescheduleModal.date)}
                                >
                                    Confirm Reschedule
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminMaintenance;

