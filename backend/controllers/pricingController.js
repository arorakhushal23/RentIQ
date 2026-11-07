/**
 * Smart Pricing & Additional Charges Controller
 *
 * File: backend/controllers/pricingController.js
 */

const db = require('../config/db');
const {
    calculateAuthoritativePrice,
    calculatePostRentalCharges,
    saveBookingAdditionalCharges
} = require('../utils/pricingEngine');

/**
 * Public/Auth: Calculate dynamic price breakdown preview
 */
const calculatePrice = async (req, res) => {
    try {
        const {
            vehicle_id,
            vehicleId,
            pickup_datetime,
            pickupDatetime,
            return_datetime,
            returnDatetime,
            selected_addons,
            selectedAddons,
            addon_ids,
            delivery_distance_km,
            deliveryDistanceKm
        } = req.body;

        const vId = Number(vehicle_id || vehicleId);
        const pDate = pickup_datetime || pickupDatetime;
        const rDate = return_datetime || returnDatetime;

        if (!vId || isNaN(vId)) {
            return res.status(400).json({ message: 'Valid vehicleId is required' });
        }

        if (!pDate || !rDate) {
            return res.status(400).json({ message: 'Both pickupDatetime and returnDatetime are required' });
        }

        if (new Date(rDate) <= new Date(pDate)) {
            return res.status(400).json({ message: 'returnDatetime must be strictly after pickupDatetime' });
        }

        const rawAddons = selected_addons || selectedAddons || addon_ids || [];
        const addonsList = Array.isArray(rawAddons) ? rawAddons : [rawAddons];

        const dist = Number(delivery_distance_km !== undefined ? delivery_distance_km : deliveryDistanceKm) || 0;

        const breakdown = await calculateAuthoritativePrice({
            vehicleId: vId,
            pickupDatetime: pDate,
            returnDatetime: rDate,
            selectedAddonIds: addonsList,
            deliveryDistanceKm: dist
        });

        return res.status(200).json(breakdown);
    } catch (err) {
        console.error('Error calculating price preview:', err);
        return res.status(400).json({ message: err.message || 'Failed to calculate price preview' });
    }
};

/**
 * Public/Auth: Get all active pricing rules, seasonal calendars, and add-on accessories
 */
const getPricingConfig = async (req, res) => {
    try {
        const [pricingRules] = await db.query(
            'SELECT * FROM pricing_rules ORDER BY priority ASC, id ASC'
        );

        const [seasonalPricing] = await db.query(
            'SELECT * FROM seasonal_pricing ORDER BY start_date ASC'
        );

        const [additionalChargeRules] = await db.query(
            'SELECT * FROM additional_charge_rules ORDER BY charge_type ASC, id ASC'
        );

        // Group additional charges for frontend convenience
        const addOns = additionalChargeRules.filter(r => r.charge_type === 'addon' && r.is_active);
        const feeRules = additionalChargeRules.filter(r => r.charge_type !== 'addon');

        return res.status(200).json({
            pricingRules,
            seasonalPricing,
            additionalChargeRules,
            availableAddons: addOns,
            feeRules
        });
    } catch (err) {
        console.error('Error fetching pricing config:', err);
        return res.status(500).json({ message: 'Failed to fetch pricing configuration' });
    }
};

/**
 * Admin: Create a new pricing rule
 */
const createPricingRule = async (req, res) => {
    try {
        const {
            rule_name,
            rule_type,
            days_of_week,
            min_duration_days,
            max_duration_days,
            adjustment_type = 'percentage',
            adjustment_value = 0,
            min_price_cap,
            max_price_cap,
            priority = 10,
            is_active = true
        } = req.body;

        if (!rule_name || !rule_type) {
            return res.status(400).json({ message: 'rule_name and rule_type are required' });
        }

        const [result] = await db.query(
            `INSERT INTO pricing_rules
                (rule_name, rule_type, days_of_week, min_duration_days, max_duration_days,
                 adjustment_type, adjustment_value, min_price_cap, max_price_cap, priority, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                rule_name,
                rule_type,
                days_of_week || null,
                min_duration_days ? Number(min_duration_days) : null,
                max_duration_days ? Number(max_duration_days) : null,
                adjustment_type,
                Number(adjustment_value),
                min_price_cap ? Number(min_price_cap) : null,
                max_price_cap ? Number(max_price_cap) : null,
                Number(priority),
                is_active ? 1 : 0
            ]
        );

        return res.status(201).json({
            message: 'Pricing rule created successfully',
            ruleId: result.insertId
        });
    } catch (err) {
        console.error('Error creating pricing rule:', err);
        return res.status(500).json({ message: 'Failed to create pricing rule' });
    }
};

/**
 * Admin: Update a pricing rule
 */
const updatePricingRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const {
            rule_name,
            rule_type,
            days_of_week,
            min_duration_days,
            max_duration_days,
            adjustment_type,
            adjustment_value,
            min_price_cap,
            max_price_cap,
            priority,
            is_active
        } = req.body;

        await db.query(
            `UPDATE pricing_rules
             SET rule_name = COALESCE(?, rule_name),
                 rule_type = COALESCE(?, rule_type),
                 days_of_week = ?,
                 min_duration_days = ?,
                 max_duration_days = ?,
                 adjustment_type = COALESCE(?, adjustment_type),
                 adjustment_value = COALESCE(?, adjustment_value),
                 min_price_cap = ?,
                 max_price_cap = ?,
                 priority = COALESCE(?, priority),
                 is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [
                rule_name,
                rule_type,
                days_of_week !== undefined ? days_of_week : null,
                min_duration_days !== undefined ? (min_duration_days ? Number(min_duration_days) : null) : null,
                max_duration_days !== undefined ? (max_duration_days ? Number(max_duration_days) : null) : null,
                adjustment_type,
                adjustment_value !== undefined ? Number(adjustment_value) : null,
                min_price_cap !== undefined ? (min_price_cap ? Number(min_price_cap) : null) : null,
                max_price_cap !== undefined ? (max_price_cap ? Number(max_price_cap) : null) : null,
                priority !== undefined ? Number(priority) : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                id
            ]
        );

        return res.status(200).json({ message: 'Pricing rule updated successfully' });
    } catch (err) {
        console.error('Error updating pricing rule:', err);
        return res.status(500).json({ message: 'Failed to update pricing rule' });
    }
};

