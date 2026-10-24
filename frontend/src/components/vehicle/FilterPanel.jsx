import './FilterPanel.css';

const DEFAULT_CATEGORIES = [
    'All Categories',
    'Sedan',
    'SUV',
    'Hatchback',
    'Bike',
    'Scooter',
    'EV',
];

function FilterPanel({
    category = 'all',
    transmission = 'all',
    seats = 'all',
    minPrice = '',
    maxPrice = '',
    availability = 'all',
    availableCategories = DEFAULT_CATEGORIES,
    onCategoryChange,
    onTransmissionChange,
    onSeatsChange,
    onMinPriceChange,
    onMaxPriceChange,
    onAvailabilityChange,
    onReset,
}) {
    // Count active filters
    const activeFiltersCount = [
        category !== 'all',
        transmission !== 'all',
        seats !== 'all',
        minPrice !== '' && Number(minPrice) > 0,
        maxPrice !== '' && Number(maxPrice) < 5000,
        availability !== 'all',
    ].filter(Boolean).length;

    return (
        <section className="filter-panel" aria-label="Vehicle Filters">
            <div className="filter-panel-header">
                <div className="filter-title-wrap">
                    <h2>Filters</h2>
                    {activeFiltersCount > 0 && (
                        <span className="filter-badge" aria-label={`${activeFiltersCount} active filters`}>
                            {activeFiltersCount}
                        </span>
                    )}
                </div>

                {activeFiltersCount > 0 && (
                    <button
                        type="button"
                        className="clear-all-text-btn"
                        onClick={onReset}
                        aria-label="Clear all applied filters"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {/* Category Filter */}
            <div className="filter-group">
                <label htmlFor="filter-category" className="filter-group-label">
                    Category
                </label>
                <select
                    id="filter-category"
                    value={category}
                    onChange={(event) => onCategoryChange(event.target.value)}
                    className="filter-select"
                >
                    {availableCategories.map((cat) => {
                        const val = cat.toLowerCase() === 'all categories' ? 'all' : cat.toLowerCase();
                        return (
                            <option key={cat} value={val}>
                                {cat}
                            </option>
                        );
                    })}
                </select>
            </div>

            {/* Daily Price Range Filter */}
            <div className="filter-group">
                <div className="filter-label-row">
                    <label htmlFor="filter-max-price-slider" className="filter-group-label">
                        Daily Price (₹/day)
                    </label>
                    <span className="price-range-indicator">
                        ₹{minPrice || 0} – ₹{maxPrice || '3,500+'}
                    </span>
                </div>

                <input
                    id="filter-max-price-slider"
                    type="range"
                    min="500"
                    max="4000"
                    step="100"
                    value={maxPrice || 4000}
                    onChange={(e) => onMaxPriceChange(e.target.value)}
                    className="filter-slider"
                    aria-label="Maximum daily rental price slider"
                />

                <div className="price-inputs-row">
                    <div className="price-input-col">
                        <span className="input-prefix">Min</span>
                        <input
                            id="filter-min-price"
                            type="number"
                            min="0"
                            max="5000"
                            placeholder="₹ Min"
                            value={minPrice}
                            onChange={(e) => onMinPriceChange(e.target.value)}
                            className="filter-input-small"
                            aria-label="Minimum daily rental price"
                        />
                    </div>
                    <span className="price-separator">–</span>
                    <div className="price-input-col">
                        <span className="input-prefix">Max</span>
                        <input
                            id="filter-max-price"
                            type="number"
                            min="0"
                            max="5000"
                            placeholder="₹ Max"
                            value={maxPrice}
                            onChange={(e) => onMaxPriceChange(e.target.value)}
                            className="filter-input-small"
                            aria-label="Maximum daily rental price"
                        />
                    </div>
                </div>
            </div>

            {/* Seating Capacity Filter */}
            <div className="filter-group">
                <label htmlFor="filter-seats" className="filter-group-label">
                    Seating Capacity
                </label>
                <select
                    id="filter-seats"
                    value={seats}
                    onChange={(event) => onSeatsChange(event.target.value)}
                    className="filter-select"
                >
                    <option value="all">Any Seats</option>
                    <option value="2">2 Seats (Bikes & Scooters)</option>
                    <option value="5">5 Seats (Sedans & Compacts)</option>
                    <option value="7">7 Seats (SUVs)</option>
                </select>
            </div>

            {/* Transmission Filter */}
            <div className="filter-group">
                <label htmlFor="filter-transmission" className="filter-group-label">
                    Transmission
                </label>
                <select
                    id="filter-transmission"
                    value={transmission}
                    onChange={(event) => onTransmissionChange(event.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Transmissions</option>
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                </select>
            </div>

            {/* Availability Filter */}
            <div className="filter-group">
                <label htmlFor="filter-availability" className="filter-group-label">
                    Availability
                </label>
                <select
                    id="filter-availability"
                    value={availability}
                    onChange={(event) => onAvailabilityChange(event.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Vehicles</option>
                    <option value="available">Available Only</option>
                </select>
            </div>

            {/* Reset Button */}
            <button
                type="button"
                className="reset-button"
                onClick={onReset}
            >
                Reset All Filters
            </button>
        </section>
    );
}

export default FilterPanel;