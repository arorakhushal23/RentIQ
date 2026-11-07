import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Car,
    History,
    Heart,
    Settings,
    Settings2,
    Calendar,
    CalendarCheck,
    Clock,
    User,
    UserCheck,
    ShieldCheck,
    ChevronRight,
    Users,
    X,
    IdCard,
    UploadCloud,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Download
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import axiosInstance from '../../api/axiosInstance';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import Loader from '../../components/common/Loader';
import {
    formatDisplayDateTime,
    calculateRentalDuration
} from '../../utils/bookingUtils';
import './Profile.css';

function Profile() {
    const { user, logout, updateUser } = useAuth();
    const { wishlist, wishlistCount, removeFromWishlist } = useWishlist();
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTab, setActiveTab] = useState('overview');
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Driving Licence State
    const [licenseInfo, setLicenseInfo] = useState(null);
    const [licenseLoading, setLicenseLoading] = useState(true);
    const [licenseSubmitting, setLicenseSubmitting] = useState(false);
    const [licenseError, setLicenseError] = useState('');
    const [licenseSuccess, setLicenseSuccess] = useState('');
    const [showEditLicForm, setShowEditLicForm] = useState(false);

    // Form fields for licence
    const [licNumber, setLicNumber] = useState('');
    const [licHolderName, setLicHolderName] = useState(user?.name || '');
    const [licDob, setLicDob] = useState('');
    const [licIssueDate, setLicIssueDate] = useState('');
    const [licExpiryDate, setLicExpiryDate] = useState('');
    const [licVehicleClass, setLicVehicleClass] = useState('LMV');
    const [frontDocFile, setFrontDocFile] = useState(null);
    const [backDocFile, setBackDocFile] = useState(null);

    // Customer Notifications
    const [notifications, setNotifications] = useState([]);

    // Check location query param tab=license
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('tab') === 'license') {
            setActiveTab('license');
        }
    }, [location.search]);

    // Booking Details Modal
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState('');
    const [cancelSuccess, setCancelSuccess] = useState('');

    // Edit Profile Modal
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editName, setEditName] = useState(user?.name || '');
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    const tabListRef = useRef(null);

    useEffect(() => {
        let isMounted = true;

        const fetchBookings = async () => {
            try {
                const response = await axiosInstance.get('/bookings/my-bookings');
                if (isMounted) {
                    setBookings(response.data.bookings || []);
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Failed to load rental history:', err);
                    setError('Unable to load rental history. Please try again.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchBookings();

        const fetchLicenseInfo = async () => {
            try {
                const res = await axiosInstance.get('/licenses/my-license');
                if (isMounted) {
                    setLicenseInfo(res.data);
                    if (res.data?.license) {
                        const lic = res.data.license;
                        setLicNumber(lic.license_number || '');
                        setLicHolderName(lic.holder_name || user?.name || '');
                        setLicDob(lic.date_of_birth ? lic.date_of_birth.split('T')[0] : '');
                        setLicIssueDate(lic.issue_date ? lic.issue_date.split('T')[0] : '');
                        setLicExpiryDate(lic.expiry_date ? lic.expiry_date.split('T')[0] : '');
                        setLicVehicleClass(lic.vehicle_class || 'LMV');
                    }
                }
            } catch (err) {
                console.error('Failed to load license details:', err);
            } finally {
                if (isMounted) setLicenseLoading(false);
            }
        };

        const fetchNotifications = async () => {
            try {
                const res = await axiosInstance.get('/notifications');
                if (isMounted) {
                    setNotifications(res.data.notifications || []);
                }
            } catch (err) {
                console.error('Failed to load notifications:', err);
            }
        };

        fetchLicenseInfo();
        fetchNotifications();

        return () => {
            isMounted = false;
        };
    }, []);

    // Active vs Past Bookings
    const activeBookings = useMemo(() => {
        return bookings.filter((b) =>
            ['pending', 'confirmed'].includes(b.status?.toLowerCase())
        );
    }, [bookings]);

    const pastBookings = useMemo(() => {
        return bookings.filter((b) =>
            ['completed', 'cancelled'].includes(b.status?.toLowerCase())
        );
    }, [bookings]);

    const handleCloseModal = useCallback(() => {
        if (cancelling) return;
        setSelectedBooking(null);
        setShowCancelConfirm(false);
        setCancelError('');
        setCancelSuccess('');
    }, [cancelling]);

    // Prevent background page from scrolling when a modal is active
    useEffect(() => {
        if (selectedBooking || isEditingProfile) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [selectedBooking, isEditingProfile]);

    // Keyboard support: Close modal on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedBooking && !cancelling) {
                    handleCloseModal();
                }
                if (isEditingProfile && !editSaving) {
                    setIsEditingProfile(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedBooking, cancelling, isEditingProfile, editSaving, handleCloseModal]);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const formatDate = (date) => {
        if (!date) return 'Not available';
        return formatDisplayDateTime(date);
    };

    const handleOpenDetails = (booking) => {
        setSelectedBooking(booking);
        setShowCancelConfirm(false);
        setCancelError('');
        setCancelSuccess('');
    };

    const handleCancelBooking = async () => {
        if (!selectedBooking || cancelling) return;

        setCancelling(true);
        setCancelError('');
        setCancelSuccess('');

        try {
            const response = await axiosInstance.patch(
                `/bookings/${selectedBooking.booking_id}/cancel`
            );

            const updatedBooking = response.data.booking;
            setSelectedBooking(updatedBooking);

            setBookings((prevBookings) =>
                prevBookings.map((b) =>
                    b.booking_id === updatedBooking.booking_id ? updatedBooking : b
                )
            );

            setShowCancelConfirm(false);
            setCancelSuccess(response.data.message || 'Booking cancelled successfully');
        } catch (err) {
            const message =
                err.response?.data?.message || 'Failed to cancel booking. Please try again.';
            setCancelError(message);
        } finally {
            setCancelling(false);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!editName.trim()) {
            setEditError('Name cannot be empty');
            return;
        }

        setEditSaving(true);
        setEditError('');

        try {
            const response = await axiosInstance.put('/auth/me', {
                name: editName.trim()
            });

            if (response.data && response.data.user) {
                updateUser(response.data.user);
            } else {
                updateUser({ name: editName.trim() });
            }

            setIsEditingProfile(false);
        } catch (err) {
            console.error('Failed to update profile:', err);
            updateUser({ name: editName.trim() });
            setIsEditingProfile(false);
        } finally {
            setEditSaving(false);
        }
    };

    const handleLicenseSubmit = async (e) => {
        e.preventDefault();
        setLicenseError('');
        setLicenseSuccess('');

        if (!licNumber.trim() || !licHolderName.trim() || !licIssueDate || !licExpiryDate) {
            setLicenseError('Please complete all mandatory licence fields.');
            return;
        }

        if (!frontDocFile && !licenseInfo?.license?.has_front) {
            setLicenseError('Front-side licence document file is required.');
            return;
        }

        const formData = new FormData();
        formData.append('license_number', licNumber.trim());
        formData.append('holder_name', licHolderName.trim());
        if (licDob) formData.append('date_of_birth', licDob);
        formData.append('issue_date', licIssueDate);
        formData.append('expiry_date', licExpiryDate);
        formData.append('vehicle_class', licVehicleClass);
        if (frontDocFile) formData.append('front', frontDocFile);
        if (backDocFile) formData.append('back', backDocFile);

        setLicenseSubmitting(true);
        try {
            await axiosInstance.post('/licenses/submit', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLicenseSuccess('Driving licence successfully submitted. It is now awaiting administrator review.');
            setShowEditLicForm(false);
            const res = await axiosInstance.get('/licenses/my-license');
            setLicenseInfo(res.data);
            const notifRes = await axiosInstance.get('/notifications');
            setNotifications(notifRes.data.notifications || []);
        } catch (err) {
            console.error('Submit license error:', err);
            setLicenseError(err.response?.data?.message || 'Failed to submit driving licence.');
        } finally {
            setLicenseSubmitting(false);
        }
    };

    const handleDownloadMyDoc = async (side) => {
        try {
            const res = await axiosInstance.get(`/licenses/my-license/document/${side}`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: res.headers['content-type'] || 'application/octet-stream'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my_driving_license_${side}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download license document error:', err);
            setLicenseError('Could not retrieve uploaded document file.');
        }
    };

    const isEligibleForCancellation =
        selectedBooking &&
        ['pending', 'confirmed'].includes(selectedBooking.status?.toLowerCase());

    const TABS = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        {
            id: 'license',
            label: 'Driving Licence',
            icon: IdCard,
            badge: licenseInfo?.status === 'verified'
                ? 'Verified'
                : licenseInfo?.status === 'pending'
                    ? 'Pending'
                    : licenseInfo?.status === 'rejected'
                        ? 'Action Req.'
                        : 'Submit'
        },
        { id: 'active', label: 'Active Bookings', icon: Car, badge: activeBookings.length },
        { id: 'history', label: 'Rental History', icon: History, badge: pastBookings.length },
        { id: 'wishlist', label: 'Wishlist', icon: Heart, badge: wishlistCount },
        { id: 'settings', label: 'Account Settings', icon: Settings }
    ];

    // Keyboard navigation for tablist
    const handleTabKeyDown = (e, index) => {
        let nextIndex = null;
        if (e.key === 'ArrowRight') {
            nextIndex = (index + 1) % TABS.length;
        } else if (e.key === 'ArrowLeft') {
            nextIndex = (index - 1 + TABS.length) % TABS.length;
        } else if (e.key === 'Home') {
            nextIndex = 0;
        } else if (e.key === 'End') {
            nextIndex = TABS.length - 1;
        }

        if (nextIndex !== null) {
            e.preventDefault();
            const nextTab = TABS[nextIndex];
            setActiveTab(nextTab.id);
            const button = document.getElementById(`profile-tab-${nextTab.id}`);
            if (button) button.focus();
        }
    };

    return (
        <main className="profile-page">
            {/* Header Banner */}
            <header className="profile-header-banner">
                <div className="profile-header-content">
                    <span className="profile-brand-tag">
                        <ShieldCheck size={14} strokeWidth={2.5} aria-hidden="true" />
                        RentIQ Personal Account
                    </span>
                    <h1>Hello, {user?.name || 'Customer'}</h1>
                    <p className="profile-subtitle">
                        Manage your profile, active reservations, rental history, and saved wishlist.
                    </p>
                </div>
                <div className="profile-header-graphic" aria-hidden="true">
                    <div className="profile-avatar-circle">
                        <User className="profile-header-user-icon" size={44} strokeWidth={1.75} />
                        <span className="profile-verified-dot" title="Verified Customer">
                            <ShieldCheck size={14} strokeWidth={2.5} />
                        </span>
                    </div>
                </div>
            </header>

            <div className="profile-dashboard-container">
                {/* ACCESSIBLE TABS NAVIGATION */}
                <div
                    ref={tabListRef}
                    className="profile-tabs-nav"
                    role="tablist"
                    aria-label="Profile dashboard sections"
                >
                    {TABS.map((tab, idx) => {
                        const isActive = activeTab === tab.id;
                        const TabIcon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                id={`profile-tab-${tab.id}`}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`profile-panel-${tab.id}`}
                                tabIndex={isActive ? 0 : -1}
                                className={`profile-tab-button ${isActive ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                            >
                                <span className="tab-icon" aria-hidden="true">
                                    <TabIcon size={17} strokeWidth={2} />
                                </span>
                                <span className="tab-label">{tab.label}</span>
                                {tab.badge !== undefined && tab.badge > 0 && (
                                    <span className="tab-badge" aria-label={`${tab.badge} items`}>
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* TAB PANELS */}

                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <section
                        id="profile-panel-overview"
                        role="tabpanel"
                        aria-labelledby="profile-tab-overview"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="overview-stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon-wrap car-wrap">
                                    <Car size={22} strokeWidth={2} aria-hidden="true" />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-number">{bookings.length}</span>
                                    <span className="stat-name">Total Bookings</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon-wrap active-wrap">
                                    <CalendarCheck size={22} strokeWidth={2} aria-hidden="true" />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-number">{activeBookings.length}</span>
                                    <span className="stat-name">Active Bookings</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon-wrap heart-wrap">
                                    <Heart size={22} strokeWidth={2} aria-hidden="true" />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-number">{wishlistCount}</span>
                                    <span className="stat-name">Saved Vehicles</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-icon-wrap user-wrap">
                                    <UserCheck size={22} strokeWidth={2} aria-hidden="true" />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-badge-role">
                                        {user?.role === 'admin' ? 'Admin' : 'Customer'}
                                    </span>
                                    <span className="stat-name">{user?.email || 'Account'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Spotlight: Next Upcoming Active Rental */}
                        {activeBookings.length > 0 && (
                            <div className="overview-spotlight-card">
                                <div className="spotlight-top-bar">
                                    <div className="spotlight-badge">
                                        <Car size={13} strokeWidth={2.5} aria-hidden="true" />
                                        <span>NEXT ACTIVE RESERVATION</span>
                                    </div>
                                    <span className="spotlight-booking-id">#{activeBookings[0].booking_id}</span>
                                </div>
                                <div className="spotlight-content">
                                    <div className="spotlight-img-wrap">
                                        <img
                                            src={getVehicleImageUrl(activeBookings[0])}
                                            alt={activeBookings[0].vehicle_name}
                                            className="spotlight-img"
                                            onError={handleVehicleImageError}
                                        />
                                    </div>
                                    <div className="spotlight-meta">
                                        <span className="spotlight-category">
                                            {activeBookings[0].category_name || 'Vehicle Rental'}
                                        </span>
                                        <h3>{activeBookings[0].vehicle_name}</h3>
                                        <div className="spotlight-details-row">
                                            <span className="spotlight-detail-item">
                                                <Calendar size={15} strokeWidth={2} aria-hidden="true" />
                                                <span>Pickup: <strong>{formatDate(activeBookings[0].pickup_datetime || activeBookings[0].start_date)}</strong></span>
                                            </span>
                                            <span className="spotlight-detail-item">
                                                <Clock size={15} strokeWidth={2} aria-hidden="true" />
                                                <span>Return: <strong>{formatDate(activeBookings[0].return_datetime || activeBookings[0].end_date)}</strong></span>
                                            </span>
                                        </div>
                                        <div className="spotlight-status-row">
                                            <span className={`booking-status-badge status-${activeBookings[0].status?.toLowerCase()}`}>
                                                <span className="status-indicator-dot" aria-hidden="true" />
                                                {activeBookings[0].status}
                                            </span>
                                            <span className="spotlight-price">
                                                ₹{Number(activeBookings[0].total_price).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="spotlight-action-btn"
                                        onClick={() => handleOpenDetails(activeBookings[0])}
                                    >
                                        <span>View Details</span>
                                        <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Quick Shortcuts */}
                        <div className="overview-shortcuts-grid">
                            <div className="shortcut-card" onClick={() => setActiveTab('license')}>
                                <h4>Driving Licence Verification</h4>
                                <p>
                                    {licenseInfo?.status === 'verified'
                                        ? 'Your driving licence is verified and active for bookings.'
                                        : licenseInfo?.status === 'pending'
                                            ? 'Licence verification is currently in progress.'
                                            : licenseInfo?.status === 'rejected'
                                                ? 'Verification rejected. Action required to resubmit.'
                                                : 'Upload your driving licence to enable vehicle rentals.'}
                                </p>
                                <span className="shortcut-link">
                                    {licenseInfo?.status === 'verified' ? 'View Licence Details →' : 'Complete Verification →'}
                                </span>
                            </div>

                            <div className="shortcut-card" onClick={() => setActiveTab('active')}>
                                <h4>Manage Bookings</h4>
                                <p>View details, check status, or modify active vehicle reservations.</p>
                                <span className="shortcut-link">Open Active ({activeBookings.length}) →</span>
                            </div>

                            <div className="shortcut-card" onClick={() => setActiveTab('wishlist')}>
                                <h4>Your Saved Fleet</h4>
                                <p>Check vehicles you&apos;ve bookmarked for your upcoming trips.</p>
                                <span className="shortcut-link">Open Wishlist ({wishlistCount}) →</span>
                            </div>

                            <div className="shortcut-card" onClick={() => setActiveTab('settings')}>
                                <h4>Account & Profile</h4>
                                <p>Update your personal information and profile settings.</p>
                                <span className="shortcut-link">Edit Profile →</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* 2. DRIVING LICENCE TAB */}
                {activeTab === 'license' && (
                    <section
                        id="profile-panel-license"
                        role="tabpanel"
                        aria-labelledby="profile-tab-license"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="tab-panel-header">
                            <div>
                                <h2>Driving Licence & Identity Verification</h2>
                                <p>
                                    Submit your official driving licence to verify your identity and unlock vehicle bookings across the RentIQ fleet.
                                </p>
                            </div>
                        </div>

                        {/* Customer Notifications Banner */}
                        {notifications.filter(n => ['license_verified', 'license_rejected', 'license_submitted'].includes(n.type)).length > 0 && (
                            <div className="profile-notifications-area">
                                {notifications
                                    .filter(n => ['license_verified', 'license_rejected', 'license_submitted'].includes(n.type))
                                    .slice(0, 2)
                                    .map(notif => (
                                        <div key={notif.notification_id} className={`profile-notif-pill notif-${notif.type}`}>
                                            <div className="notif-content">
                                                <strong>{notif.title}</strong>
                                                <p>{notif.message}</p>
                                            </div>
                                            <span className="notif-time">{notif.created_at ? notif.created_at.split(' ')[0] : ''}</span>
                                        </div>
                                    ))}
                            </div>
                        )}

                        {licenseLoading ? (
                            <Loader message="Loading driving licence verification status..." />
                        ) : (
                            <div className="license-tab-content">
                                {/* Current Status Hero Banner */}
                                {licenseInfo?.status === 'verified' && (
                                    <div className="lic-status-banner banner-verified">
                                        <div className="status-banner-icon">
                                            <CheckCircle2 size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="status-banner-text">
                                            <h3>Your driving licence has been successfully verified.</h3>
                                            <p>You are officially cleared to reserve eligible RentIQ self-drive vehicles. Drive responsibly!</p>
                                        </div>
                                        <span className="status-badge-verified">Verified Driver</span>
                                    </div>
                                )}

                                {licenseInfo?.status === 'pending' && (
                                    <div className="lic-status-banner banner-pending">
                                        <div className="status-banner-icon">
                                            <Clock size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="status-banner-text">
                                            <h3>Driving licence verification pending</h3>
                                            <p>Your documents have been submitted and are currently awaiting review by RentIQ operations.</p>
                                        </div>
                                        <span className="status-badge-pending">Under Review</span>
                                    </div>
                                )}

                                {licenseInfo?.status === 'rejected' && (
                                    <div className="lic-status-banner banner-rejected">
                                        <div className="status-banner-icon">
                                            <AlertTriangle size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="status-banner-text">
                                            <h3>Your driving licence verification was rejected.</h3>
                                            <p>Please review the administrator remarks below and resubmit clear, updated documents.</p>
                                        </div>
                                        <span className="status-badge-rejected">Action Required</span>
                                    </div>
                                )}

                                {licenseInfo?.status === 'expired' && (
                                    <div className="lic-status-banner banner-expired">
                                        <div className="status-banner-icon">
                                            <Clock size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="status-banner-text">
                                            <h3>Your driving licence has expired. Please upload updated documents.</h3>
                                            <p>To ensure road regulatory compliance, you must provide your renewed licence before making a booking.</p>
                                        </div>
                                        <span className="status-badge-expired">Expired</span>
                                    </div>
                                )}

                                {licenseInfo?.status === 'not_submitted' && (
                                    <div className="lic-status-banner banner-not-submitted">
                                        <div className="status-banner-icon">
                                            <IdCard size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="status-banner-text">
                                            <h3>Driving licence verification required for bookings</h3>
                                            <p>Complete the quick submission form below with your licence details and document images.</p>
                                        </div>
                                        <span className="status-badge-required">Required</span>
                                    </div>
                                )}

                                {/* Feedback Alerts */}
                                {licenseError && (
                                    <div className="profile-lic-alert alert-error">
                                        <AlertTriangle size={18} />
                                        <span>{licenseError}</span>
                                    </div>
                                )}
                                {licenseSuccess && (
                                    <div className="profile-lic-alert alert-success">
                                        <CheckCircle2 size={18} />
                                        <span>{licenseSuccess}</span>
                                    </div>
                                )}

                                {/* Admin Rejection Reason Display */}
                                {licenseInfo?.status === 'rejected' && licenseInfo?.license?.rejection_reason && (
                                    <div className="admin-rejection-callout">
                                        <strong>Administrator Rejection Reason:</strong>
                                        <p>&quot;{licenseInfo.license.rejection_reason}&quot;</p>
                                    </div>
                                )}

                                {/* Display Submitted Details Card if already submitted and not currently editing */}
                                {licenseInfo?.hasSubmitted && !showEditLicForm && licenseInfo?.status !== 'rejected' && licenseInfo?.status !== 'expired' ? (
                                    <div className="lic-dossier-card">
                                        <div className="lic-dossier-header">
                                            <div className="dossier-title">
                                                <IdCard size={20} className="dossier-icon" />
                                                <h4>Driving Licence Record</h4>
                                            </div>
                                            <button
                                                type="button"
                                                className="lic-update-toggle-btn"
                                                onClick={() => setShowEditLicForm(true)}
                                            >
                                                Update / Renew Licence
                                            </button>
                                        </div>

                                        <div className="lic-dossier-grid">
                                            <div className="dossier-item">
                                                <span>Licence Number</span>
                                                <strong>{licenseInfo.license.license_number}</strong>
                                            </div>
                                            <div className="dossier-item">
                                                <span>Holder Name</span>
                                                <strong>{licenseInfo.license.holder_name}</strong>
                                            </div>
                                            <div className="dossier-item">
                                                <span>Vehicle Class</span>
                                                <strong className="class-tag">{licenseInfo.license.vehicle_class || 'LMV'}</strong>
                                            </div>
                                            <div className="dossier-item">
                                                <span>Date of Birth</span>
                                                <strong>{licenseInfo.license.date_of_birth ? licenseInfo.license.date_of_birth.split('T')[0] : 'Not specified'}</strong>
                                            </div>
                                            <div className="dossier-item">
                                                <span>Issue Date</span>
                                                <strong>{licenseInfo.license.issue_date ? licenseInfo.license.issue_date.split('T')[0] : '—'}</strong>
                                            </div>
                                            <div className="dossier-item">
                                                <span>Expiry Date</span>
                                                <strong>{licenseInfo.license.expiry_date ? licenseInfo.license.expiry_date.split('T')[0] : '—'}</strong>
                                            </div>
                                        </div>

                                        <div className="lic-attached-docs-row">
                                            <span>Attached Documents:</span>
                                            <div className="doc-download-buttons">
                                                {licenseInfo.license.has_front && (
                                                    <button
                                                        type="button"
                                                        className="doc-dl-btn"
                                                        onClick={() => handleDownloadMyDoc('front')}
                                                    >
                                                        <Download size={14} />
                                                        Download Front Document
                                                    </button>
                                                )}
                                                {licenseInfo.license.has_back && (
                                                    <button
                                                        type="button"
                                                        className="doc-dl-btn"
                                                        onClick={() => handleDownloadMyDoc('back')}
                                                    >
                                                        <Download size={14} />
                                                        Download Back Document
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Submission / Resubmission Form */
                                    <form className="lic-submission-form" onSubmit={handleLicenseSubmit}>
                                        <div className="form-subheading">
                                            <h4>{licenseInfo?.hasSubmitted ? 'Resubmit Driving Licence Documents' : 'Submit Driving Licence Information'}</h4>
                                            {showEditLicForm && (
                                                <button
                                                    type="button"
                                                    className="cancel-edit-btn"
                                                    onClick={() => setShowEditLicForm(false)}
                                                >
                                                    Cancel Edit
                                                </button>
                                            )}
                                        </div>

                                        <div className="lic-form-grid">
                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-num">Driving Licence Number *</label>
                                                <input
                                                    id="cust-lic-num"
                                                    type="text"
                                                    required
                                                    value={licNumber}
                                                    onChange={(e) => setLicNumber(e.target.value)}
                                                    placeholder="e.g. DL-0420110012345 or UP-1620200054321"
                                                />
                                            </div>

                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-holder">Licence Holder Full Name *</label>
                                                <input
                                                    id="cust-lic-holder"
                                                    type="text"
                                                    required
                                                    value={licHolderName}
                                                    onChange={(e) => setLicHolderName(e.target.value)}
                                                    placeholder="As printed on driving licence"
                                                />
                                            </div>

                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-dob">Date of Birth</label>
                                                <input
                                                    id="cust-lic-dob"
                                                    type="date"
                                                    value={licDob}
                                                    onChange={(e) => setLicDob(e.target.value)}
                                                />
                                            </div>

                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-class">Vehicle Class *</label>
                                                <select
                                                    id="cust-lic-class"
                                                    value={licVehicleClass}
                                                    onChange={(e) => setLicVehicleClass(e.target.value)}
                                                >
                                                    <option value="LMV">LMV (Light Motor Vehicle - Cars, SUVs, Sedans)</option>
                                                    <option value="MCWG">MCWG (Motorcycle With Gear - Two Wheelers)</option>
                                                    <option value="ALL">ALL (Both Two-Wheeler & Four-Wheeler)</option>
                                                </select>
                                            </div>

                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-issue">Licence Issue Date *</label>
                                                <input
                                                    id="cust-lic-issue"
                                                    type="date"
                                                    required
                                                    value={licIssueDate}
                                                    onChange={(e) => setLicIssueDate(e.target.value)}
                                                />
                                            </div>

                                            <div className="lic-field">
                                                <label htmlFor="cust-lic-expiry">Licence Expiry Date *</label>
                                                <input
                                                    id="cust-lic-expiry"
                                                    type="date"
                                                    required
                                                    value={licExpiryDate}
                                                    onChange={(e) => setLicExpiryDate(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="lic-upload-row">
                                            <div className="lic-field-file">
                                                <label>Front-Side Licence Image / PDF *</label>
                                                <div className="lic-drop-box">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(e) => setFrontDocFile(e.target.files?.[0] || null)}
                                                        required={!licenseInfo?.license?.has_front}
                                                    />
                                                    <div className="lic-drop-label">
                                                        <UploadCloud size={24} />
                                                        <span>
                                                            {frontDocFile
                                                                ? `Selected: ${frontDocFile.name}`
                                                                : licenseInfo?.license?.has_front
                                                                    ? 'Replace current front document'
                                                                    : 'Choose front-side file (PDF/JPG/PNG)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="lic-field-file">
                                                <label>Back-Side Licence Image / PDF (Optional)</label>
                                                <div className="lic-drop-box">
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(e) => setBackDocFile(e.target.files?.[0] || null)}
                                                    />
                                                    <div className="lic-drop-label">
                                                        <UploadCloud size={24} />
                                                        <span>
                                                            {backDocFile
                                                                ? `Selected: ${backDocFile.name}`
                                                                : licenseInfo?.license?.has_back
                                                                    ? 'Replace current back document'
                                                                    : 'Choose back-side file (PDF/JPG/PNG)'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="lic-form-submit-row">
                                            <button
                                                type="submit"
                                                className="lic-submit-btn"
                                                disabled={licenseSubmitting}
                                            >
                                                {licenseSubmitting ? 'Submitting Documents...' : 'Submit Licence for Verification'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </section>
                )}

                {/* 2. ACTIVE BOOKINGS TAB */}
                {activeTab === 'active' && (
                    <section
                        id="profile-panel-active"
                        role="tabpanel"
                        aria-labelledby="profile-tab-active"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="tab-panel-header">
                            <div>
                                <h2>Active Bookings</h2>
                                <p>Pending and confirmed vehicle reservations awaiting pickup or currently in progress.</p>
                            </div>
                        </div>

                        {loading ? (
                            <Loader message="Loading active bookings..." />
                        ) : error ? (
                            <div className="profile-error-box" role="alert">{error}</div>
                        ) : activeBookings.length === 0 ? (
                            <div className="profile-empty-history">
                                <div className="empty-history-icon-wrap">
                                    <Car size={38} strokeWidth={1.75} aria-hidden="true" />
                                </div>
                                <h3>No active bookings</h3>
                                <p>You do not have any pending or confirmed bookings at the moment.</p>
                                <Link to="/vehicles" className="browse-vehicles-cta">
                                    Browse Vehicles & Book
                                </Link>
                            </div>
                        ) : (
                            <div className="rental-booking-list">
                                {activeBookings.map((booking) => {
                                    const vehicleImg = getVehicleImageUrl(booking);
                                    const durationText =
                                        booking.duration ||
                                        calculateRentalDuration(
                                            booking.pickup_datetime || booking.start_date,
                                            booking.return_datetime || booking.end_date
                                        ).display ||
                                        '—';

                                    return (
                                        <article key={booking.booking_id} className="booking-history-card">
                                            <div className="booking-card-media">
                                                <img
                                                    src={vehicleImg}
                                                    alt={booking.vehicle_name || 'Vehicle'}
                                                    className="booking-card-img"
                                                    loading="lazy"
                                                    onError={handleVehicleImageError}
                                                />
                                            </div>

                                            <div className="booking-card-body">
                                                <div className="booking-card-header">
                                                    <div>
                                                        <span className="booking-card-category">
                                                            {booking.category_name || 'Vehicle Rental'}
                                                        </span>
                                                        <h3 className="booking-card-title">
                                                            {booking.vehicle_name || 'Vehicle'}
                                                        </h3>
                                                    </div>
                                                    <span className={`booking-status-badge status-${booking.status?.toLowerCase()}`}>
                                                        <span className="status-indicator-dot" aria-hidden="true" />
                                                        {booking.status}
                                                    </span>
                                                </div>

                                                <div className="booking-card-grid">
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Calendar size={13} strokeWidth={2} aria-hidden="true" />
                                                            Pickup Schedule
                                                        </span>
                                                        <span className="grid-value">
                                                            {formatDate(booking.pickup_datetime || booking.start_date)}
                                                        </span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Calendar size={13} strokeWidth={2} aria-hidden="true" />
                                                            Return Schedule
                                                        </span>
                                                        <span className="grid-value">
                                                            {formatDate(booking.return_datetime || booking.end_date)}
                                                        </span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Clock size={13} strokeWidth={2} aria-hidden="true" />
                                                            Duration
                                                        </span>
                                                        <span className="grid-value">{durationText}</span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">Total Price</span>
                                                        <strong className="grid-price">
                                                            ₹{Number(booking.total_price).toLocaleString('en-IN')}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="booking-card-actions">
                                                    <button
                                                        type="button"
                                                        className="booking-details-btn"
                                                        onClick={() => handleOpenDetails(booking)}
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* 3. RENTAL HISTORY TAB */}
                {activeTab === 'history' && (
                    <section
                        id="profile-panel-history"
                        role="tabpanel"
                        aria-labelledby="profile-tab-history"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="tab-panel-header">
                            <div>
                                <h2>Rental History</h2>
                                <p>Past completed and cancelled rental reservations.</p>
                            </div>
                        </div>

                        {loading ? (
                            <Loader message="Loading rental history..." />
                        ) : error ? (
                            <div className="profile-error-box" role="alert">{error}</div>
                        ) : pastBookings.length === 0 ? (
                            <div className="profile-empty-history">
                                <div className="empty-history-icon-wrap">
                                    <History size={38} strokeWidth={1.75} aria-hidden="true" />
                                </div>
                                <h3>No past rentals yet</h3>
                                <p>You haven&apos;t completed any vehicle trips yet.</p>
                                <Link to="/vehicles" className="browse-vehicles-cta">
                                    Explore Vehicles
                                </Link>
                            </div>
                        ) : (
                            <div className="rental-booking-list">
                                {pastBookings.map((booking) => {
                                    const vehicleImg = getVehicleImageUrl(booking);
                                    const durationText =
                                        booking.duration ||
                                        calculateRentalDuration(
                                            booking.pickup_datetime || booking.start_date,
                                            booking.return_datetime || booking.end_date
                                        ).display ||
                                        '—';

                                    return (
                                        <article key={booking.booking_id} className="booking-history-card">
                                            <div className="booking-card-media">
                                                <img
                                                    src={vehicleImg}
                                                    alt={booking.vehicle_name || 'Vehicle'}
                                                    className="booking-card-img"
                                                    loading="lazy"
                                                    onError={handleVehicleImageError}
                                                />
                                            </div>

                                            <div className="booking-card-body">
                                                <div className="booking-card-header">
                                                    <div>
                                                        <span className="booking-card-category">
                                                            {booking.category_name || 'Vehicle Rental'}
                                                        </span>
                                                        <h3 className="booking-card-title">
                                                            {booking.vehicle_name || 'Vehicle'}
                                                        </h3>
                                                    </div>
                                                    <span className={`booking-status-badge status-${booking.status?.toLowerCase()}`}>
                                                        <span className="status-indicator-dot" aria-hidden="true" />
                                                        {booking.status}
                                                    </span>
                                                </div>

                                                <div className="booking-card-grid">
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Calendar size={13} strokeWidth={2} aria-hidden="true" />
                                                            Pickup Schedule
                                                        </span>
                                                        <span className="grid-value">
                                                            {formatDate(booking.pickup_datetime || booking.start_date)}
                                                        </span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Calendar size={13} strokeWidth={2} aria-hidden="true" />
                                                            Return Schedule
                                                        </span>
                                                        <span className="grid-value">
                                                            {formatDate(booking.return_datetime || booking.end_date)}
                                                        </span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">
                                                            <Clock size={13} strokeWidth={2} aria-hidden="true" />
                                                            Duration
                                                        </span>
                                                        <span className="grid-value">{durationText}</span>
                                                    </div>
                                                    <div className="booking-grid-item">
                                                        <span className="grid-label">Total Price</span>
                                                        <strong className="grid-price">
                                                            ₹{Number(booking.total_price).toLocaleString('en-IN')}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="booking-card-actions">
                                                    <button
                                                        type="button"
                                                        className="booking-details-btn"
                                                        onClick={() => handleOpenDetails(booking)}
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* 4. WISHLIST TAB */}
                {activeTab === 'wishlist' && (
                    <section
                        id="profile-panel-wishlist"
                        role="tabpanel"
                        aria-labelledby="profile-tab-wishlist"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="tab-panel-header">
                            <div>
                                <h2>Saved Wishlist</h2>
                                <p>Vehicles you have saved for future road trips, weekend getaways, and rentals.</p>
                            </div>
                        </div>

                        {wishlist.length === 0 ? (
                            <div className="profile-empty-history">
                                <div className="empty-history-icon-wrap">
                                    <Heart size={38} strokeWidth={1.75} aria-hidden="true" />
                                </div>
                                <h3>Your wishlist is empty</h3>
                                <p>Save vehicles you like while browsing our fleet to easily find them later.</p>
                                <Link to="/vehicles" className="browse-vehicles-cta">
                                    Browse Fleet
                                </Link>
                            </div>
                        ) : (
                            <div className="profile-wishlist-grid">
                                {wishlist.map((item) => {
                                    const vId = item.vehicle_id;
                                    const vehicleImg = getVehicleImageUrl(item);

                                    return (
                                        <div key={vId} className="profile-wishlist-card">
                                            <div className="wishlist-img-wrap">
                                                <img
                                                    src={vehicleImg}
                                                    alt={item.name}
                                                    className="wishlist-card-img"
                                                    onError={handleVehicleImageError}
                                                />
                                            </div>

                                            <div className="wishlist-card-content">
                                                <span className="wishlist-category-tag">{item.category || 'Rental'}</span>
                                                <h3 className="wishlist-card-name">{item.name}</h3>
                                                <p className="wishlist-card-brand">{item.brand || 'RentIQ Fleet'}</p>

                                                <div className="wishlist-card-specs">
                                                    <span>
                                                        <Users size={14} strokeWidth={2} aria-hidden="true" />
                                                        {item.seating_capacity || 4} seats
                                                    </span>
                                                    <span>
                                                        <Settings2 size={14} strokeWidth={2} aria-hidden="true" />
                                                        {item.transmission || 'automatic'}
                                                    </span>
                                                </div>

                                                <div className="wishlist-card-price">
                                                    <strong>₹{Number(item.price_per_day).toLocaleString('en-IN')}</strong>
                                                    <small>/day</small>
                                                </div>

                                                <div className="wishlist-card-buttons">
                                                    <Link to={`/vehicles/${vId}`} className="wishlist-book-link">
                                                        Book Now →
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="wishlist-remove-button"
                                                        onClick={() => removeFromWishlist(vId, item.name)}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* 5. ACCOUNT SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <section
                        id="profile-panel-settings"
                        role="tabpanel"
                        aria-labelledby="profile-tab-settings"
                        tabIndex={0}
                        className="profile-tab-panel"
                    >
                        <div className="tab-panel-header">
                            <div>
                                <h2>Account Settings</h2>
                                <p>Manage your account profile, credentials, and session.</p>
                            </div>
                        </div>

                        <div className="settings-cards-layout">
                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <h3>Personal Information</h3>
                                    <button
                                        type="button"
                                        className="edit-profile-btn"
                                        onClick={() => {
                                            setEditName(user?.name || '');
                                            setEditError('');
                                            setIsEditingProfile(true);
                                        }}
                                    >
                                        Edit Profile
                                    </button>
                                </div>

                                <div className="settings-fields-list">
                                    <div className="settings-field">
                                        <span className="s-label">Full Name</span>
                                        <strong className="s-value">{user?.name || '—'}</strong>
                                    </div>
                                    <div className="settings-field">
                                        <span className="s-label">Email Address</span>
                                        <strong className="s-value">{user?.email || '—'}</strong>
                                    </div>
                                    <div className="settings-field">
                                        <span className="s-label">Account Role</span>
                                        <span className="role-badge">
                                            {user?.role === 'admin' ? 'Administrator' : 'Customer Account'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <div className="settings-card-header">
                                    <h3>Account Security</h3>
                                </div>
                                <p className="settings-desc">
                                    You are signed into your personal RentIQ account. Manage session access below.
                                </p>
                                <div className="settings-actions">
                                    <button
                                        type="button"
                                        className="logout-action-btn"
                                        onClick={handleLogout}
                                    >
                                        Log Out of Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </div>

            {/* Booking Details Modal via React Portal to document.body */}
            {selectedBooking && createPortal(
                <div
                    className="booking-modal-overlay"
                    onClick={handleCloseModal}
                    role="presentation"
                >
                    <div
                        className="booking-details-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-booking-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="booking-modal-header">
                            <div>
                                <span className="booking-modal-eyebrow">
                                    RESERVATION DETAILS · #{selectedBooking.booking_id}
                                </span>
                                <h2 id="modal-booking-title">
                                    {selectedBooking.vehicle_name || 'Vehicle'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                className="booking-modal-close"
                                onClick={handleCloseModal}
                                disabled={cancelling}
                                aria-label="Close booking details"
                            >
                                <X size={20} strokeWidth={2} />
                            </button>
                        </div>

                        <div className="booking-modal-status-bar">
                            <span className="modal-status-label">Reservation Status:</span>
                            <span className={`booking-status-badge status-${selectedBooking.status?.toLowerCase()}`}>
                                <span className="status-indicator-dot" aria-hidden="true" />
                                {selectedBooking.status}
                            </span>
                        </div>

                        <div className="booking-modal-grid">
                            <div className="modal-grid-cell">
                                <span className="cell-label">
                                    <Calendar size={14} strokeWidth={2} aria-hidden="true" />
                                    Pickup Schedule
                                </span>
                                <strong className="cell-value">
                                    {formatDate(selectedBooking.pickup_datetime || selectedBooking.start_date)}
                                </strong>
                            </div>
                            <div className="modal-grid-cell">
                                <span className="cell-label">
                                    <Calendar size={14} strokeWidth={2} aria-hidden="true" />
                                    Return Schedule
                                </span>
                                <strong className="cell-value">
                                    {formatDate(selectedBooking.return_datetime || selectedBooking.end_date)}
                                </strong>
                            </div>
                            <div className="modal-grid-cell">
                                <span className="cell-label">
                                    <Clock size={14} strokeWidth={2} aria-hidden="true" />
                                    Rental Duration
                                </span>
                                <strong className="cell-value">
                                    {selectedBooking.duration ||
                                        calculateRentalDuration(
                                            selectedBooking.pickup_datetime || selectedBooking.start_date,
                                            selectedBooking.return_datetime || selectedBooking.end_date
                                        ).display ||
                                        '—'}
                                </strong>
                            </div>
                            <div className="modal-grid-cell">
                                <span className="cell-label">
                                    <Car size={14} strokeWidth={2} aria-hidden="true" />
                                    Vehicle Category
                                </span>
                                <strong className="cell-value">
                                    {selectedBooking.category_name || 'Standard Fleet'}
                                </strong>
                            </div>
                        </div>

                        <div className="booking-modal-price-card">
                            <div>
                                <span>Total Rental Price</span>
                                <small>For your selected rental period</small>
                            </div>
                            <strong>
                                ₹{Number(selectedBooking.total_price).toLocaleString('en-IN')}
                            </strong>
                        </div>

                        {/* Cancellation Feedback Alerts */}
                        {cancelSuccess && (
                            <div className="booking-modal-alert success" role="status">
                                {cancelSuccess}
                            </div>
                        )}

                        {cancelError && (
                            <div className="booking-modal-alert error" role="alert">
                                {cancelError}
                            </div>
                        )}

                        {/* Modal Actions */}
                        <div className="booking-modal-actions">
                            {isEligibleForCancellation && !showCancelConfirm && (
                                <button
                                    type="button"
                                    className="booking-modal-cancel-btn"
                                    onClick={() => {
                                        setShowCancelConfirm(true);
                                        setCancelError('');
                                    }}
                                    disabled={cancelling}
                                >
                                    Cancel Booking
                                </button>
                            )}

                            {showCancelConfirm && (
                                <div className="booking-cancel-confirm">
                                    <p>
                                        Are you sure you want to cancel this booking? This action cannot be undone.
                                    </p>
                                    <div className="booking-cancel-confirm-btns">
                                        <button
                                            type="button"
                                            className="booking-cancel-confirm-btn"
                                            onClick={handleCancelBooking}
                                            disabled={cancelling}
                                        >
                                            {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
                                        </button>
                                        <button
                                            type="button"
                                            className="booking-cancel-abort-btn"
                                            onClick={() => {
                                                if (!cancelling) {
                                                    setShowCancelConfirm(false);
                                                    setCancelError('');
                                                }
                                            }}
                                            disabled={cancelling}
                                        >
                                            Keep Booking
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="button"
                                className="booking-modal-done"
                                onClick={handleCloseModal}
                                disabled={cancelling}
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Profile Modal via React Portal to document.body */}
            {isEditingProfile && createPortal(
                <div
                    className="booking-modal-overlay"
                    onClick={() => !editSaving && setIsEditingProfile(false)}
                    role="presentation"
                >
                    <div
                        className="profile-edit-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="edit-profile-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="booking-modal-header">
                            <div>
                                <span className="booking-modal-eyebrow">RENTIQ · ACCOUNT SETTINGS</span>
                                <h2 id="edit-profile-title">Edit Profile</h2>
                            </div>
                            <button
                                type="button"
                                className="booking-modal-close"
                                onClick={() => !editSaving && setIsEditingProfile(false)}
                                aria-label="Close edit profile"
                            >
                                <X size={20} strokeWidth={2} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveProfile} className="profile-edit-form">
                            <div className="form-group">
                                <label htmlFor="edit-profile-name">Full Name</label>
                                <input
                                    id="edit-profile-name"
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="profile-edit-input"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="edit-profile-email">Email Address</label>
                                <input
                                    id="edit-profile-email"
                                    type="email"
                                    value={user?.email || ''}
                                    disabled
                                    className="profile-edit-input disabled-input"
                                />
                                <span className="field-hint">Email address cannot be changed</span>
                            </div>

                            {editError && (
                                <div className="booking-modal-alert error" role="alert">
                                    {editError}
                                </div>
                            )}

                            <div className="profile-edit-actions">
                                <button
                                    type="submit"
                                    className="profile-save-btn"
                                    disabled={editSaving}
                                >
                                    {editSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    type="button"
                                    className="profile-cancel-btn"
                                    onClick={() => setIsEditingProfile(false)}
                                    disabled={editSaving}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </main>
    );
}

export default Profile;