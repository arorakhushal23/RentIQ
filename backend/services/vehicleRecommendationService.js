/**
 * RentIQ Smart Vehicle Recommendation Service
 *
 * File: backend/services/vehicleRecommendationService.js
 *
 * Retrieves real vehicle records from MySQL using parameterized queries,
 * evaluates unified availability and document compliance via vehicleAvailabilityHelper,
 * applies intelligent ranking and scoring based on customer preferences,
 * and handles edge cases with closest-match alternatives.
 */

const db = require('../config/db');
const { batchEvaluateVehicleAvailability, evaluateVehicleAvailability } = require('../utils/vehicleAvailabilityHelper');
const { calculateAuthoritativePrice } = require('../utils/pricingEngine');

/**
 * Public fields returned to client and AI - sensitive admin fields stripped
 */
function sanitizeVehicleForPublic(v) {
    return {
        vehicle_id: v.vehicle_id,
        category_id: v.category_id,
        name: v.name,
        brand: v.brand,
        model: v.model,
        category: v.category,
        seating_capacity: Number(v.seating_capacity),
        transmission: v.transmission,
        price_per_day: Number(v.price_per_day),
        fuel_type: v.fuel_type || 'petrol',
        image_url: v.image_url,
        vehicle_color: v.vehicle_color,
        description: v.description,
        doors: v.doors !== null && v.doors !== undefined ? Number(v.doors) : 4,
        boot_space: v.boot_space,
        mileage: v.mileage,
        is_available: Boolean(v.booking_eligible !== undefined ? v.booking_eligible : v.is_available),
        booking_eligible: Boolean(v.booking_eligible !== undefined ? v.booking_eligible : v.is_available),
        availability_status: v.availability_status || (v.is_available ? 'available' : 'unavailable'),
        availability_code: v.availability_code || null,
        availability_reason: v.availability_reason || null,
        availability_badge: v.availability_badge || {
            text: v.is_available ? 'Available' : 'Unavailable',
            variant: v.is_available ? 'success' : 'danger'
        }
    };
}

/**
 * Normalizes category aliases
 */
function normalizeCategory(cat) {
    if (!cat) return null;
    const lower = String(cat).trim().toLowerCase();
    if (lower.includes('suv')) return 'SUV';
    if (lower.includes('sedan')) return 'Sedan';
    if (lower.includes('hatchback') || lower.includes('hatch')) return 'Hatchback';
    if (lower.includes('sport')) return 'Sports';
    if (lower.includes('luxury')) return 'Luxury';
    if (lower.includes('muv') || lower.includes('mpv')) return 'MUV';
    if (lower.includes('bike') || lower.includes('motorcycle')) return 'Bike';
    if (lower.includes('scooter') || lower.includes('scooty')) return 'Scooter';
    if (lower.includes('electric') || lower === 'ev') return 'EV';
    return cat.trim();
}

/**
 * Searches MySQL for candidate vehicles using parameterized queries.
 * Evaluates live availability, compliance, and scores results based on user preferences.
 *
 * @param {Object} preferences - Customer search criteria
 * @returns {Promise<Object>} Formatted recommendations, alternatives, and scoring
 */
