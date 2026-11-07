/**
 * RentIQ Smart Pricing Engine & Post-Rental Charges
 *
 * File: backend/utils/pricingEngine.js
 */

const db = require('../config/db');
const { calculateRentalDuration, calculateRentalPrice } = require('./bookingUtils');
const { calculateDeliveryCharge } = require('./distanceCalculator');

/**
 * Counts days within [startDate, endDate] that match specified days of the week.
 * daysOfWeekStr is e.g. "Friday,Saturday,Sunday"
 */
function countMatchingDaysOfWeek(startDate, endDate, daysOfWeekStr) {
    if (!daysOfWeekStr) return 0;
    const targets = daysOfWeekStr.toLowerCase().split(',').map(s => s.trim());
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    let count = 0;
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (cur <= end) {
        const name = dayNames[cur.getDay()];
        if (targets.includes(name)) {
            count++;
        }
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

/**
 * Counts days within [startDate, endDate] that overlap with a seasonal date range [seasonStart, seasonEnd]
 */
function countOverlappingDays(startDate, endDate, seasonStart, seasonEnd) {
    const s1 = new Date(startDate);
    s1.setHours(0, 0, 0, 0);
    const e1 = new Date(endDate);
    e1.setHours(0, 0, 0, 0);

    const s2 = new Date(seasonStart);
    s2.setHours(0, 0, 0, 0);
    const e2 = new Date(seasonEnd);
    e2.setHours(0, 0, 0, 0);

    const overlapStart = s1 > s2 ? s1 : s2;
    const overlapEnd = e1 < e2 ? e1 : e2;

    if (overlapStart > overlapEnd) {
        return 0;
    }

    const diffMs = overlapEnd.getTime() - overlapStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Calculates authoritative booking price breakdown
 */
async function calculateAuthoritativePrice(params) {
    const {
        vehicleId,
        pickupDatetime,
        returnDatetime,
        selectedAddonIds = [],
        deliveryDistanceKm = 0,
        conn = null
    } = params;

    const runner = conn || db;
    const vId = Number(vehicleId);

    // 1. Fetch vehicle
    const [vehicles] = await runner.query(
        `SELECT vehicle_id, name, brand, price_per_day, is_available
         FROM vehicles
         WHERE vehicle_id = ?`,
        [vId]
    );

    if (vehicles.length === 0) {
        throw new Error(`Vehicle #${vId} not found`);
    }

    const vehicle = vehicles[0];
    const dailyRate = Number(vehicle.price_per_day);

    // 2. Duration & Base Rental Price
    const pickupDate = new Date(pickupDatetime);
    const returnDate = new Date(returnDatetime);
    const durationInfo = calculateRentalDuration(pickupDate, returnDate);

    // Billable days (standard 24hr blocks rounded up, minimum 1)
    const rentalDays = Math.max(1, Math.ceil(durationInfo.durationHours / 24));
    const baseRentalPrice = calculateRentalPrice(dailyRate, durationInfo.durationHours);

    // 3. Weekend Surcharge
    let weekendAdjustment = 0.00;
    let weekendDaysCount = 0;
    let weekendRuleApplied = null;

    const [weekendRules] = await runner.query(
        `SELECT * FROM pricing_rules
         WHERE rule_type = 'weekend' AND is_active = TRUE
         ORDER BY priority ASC LIMIT 1`
    );

    if (weekendRules.length > 0) {
        const wRule = weekendRules[0];
        weekendDaysCount = countMatchingDaysOfWeek(pickupDate, returnDate, wRule.days_of_week || 'Friday,Saturday,Sunday');
        // Cap weekend days to total rental days
        weekendDaysCount = Math.min(weekendDaysCount, rentalDays);

        if (weekendDaysCount > 0) {
            weekendRuleApplied = wRule;
            if (wRule.adjustment_type === 'percentage') {
                const perDaySurcharge = dailyRate * (Number(wRule.adjustment_value) / 100);
                weekendAdjustment = Number((weekendDaysCount * perDaySurcharge).toFixed(2));
            } else {
                weekendAdjustment = Number((weekendDaysCount * Number(wRule.adjustment_value)).toFixed(2));
            }
        }
    }

    // 4. Seasonal Pricing Calendar Adjustment
    let seasonalAdjustment = 0.00;
    let seasonalDaysCount = 0;
    let matchedSeason = null;

    const [seasons] = await runner.query(
        `SELECT * FROM seasonal_pricing
         WHERE is_active = TRUE
           AND start_date <= ?
           AND end_date >= ?
         ORDER BY id ASC LIMIT 1`,
        [returnDate.toISOString().split('T')[0], pickupDate.toISOString().split('T')[0]]
    );

    if (seasons.length > 0) {
        const season = seasons[0];
        seasonalDaysCount = countOverlappingDays(pickupDate, returnDate, season.start_date, season.end_date);
        seasonalDaysCount = Math.min(seasonalDaysCount, rentalDays);

        if (seasonalDaysCount > 0) {
            matchedSeason = season;
            if (season.adjustment_type === 'percentage') {
                const perDayAdj = dailyRate * (Number(season.adjustment_value) / 100);
                seasonalAdjustment = Number((seasonalDaysCount * perDayAdj).toFixed(2));
            } else {
                seasonalAdjustment = Number((seasonalDaysCount * Number(season.adjustment_value)).toFixed(2));
            }
        }
    }

    // 5. Duration Discounts (Weekly 7+ days, Monthly 30+ days)
    let durationDiscount = 0.00;
    let durationDiscountRule = null;

    const [discountRules] = await runner.query(
        `SELECT * FROM pricing_rules
         WHERE rule_type = 'duration_discount'
           AND is_active = TRUE
           AND (min_duration_days IS NULL OR ? >= min_duration_days)
           AND (max_duration_days IS NULL OR ? <= max_duration_days)
         ORDER BY priority DESC, adjustment_value ASC
         LIMIT 1`,
        [rentalDays, rentalDays]
    );

    if (discountRules.length > 0) {
        const dRule = discountRules[0];
        durationDiscountRule = dRule;
        const discountPct = Math.abs(Number(dRule.adjustment_value));

        if (dRule.adjustment_type === 'percentage') {
            durationDiscount = Number((baseRentalPrice * (discountPct / 100)).toFixed(2));
        } else {
            durationDiscount = Number(discountPct.toFixed(2));
        }
    }

    // 6. Subtotal before caps and add-ons
    let adjustedRentalSubtotal = baseRentalPrice + weekendAdjustment + seasonalAdjustment - durationDiscount;

    // Check Min/Max Cap Rules
    const [capRules] = await runner.query(
        `SELECT min_price_cap, max_price_cap FROM pricing_rules
         WHERE is_active = TRUE AND (min_price_cap IS NOT NULL OR max_price_cap IS NOT NULL)
         LIMIT 1`
    );

    let isCapped = false;
    let capNote = null;
    if (capRules.length > 0) {
        const cap = capRules[0];
        if (cap.min_price_cap !== null) {
            const minAllowed = Number(cap.min_price_cap) * rentalDays;
            if (adjustedRentalSubtotal < minAllowed) {
                adjustedRentalSubtotal = minAllowed;
                isCapped = true;
                capNote = `Adjusted to minimum price cap of ₹${minAllowed}`;
            }
        }
        if (cap.max_price_cap !== null) {
            const maxAllowed = Number(cap.max_price_cap) * rentalDays;
            if (adjustedRentalSubtotal > maxAllowed) {
                adjustedRentalSubtotal = maxAllowed;
                isCapped = true;
                capNote = `Adjusted to maximum price cap of ₹${maxAllowed}`;
            }
        }
    }

    adjustedRentalSubtotal = Math.max(0, Number(adjustedRentalSubtotal.toFixed(2)));

    // 7. Add-on Accessories
    const normalizedAddonIds = Array.isArray(selectedAddonIds)
        ? selectedAddonIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        : [];

    let addonsTotal = 0.00;
    const appliedAddons = [];

    if (normalizedAddonIds.length > 0) {
        const [addonRows] = await runner.query(
            `SELECT id, charge_name, rate, unit
             FROM additional_charge_rules
             WHERE charge_type = 'addon' AND is_active = TRUE AND id IN (?)`,
            [normalizedAddonIds]
        );

        for (const addon of addonRows) {
            const rate = Number(addon.rate);
            const cost = addon.unit === 'per_day' ? rate * rentalDays : rate;
            const totalItemCost = Number(cost.toFixed(2));
            addonsTotal += totalItemCost;

            appliedAddons.push({
                addonId: addon.id,
                name: addon.charge_name,
                rate,
                unit: addon.unit,
                units: addon.unit === 'per_day' ? rentalDays : 1,
                totalCost: totalItemCost
            });
        }
    }
    addonsTotal = Number(addonsTotal.toFixed(2));

    // 8. Delivery Charge
    let deliveryCharge = 0.00;
    const dist = Number(deliveryDistanceKm) || 0;
    if (dist > 0) {
        const deliveryRes = await calculateDeliveryCharge(dist);
        deliveryCharge = Number(deliveryRes.deliveryCharge.toFixed(2));
    }

    // 9. Taxes (18% GST or 0 if tax-exempt)
    // By default in this system, tax is kept 0.00 or computed as line-item
    const taxAmount = 0.00;

    // 10. Final Authoritative Total
    const finalTotal = Number((adjustedRentalSubtotal + deliveryCharge + addonsTotal + taxAmount).toFixed(2));

    const breakdownJson = {
        vehicle: {
            id: vehicle.vehicle_id,
            name: vehicle.name,
            brand: vehicle.brand,
            dailyRate
        },
        duration: {
            hours: durationInfo.durationHours,
            display: durationInfo.durationDisplay,
            rentalDays
        },
        pricing: {
            baseRentalPrice,
            weekendAdjustment,
            weekendDays: weekendDaysCount,
            weekendRule: weekendRuleApplied ? weekendRuleApplied.rule_name : null,
            seasonalAdjustment,
            seasonalDays: seasonalDaysCount,
            seasonName: matchedSeason ? matchedSeason.season_name : null,
            durationDiscount,
            discountRule: durationDiscountRule ? durationDiscountRule.rule_name : null,
            isCapped,
            capNote,
            subtotalAfterDiscounts: adjustedRentalSubtotal,
            deliveryDistanceKm: dist,
            deliveryCharge,
            addons: appliedAddons,
            addonsTotal,
            taxAmount,
            finalTotal
        }
    };

    return {
        vehicleId: vehicle.vehicle_id,
        vehicleName: vehicle.name,
        vehicleBrand: vehicle.brand,
        dailyRate,
        rentalDays,
        durationHours: durationInfo.durationHours,
        durationDisplay: durationInfo.durationDisplay,
        baseRentalPrice,
        weekendAdjustment,
        weekendDaysCount,
        seasonalAdjustment,
        seasonalDaysCount,
        seasonName: matchedSeason ? matchedSeason.season_name : null,
        durationDiscount,
        discountRuleName: durationDiscountRule ? durationDiscountRule.rule_name : null,
        deliveryCharge,
        deliveryDistanceKm: dist,
        appliedAddons,
        addonsTotal,
        taxAmount,
        finalTotal,
        breakdownJson
    };
}

/**
 * Saves immutable pricing breakdown snapshot to `booking_price_breakdown`
 */
async function saveBookingPriceBreakdown(bookingId, breakdown, conn = null) {
    const runner = conn || db;
    const bId = Number(bookingId);

    const [res] = await runner.query(
        `
        INSERT INTO booking_price_breakdown
            (booking_id, base_price, weekend_adjustment, seasonal_adjustment,
             duration_discount, delivery_charge, addons_total, additional_charges_total,
             tax_amount, final_total, breakdown_json)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            base_price = VALUES(base_price),
            weekend_adjustment = VALUES(weekend_adjustment),
            seasonal_adjustment = VALUES(seasonal_adjustment),
            duration_discount = VALUES(duration_discount),
            delivery_charge = VALUES(delivery_charge),
            addons_total = VALUES(addons_total),
            tax_amount = VALUES(tax_amount),
            final_total = VALUES(final_total),
            breakdown_json = VALUES(breakdown_json)
        `,
        [
            bId,
            breakdown.baseRentalPrice,
            breakdown.weekendAdjustment,
            breakdown.seasonalAdjustment,
            breakdown.durationDiscount,
            breakdown.deliveryCharge,
            breakdown.addonsTotal,
            breakdown.taxAmount,
            breakdown.finalTotal,
            JSON.stringify(breakdown.breakdownJson)
        ]
    );

    return res;
}

/**
 * Calculates post-rental additional charges based on inspection comparisons & return timing:
 * 1. Late Return Fee (per hour with grace period)
 * 2. Excess Mileage (actual km driven vs daily included km limit)
 * 3. Fuel Refill Deficit (pickup fuel % vs return fuel %)
 * 4. Cleaning fee (if vehicle returned dirty/soiled)
 */
async function calculatePostRentalCharges(bookingId, customFlags = {}, conn = null) {
    const runner = conn || db;
    const bId = Number(bookingId);

    // 1. Fetch booking details
    const [bookings] = await runner.query(
        `SELECT b.booking_id, b.user_id, b.vehicle_id, b.pickup_datetime, b.return_datetime,
                b.status, v.name AS vehicle_name, v.price_per_day
         FROM bookings b
         JOIN vehicles v ON b.vehicle_id = v.vehicle_id
         WHERE b.booking_id = ?`,
        [bId]
    );

    if (bookings.length === 0) {
        throw new Error(`Booking #${bId} not found`);
    }

    const booking = bookings[0];

    // 2. Fetch Pickup and Return Inspections
    const [inspections] = await runner.query(
        `SELECT id, inspection_type, odometer_reading, fuel_level,
                exterior_condition, interior_condition, created_at
         FROM vehicle_inspections
         WHERE booking_id = ?
         ORDER BY id ASC`,
        [bId]
    );

    const pickupInsp = inspections.find(i => i.inspection_type === 'pickup');
    const returnInsp = inspections.find(i => i.inspection_type === 'return');

    // 3. Fetch Active Additional Charge Rules
    const [rules] = await runner.query(
        `SELECT id, charge_type, charge_name, rate, unit, grace_period_mins, included_units_per_day
         FROM additional_charge_rules
         WHERE is_active = TRUE`
    );

    const ruleMap = {};
    for (const r of rules) {
        ruleMap[r.charge_type] = r;
    }

    const durationInfo = calculateRentalDuration(new Date(booking.pickup_datetime), new Date(booking.return_datetime));
    const rentalDays = Math.max(1, Math.ceil(durationInfo.durationHours / 24));

    const itemizedCharges = [];

    // A. Late Return Charge
    const lateRule = ruleMap['late_return'];
    if (lateRule && returnInsp) {
        const scheduledReturn = new Date(booking.return_datetime);
        const actualReturn = returnInsp.created_at ? new Date(returnInsp.created_at) : new Date();
        const diffMs = actualReturn.getTime() - scheduledReturn.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const graceMins = Number(lateRule.grace_period_mins) || 0;

        if (diffMins > graceMins) {
            const billableHours = Math.ceil((diffMins - graceMins) / 60);
            const rate = Number(lateRule.rate);
            const total = Number((billableHours * rate).toFixed(2));

            itemizedCharges.push({
                chargeType: 'late_return',
                chargeName: lateRule.charge_name,
                units: billableHours,
                unitRate: rate,
                totalCharge: total,
                notes: `Returned ${diffMins} mins late (${graceMins} mins grace period excluded; ${billableHours} billable hours)`
            });
        }
    }

    // B. Excess Kilometres
    const excessKmRule = ruleMap['excess_km'];
    if (excessKmRule && pickupInsp && returnInsp) {
        const startOdo = Number(pickupInsp.odometer_reading);
        const endOdo = Number(returnInsp.odometer_reading);
        const distanceDriven = Math.max(0, endOdo - startOdo);
        const dailyAllowance = Number(excessKmRule.included_units_per_day) || 250;
        const totalAllowed = dailyAllowance * rentalDays;

        if (distanceDriven > totalAllowed) {
            const extraKm = distanceDriven - totalAllowed;
            const rate = Number(excessKmRule.rate);
            const total = Number((extraKm * rate).toFixed(2));

            itemizedCharges.push({
                chargeType: 'excess_km',
                chargeName: excessKmRule.charge_name,
                units: extraKm,
                unitRate: rate,
                totalCharge: total,
                notes: `Driven ${distanceDriven} km exceeding ${totalAllowed} km allowance (${dailyAllowance} km/day * ${rentalDays} days) by ${extraKm} km`
            });
        }
    }

    // C. Fuel Deficit Charge
    const fuelRule = ruleMap['fuel_refill'];
    if (fuelRule && pickupInsp && returnInsp) {
        const pickupFuel = Number(pickupInsp.fuel_level);
        const returnFuel = Number(returnInsp.fuel_level);

        if (returnFuel < pickupFuel) {
            const deficitPct = pickupFuel - returnFuel;
            const rate = Number(fuelRule.rate);
            const total = Number((deficitPct * rate).toFixed(2));

            itemizedCharges.push({
                chargeType: 'fuel_refill',
                chargeName: fuelRule.charge_name,
                units: deficitPct,
                unitRate: rate,
                totalCharge: total,
                notes: `Vehicle returned with ${returnFuel}% fuel vs ${pickupFuel}% at pickup (${deficitPct}% refill deficit)`
            });
        }
    }

    // D. Cleaning Fee
    const cleaningRule = ruleMap['cleaning'];
    const needsCleaning = customFlags.cleaningRequired ||
        (returnInsp && (returnInsp.interior_condition === 'poor' || returnInsp.exterior_condition === 'poor'));

    if (cleaningRule && needsCleaning) {
        const total = Number(cleaningRule.rate);
        itemizedCharges.push({
            chargeType: 'cleaning',
            chargeName: cleaningRule.charge_name,
            units: 1,
            unitRate: total,
            totalCharge: total,
            notes: 'Deep interior/exterior cleaning and sanitization required upon vehicle return'
        });
    }

    const grandAdditionalTotal = itemizedCharges.reduce((acc, c) => acc + c.totalCharge, 0);

    return {
        bookingId: bId,
        rentalDays,
        itemizedCharges,
        grandAdditionalTotal: Number(grandAdditionalTotal.toFixed(2))
    };
}

/**
 * Persists calculated additional charges to `booking_additional_charges` and updates `booking_price_breakdown`
 */
async function saveBookingAdditionalCharges(bookingId, chargesList, conn = null) {
    const runner = conn || db;
    const bId = Number(bookingId);

    // Clear previous unconfirmed post-rental charges for idempotent recalculation
    await runner.query(
        `DELETE FROM booking_additional_charges WHERE booking_id = ?`,
        [bId]
    );

    let totalAdditional = 0.00;

    for (const c of chargesList) {
        await runner.query(
            `INSERT INTO booking_additional_charges
                (booking_id, charge_type, charge_name, units, unit_rate, total_charge, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [bId, c.chargeType, c.chargeName, c.units, c.unitRate, c.totalCharge, c.notes || null]
        );
        totalAdditional += Number(c.totalCharge);
    }

    totalAdditional = Number(totalAdditional.toFixed(2));

    // Update booking_price_breakdown
    await runner.query(
        `UPDATE booking_price_breakdown
         SET additional_charges_total = ?,
             final_total = base_price + weekend_adjustment + seasonal_adjustment - duration_discount + delivery_charge + addons_total + tax_amount + ?
         WHERE booking_id = ?`,
        [totalAdditional, totalAdditional, bId]
    );

    return { savedCount: chargesList.length, totalAdditional };
}

module.exports = {
    countMatchingDaysOfWeek,
    countOverlappingDays,
    calculateAuthoritativePrice,
    saveBookingPriceBreakdown,
    calculatePostRentalCharges,
    saveBookingAdditionalCharges
};

