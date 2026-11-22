/**
 * RentIQ Document Management Migration Script
 *
 * File: backend/scripts/runDocumentManagementMigration.js
 *
 * Adds:
 * 1. document_verification_logs - Immutable audit log for administrative approvals & rejections
 * 2. vehicle_document_versions - Historical snapshots of renewed/updated vehicle documents
 * 3. customer_license_history - Historical snapshots of renewed/resubmitted customer driving licences
 * 4. version columns on vehicle_documents and customer_licenses
 */

const db = require('../config/db');

async function runDocumentManagementMigration() {
    console.log('================================================================');
    console.log('Starting RentIQ Document Management Module Migration...');
    console.log('================================================================\n');

    try {
        // 1. Add version column to vehicle_documents if not present
        const [vehDocCols] = await db.query('DESCRIBE vehicle_documents');
        const hasVehDocVer = vehDocCols.some(c => c.Field === 'version');
        if (!hasVehDocVer) {
            console.log('Adding "version" column to vehicle_documents...');
            await db.query('ALTER TABLE vehicle_documents ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER verification_status');
            console.log('✓ Added version column to vehicle_documents');
        } else {
            console.log('✓ Column vehicle_documents.version already exists');
        }

        // 2. Add version column to customer_licenses if not present
        const [licCols] = await db.query('DESCRIBE customer_licenses');
        const hasLicVer = licCols.some(c => c.Field === 'version');
        if (!hasLicVer) {
            console.log('Adding "version" column to customer_licenses...');
            await db.query('ALTER TABLE customer_licenses ADD COLUMN version INT NOT NULL DEFAULT 1 AFTER verification_status');
            console.log('✓ Added version column to customer_licenses');
        } else {
            console.log('✓ Column customer_licenses.version already exists');
        }

        // 3. Create document_verification_logs table
        console.log('Creating document_verification_logs table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS document_verification_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                document_type ENUM('vehicle_document', 'customer_license') NOT NULL,
                document_id INT NOT NULL,
                reference_id VARCHAR(100) NULL,
                previous_status VARCHAR(50) NOT NULL,
                new_status VARCHAR(50) NOT NULL,
                admin_id INT NOT NULL,
                remarks TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_doc_verif_doc (document_type, document_id),
                INDEX idx_doc_verif_admin (admin_id),
                INDEX idx_doc_verif_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Created document_verification_logs table');

        // 4. Create vehicle_document_versions table
        console.log('Creating vehicle_document_versions table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS vehicle_document_versions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                document_id INT NOT NULL,
                vehicle_id INT NOT NULL,
                document_type ENUM('rc', 'insurance', 'puc', 'fitness', 'permit', 'road_tax') NOT NULL,
                version_number INT NOT NULL DEFAULT 1,
                document_number VARCHAR(100) NOT NULL,
                issue_date DATE NULL,
                expiry_date DATE NOT NULL,
                file_path VARCHAR(255) NOT NULL,
                verification_status VARCHAR(50) NOT NULL,
                admin_remarks TEXT NULL,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_by INT NULL,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
                FOREIGN KEY (archived_by) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_veh_doc_ver_doc (document_id),
                INDEX idx_veh_doc_ver_veh (vehicle_id),
                INDEX idx_veh_doc_ver_type (document_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Created vehicle_document_versions table');

        // 5. Create customer_license_history table
        console.log('Creating customer_license_history table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS customer_license_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                license_id INT NOT NULL,
                user_id INT NOT NULL,
                version_number INT NOT NULL DEFAULT 1,
                license_number VARCHAR(100) NOT NULL,
                holder_name VARCHAR(150) NOT NULL,
                date_of_birth DATE NULL,
                issue_date DATE NOT NULL,
                expiry_date DATE NOT NULL,
                vehicle_class VARCHAR(50) NOT NULL DEFAULT 'LMV',
                front_document_path VARCHAR(255) NOT NULL,
                back_document_path VARCHAR(255) NULL,
                verification_status VARCHAR(50) NOT NULL,
                rejection_reason TEXT NULL,
                verified_by INT NULL,
                verified_at DATETIME NULL,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
                INDEX idx_lic_hist_user (user_id),
                INDEX idx_lic_hist_lic (license_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✓ Created customer_license_history table');

        console.log('\n================================================================');
        console.log('RentIQ Document Management Migration COMPLETED SUCCESSFULLY!');
        console.log('================================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runDocumentManagementMigration();