async function searchAndRankVehicles(preferences = {}) {
    const {
        category,
        maxPricePerDay,
        minPricePerDay,
        passengers,
        seats,
        fuelType,
        transmission,
        preferredModel,
        preferredBrand,
        tripType,
        rentalStartDate,
        rentalEndDate,
        limit = 4
    } = preferences;

    const requestedCategory = normalizeCategory(category);
    const requestedMaxPrice = maxPricePerDay ? Number(maxPricePerDay) : null;
    const requestedMinPrice = minPricePerDay ? Number(minPricePerDay) : null;
    const requestedPassengers = passengers || seats ? Number(passengers || seats) : null;
    const requestedFuel = fuelType ? String(fuelType).trim().toLowerCase() : null;
    const requestedTransmission = transmission ? String(transmission).trim().toLowerCase() : null;
    const requestedModel = preferredModel || preferredBrand ? String(preferredModel || preferredBrand).trim().toLowerCase() : null;
    const normalizedTripType = tripType ? String(tripType).trim().toLowerCase() : null;

    // 1. Fetch active vehicle fleet from database with sanitized columns
    // We join with categories to ensure accurate category names
    const query = `
        SELECT
            v.vehicle_id,
            v.category_id,
            v.name,
            v.brand,
            v.model,
            c.name AS category,
            v.seating_capacity,
            v.max_passengers,
            v.transmission,
            v.fuel_type,
            v.price_per_day,
            v.is_available,
            v.image_url,
            v.vehicle_color,
            v.mileage,
            v.engine_capacity,
            v.description,
            v.doors,
            v.boot_space,
            v.manufacturing_year
        FROM vehicles v
        LEFT JOIN categories c ON v.category_id = c.category_id
        ORDER BY v.vehicle_id ASC
    `;

    const [rows] = await db.query(query);

    if (rows.length === 0) {
        return {
            recommendations: [],
            alternatives: [],
            exactMatchesFound: false,
            unmatchedCriteria: [],
            totalEvaluated: 0,
            summary: 'No vehicles found in the fleet.'
        };
    }

    // 2. Evaluate unified live availability, compliance (RC, Insurance, PUC), and maintenance
    const evaluatedVehicles = await batchEvaluateVehicleAvailability(rows, {
        rentalStartDate,
        rentalEndDate
    });

    // 3. Score each vehicle against preferences
    const scoredVehicles = evaluatedVehicles.map(v => {
        let score = 50; // Base baseline score
        const matchReasons = [];
        const missingReasons = [];
        const sanitized = sanitizeVehicleForPublic(v);
        const dailyRate = sanitized.price_per_day;
        const capacity = sanitized.seating_capacity;
        const trans = (sanitized.transmission || '').toLowerCase();
        const fuel = (sanitized.fuel_type || '').toLowerCase();
        const cat = sanitized.category || '';
        const name = `${sanitized.brand} ${sanitized.name} ${sanitized.model}`.toLowerCase();

        // (a) Specific Model / Brand Match (High Priority)
        if (requestedModel) {
            if (name.includes(requestedModel)) {
                score += 35;
                matchReasons.push(`Matches requested model "${preferredModel || preferredBrand}"`);
            } else {
                score -= 10;
            }
        }

        // (b) Category Match
        if (requestedCategory) {
            if (cat.toLowerCase() === requestedCategory.toLowerCase()) {
                score += 30;
                matchReasons.push(`${requestedCategory} category`);
            } else {
                score -= 25;
                missingReasons.push(`Category is ${cat} instead of requested ${requestedCategory}`);
            }
        }

        // (c) Budget Match
        if (requestedMaxPrice && !isNaN(requestedMaxPrice)) {
            if (dailyRate <= requestedMaxPrice) {
                score += 25;
                matchReasons.push(`₹${dailyRate.toLocaleString('en-IN')}/day (within your ₹${requestedMaxPrice.toLocaleString('en-IN')} budget)`);
                // Extra value bonus if close to or under budget
                if (dailyRate <= requestedMaxPrice * 0.9) {
                    score += 5;
                }
            } else {
                const overage = dailyRate - requestedMaxPrice;
                score -= Math.min(40, 15 + Math.floor(overage / 500) * 5);
                missingReasons.push(`₹${dailyRate.toLocaleString('en-IN')}/day exceeds budget of ₹${requestedMaxPrice.toLocaleString('en-IN')}`);
            }
        }

        if (requestedMinPrice && !isNaN(requestedMinPrice)) {
            if (dailyRate < requestedMinPrice) {
                score -= 10;
            }
        }

        // (d) Passenger / Seating Capacity Match
        if (requestedPassengers && !isNaN(requestedPassengers)) {
            if (capacity >= requestedPassengers) {
                score += 20;
                matchReasons.push(`Comfortably seats ${capacity} passengers`);
                if (capacity === requestedPassengers || capacity === requestedPassengers + 1) {
                    score += 5; // Perfect capacity fit
                }
            } else {
                score -= 35;
                missingReasons.push(`Seats ${capacity} people (less than the ${requestedPassengers} requested)`);
            }
        }

        // (e) Transmission Match
        if (requestedTransmission) {
            if (trans === requestedTransmission) {
                score += 15;
                matchReasons.push(`${sanitized.transmission} transmission`);
            } else {
                score -= 15;
                missingReasons.push(`${sanitized.transmission} transmission instead of ${requestedTransmission}`);
            }
        }

        // (f) Fuel Type Match
        if (requestedFuel) {
            if (fuel === requestedFuel) {
                score += 15;
                matchReasons.push(`${sanitized.fuel_type} engine`);
            } else {
                score -= 15;
                missingReasons.push(`${sanitized.fuel_type} instead of ${requestedFuel}`);
            }
        }

        // (g) Trip Type Heuristics
        if (normalizedTripType) {
            if (normalizedTripType.includes('family')) {
                if (capacity >= 5 && (cat === 'SUV' || cat === 'Sedan' || cat === 'MUV')) {
                    score += 15;
                    matchReasons.push('Ideal for family travel with spacious seating & luggage room');
                }
            } else if (normalizedTripType.includes('weekend') || normalizedTripType.includes('sports')) {
                if (cat === 'Sports' || cat === 'SUV' || cat === 'Sedan') {
                    score += 15;
                    matchReasons.push('Great choice for exciting weekend drives');
                }
            } else if (normalizedTripType.includes('economic') || normalizedTripType.includes('budget') || normalizedTripType.includes('city')) {
                if (cat === 'Hatchback' || cat === 'EV' || dailyRate <= 2000) {
                    score += 15;
                    matchReasons.push('Fuel-efficient and budget-friendly for easy city commuting');
                }
            } else if (normalizedTripType.includes('long')) {
                if (trans === 'automatic' || cat === 'SUV' || cat === 'Sedan') {
                    score += 10;
                    matchReasons.push('Comfortable ride suited for extended highway journeys');
                }
            }
        }

        // (h) Live Availability & Compliance Impact
        if (v.booking_eligible) {
            score += 20; // Available for instant booking
            matchReasons.push('Available and verified for instant rental');
        } else {
            // Cannot be booked right now!
            score -= 40;
            if (v.availability_status === 'compliance_required') {
                missingReasons.push('Compliance hold: documents pending update');
            } else if (v.availability_status === 'under_maintenance') {
                missingReasons.push('Currently undergoing scheduled maintenance');
            } else {
                missingReasons.push('Currently unavailable');
            }
        }

        // Calculate a clean normalized match percentage (50% - 99%)
        const matchPercentage = Math.max(35, Math.min(99, Math.round((score / 175) * 100)));

        const isExactMatch = missingReasons.length === 0 && v.booking_eligible;

        let matchExplanation = '';
        if (matchReasons.length > 0) {
            matchExplanation = matchReasons.slice(0, 3).join(' • ');
        } else {
            matchExplanation = 'Matches fleet parameters';
        }

        return {
            ...sanitized,
            score,
            matchPercentage,
            isExactMatch,
            matchReasons,
            missingReasons,
            matchExplanation
        };
    });

    // 4. Sort vehicles by score descending
    scoredVehicles.sort((a, b) => b.score - a.score);

    // 5. Separate exact / strong matches from alternatives
    const exactMatches = scoredVehicles.filter(v => v.isExactMatch);
    let recommendations = [];
    let alternatives = [];
    let exactMatchesFound = false;
    const unmatchedCriteria = [];

    if (exactMatches.length > 0) {
        exactMatchesFound = true;
        recommendations = exactMatches.slice(0, limit);
    } else {
        // Collect what preferences couldn't be satisfied
        if (requestedCategory && !scoredVehicles.some(v => v.category.toLowerCase() === requestedCategory.toLowerCase() && v.booking_eligible)) {
            unmatchedCriteria.push(`No available ${requestedCategory} found`);
        }
        if (requestedMaxPrice && !scoredVehicles.some(v => v.price_per_day <= requestedMaxPrice && v.booking_eligible)) {
            unmatchedCriteria.push(`No vehicle within ₹${requestedMaxPrice.toLocaleString('en-IN')}/day`);
        }
        if (requestedPassengers && !scoredVehicles.some(v => v.seating_capacity >= requestedPassengers && v.booking_eligible)) {
            unmatchedCriteria.push(`No vehicle with ${requestedPassengers}+ seats`);
        }

        // Take top scored available vehicles as alternatives
        alternatives = scoredVehicles
            .filter(v => v.booking_eligible)
            .slice(0, limit);

        // If no available vehicles at all, fall back to any top scored vehicles
        if (alternatives.length === 0) {
            alternatives = scoredVehicles.slice(0, limit);
        }

        recommendations = alternatives;
    }

    return {
        recommendations,
        alternatives,
        exactMatchesFound,
        unmatchedCriteria,
        totalEvaluated: scoredVehicles.length,
        summary: exactMatchesFound
            ? `Found ${recommendations.length} matching vehicles tailored to your preferences.`
            : `We could not find an exact match for all your requirements (${unmatchedCriteria.join(', ')}). Here are the closest recommended alternatives from our fleet:`
    };
}

