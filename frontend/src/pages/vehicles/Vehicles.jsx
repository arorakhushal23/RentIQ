import { useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

import SearchBar from '../../components/vehicle/SearchBar'
import FilterPanel from '../../components/vehicle/FilterPanel'
import VehicleCard from '../../components/vehicle/VehicleCard'
import WishlistButton from '../../components/vehicle/WishlistButton'
import CompareButton from '../../components/vehicle/CompareButton'
import Loader from '../../components/common/Loader'

import './Vehicles.css'

function Vehicles() {
    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [searchText, setSearchText] = useState('')
    const [category, setCategory] = useState('all')
    const [transmission, setTransmission] = useState('all')
    const [seats, setSeats] = useState('all')
    const [maxPrice, setMaxPrice] = useState('')

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const response = await axiosInstance.get('/vehicles')

                setVehicles(response.data)
            } catch (error) {
                console.error('Error fetching vehicles:', error)

                setError('Unable to load vehicles.')
            } finally {
                setLoading(false)
            }
        }

        fetchVehicles()
    }, [])

    const handleReset = () => {
        setSearchText('')
        setCategory('all')
        setTransmission('all')
        setSeats('all')
        setMaxPrice('')
    }

    const filteredVehicles = vehicles.filter((vehicle) => {
        const matchesSearch =
            vehicle.name
                .toLowerCase()
                .includes(searchText.toLowerCase())

        const matchesCategory =
            category === 'all' ||
            vehicle.category.toLowerCase() === category.toLowerCase()

        const matchesTransmission =
            transmission === 'all' ||
            vehicle.transmission === transmission

        const matchesSeats =
            seats === 'all' ||
            vehicle.seating_capacity === Number(seats)

        const matchesPrice =
            maxPrice === '' ||
            Number(vehicle.price_per_day) <= Number(maxPrice)

        return (
            matchesSearch &&
            matchesCategory &&
            matchesTransmission &&
            matchesSeats &&
            matchesPrice
        )
    })

    if (loading) {
        return (
            <main className="vehicles-page">
                <Loader message="Loading vehicles..." />
            </main>
        )
    }
    if (error) {
        return (
            <main className="vehicles-page">
                <div className="vehicle-message">
                    {error}
                </div>
            </main>
        )
    }

    return (
        <main className="vehicles-page">

            <header className="vehicles-header">
                <h1>
                    Find Your Perfect Ride
                </h1>

                <p>
                    Choose from our collection of vehicles.
                </p>
            </header>

            <section className="vehicle-search-area">
                <SearchBar
                    searchText={searchText}
                    onSearchChange={setSearchText}
                />
            </section>

            <section className="vehicle-dashboard">

                <aside className="vehicle-filters">
                    <FilterPanel
                        category={category}
                        transmission={transmission}
                        seats={seats}
                        maxPrice={maxPrice}
                        onCategoryChange={setCategory}
                        onTransmissionChange={setTransmission}
                        onSeatsChange={setSeats}
                        onMaxPriceChange={setMaxPrice}
                        onReset={handleReset}
                    />
                </aside>

                <div className="vehicle-results">
                    <div className="vehicle-results-header">
                        <h2>
                            Available Vehicles
                        </h2>

                        <span className="vehicle-count">
                            {filteredVehicles.length} vehicles
                        </span>
                    </div>

                    {filteredVehicles.length === 0 ? (
                        <div className="vehicle-message">
                            No vehicles match your search.
                        </div>
                    ) : (
                        <div className="vehicle-grid">
                            {filteredVehicles.map((vehicle) => (
                                <div
                                    key={vehicle.vehicle_id}
                                    className="vehicle-item"
                                >
                                    <VehicleCard
                                        vehicleId={vehicle.vehicle_id}
                                        name={vehicle.name}
                                        brand={vehicle.brand}
                                        category={vehicle.category}
                                        price={vehicle.price_per_day}
                                        seats={vehicle.seating_capacity}
                                        transmission={vehicle.transmission}
                                    />

                                    <div className="vehicle-actions">
                                        <WishlistButton />
                                        <CompareButton />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </section>

        </main>
    )
}

export default Vehicles