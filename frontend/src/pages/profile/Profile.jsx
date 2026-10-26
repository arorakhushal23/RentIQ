import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
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
    X
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

    const [activeTab, setActiveTab] = useState('overview');
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    const isEligibleForCancellation =
        selectedBooking &&
        ['pending', 'confirmed'].includes(selectedBooking.status?.toLowerCase());

    const TABS = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
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