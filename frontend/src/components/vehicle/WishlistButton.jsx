function WishlistButton() {
    return (
        <button
            type="button"
            className="wishlist-button"
            aria-label="Add vehicle to wishlist"
        >
            <span className="wishlist-icon">
                ♡
            </span>

            <span>
                Wishlist
            </span>
        </button>
    )
}

export default WishlistButton