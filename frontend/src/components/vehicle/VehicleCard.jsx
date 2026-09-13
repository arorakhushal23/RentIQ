import { Link } from 'react-router-dom'
import './VehicleCard.css'
import vehicleImages from '../../utils/vehicleImages'

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

            <div className="vehicle-image">
                {vehicleImages[name] ? (
                    <img
                        src={vehicleImages[name]}
                        alt={name}
                    />
                ) : (
                    <span>🚗</span>
                )}
            </div>

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

                <div className="vehicle-details">

                    <span>
                        {seats} Seats
                    </span>

                    <span>
                        {transmission}
                    </span>

                </div>

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