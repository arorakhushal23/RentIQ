import { useState, useRef } from 'react'
import './SearchBar.css'

function SearchBar({ searchText, onSearchChange }) {
    const [localQuery, setLocalQuery] = useState(searchText || '')
    const [prevSearchText, setPrevSearchText] = useState(searchText)
    const inputRef = useRef(null)

    // Synchronize local input state when parent searchText updates (e.g. from URL params or Reset filters)
    if (prevSearchText !== searchText) {
        setPrevSearchText(searchText)
        setLocalQuery(searchText || '')
    }

    const handleChange = (e) => {
        const val = e.target.value
        setLocalQuery(val)
        onSearchChange?.(val)
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSearchChange?.(localQuery)
    }

    const handleClear = () => {
        setLocalQuery('')
        onSearchChange?.('')
        inputRef.current?.focus()
    }

    return (
        <form
            className="vehicle-search-bar"
            onSubmit={handleSubmit}
            role="search"
            aria-label="Vehicle Catalog Search"
        >
            <div className="search-field-container">
                <svg
                    className="search-field-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>

                <input
                    ref={inputRef}
                    type="text"
                    className="search-field-input"
                    placeholder="Search vehicles..."
                    value={localQuery}
                    onChange={handleChange}
                    aria-label="Search vehicles by name, brand, or model"
                    id="vehicle-search-input"
                />

                {localQuery && (
                    <button
                        type="button"
                        className="search-field-clear"
                        onClick={handleClear}
                        aria-label="Clear vehicle search"
                        title="Clear search"
                        id="vehicle-search-clear-btn"
                    >
                        &times;
                    </button>
                )}
            </div>

            <button
                type="submit"
                className="search-submit-button"
                id="vehicle-search-submit-btn"
                aria-label="Search vehicles"
            >
                <svg
                    className="search-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
            </button>
        </form>
    )
}

export default SearchBar