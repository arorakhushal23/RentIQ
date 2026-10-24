import { useState, useRef, useMemo } from 'react'
import axiosInstance from '../../api/axiosInstance'
import './BookingForm.css'
import BookingConfirmation from './BookingConfirmation'
import {
    formatLocalDate,
    formatLocalTime,
    parseDateTime,
    calculateRentalDuration,
    calculateRentalPrice,
    formatDisplayDateTime
} from '../../utils/bookingUtils'

function BookingForm({
    vehicleId,
    vehicleName,
    pricePerDay,
    isAvailable
}) {
    // Current date and next round hour for initial setup
    const now = useMemo(() => new Date(), [])
    const todayStr = useMemo(() => formatLocalDate(now), [now])

    // Initial times: next upcoming round hour for pickup, +3 hours for return
    const initialPickupTime = useMemo(() => {
        const next = new Date(now.getTime() + 60 * 60 * 1000)
        return formatLocalTime(next)
    }, [now])

    const initialReturnTime = useMemo(() => {
        const returnT = new Date(now.getTime() + 4 * 60 * 60 * 1000)
        return formatLocalTime(returnT)
    }, [now])

    // Step 1: Independent Dates
    const [pickupDate, setPickupDate] = useState(todayStr)
    const [returnDate, setReturnDate] = useState(todayStr)

    // Step 2: Independent Times
    const [pickupTime, setPickupTime] = useState(initialPickupTime)
    const [returnTime, setReturnTime] = useState(initialReturnTime)

    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [confirmedBooking, setConfirmedBooking] = useState(null)

    const isSubmittingRef = useRef(false)

    // Formatted ISO-style strings for duration calculation and backend payload
    const pickupDatetime = pickupDate && pickupTime ? `${pickupDate}T${pickupTime}` : ''
    const returnDatetime = returnDate && returnTime ? `${returnDate}T${returnTime}` : ''

    // Calculate duration & price live
    const durationInfo = useMemo(() => {
        if (!pickupDatetime || !returnDatetime) {
            return { totalMinutes: 0, durationHours: 0, display: '' }
        }
        return calculateRentalDuration(pickupDatetime, returnDatetime)
    }, [pickupDatetime, returnDatetime])

    const isDurationValid = durationInfo.totalMinutes > 0

    const totalPrice = useMemo(() => {
        if (!isDurationValid) return 0
        return calculateRentalPrice(pricePerDay, durationInfo.durationHours)
    }, [isDurationValid, pricePerDay, durationInfo.durationHours])

    const hourlyRate = (Number(pricePerDay) / 24).toFixed(2).replace(/\.00$/, '')

    // Step 1 validation: Pickup Date Change
    const handlePickupDateChange = (event) => {
        const newPickupDate = event.target.value
        setPickupDate(newPickupDate)
        setError('')

        if (!newPickupDate) {
            return
        }

        // If return date is earlier than new pickup date, revalidate return date
        if (returnDate && returnDate < newPickupDate) {
            setReturnDate(newPickupDate)
        }
    }

    // Step 1 validation: Return Date Change
    const handleReturnDateChange = (event) => {
        const newReturnDate = event.target.value
        setError('')

        if (!newReturnDate) {
            setReturnDate('')
            return
        }

        if (pickupDate && newReturnDate < pickupDate) {
            setError('Return date cannot be earlier than pickup date.')
            return
        }

        setReturnDate(newReturnDate)
    }

    // Step 2 validation: Pickup Time Change
    const handlePickupTimeChange = (event) => {
        const newTime = event.target.value
        setPickupTime(newTime)
        setError('')
    }

    // Step 2 validation: Return Time Change
    const handleReturnTimeChange = (event) => {
        const newTime = event.target.value
        setReturnTime(newTime)
        setError('')
    }

    const handleBookAnother = () => {
        setConfirmedBooking(null)
        setPickupDate(todayStr)
        setReturnDate(todayStr)
        setPickupTime(initialPickupTime)
        setReturnTime(initialReturnTime)
        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (isSubmittingRef.current) return

        if (!pickupDate || !pickupTime) {
            setError('Please select a valid pickup date and time.')
            return
        }

        if (!returnDate || !returnTime) {
            setError('Please select a valid return date and time.')
            return
        }

        const parsedPickup = parseDateTime(pickupDatetime)
        const parsedReturn = parseDateTime(returnDatetime)

        if (!parsedPickup || !parsedReturn) {
            setError('Please enter valid date and time values.')
            return
        }

        const currentTime = new Date()
        // 1-minute grace period for input latency
        if (parsedPickup.date.getTime() < currentTime.getTime() - 60000) {
            setError('Pickup date and time cannot be in the past.')
            return
        }

        if (parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
            setError('Return date and time must be strictly after pickup date and time.')
            return
        }

        if (!isAvailable) {
            setError('This vehicle is currently unavailable.')
            return
        }

        isSubmittingRef.current = true
        setIsSubmitting(true)
        setError('')

        try {
            const response = await axiosInstance.post('/bookings', {
                vehicleId,
                pickupDatetime,
                returnDatetime,
                startDate: pickupDatetime,
                endDate: returnDatetime
            })

            if (response.data && response.data.booking) {
                setConfirmedBooking(response.data.booking)
                setError('')
            } else {
                setError('Unexpected response from server.')
            }
        } catch (err) {
            console.error('Booking failed:', err)
            setError(
                err.response?.data?.message ||
                'Unable to create booking.'
            )
        } finally {
            isSubmittingRef.current = false
            setIsSubmitting(false)
        }
    }

    if (confirmedBooking) {
        return (
            <BookingConfirmation
                booking={confirmedBooking}
                vehicleName={vehicleName}
                onBookAnother={handleBookAnother}
            />
        )
    }

    return (
        <section className="booking-form" aria-labelledby="booking-heading">
            <h2 id="booking-heading">Book This Vehicle</h2>
            <p className="booking-form-subtitle">
                Select your dates and times for flexible hourly or multi-day rental.
            </p>

            <form onSubmit={handleSubmit} noValidate>
                {/* STEP 1: SELECT DATES */}
                <div className="booking-step">
                    <div className="booking-step-header">
                        <span className="booking-step-badge">1</span>
                        <h3 className="booking-step-title">Select Dates</h3>
                    </div>

                    <div className="booking-input-row">
                        <div className="form-group">
                            <label htmlFor="pickup-date">
                                Pickup Date
                            </label>
                            <input
                                id="pickup-date"
                                type="date"
                                min={todayStr}
                                value={pickupDate}
                                onChange={handlePickupDateChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="return-date">
                                Return Date
                            </label>
                            <input
                                id="return-date"
                                type="date"
                                min={pickupDate || todayStr}
                                value={returnDate}
                                onChange={handleReturnDateChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* STEP 2: SELECT TIME DURATION */}
                <div className="booking-step">
                    <div className="booking-step-header">
                        <span className="booking-step-badge">2</span>
                        <h3 className="booking-step-title">Select Time Duration</h3>
                    </div>

                    <div className="booking-input-row">
                        <div className="form-group">
                            <label htmlFor="pickup-time">
                                Pickup Time
                            </label>
                            <input
                                id="pickup-time"
                                type="time"
                                value={pickupTime}
                                onChange={handlePickupTimeChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="return-time">
                                Return Time
                            </label>
                            <input
                                id="return-time"
                                type="time"
                                value={returnTime}
                                onChange={handleReturnTimeChange}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* DURATION AND PRICE SUMMARY CARD */}
                <div className="booking-summary-card">
                    <div className="booking-summary-header">
                        <h4>Rental Summary</h4>
                        <span className="booking-rate-badge">
                            ₹{pricePerDay}/day <small>(₹{hourlyRate}/hr)</small>
                        </span>
                    </div>

                    <div className="booking-summary-details">
                        <div className="booking-summary-row">
                            <span className="summary-label">Pickup:</span>
                            <span className="summary-value">
                                {pickupDatetime ? formatDisplayDateTime(pickupDatetime) : '—'}
                            </span>
                        </div>

                        <div className="booking-summary-row">
                            <span className="summary-label">Return:</span>
                            <span className="summary-value">
                                {returnDatetime ? formatDisplayDateTime(returnDatetime) : '—'}
                            </span>
                        </div>

                        <div className="booking-summary-row">
                            <span className="summary-label">Total Duration:</span>
                            <span className="summary-value duration-highlight">
                                {isDurationValid ? durationInfo.display : 'Invalid selection'}
                            </span>
                        </div>

                        <div className="booking-summary-divider" />

                        <div className="booking-summary-row total-row">
                            <span className="summary-total-label">Estimated Total:</span>
                            <span className="summary-total-value">
                                ₹{isDurationValid ? Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}
                            </span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="booking-error" role="alert">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    className="booking-submit-btn"
                    disabled={isSubmitting || !isAvailable || !isDurationValid}
                >
                    {isSubmitting ? 'Confirming Booking...' : 'Confirm Booking'}
                </button>
            </form>
        </section>
    )
}

export default BookingForm