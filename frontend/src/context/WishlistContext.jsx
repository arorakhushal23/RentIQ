import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import axiosInstance from '../api/axiosInstance';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [wishlist, setWishlist] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch wishlist from server
    const fetchWishlist = useCallback(async () => {
        const currentToken = localStorage.getItem('token');
        if (!user || !currentToken) {
            setWishlist([]);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const res = await axiosInstance.get('/wishlist');
            if (res.data && res.data.success && Array.isArray(res.data.data)) {
                setWishlist(res.data.data);
            }
        } catch (err) {
            console.error('Error loading wishlist:', err);
            if (err.response?.status === 401) {
                setWishlist([]);
                return;
            }
            setError(err.response?.data?.message || err.message || 'Failed to load wishlist');
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Load wishlist when user changes
    useEffect(() => {
        let isSubscribed = true;

        const loadWishlist = async () => {
            const currentToken = localStorage.getItem('token');
            if (!user || !currentToken) {
                if (isSubscribed) {
                    setWishlist([]);
                    setError(null);
                }
                return;
            }

            try {
                if (isSubscribed) {
                    setLoading(true);
                    setError(null);
                }
                const res = await axiosInstance.get('/wishlist');
                if (isSubscribed && res.data && res.data.success && Array.isArray(res.data.data)) {
                    setWishlist(res.data.data);
                }
            } catch (err) {
                console.error('Error loading wishlist:', err);
                if (isSubscribed) {
                    if (err.response?.status === 401) {
                        setWishlist([]);
                    } else {
                        setError(err.response?.data?.message || err.message || 'Failed to load wishlist');
                    }
                }
            } finally {
                if (isSubscribed) setLoading(false);
            }
        };

        loadWishlist();

        return () => {
            isSubscribed = false;
        };
    }, [user]);

    // Fast lookup for wishlisted vehicle IDs
    const wishlistIds = useMemo(() => {
        return new Set(wishlist.map((item) => Number(item.vehicle_id)));
    }, [wishlist]);

    const isInWishlist = useCallback((vehicleId) => {
        if (!vehicleId) return false;
        return wishlistIds.has(Number(vehicleId));
    }, [wishlistIds]);

    // Toggle wishlist entry with optimistic update
    const toggleWishlist = useCallback(async (vehicle) => {
        const currentToken = localStorage.getItem('token');
        if (!user || !currentToken) {
            showToast('Please log in to save vehicles to your wishlist', 'warning');
            return false;
        }

        const vId = Number(vehicle.vehicle_id || vehicle.vehicleId || vehicle.id);
        if (!vId) return false;

        const vName = vehicle.name || 'Vehicle';
        const isCurrentlyWishlisted = wishlistIds.has(vId);

        if (isCurrentlyWishlisted) {
            // Optimistically remove
            setWishlist((prev) => prev.filter((item) => Number(item.vehicle_id) !== vId));

            try {
                await axiosInstance.delete(`/wishlist/${vId}`);
                showToast(`${vName} removed from wishlist`, 'info');
                return false;
            } catch (err) {
                console.error('Failed to remove from wishlist:', err);
                showToast(`Failed to remove ${vName} from wishlist`, 'error');
                // Revert optimistic update
                fetchWishlist();
                return true;
            }
        } else {
            // Optimistically add
            const optimisticVehicle = {
                vehicle_id: vId,
                name: vehicle.name || '',
                brand: vehicle.brand || '',
                category: vehicle.category || '',
                price_per_day: vehicle.price_per_day || vehicle.price || '0',
                seating_capacity: vehicle.seating_capacity || vehicle.seats || 4,
                transmission: vehicle.transmission || 'automatic',
                image_url: vehicle.image_url || vehicle.imageUrl || '',
                added_at: new Date().toISOString()
            };

            setWishlist((prev) => [optimisticVehicle, ...prev.filter((i) => Number(i.vehicle_id) !== vId)]);

            try {
                await axiosInstance.post(`/wishlist/${vId}`);
                showToast(`${vName} added to your wishlist`, 'success');
                return true;
            } catch (err) {
                console.error('Failed to add to wishlist:', err);
                showToast(`Failed to add ${vName} to wishlist`, 'error');
                // Revert optimistic update
                setWishlist((prev) => prev.filter((item) => Number(item.vehicle_id) !== vId));
                return false;
            }
        }
    }, [user, wishlistIds, showToast, fetchWishlist]);

    const removeFromWishlist = useCallback(async (vehicleId, vehicleName = 'Vehicle') => {
        const currentToken = localStorage.getItem('token');
        const vId = Number(vehicleId);
        if (!vId || !user || !currentToken) return;

        // Optimistically remove
        setWishlist((prev) => prev.filter((item) => Number(item.vehicle_id) !== vId));

        try {
            await axiosInstance.delete(`/wishlist/${vId}`);
            showToast(`${vehicleName} removed from wishlist`, 'info');
        } catch (err) {
            console.error('Error removing from wishlist:', err);
            showToast(`Failed to remove ${vehicleName} from wishlist`, 'error');
            fetchWishlist();
        }
    }, [user, showToast, fetchWishlist]);

    return (
        <WishlistContext.Provider
            value={{
                wishlist,
                wishlistIds,
                wishlistCount: wishlist.length,
                loading,
                error,
                isInWishlist,
                toggleWishlist,
                removeFromWishlist,
                refreshWishlist: fetchWishlist
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error('useWishlist must be used within a WishlistProvider');
    }
    return context;
}

export default WishlistProvider;
