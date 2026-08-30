function FilterPanel({
    category,
    transmission,
    seats,
    maxPrice,
    onCategoryChange,
    onTransmissionChange,
    onSeatsChange,
    onMaxPriceChange,
    onReset,
}) {
    return (
        <section className="filter-panel">

            <h2>Filters</h2>

            <div className="filter-group">
                <label htmlFor="category">
                    Category
                </label>

                <select
                    id="category"
                    value={category}
                    onChange={(event) =>
                        onCategoryChange(event.target.value)
                    }
                >
                    <option value="all">All Categories</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="hatchback">Hatchback</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="transmission">
                    Transmission
                </label>

                <select
                    id="transmission"
                    value={transmission}
                    onChange={(event) =>
                        onTransmissionChange(event.target.value)
                    }
                >
                    <option value="all">All Transmissions</option>
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="seats">
                    Seats
                </label>

                <select
                    id="seats"
                    value={seats}
                    onChange={(event) =>
                        onSeatsChange(event.target.value)
                    }
                >
                    <option value="all">Any Seats</option>
                    <option value="4">4 Seats</option>
                    <option value="5">5 Seats</option>
                    <option value="7">7 Seats</option>
                </select>
            </div>

            <div className="filter-group">
                <label htmlFor="max-price">
                    Maximum Price
                </label>

                <input
                    id="max-price"
                    type="number"
                    min="0"
                    placeholder="₹ per day"
                    value={maxPrice}
                    onChange={(event) =>
                        onMaxPriceChange(event.target.value)
                    }
                />
            </div>

            <button
                type="button"
                className="reset-button"
                onClick={onReset}
            >
                Reset Filters
            </button>

        </section>
    )
}

export default FilterPanel