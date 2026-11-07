-- Migration: RentIQ Advanced Vehicle, Document & Licence Management
USE rentiq;

-- 1. Extend vehicles table
ALTER TABLE vehicles
    ADD COLUMN IF NOT EXISTS model VARCHAR(100) NULL AFTER brand,
    ADD COLUMN IF NOT EXISTS manufacturing_year INT NULL AFTER model,
    ADD COLUMN IF NOT EXISTS vehicle_color VARCHAR(50) NULL AFTER manufacturing_year,
    ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50) NULL AFTER vehicle_color,
    ADD COLUMN IF NOT EXISTS registration_state VARCHAR(100) NULL AFTER registration_number,
    ADD COLUMN IF NOT EXISTS registration_date DATE NULL AFTER registration_state,
    ADD COLUMN IF NOT EXISTS registration_validity DATE NULL AFTER registration_date,
    ADD COLUMN IF NOT EXISTS fuel_type ENUM('petrol', 'diesel', 'electric', 'hybrid', 'cng') DEFAULT 'petrol' AFTER registration_validity,
    ADD COLUMN IF NOT EXISTS mileage VARCHAR(50) NULL AFTER fuel_type,
    ADD COLUMN IF NOT EXISTS engine_capacity VARCHAR(100) NULL AFTER mileage,
    ADD COLUMN IF NOT EXISTS description TEXT NULL AFTER engine_capacity,
    ADD COLUMN IF NOT EXISTS engine_number VARCHAR(100) NULL AFTER description,
    ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(100) NULL AFTER engine_number,
    ADD COLUMN IF NOT EXISTS vehicle_identification_number VARCHAR(100) NULL AFTER chassis_number,
    ADD COLUMN IF NOT EXISTS doors INT DEFAULT 4 AFTER vehicle_identification_number,
    ADD COLUMN IF NOT EXISTS boot_space VARCHAR(50) NULL AFTER doors,
    ADD COLUMN IF NOT EXISTS max_passengers INT NULL AFTER boot_space;

-- Add index on registration_number if not present
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_registration_number ON vehicles(registration_number);

-- 2. Create vehicle_documents table
CREATE TABLE IF NOT EXISTS vehicle_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    document_type ENUM('rc', 'insurance', 'puc', 'fitness', 'permit', 'road_tax') NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    issue_date DATE NULL,
    expiry_date DATE NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    verification_status ENUM('valid', 'expiring_soon', 'expired', 'pending', 'rejected') NOT NULL DEFAULT 'valid',
    admin_remarks TEXT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
    INDEX idx_veh_doc_vehicle (vehicle_id),
    INDEX idx_veh_doc_expiry (expiry_date),
    INDEX idx_veh_doc_type (document_type)
);

-- 3. Create customer_licenses table
CREATE TABLE IF NOT EXISTS customer_licenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    license_number VARCHAR(100) NOT NULL,
    holder_name VARCHAR(150) NOT NULL,
    date_of_birth DATE NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    vehicle_class VARCHAR(50) NOT NULL DEFAULT 'LMV',
    front_document_path VARCHAR(255) NOT NULL,
    back_document_path VARCHAR(255) NULL,
    verification_status ENUM('not_submitted', 'pending', 'verified', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT NULL,
    verified_by INT NULL,
    verified_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_cust_lic_user (user_id),
    INDEX idx_cust_lic_status (verification_status)
);

-- 4. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    related_record_id INT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_notif_user_read (user_id, is_read)
);

