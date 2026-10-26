import { Link, useLocation } from 'react-router-dom';
import { useCompare } from '../../context/CompareContext';
import { getVehicleImageUrl, handleVehicleImageError } from '../../utils/vehicleImages';
import './FloatingCompareBar.css';

function FloatingCompareBar() {
    const { comparedVehicles, compareCount, removeFromCompare, clearCompare, canCompare } = useCompare();
    const location = useLocation();

    // Do not show bar on the comparison page itself or if no vehicles selected
    if (compareCount === 0 || location.pathname === '/compare') {
        return null;
    }

    return (
        <aside
            className="floating-compare-bar"
            aria-label="Vehicle comparison tray"
            id="floating-compare-tray"
        >
            <div className="compare-bar-container">
                <div className="compare-bar-left">
                    <div className="compare-bar-header">
                        <span className="compare-bar-title">Compare</span>
                        <span className="compare-bar-counter">({compareCount}/3)</span>
                    </div>

                    <div className="compare-bar-items">
                        {comparedVehicles.map((vehicle) => {
                            const vehicleId = vehicle.vehicle_id || vehicle.id;
                            const imageSource = getVehicleImageUrl(vehicle);

                            return (
                                <div key={vehicleId} className="compare-mini-chip">
                                    <div className="compare-chip-thumb-wrap">
                                        <img
                                            src={imageSource}
                                            alt={vehicle.name}
                                            className="compare-chip-thumb"
                                            onError={handleVehicleImageError}
                                        />
                                        <button
                                            type="button"
                                            className="compare-chip-remove"
                                            onClick={() => removeFromCompare(vehicleId)}
                                            aria-label={`Remove ${vehicle.name} from comparison`}
                                            title="Remove"
                                            id={`compare-tray-remove-${vehicleId}`}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                    <span className="compare-chip-name">{vehicle.name}</span>
                                </div>
                            );
                        })}

                        {/* Placeholder slots for up to 3 */}
                        {Array.from({ length: Math.max(0, 3 - compareCount) }).map((_, idx) => (
                            <div key={`empty-slot-${idx}`} className="compare-empty-slot" aria-hidden="true">
                                <span>+</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="compare-bar-right">
                    <button
                        type="button"
                        className="compare-clear-btn"
                        onClick={clearCompare}
                        id="compare-tray-clear-all"
                    >
                        Clear All
                    </button>

                    {canCompare ? (
                        <Link
                            to="/compare"
                            className="compare-now-btn"
                            id="compare-now-link"
                        >
                            Compare Now ({compareCount}) →
                        </Link>
                    ) : (
                        <span
                            className="compare-now-btn disabled"
                            title="Select at least 2 vehicles to view comparison"
                            id="compare-now-disabled"
                        >
                            Select 2 to Compare
                        </span>
                    )}
                </div>
            </div>
        </aside>
    );
}

export default FloatingCompareBar;
