import { createContext, useContext, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useToast } from './ToastContext';
import {
    addToCompare as addToCompareAction,
    removeFromCompare as removeFromCompareAction,
    clearCompare as clearCompareAction,
    selectComparedVehicles,
    selectCompareCount,
    selectCompareIds,
    selectCanCompare,
    selectCompareMaxLimit
} from '../store/slices/compareSlice';

const CompareContext = createContext();

export function CompareProvider({ children }) {
    const dispatch = useDispatch();
    const { showToast } = useToast();

    const comparedVehicles = useSelector(selectComparedVehicles);
    const compareCount = useSelector(selectCompareCount);
    const compareIds = useSelector(selectCompareIds);
    const canCompare = useSelector(selectCanCompare);
    const maxLimit = useSelector(selectCompareMaxLimit) || 3;

    const isInCompare = useCallback((vehicleId) => {
        if (!vehicleId) return false;
        return compareIds.has(Number(vehicleId));
    }, [compareIds]);

    const addToCompare = useCallback((vehicle) => {
        if (!vehicle) return false;
        const vId = Number(vehicle.vehicle_id || vehicle.vehicleId || vehicle.id);
        const vName = vehicle.name || 'Vehicle';

        if (compareIds.has(vId)) {
            return true;
        }

        if (compareCount >= maxLimit) {
            showToast(`Comparison limit reached (maximum ${maxLimit} vehicles)`, 'warning');
            return false;
        }

        dispatch(addToCompareAction(vehicle));
        showToast(`${vName} added to comparison (${compareCount + 1}/${maxLimit})`, 'info');
        return true;
    }, [compareIds, compareCount, maxLimit, dispatch, showToast]);

    const removeFromCompare = useCallback((vehicleId) => {
        const vId = Number(vehicleId);
        if (!vId) return;

        const vehicleToRemove = comparedVehicles.find(
            (v) => Number(v.vehicle_id || v.vehicleId || v.id) === vId
        );
        const vName = vehicleToRemove?.name || 'Vehicle';

        dispatch(removeFromCompareAction(vId));
        showToast(`${vName} removed from comparison`, 'info');
    }, [comparedVehicles, dispatch, showToast]);

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
        dispatch(clearCompareAction());
        showToast('Comparison selection cleared', 'info');
    }, [dispatch, showToast]);

    const value = useMemo(() => ({
        comparedVehicles,
        compareCount,
        compareIds,
        isInCompare,
        addToCompare,
        removeFromCompare,
        toggleCompare,
        clearCompare,
        canCompare,
        maxLimit
    }), [
        comparedVehicles,
        compareCount,
        compareIds,
        isInCompare,
        addToCompare,
        removeFromCompare,
        toggleCompare,
        clearCompare,
        canCompare,
        maxLimit
    ]);

    return (
        <CompareContext.Provider value={value}>
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

