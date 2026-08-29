import { useState } from 'react'

function WishlistButton() {
    const [isWishlisted, setIsWishlisted] = useState(false)

    const handleWishlistClick = () => {
        setIsWishlisted((currentValue) => !currentValue)
    }

    return (
        <button
            type="button"
            className={`wishlist-button ${isWishlisted ? 'active' : ''}`}
            onClick={handleWishlistClick}
            aria-label={
                isWishlisted
                    ? 'Remove from wishlist'
                    : 'Add to wishlist'
            }
        >
            {isWishlisted ? '♥' : '♡'}
        </button>
    )
}

export default WishlistButton