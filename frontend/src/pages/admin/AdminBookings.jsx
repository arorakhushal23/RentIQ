import { useEffect, useState } from 'react';
import axiosInstance from '../../api/axiosInstance';
import './AdminBookings.css';
import {
    formatDisplayDateTime,
    calculateRentalDuration
} from '../../utils/bookingUtils';

const STATUSES = [
    'all',
    'pending',
    'confirmed',
    'cancelled',
    'completed',
];

function formatDate(date) {
    if (!date) return '—';
    return formatDisplayDateTime(date);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
}

function getStatusActions(status) {
    if (status === 'pending') {
        return ['confirmed', 'cancelled'];
    }

    if (status === 'confirmed') {
        return ['completed', 'cancelled'];
    }

    return [];
}

function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const [selectedBooking, setSelectedBooking] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');

    const [updatingBookingId, setUpdatingBookingId] = useState(null);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchBookings();
        }, 300);

        return () => clearTimeout(timeoutId);
        // Search and filter changes intentionally trigger a debounced request.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter]);

    async function fetchBookings() {
        setLoading(true);
        setError('');

        try {
            const params = {};

            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }

            if (search.trim()) {
                params.search = search.trim();
            }

            const response = await axiosInstance.get('/admin/bookings', {
                params,
            });

            setBookings(
                Array.isArray(response.data) ? response.data : []
            );
        } catch (err) {
            console.error('Error fetching bookings:', err);

            setError(
                err.response?.data?.message ||
                'Unable to load bookings. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }

    async function viewBookingDetails(bookingId) {
        setSelectedBooking(null);
        setDetailsError('');
        setDetailsLoading(true);

        try {
            const response = await axiosInstance.get(
                `/admin/bookings/${bookingId}`
            );

            setSelectedBooking(response.data);
        } catch (err) {
            console.error('Error fetching booking details:', err);

            setDetailsError(
                err.response?.data?.message ||
                'Unable to load booking details.'
            );
        } finally {
            setDetailsLoading(false);
        }
    }

    async function updateBookingStatus(booking) {
        const nextStatus = window.prompt(
            `Enter the new status for booking #${booking.booking_id}:\n` +
            getStatusActions(booking.status).join(', ')
        );

        if (nextStatus === null) return;

        const normalizedStatus = nextStatus.trim().toLowerCase();
        const allowedStatuses = getStatusActions(booking.status);

        if (!allowedStatuses.includes(normalizedStatus)) {
            setNotice(
                `Invalid status. Allowed options: ${allowedStatuses.join(', ') || 'none'}`
            );
            return;
        }

        setUpdatingBookingId(booking.booking_id);
        setNotice('');

        try {
            await axiosInstance.patch(
                `/admin/bookings/${booking.booking_id}/status`,
                { status: normalizedStatus }
            );

            setNotice(
                `Booking #${booking.booking_id} updated to ${normalizedStatus}.`
            );

            if (
                selectedBooking?.booking_id === booking.booking_id
            ) {
                await viewBookingDetails(booking.booking_id);
            }

            await fetchBookings();
        } catch (err) {
            console.error('Error updating booking status:', err);

            setNotice(
                err.response?.data?.message ||
                'Unable to update booking status.'
            );
        } finally {
            setUpdatingBookingId(null);
        }
    }

    function closeDetails() {
        setSelectedBooking(null);
        setDetailsError('');
    }

    return (
        <main className="admin-bookings-page">
            <header className="admin-bookings-header">
                <div>
                    <p className="admin-bookings-eyebrow">
                        ADMINISTRATION
                    </p>
                    <h1>Booking Management</h1>
                    <p className="admin-bookings-subtitle">
                        View and manage customer vehicle bookings.
                    </p>
                </div>

                <button
                    type="button"
                    className="admin-bookings-refresh"
                    onClick={fetchBookings}
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </header>

            <section className="admin-bookings-toolbar">
                <div className="admin-bookings-search">
                    <label htmlFor="booking-search">
                        Search bookings
                    </label>

                    <input
                        id="booking-search"
                        type="search"
                        placeholder="Booking ID, customer, email, vehicle..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>

                <div className="admin-bookings-filter">
                    <label htmlFor="booking-status-filter">
                        Booking status
                    </label>

                    <select
                        id="booking-status-filter"
                        value={statusFilter}
                        onChange={(event) =>
                            setStatusFilter(event.target.value)
                        }
                    >
                        {STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status === 'all'
                                    ? 'All statuses'
                                    : status.charAt(0).toUpperCase() +
                                      status.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            {notice && (
                <div className="admin-bookings-notice" role="status">
                    <span>{notice}</span>

                    <button
                        type="button"
                        onClick={() => setNotice('')}
                        aria-label="Dismiss message"
                    >
                        ×
                    </button>
                </div>
            )}

            {error && (
                <div className="admin-bookings-error" role="alert">
                    <p>{error}</p>

                    <button type="button" onClick={fetchBookings}>
                        Try again
                    </button>
                </div>
            )}

            <section className="admin-bookings-table-card">
                <div className="admin-bookings-table-heading">
                    <h2>All Bookings</h2>
                    <span>
                        {loading
                            ? 'Loading bookings...'
                            : `${bookings.length} booking(s)`}
                    </span>
                </div>

                <div className="admin-bookings-table-wrapper">
                    <table className="admin-bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Customer</th>
                                <th>Vehicle</th>
                                <th>Rental Dates</th>
                                <th>Total Price</th>
                                <th>Booking Status</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {!loading &&
                                !error &&
                                bookings.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan="8"
                                            className="admin-bookings-empty"
                                        >
                                            No bookings found.
                                        </td>
                                    </tr>
                                )}

                            {bookings.map((booking) => {
                                const actions = getStatusActions(
                                    booking.status
                                );

                                return (
                                    <tr key={booking.booking_id}>
                                        <td>
                                            <strong>
                                                #{booking.booking_id}
                                            </strong>
                                        </td>

                                        <td>
                                            <div className="admin-bookings-customer">
                                                <strong>
                                                    {booking.customer_name ||
                                                        booking.customer?.name ||
                                                        'Unknown customer'}
                                                </strong>

                                                <span>
                                                    {booking.customer_email ||
                                                        booking.customer?.email ||
                                                        '—'}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="admin-bookings-vehicle">
                                                <strong>
                                                    {booking.vehicle_name ||
                                                        booking.vehicle?.name ||
                                                        'Unknown vehicle'}
                                                </strong>

                                                <span>
                                                    {booking.vehicle_brand ||
                                                        booking.vehicle?.brand ||
                                                        ''}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="admin-bookings-dates">
                                                <span>
                                                    {formatDisplayDateTime(
                                                        booking.pickup_datetime || booking.start_date
                                                    )}
                                                </span>

                                                <span>
                                                    to{' '}
                                                    {formatDisplayDateTime(
                                                        booking.return_datetime || booking.end_date
                                                    )}
                                                </span>

                                                {booking.duration && (
                                                    <small style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                                                        ({booking.duration})
                                                    </small>
                                                )}
                                            </div>
                                        </td>

                                        <td className="admin-bookings-price">
                                            {formatCurrency(
                                                booking.total_price
                                            )}
                                        </td>

                                        <td>
                                            <span
                                                className={`booking-status-badge status-${booking.status}`}
                                            >
                                                {booking.status}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className={`booking-status-badge status-${booking.payment?.payment_status || booking.payment_status || 'unknown'}`}
                                            >
                                                {booking.payment?.payment_status ||
                                                    booking.payment_status ||
                                                    'Not recorded'}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="admin-bookings-actions">
                                                <button
                                                    type="button"
                                                    className="booking-action-button"
                                                    onClick={() =>
                                                        viewBookingDetails(
                                                            booking.booking_id
                                                        )
                                                    }
                                                >
                                                    Details
                                                </button>

                                                {actions.length > 0 && (
                                                    <button
                                                        type="button"
                                                        className="booking-action-button booking-action-secondary"
                                                        disabled={
                                                            updatingBookingId ===
                                                            booking.booking_id
                                                        }
                                                        onClick={() =>
                                                            updateBookingStatus(
                                                                booking
                                                            )
                                                        }
                                                    >
                                                        {updatingBookingId ===
                                                        booking.booking_id
                                                            ? 'Updating...'
                                                            : 'Update status'}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {loading && (
                        <div className="admin-bookings-loading">
                            Loading bookings...
                        </div>
                    )}
                </div>
            </section>

            {(detailsLoading || selectedBooking || detailsError) && (
                <div
                    className="booking-details-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeDetails();
                        }
                    }}
                >
                    <section
                        className="booking-details-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="booking-details-title"
                    >
                        <header className="booking-details-modal-header">
                            <h2 id="booking-details-title">
                                Booking Details
                            </h2>

                            <button
                                type="button"
                                onClick={closeDetails}
                                aria-label="Close booking details"
                            >
                                ×
                            </button>
                        </header>

                        {detailsLoading && (
                            <p className="booking-details-message">
                                Loading booking details...
                            </p>
                        )}

                        {detailsError && (
                            <p
                                className="booking-details-error"
                                role="alert"
                            >
                                {detailsError}
                            </p>
                        )}

                        {selectedBooking && (
                            <div className="booking-details-content">
                                <div className="booking-details-summary">
                                    <strong>
                                        Booking #{selectedBooking.booking_id}
                                    </strong>

                                    <span
                                        className={`booking-status-badge status-${selectedBooking.status}`}
                                    >
                                        {selectedBooking.status}
                                    </span>
                                </div>

                                <h3>Customer</h3>
                                <p>
                                    <strong>Name:</strong>{' '}
                                    {selectedBooking.customer_name ||
                                        selectedBooking.customer?.name ||
                                        '—'}
                                </p>
                                <p>
                                    <strong>Email:</strong>{' '}
                                    {selectedBooking.customer_email ||
                                        selectedBooking.customer?.email ||
                                        '—'}
                                </p>

                                <h3>Vehicle</h3>
                                <p>
                                    <strong>Vehicle:</strong>{' '}
                                    {selectedBooking.vehicle_name ||
                                        selectedBooking.vehicle?.name ||
                                        '—'}
                                </p>
                                <p>
                                    <strong>Brand:</strong>{' '}
                                    {selectedBooking.vehicle_brand ||
                                        selectedBooking.vehicle?.brand ||
                                        '—'}
                                </p>
                                <p>
                                    <strong>Category:</strong>{' '}
                                    {selectedBooking.category_name ||
                                        selectedBooking.vehicle?.category ||
                                        '—'}
                                </p>

                                <h3>Rental</h3>
                                <p>
                                    <strong>Pickup:</strong>{' '}
                                    {formatDisplayDateTime(selectedBooking.pickup_datetime || selectedBooking.start_date)}
                                </p>
                                <p>
                                    <strong>Return:</strong>{' '}
                                    {formatDisplayDateTime(selectedBooking.return_datetime || selectedBooking.end_date)}
                                </p>
                                <p>
                                    <strong>Duration:</strong>{' '}
                                    {selectedBooking.duration ||
                                        calculateRentalDuration(
                                            selectedBooking.pickup_datetime || selectedBooking.start_date,
                                            selectedBooking.return_datetime || selectedBooking.end_date
                                        ).display || '—'}
                                </p>
                                <p>
                                    <strong>Total:</strong>{' '}
                                    {formatCurrency(
                                        selectedBooking.total_price
                                    )}
                                </p>
                                <p>
                                    <strong>Created:</strong>{' '}
                                    {formatDisplayDateTime(selectedBooking.created_at)}
                                </p>

                                <h3>Payment</h3>
                                {selectedBooking.payment ? (
                                    <>
                                        <p>
                                            <strong>Status:</strong>{' '}
                                            {selectedBooking.payment.payment_status ||
                                                '—'}
                                        </p>
                                        <p>
                                            <strong>Method:</strong>{' '}
                                            {selectedBooking.payment.payment_method ||
                                                '—'}
                                        </p>
                                        <p>
                                            <strong>Amount:</strong>{' '}
                                            {formatCurrency(
                                                selectedBooking.payment.amount ??
                                                selectedBooking.payment.payment_amount
                                            )}
                                        </p>
                                        <p>
                                            <strong>Paid at:</strong>{' '}
                                            {formatDate(
                                                selectedBooking.payment.paid_at
                                            )}
                                        </p>
                                    </>
                                ) : (
                                    <p>No payment record is available.</p>
                                )}

                                {getStatusActions(
                                    selectedBooking.status
                                ).length > 0 && (
                                    <button
                                        type="button"
                                        className="booking-details-update-button"
                                        disabled={
                                            updatingBookingId ===
                                            selectedBooking.booking_id
                                        }
                                        onClick={() =>
                                            updateBookingStatus(
                                                selectedBooking
                                            )
                                        }
                                    >
                                        Update booking status
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </main>
    );
}

export default AdminBookings;