/**
 * Admin: Toggle pricing rule status (active/inactive)
 */
const togglePricingRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query('UPDATE pricing_rules SET is_active = NOT is_active WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Pricing rule status toggled successfully' });
    } catch (err) {
        console.error('Error toggling pricing rule:', err);
        return res.status(500).json({ message: 'Failed to toggle pricing rule' });
    }
};

/**
 * Admin: Delete a pricing rule
 */
const deletePricingRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query('DELETE FROM pricing_rules WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Pricing rule deleted successfully' });
    } catch (err) {
        console.error('Error deleting pricing rule:', err);
        return res.status(500).json({ message: 'Failed to delete pricing rule' });
    }
};

/**
 * Admin: Create seasonal pricing window
 */
const createSeasonalRule = async (req, res) => {
    try {
        const {
            season_name,
            start_date,
            end_date,
            adjustment_type = 'percentage',
            adjustment_value = 0,
            is_active = true
        } = req.body;

        if (!season_name || !start_date || !end_date) {
            return res.status(400).json({ message: 'season_name, start_date and end_date are required' });
        }

        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).json({ message: 'end_date cannot be earlier than start_date' });
        }

        const [result] = await db.query(
            `INSERT INTO seasonal_pricing
                (season_name, start_date, end_date, adjustment_type, adjustment_value, is_active)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [season_name, start_date, end_date, adjustment_type, Number(adjustment_value), is_active ? 1 : 0]
        );

        return res.status(201).json({
            message: 'Seasonal pricing window created successfully',
            seasonId: result.insertId
        });
    } catch (err) {
        console.error('Error creating seasonal pricing rule:', err);
        return res.status(500).json({ message: 'Failed to create seasonal pricing rule' });
    }
};

/**
 * Admin: Update seasonal pricing window
 */
const updateSeasonalRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { season_name, start_date, end_date, adjustment_type, adjustment_value, is_active } = req.body;

        await db.query(
            `UPDATE seasonal_pricing
             SET season_name = COALESCE(?, season_name),
                 start_date = COALESCE(?, start_date),
                 end_date = COALESCE(?, end_date),
                 adjustment_type = COALESCE(?, adjustment_type),
                 adjustment_value = COALESCE(?, adjustment_value),
                 is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [
                season_name,
                start_date,
                end_date,
                adjustment_type,
                adjustment_value !== undefined ? Number(adjustment_value) : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                id
            ]
        );

        return res.status(200).json({ message: 'Seasonal pricing rule updated successfully' });
    } catch (err) {
        console.error('Error updating seasonal rule:', err);
        return res.status(500).json({ message: 'Failed to update seasonal rule' });
    }
};

/**
 * Admin: Toggle seasonal rule
 */
const toggleSeasonalRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query('UPDATE seasonal_pricing SET is_active = NOT is_active WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Seasonal pricing status toggled' });
    } catch (err) {
        console.error('Error toggling seasonal rule:', err);
        return res.status(500).json({ message: 'Failed to toggle seasonal rule' });
    }
};

/**
 * Admin: Delete seasonal rule
 */
const deleteSeasonalRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query('DELETE FROM seasonal_pricing WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Seasonal pricing rule deleted' });
    } catch (err) {
        console.error('Error deleting seasonal rule:', err);
        return res.status(500).json({ message: 'Failed to delete seasonal rule' });
    }
};

/**
 * Admin: Create or update additional charge rules (Late fees, Excess Km, Fuel, Cleaning, Add-ons)
 */
