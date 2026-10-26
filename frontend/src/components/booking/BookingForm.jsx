import { useState, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import { useAuth } from '../../context/AuthContext';
import { DateTimeField, FormError } from '../common/form';
import BookingConfirmation from './BookingConfirmation';
import {
    formatLocalDate,
    formatLocalTime,
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice,
    formatDisplayDateTime
} from '../../utils/bookingUtils';
import './BookingForm.css';

const STEPS = [
    { number: 1, title: 'Vehicle', subtitle: 'Confirm Selection' },
    { number: 2, title: 'Schedule', subtitle: 'Dates & Times' },
    { number: 3, title: 'Review', subtitle: 'Price Breakdown' },
    { number: 4, title: 'Confirm', subtitle: 'Reserve Vehicle' }
];

function BookingForm({
    vehicleId,
    vehicleName,
    pricePerDay,
    isAvailable
}) {
    const { user, isLoggedIn } = useAuth();
    const location = useLocation();

    // Step state: 1, 2, 3, 4
    const [currentStep, setCurrentStep] = useState(1);

    // Current date and next round hour for initial setup
    const now = useMemo(() => new Date(), []);
    const todayStr = useMemo(() => formatLocalDate(now), [now]);

    const initialPickupTime = useMemo(() => {
        const next = new Date(now.getTime() + 60 * 60 * 1000);
        return formatLocalTime(next);
    }, [now]);

    const initialReturnTime = useMemo(() => {
        const returnT = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        return formatLocalTime(returnT);
    }, [now]);

    // Step 2 Form Data: Dates & Times
    const [pickupDate, setPickupDate] = useState(todayStr);
    const [returnDate, setReturnDate] = useState(todayStr);
    const [pickupTime, setPickupTime] = useState(initialPickupTime);
    const [returnTime, setReturnTime] = useState(initialReturnTime);

    // Step 4 Form Data: Confirmation check
    const [agreeToTerms, setAgreeToTerms] = useState(true);

    // Errors & state
    const [error, setError] = useState('');
    const [stepErrors, setStepErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmedBooking, setConfirmedBooking] = useState(null);

    const isSubmittingRef = useRef(false);

    // Formatted ISO-style strings for duration calculation and backend payload
    const pickupDatetime = pickupDate && pickupTime ? `${pickupDate}T${pickupTime}` : '';
    const returnDatetime = returnDate && returnTime ? `${returnDate}T${returnTime}` : '';

    // Calculate duration & price live
    const durationInfo = useMemo(() => {
        if (!pickupDatetime || !returnDatetime) {
            return { totalMinutes: 0, durationHours: 0, display: '' };
        }
        return calculateRentalDuration(pickupDatetime, returnDatetime);
    }, [pickupDatetime, returnDatetime]);

    const isDurationValid = durationInfo.totalMinutes > 0;

    const totalPrice = useMemo(() => {
        if (!isDurationValid) return 0;
        return calculateRentalPrice(pricePerDay, durationInfo.durationHours);
    }, [isDurationValid, pricePerDay, durationInfo.durationHours]);

    const hourlyRate = (Number(pricePerDay) / 24).toFixed(2).replace(/\.00$/, '');

    const clearErrors = () => {
        setError('');
        setStepErrors({});
    };

    const handlePickupDateChange = (val) => {
        setPickupDate(val);
        clearErrors();
    };

    const handlePickupTimeChange = (val) => {
        setPickupTime(val);
        clearErrors();
    };

    const handleReturnDateChange = (val) => {
        setReturnDate(val);
        clearErrors();
    };

    const handleReturnTimeChange = (val) => {
        setReturnTime(val);
        clearErrors();
    };

    // Validation for Step 2
    const validateStep2 = () => {
        const errors = {};

        if (!pickupDate) {
            errors.pickupDate = 'Please select a pickup date.';
        }
        if (!pickupTime) {
            errors.pickupTime = 'Please select a pickup time.';
        }
        if (!returnDate) {
            errors.returnDate = 'Please select a return date.';
        }
        if (!returnTime) {
            errors.returnTime = 'Please select a return time.';
        }

        if (Object.keys(errors).length > 0) {
            setStepErrors(errors);
            setError('Please complete all schedule fields.');
            return false;
        }

        const parsedPickup = parseDateTime(pickupDatetime);
        const parsedReturn = parseDateTime(returnDatetime);

        if (!parsedPickup || !parsedReturn) {
            setError('Please enter valid date and time values.');
            return false;
        }

        const currentTime = new Date();
        // 1-minute buffer for form completion latency
        if (parsedPickup.date.getTime() < currentTime.getTime() - 60000) {
            errors.pickupDate = 'Pickup date and time cannot be in the past.';
            setStepErrors(errors);
            setError('Pickup date and time cannot be in the past.');
            return false;
        }

        if (parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
            errors.returnTime = 'Return datetime must be after pickup datetime.';
            setStepErrors(errors);
            setError('Return date and time must be strictly after pickup date and time.');
            return false;
        }

        return true;
    };

    const handleNextStep = () => {
        setError('');
        setStepErrors({});

        if (currentStep === 1) {
            if (!isAvailable) {
                setError('This vehicle is currently marked unavailable for reservations.');
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (!validateStep2()) {
                return;
            }
            setCurrentStep(3);
        } else if (currentStep === 3) {
            if (!isDurationValid) {
                setError('Please adjust your dates and times in Step 2 to ensure a valid rental duration.');
                return;
            }
            setCurrentStep(4);
        }
    };

    const handlePrevStep = () => {
        setError('');
        setStepErrors({});
        if (currentStep > 1) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const handleStepJump = (targetStep) => {
        // Allow jumping to completed or previous steps, but validate forward jumps
        if (targetStep < currentStep) {
            setError('');
            setStepErrors({});
            setCurrentStep(targetStep);
        } else if (targetStep === 2 && currentStep === 1) {
            handleNextStep();
        } else if (targetStep === 3 && currentStep === 2) {
            if (validateStep2()) setCurrentStep(3);
        } else if (targetStep === 4 && (currentStep === 2 || currentStep === 3)) {
            if (validateStep2()) setCurrentStep(4);
        }
    };

    const handleBookAnother = () => {
        setConfirmedBooking(null);
        setCurrentStep(1);
        setPickupDate(todayStr);
        setReturnDate(todayStr);
        setPickupTime(initialPickupTime);
        setReturnTime(initialReturnTime);
        setAgreeToTerms(true);
        setError('');
        setStepErrors({});
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isSubmittingRef.current) return;

        if (!isLoggedIn) {
            setError('Authentication required: Please log in to complete your booking.');
            return;
        }

        if (!agreeToTerms) {
            setError('Please accept the rental terms and agreement to proceed.');
            return;
        }

        if (!validateStep2()) {
            setCurrentStep(2);
            return;
        }

        if (!isAvailable) {
            setError('This vehicle is currently unavailable for rental.');
            return;
        }

        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            const response = await axiosInstance.post('/bookings', {
                vehicleId,
                pickupDatetime,
                returnDatetime,
                startDate: pickupDatetime,
                endDate: returnDatetime
            });

            if (response.data && response.data.booking) {
                setConfirmedBooking(response.data.booking);
                setError('');
            } else {
                setError('Unexpected response received from the server.');
            }
        } catch (err) {
            console.error('Booking submission error:', err);
            setError(
                err.response?.data?.message ||
                'Unable to create booking. Please check availability and try again.'
            );
        } finally {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    if (confirmedBooking) {
        return (
            <BookingConfirmation
                booking={confirmedBooking}
                vehicleName={vehicleName}
                onBookAnother={handleBookAnother}
            />
        );
    }

    return (
        <section className="booking-form multi-step-booking" aria-labelledby="booking-heading">
            <header className="booking-header-area">
                <h2 id="booking-heading">Book This Vehicle</h2>
                <p className="booking-form-subtitle">
                    Complete the 4-step workflow to configure your schedule, review pricing, and reserve.
                </p>
            </header>

            {/* STEP PROGRESS INDICATOR */}
            <nav className="booking-stepper" aria-label="Booking steps">
                <ol className="stepper-list">
                    {STEPS.map((s) => {
                        const isDone = s.number < currentStep;
                        const isCurrent = s.number === currentStep;

                        return (
                            <li
                                key={s.number}
                                className={`stepper-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="stepper-btn"
                                    onClick={() => handleStepJump(s.number)}
                                    disabled={s.number > currentStep && currentStep < 2}
                                    aria-current={isCurrent ? 'step' : undefined}
                                >
                                    <span className="stepper-badge" aria-hidden="true">
                                        {isDone ? '✓' : s.number}
                                    </span>
                                    <div className="stepper-text">
                                        <span className="stepper-title">{s.title}</span>
                                        <span className="stepper-subtitle">{s.subtitle}</span>
                                    </div>
                                </button>
                                {s.number < STEPS.length && <div className="stepper-connector" aria-hidden="true" />}
                            </li>
                        );
                    })}
                </ol>
            </nav>

            <form onSubmit={handleSubmit} noValidate>
                {/* STEP 1: VEHICLE CONFIRMATION */}
                {currentStep === 1 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 1: Vehicle Confirmation">
                        <div className="panel-header">
                            <span className="panel-badge">Step 1 of 4</span>
                            <h3 className="panel-title">Confirm Vehicle Selection</h3>
                        </div>

                        <div className="vehicle-confirm-card">
                            <div className="vehicle-confirm-meta">
                                <h4>{vehicleName}</h4>
                                <div className="vehicle-rate-pill">
                                    <strong>₹{Number(pricePerDay).toLocaleString('en-IN')}/day</strong>
                                    <span>(₹{hourlyRate}/hr)</span>
                                </div>
                            </div>

                            <div className="vehicle-status-row">
                                <span className="status-label">Availability Status:</span>
                                {isAvailable ? (
                                    <span className="badge-available">● Ready to Book</span>
                                ) : (
                                    <span className="badge-unavailable">● Currently Unavailable</span>
                                )}
                            </div>

                            <ul className="vehicle-booking-perks">
                                <li>✓ Instant confirmation with free cancellation up to 6h before pickup</li>
                                <li>✓ Comprehensive roadside breakdown assistance included</li>
                                <li>✓ Flexible hourly or multi-day rental billing with zero hidden fees</li>
                            </ul>
                        </div>

                        {!isAvailable && (
                            <FormError message="This vehicle is currently unavailable. Please browse other vehicles in our fleet." />
                        )}

                        <div className="step-actions right-align">
                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                                disabled={!isAvailable}
                            >
                                Next: Select Dates & Times →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: DATES AND TIMES SELECTION */}
                {currentStep === 2 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 2: Dates and Times">
                        <div className="panel-header">
                            <span className="panel-badge">Step 2 of 4</span>
                            <h3 className="panel-title">Select Pickup & Return Schedule</h3>
                        </div>

                        <div className="booking-grid-2col">
                            <DateTimeField
                                label="Pickup Date"
                                id="booking-pickup-date"
                                name="pickupDate"
                                type="date"
                                min={todayStr}
                                value={pickupDate}
                                onChange={(e) => handlePickupDateChange(e.target.value)}
                                required
                                error={stepErrors.pickupDate}
                            />

                            <DateTimeField
                                label="Pickup Time"
                                id="booking-pickup-time"
                                name="pickupTime"
                                type="time"
                                value={pickupTime}
                                onChange={(e) => handlePickupTimeChange(e.target.value)}
                                required
                                error={stepErrors.pickupTime}
                            />
                        </div>

                        <div className="booking-grid-2col">
                            <DateTimeField
                                label="Return Date"
                                id="booking-return-date"
                                name="returnDate"
                                type="date"
                                min={pickupDate || todayStr}
                                value={returnDate}
                                onChange={(e) => handleReturnDateChange(e.target.value)}
                                required
                                error={stepErrors.returnDate}
                            />

                            <DateTimeField
                                label="Return Time"
                                id="booking-return-time"
                                name="returnTime"
                                type="time"
                                value={returnTime}
                                onChange={(e) => handleReturnTimeChange(e.target.value)}
                                required
                                error={stepErrors.returnTime}
                            />
                        </div>

                        {/* Live Duration pill */}
                        {isDurationValid && (
                            <div className="schedule-preview-pill">
                                <span className="pill-icon">⏱</span>
                                <span className="pill-text">
                                    Calculated Duration: <strong>{durationInfo.display}</strong>
                                </span>
                            </div>
                        )}

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                            >
                                ← Back: Vehicle
                            </button>

                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                            >
                                Next: Review Pricing →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: REVIEW & PRICE BREAKDOWN */}
                {currentStep === 3 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 3: Review and Price Breakdown">
                        <div className="panel-header">
                            <span className="panel-badge">Step 3 of 4</span>
                            <h3 className="panel-title">Review Booking & Price Breakdown</h3>
                        </div>

                        <div className="price-breakdown-card">
                            <div className="breakdown-vehicle-header">
                                <div>
                                    <span className="breakdown-tag">RESERVATION SUMMARY</span>
                                    <h4>{vehicleName}</h4>
                                </div>
                                <span className="breakdown-rate">
                                    ₹{pricePerDay}/day <small>(₹{hourlyRate}/hr)</small>
                                </span>
                            </div>

                            <div className="breakdown-schedule-grid">
                                <div className="schedule-block">
                                    <span className="block-label">Pickup Schedule</span>
                                    <strong className="block-val">{formatDisplayDateTime(pickupDatetime)}</strong>
                                </div>
                                <div className="schedule-block">
                                    <span className="block-label">Return Schedule</span>
                                    <strong className="block-val">{formatDisplayDateTime(returnDatetime)}</strong>
                                </div>
                            </div>

                            <div className="breakdown-divider" />

                            <div className="breakdown-line-items">
                                <div className="line-item">
                                    <span>Rental Duration</span>
                                    <strong>{durationInfo.display} ({durationInfo.durationHours} hrs)</strong>
                                </div>
                                <div className="line-item">
                                    <span>Hourly Base Rate</span>
                                    <span>₹{hourlyRate} × {durationInfo.durationHours} hrs</span>
                                </div>
                                <div className="line-item">
                                    <span>Base Rental Amount</span>
                                    <span>₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="line-item green-text">
                                    <span>Standard Damage Waiver & Insurance</span>
                                    <span>Included (₹0)</span>
                                </div>
                                <div className="line-item green-text">
                                    <span>Roadside Assistance (24/7)</span>
                                    <span>Included (₹0)</span>
                                </div>
                                <div className="line-item">
                                    <span>Applicable GST & Fees</span>
                                    <span>Included</span>
                                </div>
                            </div>

                            <div className="breakdown-divider" />

                            <div className="breakdown-total-row">
                                <span className="total-title">Total Rental Payable</span>
                                <strong className="total-amount">
                                    ₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </strong>
                            </div>
                        </div>

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                            >
                                ← Back: Schedule
                            </button>

                            <button
                                type="button"
                                className="step-btn next-btn"
                                onClick={handleNextStep}
                            >
                                Next: Confirm & Reserve →
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: CONFIRMATION & SUBMIT */}
                {currentStep === 4 && (
                    <div className="booking-step-panel" role="region" aria-label="Step 4: Final Confirmation">
                        <div className="panel-header">
                            <span className="panel-badge">Step 4 of 4</span>
                            <h3 className="panel-title">Finalize Reservation</h3>
                        </div>

                        <div className="booking-final-summary">
                            <div className="final-summary-row">
                                <span className="f-label">Vehicle:</span>
                                <strong className="f-val">{vehicleName}</strong>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Pickup:</span>
                                <span className="f-val">{formatDisplayDateTime(pickupDatetime)}</span>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Return:</span>
                                <span className="f-val">{formatDisplayDateTime(returnDatetime)}</span>
                            </div>
                            <div className="final-summary-row">
                                <span className="f-label">Duration:</span>
                                <span className="f-val">{durationInfo.display}</span>
                            </div>
                            <div className="final-summary-row total-highlight">
                                <span className="f-label">Grand Total:</span>
                                <strong className="f-val total-price">
                                    ₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </strong>
                            </div>
                        </div>

                        {/* Customer Authentication Check */}
                        {isLoggedIn && user ? (
                            <div className="customer-info-box">
                                <span className="customer-info-title">Booking As</span>
                                <div className="customer-info-details">
                                    <strong>{user.name}</strong>
                                    <span>{user.email}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="booking-auth-warning" role="alert">
                                <strong>Account Login Required</strong>
                                <p>
                                    You must be logged in to complete your vehicle booking.
                                </p>
                                <Link
                                    to="/login"
                                    state={{ from: location }}
                                    className="booking-login-link"
                                >
                                    Log In to RentIQ →
                                </Link>
                            </div>
                        )}

                        <div className="terms-checkbox-wrap">
                            <label className="terms-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={agreeToTerms}
                                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                                    className="terms-checkbox"
                                    id="booking-terms-agree"
                                />
                                <span>
                                    I agree to RentIQ&apos;s rental agreement, age/driver requirements, and cancellation policy.
                                </span>
                            </label>
                        </div>

                        {error && <FormError message={error} />}

                        <div className="step-actions split-align">
                            <button
                                type="button"
                                className="step-btn back-btn"
                                onClick={handlePrevStep}
                                disabled={isSubmitting}
                            >
                                ← Back: Review
                            </button>

                            <button
                                type="submit"
                                className="step-btn confirm-submit-btn"
                                disabled={isSubmitting || !isAvailable || !isDurationValid || !isLoggedIn || !agreeToTerms}
                            >
                                {isSubmitting ? (
                                    <span className="submitting-spinner">Reserving Vehicle...</span>
                                ) : (
                                    <span>Confirm & Book Now (₹{Number(totalPrice).toLocaleString('en-IN')})</span>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </form>
        </section>
    );
}

export default BookingForm;