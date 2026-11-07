/**
 * Distance, Routing & Delivery Pricing Utilities
 *
 * File: backend/utils/distanceCalculator.js
 */

const db = require('../config/db');

/**
 * Calculates straight-line distance in kilometers using the Haversine formula
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
        return 0;
    }

    const nLat1 = Number(lat1);
    const nLon1 = Number(lon1);
    const nLat2 = Number(lat2);
    const nLon2 = Number(lon2);

    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) {
        return 0;
    }

    // Identical coordinates
    if (Math.abs(nLat1 - nLat2) < 0.00001 && Math.abs(nLon1 - nLon2) < 0.00001) {
        return 0;
    }

    const R = 6371; // Earth's mean radius in km
    const dLat = (nLat2 - nLat1) * (Math.PI / 180);
    const dLon = (nLon2 - nLon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(nLat1 * (Math.PI / 180)) *
        Math.cos(nLat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

/**
 * Formats duration in minutes into a human-readable string
 * e.g., "1 hr 45 mins" or "35 mins"
 */
function formatDurationDisplay(totalMinutes) {
    const mins = Math.max(0, Math.round(totalMinutes));
    if (mins <= 0) return '0 mins';

    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;

    if (hours === 0) {
        return `${remMins} min${remMins === 1 ? '' : 's'}`;
    }
    if (remMins === 0) {
        return `${hours} hr${hours === 1 ? '' : 's'}`;
    }
    return `${hours} hr${hours === 1 ? '' : 's'} ${remMins} min${remMins === 1 ? '' : 's'}`;
}

/**
 * Calculates driving route distance and estimated travel time between two coordinates.
 * Attempts OSRM driving API first, with fallback to Haversine * 1.35 road tortuosity factor.
 */
async function calculateDrivingRoute(pickupLat, pickupLng, dropLat, dropLng) {
    const pLat = Number(pickupLat);
    const pLng = Number(pickupLng);
    const dLat = Number(dropLat);
    const dLng = Number(dropLng);

    if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
        return {
            distanceKm: 0,
            durationMinutes: 0,
            durationDisplay: '0 mins',
            isFallback: true
        };
    }

    // Same location check
    const haversineKm = calculateHaversineDistanceKm(pLat, pLng, dLat, dLng);
    if (haversineKm < 0.05) {
        return {
            distanceKm: 0,
            durationMinutes: 0,
            durationDisplay: '0 mins',
            isFallback: false
        };
    }

    // Check if Google Maps API key is configured
    if (process.env.GOOGLE_MAPS_API_KEY) {
        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pLat},${pLng}&destination=${dLat},${dLng}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data.routes && data.routes[0] && data.routes[0].legs && data.routes[0].legs[0]) {
                    const leg = data.routes[0].legs[0];
                    const distKm = Number((leg.distance.value / 1000).toFixed(1));
                    const durMins = Math.round(leg.duration.value / 60);
                    return {
                        distanceKm: distKm,
                        durationMinutes: durMins,
                        durationDisplay: leg.duration.text || formatDurationDisplay(durMins),
                        isFallback: false
                    };
                }
            }
        } catch (err) {
            // Proceed to OSRM / fallback
        }
    }

    // Try OpenStreetMap OSRM routing
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=false`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const res = await fetch(osrmUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'RentIQ-VehicleRental/1.0' }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes[0]) {
                const route = data.routes[0];
                const distKm = Number((route.distance / 1000).toFixed(1));
                const durMins = Math.round(route.duration / 60);
                return {
                    distanceKm: distKm,
                    durationMinutes: durMins,
                    durationDisplay: formatDurationDisplay(durMins),
                    isFallback: false
                };
            }
        }
    } catch (err) {
        // Fallback to Haversine with road tortuosity
    }

    // Realistic road driving factor: approx 1.35x straight-line distance
    const roadDistanceKm = Number((haversineKm * 1.35).toFixed(1));
    // Average urban driving speed 35-40 km/h
    const estimatedMinutes = Math.max(5, Math.round((roadDistanceKm / 38) * 60));

    return {
        distanceKm: roadDistanceKm,
        durationMinutes: estimatedMinutes,
        durationDisplay: formatDurationDisplay(estimatedMinutes),
        isFallback: true
    };
}

/**
 * Calculates delivery charges authoritatively from distance and active rules
 */
async function calculateDeliveryCharge(distanceKm, overrideRule = null) {
    let rule = overrideRule;

    if (!rule) {
        const [rows] = await db.query(
            `SELECT base_delivery_charge, per_km_charge, free_delivery_distance_km, max_delivery_distance_km
             FROM delivery_pricing_rules
             WHERE is_active = TRUE
             ORDER BY id DESC
             LIMIT 1`
        );

        if (rows.length > 0) {
            rule = rows[0];
        } else {
            // Default fallback rule
            rule = {
                base_delivery_charge: 150.00,
                per_km_charge: 15.00,
                free_delivery_distance_km: 5.00,
                max_delivery_distance_km: 150.00
            };
        }
    }

    const dist = Math.max(0, Number(distanceKm) || 0);
    const freeKm = Number(rule.free_delivery_distance_km) || 0;
    const baseCharge = Number(rule.base_delivery_charge) || 0;
    const perKmRate = Number(rule.per_km_charge) || 0;
    const maxKm = Number(rule.max_delivery_distance_km) || 150;

    // Within free delivery radius
    if (dist <= freeKm) {
        return {
            deliveryCharge: 0,
            isFree: true,
            distanceKm: dist,
            freeDistanceKm: freeKm,
            rule
        };
    }

    const billableDistance = Math.min(dist, maxKm) - freeKm;
    const distanceFee = billableDistance * perKmRate;
    const totalDelivery = Number((baseCharge + distanceFee).toFixed(2));

    return {
        deliveryCharge: totalDelivery,
        isFree: false,
        distanceKm: dist,
        freeDistanceKm: freeKm,
        billableDistance: Number(billableDistance.toFixed(1)),
        rule
    };
}

module.exports = {
    calculateHaversineDistanceKm,
    formatDurationDisplay,
    calculateDrivingRoute,
    calculateDeliveryCharge
};

