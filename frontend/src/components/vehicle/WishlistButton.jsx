import { useWishlist } from '../../context/WishlistContext';

function WishlistButton({ vehicle }) {
    const { isInWishlist, toggleWishlist } = useWishlist();

    if (!vehicle) return null;

    const vehicleId = vehicle.vehicle_id || vehicle.vehicleId || vehicle.id;
    const isWishlisted = isInWishlist(vehicleId);
    const vehicleName = vehicle.name || 'Vehicle';

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(vehicle);
    };

    return (
        <button
            type="button"
            className={`wishlist-button ${isWishlisted ? 'active' : ''}`}
            onClick={handleClick}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? `Remove ${vehicleName} from wishlist` : `Add ${vehicleName} to wishlist`}
            id={`wishlist-btn-${vehicleId}`}
        >
            <span className="wishlist-icon" aria-hidden="true">
                {isWishlisted ? '♥' : '♡'}
            </span>
            <span className="wishlist-label">
                {isWishlisted ? 'Wishlisted' : 'Wishlist'}
            </span>
        </button>
    );
}

export default WishlistButton;