import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, Search } from 'lucide-react'
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
    const urlPage = parseInt(searchParams.get('page'), 10) || 1

    const [vehicles, setVehicles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Pagination state
    const [currentPage, setCurrentPage] = useState(urlPage > 0 ? urlPage : 1)
    const [pagination, setPagination] = useState({
        totalItems: 0,
        totalPages: 1,
        currentPage: urlPage > 0 ? urlPage : 1,
        limit: 12,
        hasNextPage: false,
        hasPrevPage: false
    })

    const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch)
    const [searchText, setSearchText] = useState(urlSearch)

    if (prevUrlSearch !== urlSearch) {
        setPrevUrlSearch(urlSearch)
        setSearchText(urlSearch)
    }

    // Filters
    const [category, setCategory] = useState(searchParams.get('category') || 'all')
    const [transmission, setTransmission] = useState(searchParams.get('transmission') || 'all')
    const [seats, setSeats] = useState(searchParams.get('seats') || 'all')
    const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '')
    const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '')
    const [availability, setAvailability] = useState(searchParams.get('availability') || 'all')
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'default')

    // Mobile filter visibility
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    // Sync state with URL params
    const updateUrlParams = (newParams = {}) => {
        const next = new URLSearchParams()
        const merged = {
            search: searchText.trim() || undefined,
            category: category !== 'all' ? category : undefined,
            transmission: transmission !== 'all' ? transmission : undefined,
            seats: seats !== 'all' ? seats : undefined,
            minPrice: minPrice !== '' ? minPrice : undefined,
            maxPrice: maxPrice !== '' ? maxPrice : undefined,
            availability: availability !== 'all' ? availability : undefined,
            sortBy: sortBy !== 'default' ? sortBy : undefined,
            page: currentPage > 1 ? currentPage : undefined,
            ...newParams
        }

        Object.entries(merged).forEach(([k, v]) => {
            if (v !== undefined && v !== '') {
                next.set(k, String(v))
            }
        })

        setSearchParams(next, { replace: true })
    }

    // Fetch vehicles from backend with pagination, search, filters, and sorting
    useEffect(() => {
        let isSubscribed = true

        const fetchVehicles = async () => {
            setLoading(true)
            setError('')

            try {
                const params = {
                    page: currentPage,
                    limit: 12
                }

                if (searchText.trim()) params.search = searchText.trim()
                if (category !== 'all') params.category = category
                if (transmission !== 'all') params.transmission = transmission
                if (seats !== 'all') params.seats = seats
                if (minPrice !== '') params.minPrice = minPrice
                if (maxPrice !== '') params.maxPrice = maxPrice
                if (availability !== 'all') params.availability = availability
                if (sortBy !== 'default') params.sortBy = sortBy

                const response = await axiosInstance.get('/vehicles', { params })

                if (!isSubscribed) return

                if (response.data && response.data.pagination) {
                    setVehicles(response.data.vehicles || [])
                    setPagination(response.data.pagination)

                    // If current page is beyond total pages (e.g. after filtering), adjust
                    if (response.data.pagination.totalPages > 0 && currentPage > response.data.pagination.totalPages) {
                        setCurrentPage(response.data.pagination.totalPages)
                    }
                } else if (Array.isArray(response.data)) {
                    // Fallback for unpaginated responses
                    setVehicles(response.data)
                    setPagination({
                        totalItems: response.data.length,
                        totalPages: Math.max(1, Math.ceil(response.data.length / 12)),
                        currentPage: 1,
                        limit: 12,
                        hasNextPage: false,
                        hasPrevPage: false
                    })
                }
            } catch (err) {
                if (isSubscribed) {
                    console.error('Error fetching vehicles:', err)
                    setError('Unable to load vehicles. Please try again.')
                }
            } finally {
                if (isSubscribed) {
                    setLoading(false)
                }
            }
        }

        fetchVehicles()

        return () => {
            isSubscribed = false
        }
    }, [currentPage, searchText, category, transmission, seats, minPrice, maxPrice, availability, sortBy])

    // Derive supported categories list combining defaults and current records
    const availableCategories = useMemo(() => {
        const categorySet = new Set(DEFAULT_SUPPORTED_CATEGORIES)
        vehicles.forEach((v) => {
            if (v.category && typeof v.category === 'string') {
                const trimmed = v.category.trim()
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
        setCurrentPage(1)
        updateUrlParams({ search: val.trim() || undefined, page: undefined })
    }

    const handleCategoryChange = (val) => {
        setCategory(val)
        setCurrentPage(1)
        updateUrlParams({ category: val !== 'all' ? val : undefined, page: undefined })
    }

    const handleTransmissionChange = (val) => {
        setTransmission(val)
        setCurrentPage(1)
        updateUrlParams({ transmission: val !== 'all' ? val : undefined, page: undefined })
    }

    const handleSeatsChange = (val) => {
        setSeats(val)
        setCurrentPage(1)
        updateUrlParams({ seats: val !== 'all' ? val : undefined, page: undefined })
    }

    const handleMinPriceChange = (val) => {
        setMinPrice(val)
        setCurrentPage(1)
        updateUrlParams({ minPrice: val !== '' ? val : undefined, page: undefined })
    }

    const handleMaxPriceChange = (val) => {
        setMaxPrice(val)
        setCurrentPage(1)
        updateUrlParams({ maxPrice: val !== '' ? val : undefined, page: undefined })
    }

    const handleAvailabilityChange = (val) => {
        setAvailability(val)
        setCurrentPage(1)
        updateUrlParams({ availability: val !== 'all' ? val : undefined, page: undefined })
    }

    const handleSortChange = (val) => {
        setSortBy(val)
        setCurrentPage(1)
        updateUrlParams({ sortBy: val !== 'default' ? val : undefined, page: undefined })
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
        setCurrentPage(1)
        setSearchParams({}, { replace: true })
    }

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== currentPage) {
            setCurrentPage(newPage)
            updateUrlParams({ page: newPage > 1 ? newPage : undefined })
            window.scrollTo({ top: 180, behavior: 'smooth' })
        }
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

    // Generate page numbers array for pagination controls
    const pageNumbers = useMemo(() => {
        const pages = []
        const total = pagination.totalPages
        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i)
        } else {
            // Windowed pagination
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', total)
            } else if (currentPage >= total - 3) {
                pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total)
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', total)
            }
        }
        return pages
    }, [pagination.totalPages, currentPage])

    const startItem = pagination.totalItems === 0 ? 0 : (currentPage - 1) * pagination.limit + 1
    const endItem = Math.min(currentPage * pagination.limit, pagination.totalItems)

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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" />
                        Filters
                    </span>
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
                        onCategoryChange={handleCategoryChange}
                        onTransmissionChange={handleTransmissionChange}
                        onSeatsChange={handleSeatsChange}
                        onMinPriceChange={handleMinPriceChange}
                        onMaxPriceChange={handleMaxPriceChange}
                        onAvailabilityChange={handleAvailabilityChange}
                        onReset={handleReset}
                    />
                </aside>

                {/* Vehicle Grid & Results Header */}
                <div className="vehicle-results">
                    <div className="vehicle-results-header">
                        <div className="results-count-wrap">
                            <h2>Available Vehicles</h2>
                            <span className="vehicle-count">
                                {pagination.totalItems > 0
                                    ? `Showing ${startItem}–${endItem} of ${pagination.totalItems} vehicles`
                                    : '0 vehicles found'}
                            </span>
                        </div>

                        {/* Sorting Selector */}
                        <div className="sort-control">
                            <label htmlFor="vehicle-sort" className="sort-label">Sort by:</label>
                            <select
                                id="vehicle-sort"
                                value={sortBy}
                                onChange={(e) => handleSortChange(e.target.value)}
                                className="sort-select"
                            >
                                <option value="default">Featured</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name-asc">Name: A to Z</option>
                            </select>
                        </div>
                    </div>

                    {loading ? (
                        <div className="vehicle-loading-container">
                            <Loader message="Loading vehicles..." />
                        </div>
                    ) : error ? (
                        <div className="vehicle-message error-message" role="alert">
                            {error}
                            <button
                                type="button"
                                className="reset-filters-btn"
                                style={{ marginTop: '12px' }}
                                onClick={() => handlePageChange(currentPage)}
                            >
                                Try Again
                            </button>
                        </div>
                    ) : vehicles.length === 0 ? (
                        <div className="vehicle-no-results">
                            <div className="no-results-icon" aria-hidden="true">
                                <Search size={36} strokeWidth={1.5} />
                            </div>
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
                        <>
                            <div className="vehicle-grid">
                                {vehicles.map((vehicle) => (
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

                            {/* Pagination Controls */}
                            {pagination.totalPages > 1 && (
                                <nav
                                    className="vehicle-pagination"
                                    aria-label="Vehicle catalogue pagination"
                                >
                                    <button
                                        type="button"
                                        className="pagination-btn pagination-prev"
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={!pagination.hasPrevPage || currentPage <= 1}
                                        aria-label="Go to previous page"
                                    >
                                        ← Previous
                                    </button>

                                    <div className="pagination-numbers" role="list">
                                        {pageNumbers.map((item, idx) => {
                                            if (item === '...') {
                                                return (
                                                    <span
                                                        key={`ellipsis-${idx}`}
                                                        className="pagination-ellipsis"
                                                        aria-hidden="true"
                                                    >
                                                        …
                                                    </span>
                                                )
                                            }

                                            const isCurrent = item === currentPage
                                            return (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    className={`pagination-number-btn ${isCurrent ? 'active' : ''}`}
                                                    onClick={() => handlePageChange(item)}
                                                    aria-current={isCurrent ? 'page' : undefined}
                                                    aria-label={`Page ${item}`}
                                                >
                                                    {item}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        className="pagination-btn pagination-next"
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={!pagination.hasNextPage || currentPage >= pagination.totalPages}
                                        aria-label="Go to next page"
                                    >
                                        Next →
                                    </button>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            </section>
        </main>
    )
}

export default Vehicles