/**
 * Calculates authoritative pricing estimate using RentIQ's existing pricing engine
 *
 * @param {Object} params - Pricing parameters
 * @returns {Promise<Object>} Authoritative pricing breakdown
 */
async function getPricingEstimate(params = {}) {
    const {
        vehicleId,
        vehicleName,
        days = 1,
        hours = 0,
        pickupDatetime,
        returnDatetime,
        selectedAddons = [],
        deliveryDistanceKm = 0
    } = params;

    let targetVehicleId = vehicleId;

    // If vehicleId not provided, search by vehicle name
    if (!targetVehicleId && vehicleName) {
        const [found] = await db.query(
            `SELECT vehicle_id, name, brand, model FROM vehicles
             WHERE LOWER(name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(model) LIKE ?
             LIMIT 1`,
            [`%${vehicleName.toLowerCase()}%`, `%${vehicleName.toLowerCase()}%`, `%${vehicleName.toLowerCase()}%`]
        );
        if (found.length > 0) {
            targetVehicleId = found[0].vehicle_id;
        }
    }

    if (!targetVehicleId) {
        throw new Error(`Vehicle not found for pricing estimate: "${vehicleName || vehicleId}"`);
    }

    // Default datetimes if not explicitly supplied
    let pDate = pickupDatetime;
    let rDate = returnDatetime;

    if (!pDate || !rDate) {
        // Start tomorrow at 10:00 AM
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
        const durationDays = Number(days) || 1;
        const durationHours = Number(hours) || 0;
        const totalHours = (durationDays * 24) + durationHours;
        const end = new Date(start.getTime() + totalHours * 60 * 60 * 1000);

        pDate = start.toISOString();
        rDate = end.toISOString();
    }

    // Call existing single authoritative pricing engine
    const breakdown = await calculateAuthoritativePrice({
        vehicleId: Number(targetVehicleId),
        pickupDatetime: pDate,
        returnDatetime: rDate,
        selectedAddonIds: selectedAddons,
        deliveryDistanceKm: Number(deliveryDistanceKm) || 0
    });

    return {
        vehicleId: breakdown.vehicleId,
        vehicleName: `${breakdown.vehicleBrand || ''} ${breakdown.vehicleName}`.trim(),
        dailyRate: breakdown.dailyRate,
        pickupDatetime: pDate,
        returnDatetime: rDate,
        rentalDuration: `${breakdown.rentalDays} day(s) (${breakdown.durationHours} hrs)`,
        rentalDays: breakdown.rentalDays,
        durationHours: breakdown.durationHours,
        baseRentalPrice: breakdown.baseRentalPrice,
        weekendAdjustment: breakdown.weekendAdjustment,
        weekendDaysCount: breakdown.weekendDaysCount,
        seasonalAdjustment: breakdown.seasonalAdjustment,
        seasonalDaysCount: breakdown.seasonalDaysCount,
        durationDiscount: breakdown.durationDiscount,
        appliedAddons: breakdown.appliedAddons || [],
        addonsTotal: breakdown.addonsTotal || 0,
        deliveryCharge: breakdown.deliveryCharge || 0,
        finalTotalPrice: breakdown.finalTotal,
        appliedRulesSummary: [
            breakdown.weekendAdjustment > 0 ? `Weekend Surcharge: +₹${breakdown.weekendAdjustment}` : null,
            breakdown.seasonalAdjustment > 0 ? `Seasonal Pricing: +₹${breakdown.seasonalAdjustment}` : null,
            breakdown.durationDiscount > 0 ? `Duration Discount: -₹${breakdown.durationDiscount}` : null,
            breakdown.deliveryCharge > 0 ? `Delivery Fee: +₹${breakdown.deliveryCharge}` : null
        ].filter(Boolean)
    };
}

