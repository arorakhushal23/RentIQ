import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axiosInstance from '../../api/axiosInstance';
import BookingForm from '../../components/booking/BookingForm';
import vehicleImages from '../../utils/vehicleImages';
import './VehicleDetails.css';
function VehicleDetails() {
    const { id } = useParams();

    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        const fetchVehicle = async () => {
            setLoading(true);
            setError('');
            setImageFailed(false);

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

    const imageUrl =
        vehicle.image_url ||
        vehicleImages[vehicle.name];

    return (
        <main className="vehicle-details-page">
            <section className="vehicle-details-card">
                <div className="vehicle-details-image">
                    {imageUrl && !imageFailed ? (
                        <img
                            src={imageUrl}
                            alt={`${vehicle.brand || ''} ${vehicle.name}`}
                            onError={() => setImageFailed(true)}
                        />
                    ) : (
                        <span role="img" aria-label="Vehicle">
                            🚗
                        </span>
                    )}
                </div>

                <div className="vehicle-details-info">
                    <p className="vehicle-category">
                        {vehicle.category}
                    </p>

                    <h1>{vehicle.name}</h1>

                    <p className="vehicle-brand">
                        {vehicle.brand}
                    </p>

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
                        pricePerDay={vehicle.price_per_day}
                        isAvailable={vehicle.is_available}
                    />
                </div>
            </section>
        </main>
    );
}

export default VehicleDetails;