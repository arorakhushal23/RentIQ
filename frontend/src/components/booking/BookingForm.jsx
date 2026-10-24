import { useState, useRef } from 'react'
import axiosInstance from '../../api/axiosInstance'
import './BookingForm.css'
import BookingSummary from './BookingSummary'
import BookingConfirmation from './BookingConfirmation'
import {
    formatLocalDateTime,
    parseDateTime,
    addHours,
    calculateRentalDuration,
    calculateRentalPrice
} from '../../utils/bookingUtils'

function BookingForm({
    vehicleId,
    vehicleName,
    pricePerDay,
    isAvailable
}) {
    const [pickupDatetime, setPickupDatetime] = useState('')
    const [returnDatetime, setReturnDatetime] = useState('')
    const [error, setError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [confirmedBooking, setConfirmedBooking] = useState(null)

    const isSubmittingRef = useRef(false)

    // Current time formatted for datetime-local input min boundary
    const minPickupDatetime = formatLocalDateTime(new Date())
    const minReturnDatetime = pickupDatetime || minPickupDatetime

    // Calculate duration & price
    const durationInfo =
        pickupDatetime && returnDatetime
            ? calculateRentalDuration(pickupDatetime, returnDatetime)
            : { totalMinutes: 0, durationHours: 0, display: '' }

    const isDurationValid = durationInfo.totalMinutes > 0

    const totalPrice = isDurationValid
        ? calculateRentalPrice(pricePerDay, durationInfo.durationHours)
        : 0

    const handlePickupChange = (event) => {
        const newPickup = event.target.value
        setPickupDatetime(newPickup)
        setError('')

        if (!newPickup) {
            setReturnDatetime('')
            return
        }

        const parsedPickup = parseDateTime(newPickup)
        const now = new Date()

        // 1-minute grace for input entry
        if (parsedPickup && parsedPickup.date.getTime() < now.getTime() - 60000) {
            setError('Pickup time cannot be in the past.')
            return
        }

        // If return is empty or no longer after pickup, suggest pickup + 2 hours by default
        if (!returnDatetime) {
            setReturnDatetime(addHours(newPickup, 2))
        } else {
            const parsedReturn = parseDateTime(returnDatetime)
            if (parsedReturn && parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
                setReturnDatetime(addHours(newPickup, 2))
            }
        }
    }

    const handleReturnChange = (event) => {
        const newReturn = event.target.value
        setError('')

        if (!newReturn) {
            setReturnDatetime('')
            return
        }

        if (!pickupDatetime) {
            setError('Please select a pickup date and time first.')
            setReturnDatetime('')
            return
        }

        const parsedPickup = parseDateTime(pickupDatetime)
        const parsedReturn = parseDateTime(newReturn)

        if (parsedPickup && parsedReturn && parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
            setError('Return time must be after pickup time.')
            setReturnDatetime(addHours(pickupDatetime, 2))
            return
        }

        setReturnDatetime(newReturn)
    }

    const handleQuickDuration = (hours) => {
        if (!pickupDatetime) {
            const defaultPickup = formatLocalDateTime(new Date(Date.now() + 15 * 60 * 1000))
            setPickupDatetime(defaultPickup)
            setReturnDatetime(addHours(defaultPickup, hours))
            setError('')
            return
        }
        setReturnDatetime(addHours(pickupDatetime, hours))
        setError('')
    }

    const handleBookAnother = () => {
        setConfirmedBooking(null)
        setPickupDatetime('')
        setReturnDatetime('')
        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (isSubmittingRef.current) return

        if (!pickupDatetime) {
            setError('Please select a pickup date and time.')
            return
        }

        if (!returnDatetime) {
            setError('Please select a return date and time.')
            return
        }

        const parsedPickup = parseDateTime(pickupDatetime)
        const parsedReturn = parseDateTime(returnDatetime)

        if (!parsedPickup || !parsedReturn) {
            setError('Please enter valid date and time values.')
            return
        }

        const now = new Date()
        if (parsedPickup.date.getTime() < now.getTime() - 60000) {
            setError('Pickup time cannot be in the past.')
            return
        }

        if (parsedReturn.date.getTime() <= parsedPickup.date.getTime()) {
            setError('Return time must be strictly after pickup time.')
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
        <section className="booking-form">
            <h2>Book This Vehicle</h2>
            <p className="booking-form-subtitle">
                Flexible hourly and multi-day rentals. Same-day rentals supported.
            </p>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="pickup-datetime">
                        Pickup Date & Time
                    </label>

                    <input
                        id="pickup-datetime"
                        type="datetime-local"
                        min={minPickupDatetime}
                        value={pickupDatetime}
                        onChange={handlePickupChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="return-datetime">
                        Return Date & Time
                    </label>

                    <input
                        id="return-datetime"
                        type="datetime-local"
                        min={minReturnDatetime}
                        value={returnDatetime}
                        onChange={handleReturnChange}
                        disabled={!pickupDatetime}
                        required
                    />
                    {!pickupDatetime && (
                        <span className="form-field-hint">Select pickup date & time first</span>
                    )}
                </div>

                {/* Quick duration selection presets */}
                <div className="form-group">
                    <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Quick Durations:
                    </label>
                    <div className="booking-presets">
                        <button
                            type="button"
                            className="booking-preset-btn"
                            onClick={() => handleQuickDuration(2)}
                        >
                            2 Hours
                        </button>
                        <button
                            type="button"
                            className="booking-preset-btn"
                            onClick={() => handleQuickDuration(3)}
                        >
                            3 Hours
                        </button>
                        <button
                            type="button"
                            className="booking-preset-btn"
                            onClick={() => handleQuickDuration(24)}
                        >
                            1 Day (24 hrs)
                        </button>
                        <button
                            type="button"
                            className="booking-preset-btn"
                            onClick={() => handleQuickDuration(48)}
                        >
                            2 Days (48 hrs)
                        </button>
                    </div>
                </div>

                {error && (
                    <p className="booking-error" role="alert">
                        {error}
                    </p>
                )}

                {isDurationValid && (
                    <BookingSummary
                        durationDisplay={durationInfo.display}
                        durationHours={durationInfo.durationHours}
                        pricePerDay={pricePerDay}
                        totalPrice={totalPrice}
                    />
                )}

                <button
                    type="submit"
                    disabled={!isAvailable || !isDurationValid || isSubmitting}
                >
                    {isSubmitting ? 'Confirming Booking...' : 'Confirm Booking'}
                </button>
            </form>
        </section>
    )
}

export default BookingForm