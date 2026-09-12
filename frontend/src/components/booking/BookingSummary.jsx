import './BookingSummary.css'

function BookingSummary({
    rentalDays,
    pricePerDay,
    totalPrice,
}) {
    return (
        <div className="booking-summary">

            <div className="summary-item">
                <span>Rental Days</span>

                <strong>
                    {rentalDays} {rentalDays === 1 ? 'Day' : 'Days'}
                </strong>
            </div>

            <div className="summary-item">
                <span>Daily Rate</span>

                <strong>
                    ₹{pricePerDay}/day
                </strong>
            </div>

            <div className="summary-item summary-total">
                <span>Total Price</span>

                <strong>
                    ₹{totalPrice}
                </strong>
            </div>

        </div>
    )
}

export default BookingSummary