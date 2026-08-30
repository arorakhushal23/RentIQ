import { Link } from 'react-router-dom'
import './VehicleCard.css'
function VehicleCard({
    vehicleId,
    name,
    brand,
    category,
    price,
    seats,
    transmission,
}) {
    return (
        <article className="vehicle-card">

            {/* Vehicle image area */}
            <div className="vehicle-image">
                <span>🚗</span>
            </div>


            {/* Vehicle information */}
            <div className="vehicle-info">

                <p className="vehicle-category">
                    {category}
                </p>

                <h2 className="vehicle-name">
                    {name}
                </h2>

                <p className="vehicle-brand">
                    {brand}
                </p>


                {/* Vehicle specifications */}
                <div className="vehicle-details">

                    <span>
                        {seats} Seats
                    </span>

                    <span>
                        {transmission}
                    </span>

                </div>


                {/* Price */}
                <div className="vehicle-bottom">

                    <p className="vehicle-price">
                        ₹{price}
                        <span>/day</span>
                    </p>

                    <Link
                        to={`/vehicles/${vehicleId}`}
                        className="vehicle-details-button"
                    >
                        View Details
                    </Link>

                </div>

            </div>

        </article>
    )
}

export default VehicleCard