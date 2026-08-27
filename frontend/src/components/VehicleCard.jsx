function VehicleCard({ name, category, price, seats, transmission }) {
    return (
        <article className="vehicle-card">

            <div className="vehicle-image">
                🚗
            </div>

            <div className="vehicle-info">
                <p className="vehicle-category">
                    {category}
                </p>

                <h2>{name}</h2>

                <div className="vehicle-details">
                    <span>{seats} Seats</span>
                    <span>{transmission}</span>
                </div>

                <div className="vehicle-bottom">
                    <p>
                        ₹{price}
                        <span>/day</span>
                    </p>

                    <button type="button">
                        View Details
                    </button>
                </div>
            </div>

        </article>
    )
}

export default VehicleCard
