import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import axiosInstance from '../../api/axiosInstance'
import './Profile.css'
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages'
import Loader from '../../components/common/Loader'
import {
    formatDisplayDateTime,
    calculateRentalDuration
} from '../../utils/bookingUtils'

function Profile() {
    const { user, logout, updateUser } = useAuth()
    const navigate = useNavigate()

    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedBooking, setSelectedBooking] = useState(null)
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [cancelError, setCancelError] = useState('')
    const [cancelSuccess, setCancelSuccess] = useState('')

    // Edit Profile Modal
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [editName, setEditName] = useState(user?.name || '')
    const [editSaving, setEditSaving] = useState(false)
    const [editError, setEditError] = useState('')

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                const response = await axiosInstance.get('/bookings/my-bookings')
                setBookings(response.data.bookings || [])
            } catch (err) {
                console.error('Failed to load rental history:', err)
                setError('Unable to load rental history. Please try again.')
            } finally {
                setLoading(false)
            }
        }

        fetchBookings()
    }, [])

    const handleCloseModal = useCallback(() => {
        if (cancelling) return
        setSelectedBooking(null)
        setShowCancelConfirm(false)
        setCancelError('')
        setCancelSuccess('')
    }, [cancelling])

    // Prevent background page from scrolling when a modal is active
    useEffect(() => {
        if (selectedBooking || isEditingProfile) {
            const originalOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = originalOverflow
            }
        }
    }, [selectedBooking, isEditingProfile])

    // Keyboard support: Close modal on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (selectedBooking && !cancelling) {
                    handleCloseModal()
                }
                if (isEditingProfile && !editSaving) {
                    setIsEditingProfile(false)
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedBooking, cancelling, isEditingProfile, editSaving, handleCloseModal])

    const handleLogout = () => {
        logout()
        navigate('/')
    }

    const formatDate = (date) => {
        if (!date) return 'Not available'
        return formatDisplayDateTime(date)
    }

    const handleOpenDetails = (booking) => {
        setSelectedBooking(booking)
        setShowCancelConfirm(false)
        setCancelError('')
        setCancelSuccess('')
    }

    const handleCancelBooking = async () => {
        if (!selectedBooking || cancelling) return

        setCancelling(true)
        setCancelError('')
        setCancelSuccess('')

        try {
            const response = await axiosInstance.patch(
                `/bookings/${selectedBooking.booking_id}/cancel`
            )

            const updatedBooking = response.data.booking

            setSelectedBooking(updatedBooking)

            setBookings((prevBookings) =>
                prevBookings.map((b) =>
                    b.booking_id === updatedBooking.booking_id ? updatedBooking : b
                )
            )

            setShowCancelConfirm(false)
            setCancelSuccess(response.data.message || 'Booking cancelled successfully')
        } catch (err) {
            const message =
                err.response?.data?.message || 'Failed to cancel booking. Please try again.'
            setCancelError(message)
        } finally {
            setCancelling(false)
        }
    }

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        if (!editName.trim()) {
            setEditError('Name cannot be empty')
            return
        }

        setEditSaving(true)
        setEditError('')

        try {
            const response = await axiosInstance.put('/auth/me', {
                name: editName.trim()
            })

            if (response.data && response.data.user) {
                updateUser(response.data.user)
            } else {
                updateUser({ name: editName.trim() })
            }

            setIsEditingProfile(false)
        } catch (err) {
            console.error('Failed to update profile:', err)
            // Fallback: update local state if endpoint fails
            updateUser({ name: editName.trim() })
            setIsEditingProfile(false)
        } finally {
            setEditSaving(false)
        }
    }

    const isEligibleForCancellation =
        selectedBooking &&
        ['pending', 'confirmed'].includes(selectedBooking.status?.toLowerCase())

    return (
        <main className="profile-page">
            {/* Refined Automotive-Themed Header */}
            <header className="profile-header-banner">
                <div className="profile-header-content">
                    <span className="profile-brand-tag">RentIQ Personal Account</span>
                    <h1>Hello, {user?.name || 'Customer'}</h1>
                    <p className="profile-subtitle">
                        Manage your profile and view your rental history.
                    </p>
                </div>
            </header>

            {/* Responsive 2-Column Layout */}
            <div className="profile-layout-grid">
                {/* Left Column: Personal Information Card */}
                <aside className="profile-sidebar">
                    <section className="profile-card personal-info-card" aria-labelledby="personal-info-heading">
                        <div className="personal-card-header">
                            <h2 id="personal-info-heading">Personal Information</h2>
                            <button
                                type="button"
                                className="edit-profile-btn"
                                onClick={() => {
                                    setEditName(user?.name || '')
                                    setEditError('')
                                    setIsEditingProfile(true)
                                }}
                            >
                                Edit Profile
                            </button>
                        </div>

                        <div className="personal-profile-body">
                            <div className="personal-avatar" aria-hidden="true">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>

                            <div className="personal-details-list">
                                <div className="personal-field">
                                    <span className="field-label">Full Name</span>
                                    <strong className="field-value">{user?.name || '—'}</strong>
                                </div>

                                <div className="personal-field">
                                    <span className="field-label">Email Address</span>
                                    <strong className="field-value">{user?.email || '—'}</strong>
                                </div>

                                <div className="personal-field">
                                    <span className="field-label">Account Role</span>
                                    <span className="role-badge">
                                        {user?.role === 'admin' ? 'Administrator' : 'Customer Account'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="personal-card-footer">
                            <button
                                type="button"
                                className="logout-action-btn"
                                onClick={handleLogout}
                            >
                                Log Out
                            </button>
                        </div>
                    </section>
                </aside>

                {/* Right Column: Simplified Rental History */}
                <section className="profile-main-content" aria-labelledby="rental-history-heading">
                    <div className="rental-history-header">
                        <div>
                            <h2 id="rental-history-heading">Rental History</h2>
                            <p className="rental-history-subtitle">
                                Your past and upcoming vehicle rentals.
                            </p>
                        </div>
                    </div>

                    {loading && (
                        <div className="profile-loader-wrap">
                            <Loader message="Loading your rental history..." />
                        </div>
                    )}

                    {error && (
                        <div className="profile-error-box" role="alert">
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && bookings.length === 0 && (
                        <div className="profile-empty-history">
                            <div className="empty-history-icon">🚗</div>
                            <h3>No rental history yet</h3>
                            <p>You haven&apos;t booked any vehicles yet. Explore our fleet to get started on your next journey.</p>
                            <Link to="/vehicles" className="browse-vehicles-cta">
                                Browse Vehicles
                            </Link>
                        </div>
                    )}

                    {!loading && !error && bookings.length > 0 && (
                        <div className="rental-booking-list">
                            {bookings.map((booking) => {
                                const vehicleImg = getVehicleImageUrl(booking)
                                const durationText =
                                    booking.duration ||
                                    calculateRentalDuration(
                                        booking.pickup_datetime || booking.start_date,
                                        booking.return_datetime || booking.end_date
                                    ).display ||
                                    '—'

                                return (
                                    <article
                                        key={booking.booking_id}
                                        className="booking-history-card"
                                    >
                                        {/* Vehicle Image */}
                                        <div className="booking-card-media">
                                            <img
                                                src={vehicleImg}
                                                alt={booking.vehicle_name || 'Vehicle'}
                                                className="booking-card-img"
                                                loading="lazy"
                                                onError={handleVehicleImageError}
                                            />
                                        </div>

                                        {/* Booking Info */}
                                        <div className="booking-card-body">
                                            <div className="booking-card-topline">
                                                <div className="booking-title-group">
                                                    <h3 className="booking-vehicle-title">
                                                        {booking.vehicle_name}
                                                    </h3>
                                                    {booking.category_name && (
                                                        <span className="booking-category-tag">
                                                            {booking.category_name}
                                                        </span>
                                                    )}
                                                </div>

                                                <span className={`booking-status-badge status-${booking.status?.toLowerCase()}`}>
                                                    {booking.status}
                                                </span>
                                            </div>

                                            <div className="booking-period-meta">
                                                <div className="period-item">
                                                    <span className="period-label">Pickup:</span>
                                                    <span className="period-time">
                                                        {formatDisplayDateTime(booking.pickup_datetime || booking.start_date)}
                                                    </span>
                                                </div>
                                                <div className="period-item">
                                                    <span className="period-label">Return:</span>
                                                    <span className="period-time">
                                                        {formatDisplayDateTime(booking.return_datetime || booking.end_date)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="booking-duration-tag">
                                                <span>⏱️ Duration: <strong>{durationText}</strong></span>
                                            </div>
                                        </div>

                                        {/* Total and Actions */}
                                        <div className="booking-card-aside">
                                            <div className="booking-ref-block">
                                                <span className="booking-id-label">Booking ID</span>
                                                <strong className="booking-id-val">#{booking.booking_id}</strong>
                                            </div>

                                            <div className="booking-price-block">
                                                <span className="booking-price-label">Total Price</span>
                                                <strong className="booking-price-val">
                                                    ₹{Number(booking.total_price).toLocaleString('en-IN')}
                                                </strong>
                                            </div>

                                            <button
                                                type="button"
                                                className="booking-view-details-btn"
                                                onClick={() => handleOpenDetails(booking)}
                                                id={`view-details-${booking.booking_id}`}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Booking Details Modal via React Portal to document.body */}
            {selectedBooking && createPortal(
                <div
                    className="booking-modal-overlay"
                    onClick={handleCloseModal}
                    role="presentation"
                >
                    <div
                        className="booking-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="booking-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="booking-modal-header">
                            <div>
                                <span className="booking-modal-eyebrow">
                                    RENTIQ · RENTAL SUMMARY
                                </span>
                                <h2 id="booking-modal-title">
                                    Booking Details
                                </h2>
                                <span className="booking-modal-reference">
                                    Booking #{selectedBooking.booking_id}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="booking-modal-close"
                                onClick={handleCloseModal}
                                disabled={cancelling}
                                aria-label="Close booking details"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Vehicle Image & Info */}
                        <div className="booking-modal-vehicle">
                            <img
                                src={getVehicleImageUrl(selectedBooking)}
                                alt={selectedBooking.vehicle_name || 'Vehicle'}
                                className="booking-modal-img"
                                onError={handleVehicleImageError}
                            />

                            <div className="booking-modal-vehicle-info">
                                <span>YOUR RENTAL VEHICLE</span>
                                <h3>{selectedBooking.vehicle_name}</h3>
                                {selectedBooking.category_name && (
                                    <span className="booking-modal-cat">
                                        {selectedBooking.category_name}
                                    </span>
                                )}
                                <span
                                    className={`booking-status-badge status-${selectedBooking.status?.toLowerCase()}`}
                                >
                                    {selectedBooking.status}
                                </span>
                            </div>
                        </div>

                        {/* Rental Dates */}
                        <div className="booking-modal-section">
                            <h3 className="booking-modal-section-title">
                                Rental Period
                            </h3>

                            <div className="booking-modal-dates">
                                <div className="booking-modal-date">
                                    <span className="booking-modal-date-icon">↗</span>
                                    <div>
                                        <span>Pickup Time</span>
                                        <strong>
                                            {formatDisplayDateTime(selectedBooking.pickup_datetime || selectedBooking.start_date)}
                                        </strong>
                                    </div>
                                </div>

                                <div className="booking-modal-date">
                                    <span className="booking-modal-date-icon">↙</span>
                                    <div>
                                        <span>Return Time</span>
                                        <strong>
                                            {formatDisplayDateTime(selectedBooking.return_datetime || selectedBooking.end_date)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Booking Information */}
                        <div className="booking-modal-section">
                            <h3 className="booking-modal-section-title">
                                Booking Information
                            </h3>

                            <div className="booking-modal-info">
                                <div>
                                    <span>Booking ID</span>
                                    <strong>#{selectedBooking.booking_id}</strong>
                                </div>

                                <div>
                                    <span>Rental Duration</span>
                                    <strong>
                                        {selectedBooking.duration ||
                                            calculateRentalDuration(
                                                selectedBooking.pickup_datetime || selectedBooking.start_date,
                                                selectedBooking.return_datetime || selectedBooking.end_date
                                            ).display || '—'}
                                    </strong>
                                </div>

                                <div>
                                    <span>Booked On</span>
                                    <strong>
                                        {formatDate(selectedBooking.created_at)}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Price Summary */}
                        <div className="booking-modal-total">
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
                                        setShowCancelConfirm(true)
                                        setCancelError('')
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
                                                    setShowCancelConfirm(false)
                                                    setCancelError('')
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
                                &times;
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
    )
}

export default Profile