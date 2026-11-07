import { useNavigate } from 'react-router-dom';
import { FileText, MapPin } from 'lucide-react';
import './BookingConfirmation.css';
import {
    formatDisplayDateTime,
    calculateRentalDuration
} from '../../utils/bookingUtils';

function BookingConfirmation({
    booking,
    vehicleName,
    onBookAnother
}) {
    const navigate = useNavigate();

    if (!booking) return null;

    const bookingId = booking.bookingId || booking.booking_id;
    const resolvedVehicleName = booking.vehicleName || booking.vehicle_name || vehicleName || 'Vehicle';
    const pickupDateTime = booking.pickupDatetime || booking.pickup_datetime || booking.startDate || booking.start_date;
    const returnDateTime = booking.returnDatetime || booking.return_datetime || booking.endDate || booking.end_date;

    const resolvedDuration =
        booking.duration ||
        calculateRentalDuration(pickupDateTime, returnDateTime).display ||
        (booking.rentalDays ? `${booking.rentalDays} ${booking.rentalDays === 1 ? 'Day' : 'Days'}` : 'Rental');

    const totalPrice = booking.totalPrice ?? booking.total_price ?? 0;
    const deliveryCharge = booking.deliveryCharge ?? booking.delivery_charge ?? 0;
    const pickupAddress = booking.pickupAddress || booking.pickup_address;
    const dropAddress = booking.dropAddress || booking.drop_address;
    const status = booking.status || 'pending';

    const handleViewMyBookings = () => {
        navigate('/profile');
    };

    return (
        <section
            className="booking-confirmation"
            aria-labelledby="booking-confirmation-title"
        >
            <div className="booking-confirmation-header">
                <div className="booking-confirmation-badge" aria-hidden="true">
                    ✓
                </div>
                <h2 id="booking-confirmation-title" className="booking-confirmation-title">
                    Booking Request Submitted Successfully
                </h2>
                <p className="booking-confirmation-subtitle">
                    Your booking request has been received. Please review your reservation details below.
                </p>
            </div>

            <div className="booking-confirmation-card">
                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Booking Reference</span>
                    <strong className="confirmation-value confirmation-id">
                        #{bookingId}
                    </strong>
                </div>

                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Vehicle</span>
                    <strong className="confirmation-value">
                        {resolvedVehicleName}
                    </strong>
                </div>

                {pickupAddress && (
                    <div className="booking-confirmation-row">
                        <span className="confirmation-label">Pickup Location</span>
                        <span className="confirmation-value">
                            <MapPin size={13} style={{ display: 'inline', marginRight: '4px', color: '#10b981' }} />
                            {pickupAddress}
                        </span>
                    </div>
                )}

                {dropAddress && dropAddress !== pickupAddress && (
                    <div className="booking-confirmation-row">
                        <span className="confirmation-label">Drop Location</span>
                        <span className="confirmation-value">
                            <MapPin size={13} style={{ display: 'inline', marginRight: '4px', color: '#f43f5e' }} />
                            {dropAddress}
                        </span>
                    </div>
                )}

                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Pickup Time</span>
                    <strong className="confirmation-value">
                        {formatDisplayDateTime(pickupDateTime)}
                    </strong>
                </div>

                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Return Time</span>
                    <strong className="confirmation-value">
                        {formatDisplayDateTime(returnDateTime)}
                    </strong>
                </div>

                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Rental Duration</span>
                    <strong className="confirmation-value">
                        {resolvedDuration}
                    </strong>
                </div>

                {Number(deliveryCharge) > 0 && (
                    <div className="booking-confirmation-row">
                        <span className="confirmation-label">Delivery Charges</span>
                        <strong className="confirmation-value">
                            ₹{Number(deliveryCharge).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </strong>
                    </div>
                )}

                <div className="booking-confirmation-row confirmation-total-row">
                    <span className="confirmation-label">Total Payable</span>
                    <strong className="confirmation-value confirmation-total-price">
                        ₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </strong>
                </div>

                <div className="booking-confirmation-row">
                    <span className="confirmation-label">Status</span>
                    <span
                        className={`booking-status ${status.toLowerCase()}`}
                        aria-label={`Booking status: ${status}`}
                    >
                        {status}
                    </span>
                </div>
            </div>

            {/* Digital Rental Agreement callout */}
            <div className="booking-confirmation-note agreement-highlight" role="status">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <FileText size={16} color="#0284c7" />
                    <strong>Digital Rental Agreement Generated</strong>
                </div>
                <p>
                    Your digital agreement has been prepared. Once your booking is confirmed by an admin, review and accept it in your profile before vehicle inspection and handover.
                </p>
            </div>

            <div className="booking-confirmation-actions">
                <button
                    type="button"
                    className="booking-btn-view"
                    onClick={handleViewMyBookings}
                >
                    View in My Bookings
                </button>
                <button
                    type="button"
                    className="booking-btn-another"
                    onClick={onBookAnother}
                >
                    Book Another Date/Time
                </button>
            </div>
        </section>
    );
}

export default BookingConfirmation;
