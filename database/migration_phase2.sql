-- ====================================================================
-- RentIQ Phase 2 Database Migration
-- Features:
-- 1. Interactive Pickup & Drop Location with Maps & Delivery Pricing
-- 2. Vehicle Inspection System with Photographs
-- 3. Digital Rental Agreement Generation
-- ====================================================================

-- 1. Extend bookings table for Pickup/Drop Locations and Delivery Pricing
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(500) NULL AFTER end_date,
    ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 7) NULL AFTER pickup_address,
    ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(10, 7) NULL AFTER pickup_latitude,
    ADD COLUMN IF NOT EXISTS drop_address VARCHAR(500) NULL AFTER pickup_longitude,
    ADD COLUMN IF NOT EXISTS drop_latitude DECIMAL(10, 7) NULL AFTER drop_address,
    ADD COLUMN IF NOT EXISTS drop_longitude DECIMAL(10, 7) NULL AFTER drop_latitude,
    ADD COLUMN IF NOT EXISTS route_distance_km DECIMAL(8, 2) DEFAULT 0.00 AFTER drop_longitude,
    ADD COLUMN IF NOT EXISTS estimated_travel_time VARCHAR(100) NULL AFTER route_distance_km,
    ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0.00 AFTER estimated_travel_time;

-- Expand booking status enum to include 'active' (vehicle handover completed)
ALTER TABLE bookings 
    MODIFY COLUMN status ENUM('pending', 'confirmed', 'active', 'cancelled', 'completed') NOT NULL DEFAULT 'pending';

-- 2. Delivery Pricing Rules (Configurable by Administrator)
CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    base_delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 150.00,
    per_km_charge DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
    free_delivery_distance_km DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
    max_delivery_distance_km DECIMAL(6, 2) NOT NULL DEFAULT 150.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default delivery pricing rule if none exists
INSERT INTO delivery_pricing_rules (id, base_delivery_charge, per_km_charge, free_delivery_distance_km, max_delivery_distance_km, is_active)
SELECT 1, 150.00, 15.00, 5.00, 150.00, TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM delivery_pricing_rules WHERE id = 1);

-- 3. Service Hubs (Admin Location Management)
CREATE TABLE IF NOT EXISTS service_hubs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hub_name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default service hubs
INSERT INTO service_hubs (id, hub_name, address, latitude, longitude, city, is_active)
VALUES
    (1, 'RentIQ Central Hub - Sector 17', 'Sector 17 Plaza, Chandigarh', 30.7398, 76.7827, 'Chandigarh', TRUE),
    (2, 'RentIQ Airport Station Hub', 'Shaheed Bhagat Singh International Airport, Mohali', 30.6735, 76.7885, 'Mohali', TRUE),
    (3, 'RentIQ Patiala Hub - Railway Station', 'Station Road, Patiala, Punjab', 30.3244, 76.4018, 'Patiala', TRUE)
ON DUPLICATE KEY UPDATE hub_name = VALUES(hub_name);

-- 4. Vehicle Inspections (Pickup & Return Stages)
CREATE TABLE IF NOT EXISTS vehicle_inspections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    inspection_type ENUM('pickup', 'return') NOT NULL,
    odometer_reading INT NOT NULL,
    fuel_level INT NOT NULL COMMENT 'Percentage 0-100',
    battery_percentage INT NULL COMMENT 'Percentage 0-100 for EVs',
    exterior_condition ENUM('excellent', 'good', 'fair', 'poor', 'damaged') NOT NULL DEFAULT 'good',
    interior_condition ENUM('excellent', 'good', 'fair', 'poor', 'damaged') NOT NULL DEFAULT 'good',
    tyre_condition ENUM('excellent', 'good', 'fair', 'poor', 'worn') NOT NULL DEFAULT 'good',
    headlights_condition ENUM('working', 'damaged', 'not_working') NOT NULL DEFAULT 'working',
    taillights_condition ENUM('working', 'damaged', 'not_working') NOT NULL DEFAULT 'working',
    mirrors_condition ENUM('intact', 'scratched', 'damaged') NOT NULL DEFAULT 'intact',
    windows_condition ENUM('intact', 'scratched', 'cracked') NOT NULL DEFAULT 'intact',
    brakes_condition ENUM('optimal', 'satisfactory', 'needs_attention') NOT NULL DEFAULT 'optimal',
    existing_scratches TEXT NULL,
    existing_dents TEXT NULL,
    damage_description TEXT NULL,
    inspection_notes TEXT NULL,
    customer_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    customer_accepted_at TIMESTAMP NULL,
    inspected_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (inspected_by) REFERENCES users(user_id) ON DELETE RESTRICT,
    UNIQUE KEY unique_booking_inspection_type (booking_id, inspection_type)
);

-- 5. Inspection Photographs
CREATE TABLE IF NOT EXISTS inspection_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inspection_id INT NOT NULL,
    photo_category ENUM('front', 'rear', 'left', 'right', 'interior', 'dashboard', 'damage', 'tyres', 'other') NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    description VARCHAR(255) NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (inspection_id) REFERENCES vehicle_inspections(id) ON DELETE CASCADE
);

-- 6. Digital Rental Agreements
CREATE TABLE IF NOT EXISTS rental_agreements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    user_id INT NOT NULL,
    agreement_number VARCHAR(100) NOT NULL UNIQUE,
    agreement_version INT NOT NULL DEFAULT 1,
    agreement_data JSON NOT NULL,
    pdf_file_path VARCHAR(500) NULL,
    agreement_status ENUM('generated', 'awaiting_acceptance', 'accepted', 'cancelled') NOT NULL DEFAULT 'awaiting_acceptance',
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY unique_booking_agreement (booking_id, agreement_version)
);

CREATE INDEX idx_vehicle_inspections_booking ON vehicle_inspections(booking_id);
CREATE INDEX idx_vehicle_inspections_vehicle ON vehicle_inspections(vehicle_id);
CREATE INDEX idx_inspection_photos_insp ON inspection_photos(inspection_id);
CREATE INDEX idx_rental_agreements_booking ON rental_agreements(booking_id);
CREATE INDEX idx_rental_agreements_user ON rental_agreements(user_id);

