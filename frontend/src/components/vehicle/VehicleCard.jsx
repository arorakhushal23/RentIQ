import { Link } from 'react-router-dom';
import './VehicleCard.css';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';

function VehicleCard({
    vehicleId,
    name,
    brand,
    category,
    price,
    seats,
    transmission,
    imageUrl,
}) {
    const imageSource = getVehicleImageUrl({ name, vehicle_name: name, image_url: imageUrl });
    const isEv = category && category.toLowerCase() === 'ev';

    return (
        <article className="vehicle-card">
            <div className="vehicle-image-wrapper">
                <img
                    src={imageSource}
                    alt={`${brand || ''} ${name}`}
                    className="vehicle-card-img"
                    loading="lazy"
                    onError={handleVehicleImageError}
                />
                {category && (
                    <span className="vehicle-badge-pill">
                        {category}
                    </span>
                )}
            </div>

            <div className="vehicle-info">
                <div className="vehicle-title-wrap">
                    <h3 className="vehicle-name">{name}</h3>
                    <span className="vehicle-brand">{brand}</span>
                </div>

                <div className="vehicle-specs-row">
                    <span className="spec-item">
                        👥 {seats} {seats === 1 ? 'Seat' : 'Seats'}
                    </span>
                    <span className="spec-item spec-transmission">
                        ⚙️ {transmission}
                    </span>
                    {isEv && (
                        <span className="spec-item spec-ev">
                            ⚡ Electric
                        </span>
                    )}
                </div>

                <div className="vehicle-card-footer">
                    <div className="vehicle-rate-block">
                        <span className="vehicle-rate-label">Daily Rate</span>
                        <div className="vehicle-rate-val">
                            ₹{Number(price).toLocaleString('en-IN')}
                            <span className="vehicle-rate-unit">/day</span>
                        </div>
                    </div>

                    <Link
                        to={`/vehicles/${vehicleId}`}
                        className="vehicle-view-details-btn"
                        id={`vehicle-details-${vehicleId}`}
                    >
                        View Details
                    </Link>
                </div>
            </div>
        </article>
    );
}

export default VehicleCard;