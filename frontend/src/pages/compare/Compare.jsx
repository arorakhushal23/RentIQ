import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Settings2, Zap } from 'lucide-react';
import { useCompare } from '../../context/CompareContext';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import './Compare.css';

function Compare() {
    const { comparedVehicles, compareCount, removeFromCompare, clearCompare } = useCompare();

    // Determine the lowest price to highlight value
    const lowestPrice = useMemo(() => {
        if (comparedVehicles.length < 2) return null;
        const prices = comparedVehicles
            .map((v) => Number(v.price_per_day || v.price))
            .filter((p) => !isNaN(p) && p > 0);
        if (prices.length === 0) return null;
        const min = Math.min(...prices);
        // Only highlight if there is a difference among prices
        const allSame = prices.every((p) => p === min);
        return allSame ? null : min;
    }, [comparedVehicles]);

    if (compareCount < 2) {
        return (
            <main className="compare-page">
                <header className="compare-header">
                    <span className="compare-eyebrow">VEHICLE BENCHMARK</span>
                    <h1>Compare Vehicles</h1>
                    <p>Side-by-side comparison of specifications, features, and rental pricing.</p>
                </header>

                <section className="compare-insufficient-state" aria-labelledby="compare-notice-heading">
                    <div className="compare-insufficient-icon" aria-hidden="true">
                        ⇄
                    </div>
                    <h2 id="compare-notice-heading">Select at least 2 vehicles to compare.</h2>
                    <p>
                        {compareCount === 1
                            ? `You currently have 1 vehicle selected (${comparedVehicles[0].name}). Select at least one more vehicle to view side-by-side specifications.`
                            : 'Choose 2 to 3 vehicles from our verified fleet to evaluate their specifications, features, and daily rates.'}
                    </p>

                    {compareCount === 1 && (
                        <div className="compare-single-preview">
                            <div className="single-preview-card">
                                <img
                                    src={getVehicleImageUrl(comparedVehicles[0])}
                                    alt={comparedVehicles[0].name}
                                    className="single-preview-img"
                                    onError={handleVehicleImageError}
                                />
                                <div className="single-preview-info">
                                    <strong>{comparedVehicles[0].name}</strong>
                                    <span>{comparedVehicles[0].brand} · ₹{Number(comparedVehicles[0].price_per_day).toLocaleString('en-IN')}/day</span>
                                </div>
                                <button
                                    type="button"
                                    className="single-preview-remove"
                                    onClick={() => removeFromCompare(comparedVehicles[0].vehicle_id)}
                                    title="Remove from comparison"
                                    aria-label="Remove vehicle"
                                >
                                    &times;
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="compare-insufficient-actions">
                        <Link to="/vehicles" className="compare-browse-cta">
                            Browse Vehicles
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="compare-page">
            <header className="compare-header">
                <div className="compare-header-row">
                    <div>
                        <span className="compare-eyebrow">VEHICLE BENCHMARK</span>
                        <h1>Compare Vehicles</h1>
                        <p>
                            Comparing {compareCount} vehicles side by side.
                            {compareCount < 4 && ' You can add more vehicles (up to 4 total).'}
                        </p>
                    </div>

                    <div className="compare-header-actions">
                        {compareCount < 4 && (
                            <Link to="/vehicles" className="compare-add-more-btn">
                                + Add Vehicle ({compareCount}/4)
                            </Link>
                        )}
                        <button
                            type="button"
                            className="compare-clear-all-header-btn"
                            onClick={clearCompare}
                            id="compare-clear-btn"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </header>

            {/* Accessible Responsive Comparison Table */}
            <section className="compare-table-wrapper" aria-label="Vehicle comparison table">
                <div className="compare-table-scroll">
                    <table className="compare-table">
                        <thead>
                            <tr>
                                <th className="feature-label-cell" scope="col">
                                    <span>Vehicle Details</span>
                                </th>
                                {comparedVehicles.map((vehicle) => {
                                    const vehicleId = vehicle.vehicle_id || vehicle.id;
                                    const imageSource = getVehicleImageUrl(vehicle);

                                    return (
                                        <th key={vehicleId} className="vehicle-column-header" scope="col">
                                            <div className="compare-col-card">
                                                <button
                                                    type="button"
                                                    className="compare-remove-item-btn"
                                                    onClick={() => removeFromCompare(vehicleId)}
                                                    aria-label={`Remove ${vehicle.name} from comparison`}
                                                    title="Remove from comparison"
                                                    id={`compare-remove-btn-${vehicleId}`}
                                                >
                                                    &times;
                                                </button>

                                                <div className="compare-vehicle-media">
                                                    <img
                                                        src={imageSource}
                                                        alt={`${vehicle.brand || ''} ${vehicle.name}`}
                                                        className="compare-vehicle-img"
                                                        onError={handleVehicleImageError}
                                                    />
                                                </div>

                                                <div className="compare-vehicle-headline">
                                                    <h2 className="compare-col-name">{vehicle.name}</h2>
                                                    <span className="compare-col-brand">{vehicle.brand}</span>
                                                </div>
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {/* Category Row */}
                            <tr>
                                <th className="feature-label-cell" scope="row">
                                    <strong>Category</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => (
                                    <td key={vehicle.vehicle_id} className="feature-val-cell">
                                        <span className="compare-badge-pill">
                                            {vehicle.category || 'Standard'}
                                        </span>
                                    </td>
                                ))}
                            </tr>

                            {/* Daily Rate Row */}
                            <tr className="price-row">
                                <th className="feature-label-cell" scope="row">
                                    <strong>Daily Rental Price</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => {
                                    const priceNum = Number(vehicle.price_per_day || vehicle.price);
                                    const isLowest = lowestPrice !== null && priceNum === lowestPrice;

                                    return (
                                        <td key={vehicle.vehicle_id} className="feature-val-cell">
                                            <div className="compare-price-wrap">
                                                <span className="compare-price-figure">
                                                    ₹{priceNum.toLocaleString('en-IN')}
                                                    <small>/day</small>
                                                </span>
                                                {isLowest && (
                                                    <span className="lowest-price-badge">
                                                        ★ Best Rate
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* Seating Capacity Row */}
                            <tr>
                                <th className="feature-label-cell" scope="row">
                                    <strong>Seating Capacity</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => (
                                    <td key={vehicle.vehicle_id} className="feature-val-cell">
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <Users size={14} strokeWidth={2} aria-hidden="true" />
                                            {vehicle.seating_capacity} {vehicle.seating_capacity === 1 ? 'Seat' : 'Seats'}
                                        </span>
                                    </td>
                                ))}
                            </tr>

                            {/* Transmission Row */}
                            <tr>
                                <th className="feature-label-cell" scope="row">
                                    <strong>Transmission</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => (
                                    <td key={vehicle.vehicle_id} className="feature-val-cell">
                                        <span className="capitalize-val" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <Settings2 size={14} strokeWidth={2} aria-hidden="true" />
                                            {vehicle.transmission || 'Automatic'}
                                        </span>
                                    </td>
                                ))}
                            </tr>

                            {/* Fuel / Power Type Row */}
                            <tr>
                                <th className="feature-label-cell" scope="row">
                                    <strong>Powertrain / Fuel</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => {
                                    const isEv = vehicle.category && vehicle.category.toLowerCase() === 'ev';
                                    return (
                                        <td key={vehicle.vehicle_id} className="feature-val-cell">
                                            {isEv ? (
                                                <span className="ev-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                    <Zap size={14} strokeWidth={2} aria-hidden="true" />
                                                    Electric (EV)
                                                </span>
                                            ) : (
                                                <span>Internal Combustion (Standard)</span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* Availability Row */}
                            <tr>
                                <th className="feature-label-cell" scope="row">
                                    <strong>Availability Status</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => {
                                    const isAvail = vehicle.is_available === 1 || vehicle.is_available === true;
                                    return (
                                        <td key={vehicle.vehicle_id} className="feature-val-cell">
                                            <span className={`status-pill ${isAvail ? 'available' : 'unavailable'}`}>
                                                {isAvail ? '● Available' : '○ Currently Reserved'}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>

                            {/* Actions Row */}
                            <tr className="actions-row">
                                <th className="feature-label-cell" scope="row">
                                    <strong>Actions</strong>
                                </th>
                                {comparedVehicles.map((vehicle) => {
                                    const vehicleId = vehicle.vehicle_id || vehicle.id;
                                    return (
                                        <td key={vehicleId} className="feature-val-cell actions-cell">
                                            <div className="compare-cell-actions">
                                                <Link
                                                    to={`/vehicles/${vehicleId}`}
                                                    className="compare-action-btn details-btn"
                                                    id={`compare-view-${vehicleId}`}
                                                >
                                                    View Details
                                                </Link>
                                                <Link
                                                    to={`/vehicles/${vehicleId}`}
                                                    className="compare-action-btn book-btn"
                                                    id={`compare-book-${vehicleId}`}
                                                >
                                                    Book Now
                                                </Link>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}

export default Compare;
