import { Link } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import CompareButton from '../../components/vehicle/CompareButton';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import './Wishlist.css';

function Wishlist() {
    const { wishlist, loading, error, removeFromWishlist } = useWishlist();
    const { isLoggedIn } = useAuth();

    if (!isLoggedIn) {
        return (
            <main className="wishlist-page">
                <header className="wishlist-header">
                    <h1>My Wishlist</h1>
                    <p>Save vehicles you&apos;re interested in and find them here later.</p>
                </header>

                <div className="wishlist-auth-prompt">
                    <div className="wishlist-auth-icon">🔒</div>
                    <h2>Please Log In</h2>
                    <p>Log in or create an account to view and manage your saved vehicles.</p>
                    <div className="wishlist-auth-actions">
                        <Link to="/login" className="wishlist-primary-btn">
                            Log In
                        </Link>
                        <Link to="/register" className="wishlist-secondary-btn">
                            Create Account
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (loading) {
        return (
            <main className="wishlist-page">
                <header className="wishlist-header">
                    <h1>My Wishlist</h1>
                    <p>Save vehicles you&apos;re interested in and find them here later.</p>
                </header>
                <div className="wishlist-loader-wrap">
                    <Loader message="Loading your saved vehicles..." />
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="wishlist-page">
                <header className="wishlist-header">
                    <h1>My Wishlist</h1>
                    <p>Save vehicles you&apos;re interested in and find them here later.</p>
                </header>
                <div className="wishlist-error-box" role="alert">
                    <p>{error}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="wishlist-page">
            <header className="wishlist-header">
                <div className="wishlist-header-content">
                    <span className="wishlist-eyebrow">YOUR SAVED COLLECTION</span>
                    <h1>My Wishlist</h1>
                    <p>
                        {wishlist.length > 0
                            ? `You have ${wishlist.length} saved ${wishlist.length === 1 ? 'vehicle' : 'vehicles'} ready for your next booking.`
                            : "Save vehicles you're interested in and find them here later."}
                    </p>
                </div>
            </header>

            {wishlist.length === 0 ? (
                <section className="wishlist-empty-state" aria-labelledby="empty-wishlist-heading">
                    <div className="wishlist-empty-icon" aria-hidden="true">
                        ♡
                    </div>
                    <h2 id="empty-wishlist-heading">Your wishlist is empty.</h2>
                    <p>Save vehicles you&apos;re interested in and find them here later.</p>
                    <Link to="/vehicles" className="wishlist-browse-btn">
                        Browse Vehicles
                    </Link>
                </section>
            ) : (
                <section className="wishlist-grid" aria-label="Saved vehicles">
                    {wishlist.map((vehicle) => {
                        const vehicleId = vehicle.vehicle_id;
                        const imageSource = getVehicleImageUrl(vehicle);
                        const isEv = vehicle.category && vehicle.category.toLowerCase() === 'ev';

                        return (
                            <article key={vehicleId} className="wishlist-card">
                                <div className="wishlist-card-media">
                                    <img
                                        src={imageSource}
                                        alt={`${vehicle.brand || ''} ${vehicle.name}`}
                                        className="wishlist-card-img"
                                        loading="lazy"
                                        onError={handleVehicleImageError}
                                    />
                                    {vehicle.category && (
                                        <span className="wishlist-category-badge">
                                            {vehicle.category}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        className="wishlist-remove-btn"
                                        onClick={() => removeFromWishlist(vehicleId, vehicle.name)}
                                        aria-label={`Remove ${vehicle.name} from wishlist`}
                                        title="Remove from wishlist"
                                        id={`wishlist-remove-${vehicleId}`}
                                    >
                                        &times;
                                    </button>
                                </div>

                                <div className="wishlist-card-body">
                                    <div className="wishlist-card-title-row">
                                        <h3 className="wishlist-vehicle-name">{vehicle.name}</h3>
                                        <span className="wishlist-vehicle-brand">{vehicle.brand}</span>
                                    </div>

                                    <div className="wishlist-specs-row">
                                        <span className="wishlist-spec-item">
                                            👥 {vehicle.seating_capacity} {vehicle.seating_capacity === 1 ? 'Seat' : 'Seats'}
                                        </span>
                                        <span className="wishlist-spec-item">
                                            ⚙️ {vehicle.transmission}
                                        </span>
                                        {isEv && (
                                            <span className="wishlist-spec-item wishlist-spec-ev">
                                                ⚡ Electric
                                            </span>
                                        )}
                                    </div>

                                    <div className="wishlist-card-footer">
                                        <div className="wishlist-price-block">
                                            <span className="wishlist-price-label">Daily Rental Rate</span>
                                            <div className="wishlist-price-val">
                                                ₹{Number(vehicle.price_per_day).toLocaleString('en-IN')}
                                                <span className="wishlist-price-unit">/day</span>
                                            </div>
                                        </div>

                                        <div className="wishlist-actions-cluster">
                                            <Link
                                                to={`/vehicles/${vehicleId}`}
                                                className="wishlist-btn-details"
                                                id={`wishlist-view-${vehicleId}`}
                                            >
                                                View Details
                                            </Link>
                                            <Link
                                                to={`/vehicles/${vehicleId}`}
                                                className="wishlist-btn-book"
                                                id={`wishlist-book-${vehicleId}`}
                                            >
                                                Book Now
                                            </Link>
                                        </div>
                                    </div>

                                    <div className="wishlist-card-extra-actions">
                                        <CompareButton vehicle={vehicle} />
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}
        </main>
    );
}

export default Wishlist;
