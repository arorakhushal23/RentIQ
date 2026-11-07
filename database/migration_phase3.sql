-- ====================================================================
-- RentIQ Phase 3 Database Migration
-- Features:
-- 1. Vehicle Maintenance Management System
-- 2. Smart Pricing and Additional Charges System
-- ====================================================================

-- 1. Vehicle Maintenance Records
CREATE TABLE IF NOT EXISTS vehicle_maintenance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    maintenance_category ENUM(
        'regular_service',
        'engine_repair',
        'oil_change',
        'tyre_replacement',
        'brake_servicing',
        'battery_replacement',
        'electrical_repairs',
        'accident_repairs',
        'other'
    ) NOT NULL DEFAULT 'regular_service',
    service_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NULL,
    odometer_reading INT NOT NULL,
    service_center VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    parts_replaced TEXT NULL,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    next_service_date DATE NULL,
    next_service_odometer INT NULL,
    invoice_file_path VARCHAR(500) NULL,
    notes TEXT NULL,
    status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'in_progress',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 2. Maintenance Reminders (Odometer, Due Date & Overdue)
CREATE TABLE IF NOT EXISTS maintenance_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    reminder_type ENUM('date_due', 'odometer_due', 'overdue') NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    due_date DATE NULL,
    due_odometer INT NULL,
    status ENUM('pending', 'completed', 'rescheduled', 'dismissed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE
);

-- 3. Dynamic Pricing Rules
CREATE TABLE IF NOT EXISTS pricing_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_name VARCHAR(150) NOT NULL,
    rule_type ENUM('weekend', 'duration_discount', 'demand', 'custom') NOT NULL,
    days_of_week VARCHAR(50) NULL COMMENT 'Comma separated (e.g. Friday,Saturday,Sunday)',
    min_duration_days INT NULL,
    max_duration_days INT NULL,
    adjustment_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    adjustment_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'e.g. 15 for 15% surcharge or -10 for 10% discount',
    min_price_cap DECIMAL(10, 2) NULL,
    max_price_cap DECIMAL(10, 2) NULL,
    priority INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Seasonal Pricing Calendars
CREATE TABLE IF NOT EXISTS seasonal_pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    season_name VARCHAR(150) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    adjustment_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
    adjustment_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Additional Charge Rules (Late fees, Excess Km, Fuel, Cleaning, Add-ons)
CREATE TABLE IF NOT EXISTS additional_charge_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    charge_type ENUM('late_return', 'excess_km', 'fuel_refill', 'cleaning', 'addon') NOT NULL,
    charge_name VARCHAR(150) NOT NULL,
    rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(50) NOT NULL DEFAULT 'fixed' COMMENT 'per_hour, per_km, per_percent, per_day, fixed',
    grace_period_mins INT NOT NULL DEFAULT 0,
    included_units_per_day DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Booking Price Breakdown Snapshot
CREATE TABLE IF NOT EXISTS booking_price_breakdown (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    base_price DECIMAL(10, 2) NOT NULL,
    weekend_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    seasonal_adjustment DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    duration_discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    addons_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    additional_charges_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    final_total DECIMAL(10, 2) NOT NULL,
    breakdown_json JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- 7. Booking Additional Charges (Itemized post-rental charges)
CREATE TABLE IF NOT EXISTS booking_additional_charges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    charge_type VARCHAR(50) NOT NULL,
    charge_name VARCHAR(150) NOT NULL,
    units DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    unit_rate DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_vehicle_maintenance_veh ON vehicle_maintenance(vehicle_id);
CREATE INDEX idx_vehicle_maintenance_dates ON vehicle_maintenance(start_date, end_date);
CREATE INDEX idx_vehicle_maintenance_status ON vehicle_maintenance(status);
CREATE INDEX idx_maintenance_reminders_veh ON maintenance_reminders(vehicle_id);
CREATE INDEX idx_booking_add_charges_bk ON booking_additional_charges(booking_id);

-- Seed Default Pricing Rules
INSERT INTO pricing_rules (id, rule_name, rule_type, days_of_week, min_duration_days, max_duration_days, adjustment_type, adjustment_value, priority, is_active)
VALUES
    (1, 'Weekend Peak Surcharge', 'weekend', 'Friday,Saturday,Sunday', NULL, NULL, 'percentage', 15.00, 10, TRUE),
    (2, 'Weekly Rental Discount (7+ Days)', 'duration_discount', NULL, 7, 29, 'percentage', -10.00, 20, TRUE),
    (3, 'Monthly Rental Super Saver (30+ Days)', 'duration_discount', NULL, 30, 365, 'percentage', -20.00, 25, TRUE)
ON DUPLICATE KEY UPDATE rule_name = VALUES(rule_name);

-- Seed Default Seasonal Pricing (Holiday Peak)
INSERT INTO seasonal_pricing (id, season_name, start_date, end_date, adjustment_type, adjustment_value, is_active)
VALUES
    (1, 'Winter Holiday & Year-End Peak', '2026-12-15', '2027-01-05', 'percentage', 20.00, TRUE),
    (2, 'Summer Vacation Escapes', '2027-05-15', '2027-06-30', 'percentage', 15.00, TRUE)
ON DUPLICATE KEY UPDATE season_name = VALUES(season_name);

-- Seed Default Additional Charge Rules
INSERT INTO additional_charge_rules (id, charge_type, charge_name, rate, unit, grace_period_mins, included_units_per_day, is_active)
VALUES
    (1, 'late_return', 'Standard Late Return Fee', 400.00, 'per_hour', 45, 0.00, TRUE),
    (2, 'excess_km', 'Excess Mileage Fee', 12.00, 'per_km', 0, 250.00, TRUE),
    (3, 'fuel_refill', 'Fuel Refill Deficit Fee', 15.00, 'per_percent', 0, 0.00, TRUE),
    (4, 'cleaning', 'Deep Cleaning & Sanitization', 750.00, 'fixed', 0, 0.00, TRUE),
    (5, 'addon', 'GPS Navigation Unit', 150.00, 'per_day', 0, 0.00, TRUE),
    (6, 'addon', 'Child Safety Seat', 200.00, 'per_day', 0, 0.00, TRUE),
    (7, 'addon', 'GoPro Action Cam Rental', 350.00, 'per_day', 0, 0.00, TRUE)
ON DUPLICATE KEY UPDATE charge_name = VALUES(charge_name);

