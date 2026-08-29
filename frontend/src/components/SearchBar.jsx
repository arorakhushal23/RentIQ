import { useState } from 'react'

function SearchBar() {
    const [searchText, setSearchText] = useState('')

    const handleSearch = (event) => {
        setSearchText(event.target.value)
    }

    return (
        <div className="search-bar">

            <input
                type="text"
                placeholder="Search vehicles..."
                value={searchText}
                onChange={handleSearch}
            />

            <button type="button">
                Search
            </button>

        </div>
    )
}

export default SearchBar