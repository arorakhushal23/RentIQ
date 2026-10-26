import { createSlice, createSelector } from '@reduxjs/toolkit';

const STORAGE_KEY = 'rentiq_compare_vehicles';
const MAX_COMPARE_LIMIT = 3;

function getInitialComparedVehicles() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return [];
    }
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
            return parsed.slice(0, MAX_COMPARE_LIMIT);
        }
    } catch (e) {
        console.error('Failed to parse compare storage from localStorage:', e);
    }
    return [];
}

function persistComparedVehicles(vehicles) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
    } catch (e) {
        console.error('Failed to save compare storage to localStorage:', e);
    }
}

function normalizeVehicle(vehicle) {
    if (!vehicle) return null;
    const vId = Number(vehicle.vehicle_id || vehicle.vehicleId || vehicle.id);
    return {
        vehicle_id: vId,
        id: vId,
        name: vehicle.name || '',
        brand: vehicle.brand || '',
        category: vehicle.category || '',
        price_per_day: vehicle.price_per_day || vehicle.price || '0',
        price: vehicle.price_per_day || vehicle.price || '0',
        seating_capacity: vehicle.seating_capacity || vehicle.seats || 4,
        transmission: vehicle.transmission || 'automatic',
        is_available: vehicle.is_available !== undefined ? vehicle.is_available : 1,
        image_url: vehicle.image_url || vehicle.imageUrl || ''
    };
}

const initialState = {
    comparedVehicles: getInitialComparedVehicles(),
    maxLimit: MAX_COMPARE_LIMIT
};

const compareSlice = createSlice({
    name: 'compare',
    initialState,
    reducers: {
        addToCompare: (state, action) => {
            const vehicle = action.payload;
            if (!vehicle) return;
            const normalized = normalizeVehicle(vehicle);
            if (!normalized || !normalized.vehicle_id) return;

            const exists = state.comparedVehicles.some(
                (v) => Number(v.vehicle_id) === normalized.vehicle_id
            );
            if (exists) return;

            if (state.comparedVehicles.length >= MAX_COMPARE_LIMIT) {
                return;
            }

            state.comparedVehicles.push(normalized);
            persistComparedVehicles(state.comparedVehicles);
        },
        removeFromCompare: (state, action) => {
            const vehicleId = Number(action.payload);
            if (!vehicleId) return;

            state.comparedVehicles = state.comparedVehicles.filter(
                (v) => Number(v.vehicle_id) !== vehicleId
            );
            persistComparedVehicles(state.comparedVehicles);
        },
        toggleCompare: (state, action) => {
            const vehicle = action.payload;
            if (!vehicle) return;
            const normalized = normalizeVehicle(vehicle);
            if (!normalized || !normalized.vehicle_id) return;

            const existingIndex = state.comparedVehicles.findIndex(
                (v) => Number(v.vehicle_id) === normalized.vehicle_id
            );

            if (existingIndex >= 0) {
                state.comparedVehicles.splice(existingIndex, 1);
            } else if (state.comparedVehicles.length < MAX_COMPARE_LIMIT) {
                state.comparedVehicles.push(normalized);
            }
            persistComparedVehicles(state.comparedVehicles);
        },
        clearCompare: (state) => {
            state.comparedVehicles = [];
            persistComparedVehicles([]);
        }
    }
});

export const { addToCompare, removeFromCompare, toggleCompare, clearCompare } = compareSlice.actions;

// Selectors
export const selectComparedVehicles = (state) => state.compare.comparedVehicles;
export const selectCompareCount = (state) => state.compare.comparedVehicles.length;
export const selectCompareMaxLimit = (state) => state.compare.maxLimit;
export const selectCanCompare = (state) => state.compare.comparedVehicles.length >= 2;
export const selectIsCompareLimitReached = (state) => state.compare.comparedVehicles.length >= MAX_COMPARE_LIMIT;

export const selectCompareIds = createSelector(
    [selectComparedVehicles],
    (vehicles) => new Set(vehicles.map((v) => Number(v.vehicle_id)))
);

export const selectIsInCompare = (vehicleId) => createSelector(
    [selectCompareIds],
    (ids) => ids.has(Number(vehicleId))
);

export default compareSlice.reducer;
