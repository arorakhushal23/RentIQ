import { useCompare } from '../../context/CompareContext';

function CompareButton({ vehicle }) {
    const { isInCompare, toggleCompare } = useCompare();

    if (!vehicle) return null;

    const vehicleId = vehicle.vehicle_id || vehicle.vehicleId || vehicle.id;
    const isSelected = isInCompare(vehicleId);
    const vehicleName = vehicle.name || 'Vehicle';

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCompare(vehicle);
    };

    return (
        <button
            type="button"
            className={`compare-button ${isSelected ? 'active' : ''}`}
            onClick={handleClick}
            aria-pressed={isSelected}
            aria-label={isSelected ? `Remove ${vehicleName} from comparison` : `Add ${vehicleName} to comparison`}
            id={`compare-btn-${vehicleId}`}
        >
            <span className="compare-icon" aria-hidden="true">
                ⇄
            </span>
            <span className="compare-label">
                {isSelected ? 'Compared' : 'Compare'}
            </span>
        </button>
    );
}

export default CompareButton;