/**
 * Retrieves a single vehicle with complete public details and evaluated availability
 */
async function getVehicleDetails(vehicleIdOrName) {
    let query = '';
    let params = [];

    if (!isNaN(Number(vehicleIdOrName))) {
        query = `
            SELECT v.*, c.name AS category
            FROM vehicles v
            LEFT JOIN categories c ON v.category_id = c.category_id
            WHERE v.vehicle_id = ?
        `;
        params = [Number(vehicleIdOrName)];
    } else {
        query = `
            SELECT v.*, c.name AS category
            FROM vehicles v
            LEFT JOIN categories c ON v.category_id = c.category_id
            WHERE LOWER(v.name) LIKE ? OR LOWER(v.brand) LIKE ? OR LOWER(v.model) LIKE ?
            LIMIT 1
        `;
        params = [`%${String(vehicleIdOrName).toLowerCase()}%`, `%${String(vehicleIdOrName).toLowerCase()}%`, `%${String(vehicleIdOrName).toLowerCase()}%`];
    }

    const [rows] = await db.query(query, params);
    if (rows.length === 0) return null;

    const evaluated = await evaluateVehicleAvailability(rows[0]);
    return {
        ...sanitizeVehicleForPublic(rows[0]),
        operational_status: evaluated.operationalStatus,
        booking_eligible: evaluated.bookingEligible,
        availability_status: evaluated.availabilityStatus,
        availability_reason: evaluated.displayReason,
        availability_badge: evaluated.badge
    };
}

module.exports = {
    searchAndRankVehicles,
    getPricingEstimate,
    getVehicleDetails,
    sanitizeVehicleForPublic,
    normalizeCategory
};
