import { useState } from 'react'
import axiosInstance from '../api/axiosInstance'
import './BookingForm.css'
import BookingSummary from './BookingSummary'

function BookingForm({
    vehicleId,
    pricePerDay,
    isAvailable
}) {
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [error, setError] = useState('')

    const today = new Date().toISOString().split('T')[0]

    const calculateDays = () => {
        if (!startDate || !endDate) {
            return 0
        }

        const start = new Date(startDate)
        const end = new Date(endDate)

        const difference = end - start

        return difference / (1000 * 60 * 60 * 24)
    }

    const rentalDays = calculateDays()

    const totalPrice =
        rentalDays > 0
            ? rentalDays * Number(pricePerDay)
            : 0

    const handleStartDateChange = (event) => {
        setStartDate(event.target.value)
        setError('')
    }

    const handleEndDateChange = (event) => {
        setEndDate(event.target.value)
        setError('')
    }

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!startDate) {
            setError('Please select a start date.')
            return
        }

        if (!endDate) {
            setError('Please select an end date.')
            return
        }

        if (startDate < today) {
            setError('Start date cannot be in the past.')
            return
        }

        if (endDate <= startDate) {
            setError('End date must be after the start date.')
            return
        }

        if (!isAvailable) {
            setError('This vehicle is currently unavailable.')
            return
        }

        try {
            const response = await axiosInstance.post('/bookings', {
                vehicleId,
                startDate,
                endDate,
            })

            console.log('Booking created:', response.data)

            setError('')
        } catch (error) {
            console.error('Booking failed:', error)

            setError(
                error.response?.data?.message ||
                'Unable to create booking.'
            )
        }
    }

    return (
        <section className="booking-form">

            <h2>Book This Vehicle</h2>

            <form onSubmit={handleSubmit}>

                <div className="form-group">

                    <label htmlFor="start-date">
                        Start Date
                    </label>

                    <input
                        id="start-date"
                        type="date"
                        min={today}
                        value={startDate}
                        onChange={handleStartDateChange}
                    />

                </div>

                <div className="form-group">

                    <label htmlFor="end-date">
                        End Date
                    </label>

                    <input
                        id="end-date"
                        type="date"
                        min={startDate || today}
                        value={endDate}
                        onChange={handleEndDateChange}
                    />

                </div>

                {error && (
                    <p className="booking-error">
                        {error}
                    </p>
                )}

                {rentalDays > 0 && (
                    <BookingSummary
                        rentalDays={rentalDays}
                        pricePerDay={pricePerDay}
                        totalPrice={totalPrice}
                    />
                )}

                <button
                    type="submit"
                    disabled={!isAvailable || rentalDays <= 0}
                >
                    Confirm Booking
                </button>

            </form>

        </section>
    )
}

export default BookingForm