const createAdditionalChargeRule = async (req, res) => {
    try {
        const {
            charge_type,
            charge_name,
            rate = 0,
            unit = 'fixed',
            grace_period_mins = 0,
            included_units_per_day = 0,
            is_active = true
        } = req.body;

        if (!charge_type || !charge_name) {
            return res.status(400).json({ message: 'charge_type and charge_name are required' });
        }

        const [result] = await db.query(
            `INSERT INTO additional_charge_rules
                (charge_type, charge_name, rate, unit, grace_period_mins, included_units_per_day, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                charge_type,
                charge_name,
                Number(rate),
                unit,
                Number(grace_period_mins) || 0,
                Number(included_units_per_day) || 0,
                is_active ? 1 : 0
            ]
        );

        return res.status(201).json({
            message: 'Additional charge rule created successfully',
            ruleId: result.insertId
        });
    } catch (err) {
        console.error('Error creating additional charge rule:', err);
        return res.status(500).json({ message: 'Failed to create additional charge rule' });
    }
};

const updateAdditionalChargeRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const {
            charge_name,
            rate,
            unit,
            grace_period_mins,
            included_units_per_day,
            is_active
        } = req.body;

        await db.query(
            `UPDATE additional_charge_rules
             SET charge_name = COALESCE(?, charge_name),
                 rate = COALESCE(?, rate),
                 unit = COALESCE(?, unit),
                 grace_period_mins = COALESCE(?, grace_period_mins),
                 included_units_per_day = COALESCE(?, included_units_per_day),
                 is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [
                charge_name,
                rate !== undefined ? Number(rate) : null,
                unit,
                grace_period_mins !== undefined ? Number(grace_period_mins) : null,
                included_units_per_day !== undefined ? Number(included_units_per_day) : null,
                is_active !== undefined ? (is_active ? 1 : 0) : null,
                id
            ]
        );

        return res.status(200).json({ message: 'Additional charge rule updated successfully' });
    } catch (err) {
        console.error('Error updating additional charge rule:', err);
        return res.status(500).json({ message: 'Failed to update additional charge rule' });
    }
};

const deleteAdditionalChargeRule = async (req, res) => {
    try {
        const id = Number(req.params.id);
        await db.query('DELETE FROM additional_charge_rules WHERE id = ?', [id]);
        return res.status(200).json({ message: 'Additional charge rule deleted successfully' });
    } catch (err) {
        console.error('Error deleting additional charge rule:', err);
        return res.status(500).json({ message: 'Failed to delete additional charge rule' });
    }
};

/**
 * Public/Auth: Retrieve saved price breakdown snapshot for a booking
 */
const getBookingPriceBreakdown = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);

        const [rows] = await db.query(
            `SELECT bpb.*, b.total_price AS booking_stored_total, b.status AS booking_status
             FROM booking_price_breakdown bpb
             JOIN bookings b ON bpb.booking_id = b.booking_id
             WHERE bpb.booking_id = ?`,
            [bookingId]
        );

        const [additionalRows] = await db.query(
            `SELECT * FROM booking_additional_charges WHERE booking_id = ? ORDER BY id ASC`,
            [bookingId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Price breakdown snapshot not found for this booking' });
        }

        const breakdown = rows[0];
        if (typeof breakdown.breakdown_json === 'string') {
            try {
                breakdown.breakdown_json = JSON.parse(breakdown.breakdown_json);
            } catch (_) {}
        }

        return res.status(200).json({
            breakdown,
            postRentalCharges: additionalRows
        });
    } catch (err) {
        console.error('Error fetching booking price breakdown:', err);
        return res.status(500).json({ message: 'Failed to fetch price breakdown' });
    }
};

/**
 * Admin: Calculate & apply post-rental charges (late return, excess km, fuel, cleaning)
 */
const computeAndApplyPostRentalCharges = async (req, res) => {
    try {
        const bookingId = Number(req.params.bookingId);
        const { cleaningRequired = false } = req.body;

        const result = await calculatePostRentalCharges(bookingId, { cleaningRequired });
        const saveRes = await saveBookingAdditionalCharges(bookingId, result.itemizedCharges);

        return res.status(200).json({
            message: 'Post-rental charges evaluated and applied successfully',
            summary: result,
            persisted: saveRes
        });
    } catch (err) {
        console.error('Error calculating post-rental charges:', err);
        return res.status(400).json({ message: err.message || 'Failed to calculate post-rental charges' });
    }
};

module.exports = {
    calculatePrice,
    getPricingConfig,
    createPricingRule,
    updatePricingRule,
    togglePricingRule,
    deletePricingRule,
    createSeasonalRule,
    updateSeasonalRule,
    toggleSeasonalRule,
    deleteSeasonalRule,
    createAdditionalChargeRule,
    updateAdditionalChargeRule,
    deleteAdditionalChargeRule,
    getBookingPriceBreakdown,
    computeAndApplyPostRentalCharges
};

