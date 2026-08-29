import { useState } from 'react'

function FilterPanel() {
    const [category, setCategory] = useState('all')
    const [transmission, setTransmission] = useState('all')
    const [seats, setSeats] = useState('all')

    return (
        <section className="filter-panel">

            <h2>Filters</h2>

            <div>
                <label htmlFor="category">
                    Category
                </label>

                <select
                    id="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                >
                    <option value="all">All</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="hatchback">Hatchback</option>
                </select>
            </div>

            <div>
                <label htmlFor="transmission">
                    Transmission
                </label>

                <select
                    id="transmission"
                    value={transmission}
                    onChange={(event) =>
                        setTransmission(event.target.value)
                    }
                >
                    <option value="all">All</option>
                    <option value="automatic">Automatic</option>
                    <option value="manual">Manual</option>
                </select>
            </div>

            <div>
                <label htmlFor="seats">
                    Seats
                </label>

                <select
                    id="seats"
                    value={seats}
                    onChange={(event) => setSeats(event.target.value)}
                >
                    <option value="all">All</option>
                    <option value="4">4 Seats</option>
                    <option value="5">5 Seats</option>
                    <option value="7">7 Seats</option>
                </select>
            </div>

        </section>
    )
}

export default FilterPanel