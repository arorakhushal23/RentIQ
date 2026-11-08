import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Car,
    CheckCircle2,
    Users,
    IndianRupee,
    ClipboardList,
    Clock,
    CheckCircle,
    Flag,
    XCircle,
    AlertCircle,
    AlertTriangle,
    FileCheck,
    IdCard,
    ArrowRight,
    ShieldAlert,
    ExternalLink,
    Wrench,
    Percent
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminDashboard.css';

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [alertsData, setAlertsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            const [statsRes, alertsRes] = await Promise.all([
                axiosInstance.get('/admin/dashboard'),
                axiosInstance.get('/admin/documents/alerts').catch(() => ({ data: { summary: {}, alerts: [] } }))
            ]);

            if (statsRes.data && statsRes.data.stats) {
                setStats(statsRes.data.stats);
            } else {
                throw new Error('Invalid response structure received from server.');
            }

            if (alertsRes.data) {
                setAlertsData(alertsRes.data);
            }
        } catch (err) {
            console.error('Failed to load admin dashboard statistics:', err);
            if (err.response?.status === 403) {
                setError('Access denied: Administrator privileges are required to view this dashboard.');
            } else if (err.response?.status === 401) {
                setError('Authentication required: Your session may have expired. Please log in again.');
            } else {
                setError(
                    err.response?.data?.message ||
                    'Unable to retrieve dashboard statistics. Please verify backend connection and try again.'
                );
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const formatNumber = (val) => (Number(val) || 0).toLocaleString('en-IN');
    const formatCurrency = (val) => '₹' + (Number(val) || 0).toLocaleString('en-IN');

    return (
        <main className="admin-dashboard-page">
            <header className="admin-header">
                <div className="admin-header-title">
                    <span className="admin-badge">ADMINISTRATION & COMPLIANCE</span>
                    <h1>Admin Operations Dashboard</h1>
                    <p>
                        Real-time overview of fleet availability, document compliance, customer driving licence verification, and booking activity.
                    </p>
                </div>

                <div className="admin-header-actions">
                    <button
                        type="button"
                        className="admin-refresh-btn"
                        onClick={fetchDashboardData}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : '↻ Refresh Data'}
                    </button>
                </div>
            </header>

            {loading && (
                <div className="admin-loading-state">
                    <Loader message="Loading dashboard statistics & compliance records..." />
                </div>
            )}

            {!loading && error && (
                <div className="admin-error-card">
                    <div className="admin-error-icon" aria-hidden="true">
                        <AlertCircle size={32} strokeWidth={2} />
                    </div>
                    <div className="admin-error-content">
                        <h3>Failed to Load Statistics</h3>
                        <p>{error}</p>
                        <button
                            type="button"
                            className="admin-retry-btn"
                            onClick={fetchDashboardData}
                        >
                            Retry Request
                        </button>
                    </div>
                </div>
            )}

            {!loading && !error && stats && (
                <div className="admin-content">
                    {/* Primary Fleet & Customer Overview */}
                    <section className="admin-section">
                        <h2 className="admin-section-title">Fleet & Customer Overview</h2>

                        <div className="admin-kpi-grid">
                            <article className="admin-kpi-card">
                                <div className="kpi-header">
                                    <span className="kpi-label">Total Fleet</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Car size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.totalVehicles)}</div>
                                <div className="kpi-subtext">Registered vehicles in catalog</div>
                            </article>

                            <article className="admin-kpi-card highlight-success">
                                <div className="kpi-header">
                                    <span className="kpi-label">Available Vehicles</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <CheckCircle2 size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.availableVehicles)}</div>
                                <div className="kpi-subtext">Active and ready to rent</div>
                            </article>

                            <article className="admin-kpi-card">
                                <div className="kpi-header">
                                    <span className="kpi-label">Total Customers</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Users size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.totalCustomers)}</div>
                                <div className="kpi-subtext">Registered customer accounts</div>
                            </article>

                            <article className="admin-kpi-card highlight-revenue">
                                <div className="kpi-header">
                                    <span className="kpi-label">Booking Value</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <IndianRupee size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatCurrency(stats.totalRevenue)}</div>
                                <div className="kpi-subtext">
                                    Confirmed & completed rentals (provisional booking value)
                                </div>
                            </article>
                        </div>
                    </section>

                    {/* COMPLIANCE & VERIFICATION METRICS (Features 2 & 3) */}
                    <section className="admin-section">
                        <div className="section-title-with-actions">
                            <h2 className="admin-section-title">Compliance & Licence Verification Hub</h2>
                            <div className="section-actions-links">
                                <Link to="/admin/licenses" className="quick-action-link">
                                    <IdCard size={15} />
                                    Verify Licences ({formatNumber(stats.pendingLicenses)} pending)
                                    <ArrowRight size={14} />
                                </Link>
                                <Link to="/admin/vehicles" className="quick-action-link secondary">
                                    <FileCheck size={15} />
                                    Manage Fleet Documents
                                    <ArrowRight size={14} />
                                </Link>
                            </div>
                        </div>

                        <div className="admin-kpi-grid compliance-grid">
                            <article className={`admin-kpi-card ${stats.pendingLicenses > 0 ? 'highlight-warning' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Pending Licence Reviews</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Clock size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.pendingLicenses)}</div>
                                <div className="kpi-subtext">Awaiting admin review & approval</div>
                            </article>

                            <article className="admin-kpi-card highlight-success">
                                <div className="kpi-header">
                                    <span className="kpi-label">Verified Customers</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <CheckCircle size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.verifiedLicenses)}</div>
                                <div className="kpi-subtext">Customers eligible for vehicle rental</div>
                            </article>

                            <article className={`admin-kpi-card ${stats.expiredDocuments > 0 ? 'highlight-danger' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Expired Fleet Docs</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <AlertTriangle size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.expiredDocuments)}</div>
                                <div className="kpi-subtext">Blocking customer reservations</div>
                            </article>

                            <article className={`admin-kpi-card ${stats.expiringDocuments > 0 ? 'highlight-expiring' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Expiring Soon (30 Days)</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Clock size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.expiringDocuments)}</div>
                                <div className="kpi-subtext">Renewal required soon</div>
                            </article>
                        </div>
                    </section>

                    {/* URGENT DOCUMENT EXPIRY ALERTS LIST */}
                    {alertsData && alertsData.alerts && alertsData.alerts.length > 0 && (
                        <section className="admin-section alerts-banner-section">
                            <div className="alerts-banner-header">
                                <div className="alerts-banner-title">
                                    <ShieldAlert size={20} className="alerts-header-icon" />
                                    <h3>Urgent Vehicle Document Expiry Alerts</h3>
                                </div>
                                <span className="alerts-count-badge">
                                    {alertsData.alerts.length} Action Item{alertsData.alerts.length > 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="alerts-items-list">
                                {alertsData.alerts.slice(0, 6).map((item) => {
                                    const isExpired = item.status === 'expired' || item.days_remaining < 0;
                                    return (
                                        <div
                                            key={item.id}
                                            className={`alert-item-row ${isExpired ? 'row-expired' : 'row-expiring'}`}
                                        >
                                            <div className="alert-item-left">
                                                <span className={`alert-tier-tag ${isExpired ? 'tier-expired' : 'tier-warning'}`}>
                                                    {isExpired ? 'EXPIRED' : `EXPIRING IN ${item.days_remaining}D`}
                                                </span>
                                                <div className="alert-item-vehicle">
                                                    <strong>{item.vehicle_brand} {item.vehicle_name}</strong>
                                                    <span className="alert-reg-no">({item.registration_number || `ID #${item.vehicle_id}`})</span>
                                                </div>
                                            </div>

                                            <div className="alert-item-doc-info">
                                                <span className="alert-doc-type">{item.document_type?.toUpperCase()} Certificate</span>
                                                <span className="alert-doc-no">Doc No: {item.document_number}</span>
                                                <span className="alert-doc-expiry">Expiry: {item.expiry_date ? item.expiry_date.split('T')[0] : 'N/A'}</span>
                                            </div>

                                            <Link
                                                to="/admin/vehicles"
                                                className="alert-action-btn"
                                                title="Open Vehicle Management to upload renewal"
                                            >
                                                Manage Vehicle
                                                <ExternalLink size={13} />
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* ADVANCED OPERATIONS: LOCATIONS, INSPECTIONS & AGREEMENTS */}
                    <section className="admin-section">
                        <h2 className="admin-section-title">Rental Operations & Inspection Center</h2>
                        
                        <div className="admin-kpi-grid">
                            <article className="admin-kpi-card highlight-success">
                                <div className="kpi-header">
                                    <span className="kpi-label">Active Handed-Over Rentals</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Car size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.activeBookings)}</div>
                                <div className="kpi-subtext">Vehicles currently on the road with customers</div>
                            </article>

                            <article className={`admin-kpi-card ${stats.pendingPickupInspections > 0 ? 'highlight-warning' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Pending Pickup Inspections</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Clock size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.pendingPickupInspections)}</div>
                                <div className="kpi-subtext">Confirmed bookings awaiting pre-rental inspection</div>
                            </article>

                            <article className={`admin-kpi-card ${stats.pendingReturnInspections > 0 ? 'highlight-expiring' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Pending Return Inspections</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Clock size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.pendingReturnInspections)}</div>
                                <div className="kpi-subtext">Active rentals awaiting check-in & return report</div>
                            </article>

                            <article className="admin-kpi-card">
                                <div className="kpi-header">
                                    <span className="kpi-label">Rental Agreements</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <FileCheck size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.acceptedAgreements)} / {formatNumber(stats.totalAgreements)}</div>
                                <div className="kpi-subtext">{formatNumber(stats.pendingAgreements)} awaiting customer digital sign-off</div>
                            </article>
                        </div>

                        {/* Quick Action Navigation Grid for the 3 Modules */}
                        <div className="operations-modules-grid">
                            <Link to="/admin/locations" className="operation-nav-card">
                                <div className="op-card-header">
                                    <div className="op-icon-pill map-pill">📍</div>
                                    <h4>Location & Delivery Management</h4>
                                </div>
                                <p>Interactive booking routes map, doorstep delivery pricing rules, and service hub depots.</p>
                                <span className="op-link-text">Open Location Manager →</span>
                            </Link>

                            <Link to="/admin/inspections" className="operation-nav-card">
                                <div className="op-card-header">
                                    <div className="op-icon-pill insp-pill">📸</div>
                                    <h4>Vehicle Inspection System</h4>
                                </div>
                                <p>Before & after rental photo inspections, damage comparison, and handover authorization.</p>
                                <span className="op-link-text">Open Inspections →</span>
                            </Link>

                            <Link to="/admin/agreements" className="operation-nav-card">
                                <div className="op-card-header">
                                    <div className="op-icon-pill agr-pill">📄</div>
                                    <h4>Digital Rental Agreements</h4>
                                </div>
                                <p>Generated contracts, verified customer terms acceptance, and PDF agreement downloads.</p>
                                <span className="op-link-text">Open Agreements →</span>
                            </Link>
                        </div>
                    </section>

                    {/* PHASE 3: VEHICLE MAINTENANCE & SMART PRICING */}
                    <section className="admin-section">
                        <h2 className="admin-section-title">Fleet Maintenance & Dynamic Pricing Engine</h2>

                        <div className="admin-kpi-grid">
                            <article className={`admin-kpi-card ${stats.vehiclesUnderMaintenance > 0 ? 'highlight-warning' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Vehicles Under Maintenance</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Wrench size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.vehiclesUnderMaintenance)}</div>
                                <div className="kpi-subtext">{formatNumber(stats.upcomingMaintenance)} scheduled upcoming service blocks</div>
                            </article>

                            <article className={`admin-kpi-card ${stats.overdueMaintenanceReminders > 0 ? 'highlight-expired' : ''}`}>
                                <div className="kpi-header">
                                    <span className="kpi-label">Overdue Maintenance Reminders</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <AlertTriangle size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.overdueMaintenanceReminders)}</div>
                                <div className="kpi-subtext">Immediate preventive servicing required</div>
                            </article>

                            <article className="admin-kpi-card">
                                <div className="kpi-header">
                                    <span className="kpi-label">Lifetime Fleet Maintenance Cost</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <IndianRupee size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatCurrency(stats.totalMaintenanceExpense)}</div>
                                <div className="kpi-subtext">Aggregate repairs, servicing & parts</div>
                            </article>

                            <article className="admin-kpi-card">
                                <div className="kpi-header">
                                    <span className="kpi-label">Active Smart Pricing Rules</span>
                                    <span className="kpi-icon" aria-hidden="true">
                                        <Percent size={20} strokeWidth={2} />
                                    </span>
                                </div>
                                <div className="kpi-value">{formatNumber(stats.activePricingRules)} Rules / {formatNumber(stats.activeSeasonalRules)} Seasons</div>
                                <div className="kpi-subtext">Dynamic peak surcharges & discounts active</div>
                            </article>
                        </div>

                        {/* Quick Action Navigation Grid for Maintenance & Pricing */}
                        <div className="operations-modules-grid">
                            <Link to="/admin/maintenance" className="operation-nav-card">
                                <div className="op-card-header">
                                    <div className="op-icon-pill maint-pill">🔧</div>
                                    <h4>Vehicle Maintenance Management</h4>
                                </div>
                                <p>Record services, upload workshop invoices, manage overdue reminders, and track vehicle lifetime costs.</p>
                                <span className="op-link-text">Open Maintenance Center →</span>
                            </Link>

                            <Link to="/admin/pricing" className="operation-nav-card">
                                <div className="op-card-header">
                                    <div className="op-icon-pill pricing-pill">⚡</div>
                                    <h4>Smart Pricing & Additional Charges</h4>
                                </div>
                                <p>Weekend surcharges, seasonal holiday calendars, duration discounts, penalty fees, and live pricing simulation.</p>
                                <span className="op-link-text">Open Pricing Engine →</span>
                            </Link>
                        </div>
                    </section>

                    {/* Booking Breakdown */}
                    <section className="admin-section">
                        <h2 className="admin-section-title">Booking Breakdown by Status</h2>

                        <div className="admin-booking-grid">
                            <article className="admin-status-card total-card">
                                <div className="status-indicator" aria-hidden="true">
                                    <ClipboardList size={20} strokeWidth={2} />
                                </div>
                                <div className="status-info">
                                    <span className="status-name">Total Bookings</span>
                                    <strong className="status-count">{formatNumber(stats.totalBookings)}</strong>
                                </div>
                            </article>

                            <article className="admin-status-card pending-card">
                                <div className="status-indicator" aria-hidden="true">
                                    <Clock size={20} strokeWidth={2} />
                                </div>
                                <div className="status-info">
                                    <span className="status-name">Pending</span>
                                    <strong className="status-count">{formatNumber(stats.pendingBookings)}</strong>
                                </div>
                            </article>

                            <article className="admin-status-card confirmed-card">
                                <div className="status-indicator" aria-hidden="true">
                                    <CheckCircle size={20} strokeWidth={2} />
                                </div>
                                <div className="status-info">
                                    <span className="status-name">Confirmed</span>
                                    <strong className="status-count">{formatNumber(stats.confirmedBookings)}</strong>
                                </div>
                            </article>

                            <article className="admin-status-card completed-card">
                                <div className="status-indicator" aria-hidden="true">
                                    <Flag size={20} strokeWidth={2} />
                                </div>
                                <div className="status-info">
                                    <span className="status-name">Completed</span>
                                    <strong className="status-count">{formatNumber(stats.completedBookings)}</strong>
                                </div>
                            </article>

                            <article className="admin-status-card cancelled-card">
                                <div className="status-indicator" aria-hidden="true">
                                    <XCircle size={20} strokeWidth={2} />
                                </div>
                                <div className="status-info">
                                    <span className="status-name">Cancelled</span>
                                    <strong className="status-count">{formatNumber(stats.cancelledBookings)}</strong>
                                </div>
                            </article>
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}

export default AdminDashboard;
