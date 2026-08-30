import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axiosInstance from '../api/axiosInstance'

function VehicleDetails() {
    const { id } = useParams()

    const [vehicle, setVehicle] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const fetchVehicle = async () => {
            try {
                const response = await axiosInstance.get(`/vehicles/${id}`)

                setVehicle(response.data)
            } catch (error) {
                console.error('Error fetching vehicle:', error)

                setError('Unable to load vehicle details.')
            } finally {
                setLoading(false)
            }
        }

        fetchVehicle()
    }, [id])

    if (loading) {
        return <p>Loading vehicle...</p>
    }

    if (error) {
        return <p>{error}</p>
    }

    return (
        <main className="vehicle-details-page">

            <section className="vehicle-details-card">

                <div className="vehicle-details-image">
                    🚗
                </div>

                <div className="vehicle-details-info">

                    <p className="vehicle-category">
                        {vehicle.category}
                    </p>

                    <h1>
                        {vehicle.name}
                    </h1>

                    <p className="vehicle-brand">
                        {vehicle.brand}
                    </p>

                    <div className="vehicle-specifications">

                        <div>
                            <span>Seats</span>
                            <strong>
                                {vehicle.seating_capacity}
                            </strong>
                        </div>

                        <div>
                            <span>Transmission</span>
                            <strong>
                                {vehicle.transmission}
                            </strong>
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

                    <button
                        type="button"
                        className="book-now-button"
                    >
                        Book Now
                    </button>

                </div>

            </section>

        </main>
    )
}

export default VehicleDetails