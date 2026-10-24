import './BookingSummary.css'

function BookingSummary({
    durationDisplay,
    pricePerDay,
    totalPrice,
    rentalDays
}) {
    const displayDuration =
        durationDisplay ||
        (rentalDays ? `${rentalDays} ${rentalDays === 1 ? 'Day' : 'Days'}` : '0 hours')

    const hourlyRate = (Number(pricePerDay) / 24).toFixed(2).replace(/\.00$/, '')

    return (
        <div className="booking-summary">
            <div className="summary-item">
                <span>Rental Duration</span>
                <strong>{displayDuration}</strong>
            </div>

            <div className="summary-item">
                <span>Rate</span>
                <strong>
                    ₹{pricePerDay}/day <small style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>(₹{hourlyRate}/hr)</small>
                </strong>
            </div>

            <div className="summary-item summary-total">
                <span>Total Price</span>
                <strong>
                    ₹{Number(totalPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </strong>
            </div>
        </div>
    )
}

export default BookingSummary