import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'

import SearchBar from '../../components/vehicle/SearchBar'
import FilterPanel from '../../components/vehicle/FilterPanel'
import VehicleCard from '../../components/vehicle/VehicleCard'
import WishlistButton from '../../components/vehicle/WishlistButton'
import CompareButton from '../../components/vehicle/CompareButton'
import Loader from '../../components/common/Loader'

import './Vehicles.css'

const DEFAULT_SUPPORTED_CATEGORIES = [
    'All Categories',
    'Sedan',
    'SUV',
    'Hatchback',
    'Bike',
    'Scooter',
    'EV',
]

function Vehicles() {
    const [searchParams, setSearchParams] = useSearchParams()
    const urlSearch = searchParams.get('search') || ''

    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch)
    const [searchText, setSearchText] = useState(urlSearch)

    if (prevUrlSearch !== urlSearch) {
        setPrevUrlSearch(urlSearch)
        setSearchText(urlSearch)
    }

    // Filters
    const [category, setCategory] = useState('all')
    const [transmission, setTransmission] = useState('all')
    const [seats, setSeats] = useState('all')
    const [minPrice, setMinPrice] = useState('')
    const [maxPrice, setMaxPrice] = useState('')
    const [availability, setAvailability] = useState('all')
    const [sortBy, setSortBy] = useState('default')

    // Mobile filter visibility
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    useEffect(() => {
        const fetchVehicles = async () => {
            try {
                const response = await axiosInstance.get('/vehicles')
                setVehicles(response.data)
            } catch (err) {
                console.error('Error fetching vehicles:', err)
                setError('Unable to load vehicles.')
            } finally {
                setLoading(false)
            }
        }

        fetchVehicles()
    }, [])

    // Derive supported categories list combining DB defaults and actual returned records
    const availableCategories = useMemo(() => {
        const categorySet = new Set(DEFAULT_SUPPORTED_CATEGORIES)
        vehicles.forEach((v) => {
            if (v.category && typeof v.category === 'string') {
                const trimmed = v.category.trim()
                // Avoid duplicate casing
                const exists = Array.from(categorySet).some(
                    (c) => c.toLowerCase() === trimmed.toLowerCase()
                )
                if (!exists) {
                    categorySet.add(trimmed)
                }
            }
        })
        return Array.from(categorySet)
    }, [vehicles])

    const handleSearchChange = (val) => {
        setSearchText(val)
        const next = new URLSearchParams(searchParams)
        if (val.trim()) {
            next.set('search', val.trim())
        } else {
            next.delete('search')
        }
        setSearchParams(next, { replace: true })
    }

    const handleReset = () => {
        setSearchText('')
        setCategory('all')
        setTransmission('all')
        setSeats('all')
        setMinPrice('')
        setMaxPrice('')
        setAvailability('all')
        setSortBy('default')
        setSearchParams({}, { replace: true })
    }

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        return [
            searchText.trim() !== '',
            category !== 'all',
            transmission !== 'all',
            seats !== 'all',
            minPrice !== '' && Number(minPrice) > 0,
            maxPrice !== '' && Number(maxPrice) < 5000,
            availability !== 'all',
        ].filter(Boolean).length
    }, [searchText, category, transmission, seats, minPrice, maxPrice, availability])

    const filteredVehicles = useMemo(() => {
        const searchLower = searchText.trim().toLowerCase()

        const results = vehicles.filter((vehicle) => {
            const matchesSearch =
                !searchLower ||
                vehicle.name.toLowerCase().includes(searchLower) ||
                (vehicle.brand && vehicle.brand.toLowerCase().includes(searchLower))

            const matchesCategory =
                category === 'all' ||
                (vehicle.category &&
                    vehicle.category.toLowerCase() === category.toLowerCase())

            const matchesTransmission =
                transmission === 'all' ||
                vehicle.transmission?.toLowerCase() === transmission.toLowerCase()

            const matchesSeats =
                seats === 'all' ||
                vehicle.seating_capacity === Number(seats)

            const matchesMinPrice =
                minPrice === '' ||
                Number(vehicle.price_per_day) >= Number(minPrice)

            const matchesMaxPrice =
                maxPrice === '' ||
                Number(vehicle.price_per_day) <= Number(maxPrice)

            const matchesAvailability =
                availability === 'all' ||
                (availability === 'available' ? Boolean(vehicle.is_available) : true)

            return (
                matchesSearch &&
                matchesCategory &&
                matchesTransmission &&
                matchesSeats &&
                matchesMinPrice &&
                matchesMaxPrice &&
                matchesAvailability
            )
        })

        // Apply sorting
        if (sortBy === 'price-low') {
            return [...results].sort((a, b) => Number(a.price_per_day) - Number(b.price_per_day))
        }
        if (sortBy === 'price-high') {
            return [...results].sort((a, b) => Number(b.price_per_day) - Number(a.price_per_day))
        }
        if (sortBy === 'name-asc') {
            return [...results].sort((a, b) => a.name.localeCompare(b.name))
        }

        return results
    }, [vehicles, searchText, category, transmission, seats, minPrice, maxPrice, availability, sortBy])

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
                <div className="vehicle-message error-message">
                    {error}
                </div>
            </main>
        )
    }

    return (
        <main className="vehicles-page">
            <header className="vehicles-header">
                <h1>Find Your Perfect Ride</h1>
                <p>
                    Browse RentIQ&apos;s verified fleet of sedans, SUVs, hatchbacks, bikes, scooters, and EVs.
                </p>
            </header>

            <section className="vehicle-search-area">
                <SearchBar
                    searchText={searchText}
                    onSearchChange={handleSearchChange}
                />

                {/* Mobile Filter Toggle Button */}
                <button
                    type="button"
                    className="mobile-filter-btn"
                    onClick={() => setShowMobileFilters((prev) => !prev)}
                    aria-expanded={showMobileFilters}
                >
                    <span>⚡ Filters</span>
                    {activeFiltersCount > 0 && (
                        <span className="mobile-filter-badge">{activeFiltersCount}</span>
                    )}
                </button>
            </section>

            <section className="vehicle-dashboard">
                {/* Desktop and Mobile Filter Sidebar */}
                <aside className={`vehicle-filters ${showMobileFilters ? 'open-mobile' : ''}`}>
                    <FilterPanel
                        category={category}
                        transmission={transmission}
                        seats={seats}
                        minPrice={minPrice}
                        maxPrice={maxPrice}
                        availability={availability}
                        availableCategories={availableCategories}
                        onCategoryChange={setCategory}
                        onTransmissionChange={setTransmission}
                        onSeatsChange={setSeats}
                        onMinPriceChange={setMinPrice}
                        onMaxPriceChange={setMaxPrice}
                        onAvailabilityChange={setAvailability}
                        onReset={handleReset}
                    />
                </aside>

                {/* Vehicle Grid & Results Header */}
                <div className="vehicle-results">
                    <div className="vehicle-results-header">
                        <div className="results-count-wrap">
                            <h2>Available Vehicles</h2>
                            <span className="vehicle-count">
                                {filteredVehicles.length} {filteredVehicles.length === 1 ? 'vehicle' : 'vehicles'} found
                            </span>
                        </div>

                        {/* Sorting Selector */}
                        <div className="sort-control">
                            <label htmlFor="vehicle-sort" className="sort-label">Sort by:</label>
                            <select
                                id="vehicle-sort"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="sort-select"
                            >
                                <option value="default">Featured</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name-asc">Name: A to Z</option>
                            </select>
                        </div>
                    </div>

                    {filteredVehicles.length === 0 ? (
                        <div className="vehicle-no-results">
                            <div className="no-results-icon">🔍</div>
                            <h3>No vehicles match your filters</h3>
                            <p>Try adjusting your search criteria, price range, or category filter.</p>
                            <button
                                type="button"
                                className="reset-filters-btn"
                                onClick={handleReset}
                            >
                                Clear All Filters
                            </button>
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
                                        imageUrl={vehicle.image_url}
                                    />

                                    <div className="vehicle-actions">
                                        <WishlistButton vehicle={vehicle} />
                                        <CompareButton vehicle={vehicle} />
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