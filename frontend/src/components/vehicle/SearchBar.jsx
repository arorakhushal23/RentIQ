function SearchBar({ searchText, onSearchChange }) {
    return (
        <div className="search-bar">
            <input
                type="text"
                placeholder="Search vehicles..."
                value={searchText}
                onChange={(event) => onSearchChange(event.target.value)}
            />

            <button type="button">
                Search
            </button>
        </div>
    )
}

export default SearchBar