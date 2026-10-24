import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import BookingForm from '../../components/booking/BookingForm';
import WishlistButton from '../../components/vehicle/WishlistButton';
import CompareButton from '../../components/vehicle/CompareButton';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import './VehicleDetails.css';
function VehicleDetails() {
    const { id } = useParams();

    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchVehicle = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await axiosInstance.get(`/vehicles/${id}`);
                setVehicle(response.data);
            } catch (err) {
                console.error('Error fetching vehicle:', err);
                setError('Unable to load vehicle details.');
            } finally {
                setLoading(false);
            }
        };

        fetchVehicle();
    }, [id]);

    if (loading) {
        return <p>Loading vehicle...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    if (!vehicle) {
        return <p>Vehicle not found.</p>;
    }

    const imageUrl = getVehicleImageUrl(vehicle);

    return (
        <main className="vehicle-details-page">
            <section className="vehicle-details-card">
                <div className="vehicle-details-image">
                    <img
                        src={imageUrl}
                        alt={`${vehicle.brand || ''} ${vehicle.name}`}
                        onError={handleVehicleImageError}
                    />
                </div>

                <div className="vehicle-details-info">
                    <div className="vehicle-details-header-row">
                        <div>
                            <p className="vehicle-category">
                                {vehicle.category}
                            </p>

                            <h1>{vehicle.name}</h1>

                            <p className="vehicle-brand">
                                {vehicle.brand}
                            </p>
                        </div>

                        <div className="vehicle-details-actions">
                            <WishlistButton vehicle={vehicle} />
                            <CompareButton vehicle={vehicle} />
                        </div>
                    </div>

                    <div className="vehicle-specifications">
                        <div>
                            <span>Seats</span>
                            <strong>{vehicle.seating_capacity}</strong>
                        </div>

                        <div>
                            <span>Transmission</span>
                            <strong>{vehicle.transmission}</strong>
                        </div>

                        <div>
                            <span>Availability</span>
                            <strong>
                                {vehicle.is_available
                                    ? 'Available'
                                    : 'Unavailable'}
                            </strong>
                        </div>
                    </div>

                    <div className="vehicle-details-price">
                        <span>Rental Price</span>

                        <strong>
                            ₹{vehicle.price_per_day}
                            <small>/day</small>
                        </strong>
                    </div>

                    <BookingForm
                        vehicleId={vehicle.vehicle_id}
                        vehicleName={vehicle.brand ? `${vehicle.brand} ${vehicle.name}` : vehicle.name}
                        pricePerDay={vehicle.price_per_day}
                        isAvailable={vehicle.is_available}
                    />
                </div>
            </section>
        </main>
    );
}

export default VehicleDetails;