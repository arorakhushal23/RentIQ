import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';

const CompareContext = createContext();
const STORAGE_KEY = 'rentiq_compare_vehicles';

export function CompareProvider({ children }) {
    const { showToast } = useToast();

    const [comparedVehicles, setComparedVehicles] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return [];
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
        } catch (e) {
            console.error('Failed to parse compare storage:', e);
            return [];
        }
    });

    // Save to localStorage whenever comparedVehicles changes
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(comparedVehicles));
        } catch (e) {
            console.error('Failed to save compare storage:', e);
        }
    }, [comparedVehicles]);

    const compareIds = useMemo(() => {
        return new Set(comparedVehicles.map((v) => Number(v.vehicle_id || v.vehicleId || v.id)));
    }, [comparedVehicles]);

    const isInCompare = useCallback((vehicleId) => {
        if (!vehicleId) return false;
        return compareIds.has(Number(vehicleId));
    }, [compareIds]);

    const addToCompare = useCallback((vehicle) => {
        if (!vehicle) return false;
        const vId = Number(vehicle.vehicle_id || vehicle.vehicleId || vehicle.id);
        const vName = vehicle.name || 'Vehicle';

        if (compareIds.has(vId)) {
            // Already in comparison
            return true;
        }

        if (comparedVehicles.length >= 4) {
            showToast('Comparison limit reached (maximum 4 vehicles)', 'warning');
            return false;
        }

        const normalizedVehicle = {
            vehicle_id: vId,
            name: vehicle.name || '',
            brand: vehicle.brand || '',
            category: vehicle.category || '',
            price_per_day: vehicle.price_per_day || vehicle.price || '0',
            seating_capacity: vehicle.seating_capacity || vehicle.seats || 4,
            transmission: vehicle.transmission || 'automatic',
            is_available: vehicle.is_available !== undefined ? vehicle.is_available : 1,
            image_url: vehicle.image_url || vehicle.imageUrl || ''
        };

        const nextCount = comparedVehicles.length + 1;
        setComparedVehicles((prev) => [...prev, normalizedVehicle]);
        showToast(`${vName} added to comparison (${nextCount}/4)`, 'info');
        return true;
    }, [compareIds, comparedVehicles.length, showToast]);

    const removeFromCompare = useCallback((vehicleId) => {
        const vId = Number(vehicleId);
        if (!vId) return;

        const vehicleToRemove = comparedVehicles.find((v) => Number(v.vehicle_id || v.vehicleId || v.id) === vId);
        const vName = vehicleToRemove?.name || 'Vehicle';

        setComparedVehicles((prev) => prev.filter((v) => Number(v.vehicle_id || v.vehicleId || v.id) !== vId));
        showToast(`${vName} removed from comparison`, 'info');
    }, [comparedVehicles, showToast]);

    const toggleCompare = useCallback((vehicle) => {
        if (!vehicle) return false;
        const vId = Number(vehicle.vehicle_id || vehicle.vehicleId || vehicle.id);
        if (compareIds.has(vId)) {
            removeFromCompare(vId);
            return false;
        } else {
            return addToCompare(vehicle);
        }
    }, [compareIds, removeFromCompare, addToCompare]);

    const clearCompare = useCallback(() => {
        setComparedVehicles([]);
        showToast('Comparison selection cleared', 'info');
    }, [showToast]);

    return (
        <CompareContext.Provider
            value={{
                comparedVehicles,
                compareCount: comparedVehicles.length,
                compareIds,
                isInCompare,
                addToCompare,
                removeFromCompare,
                toggleCompare,
                clearCompare,
                canCompare: comparedVehicles.length >= 2
            }}
        >
            {children}
        </CompareContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCompare() {
    const context = useContext(CompareContext);
    if (!context) {
        throw new Error('useCompare must be used within a CompareProvider');
    }
    return context;
}

export default CompareProvider;
