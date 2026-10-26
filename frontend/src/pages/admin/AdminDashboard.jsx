import { useEffect, useState } from 'react';
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
    AlertCircle
} from 'lucide-react';
import axiosInstance from '../../api/axiosInstance';
import Loader from '../../components/common/Loader';
import './AdminDashboard.css';

function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await axiosInstance.get('/admin/dashboard');
            if (response.data && response.data.stats) {
                setStats(response.data.stats);
            } else {
                throw new Error('Invalid response structure received from server.');
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
    };

    useEffect(() => {
        let isMounted = true;

        axiosInstance
            .get('/admin/dashboard')
            .then((response) => {
                if (isMounted) {
                    if (response.data && response.data.stats) {
                        setStats(response.data.stats);
                    } else {
                        setError('Invalid response structure received from server.');
                    }
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
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
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const formatNumber = (val) => (Number(val) || 0).toLocaleString('en-IN');
    const formatCurrency = (val) => '₹' + (Number(val) || 0).toLocaleString('en-IN');

    return (
        <main className="admin-dashboard-page">
            <header className="admin-header">
                <div className="admin-header-title">
                    <span className="admin-badge">ADMINISTRATION</span>
                    <h1>Admin Dashboard</h1>
                    <p>
                        Real-time overview of fleet availability, customer registrations,
                        booking activity, and cumulative booking value.
                    </p>
                </div>

                <div className="admin-header-actions">
                    <button
                        type="button"
                        className="admin-refresh-btn"
                        onClick={fetchStats}
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : '↻ Refresh Data'}
                    </button>
                </div>
            </header>

            {loading && (
                <div className="admin-loading-state">
                    <Loader message="Loading dashboard statistics..." />
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
                            onClick={fetchStats}
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

                    {/* Operational Notice / Disclaimer */}
                    <footer className="admin-notice-box">
                        <strong>Financial Accounting Notice:</strong> The &quot;Booking Value&quot; metric aggregates
                        the calculated rental prices of all confirmed and completed bookings recorded in the system.
                        Actual payment transactions are processed as independent workflows and do not reflect
                        reconciled merchant collections.
                    </footer>
                </div>
            )}
        </main>
    );
}

export default AdminDashboard;
