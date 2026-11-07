const db = require('../config/db');

async function runPhase2Migration() {
    let connection;
    try {
        console.log('--- Starting RentIQ Phase 2 Database Migration ---');
        connection = await db.getConnection();

        // 1. Extend bookings table
        console.log('1. Extending bookings table for locations and delivery pricing...');
        const [existingCols] = await connection.query('DESCRIBE bookings');
        const colNames = existingCols.map(c => c.Field);

        const colsToAdd = [
            { name: 'pickup_address', def: 'VARCHAR(500) NULL' },
            { name: 'pickup_latitude', def: 'DECIMAL(10, 7) NULL' },
            { name: 'pickup_longitude', def: 'DECIMAL(10, 7) NULL' },
            { name: 'drop_address', def: 'VARCHAR(500) NULL' },
            { name: 'drop_latitude', def: 'DECIMAL(10, 7) NULL' },
            { name: 'drop_longitude', def: 'DECIMAL(10, 7) NULL' },
            { name: 'route_distance_km', def: 'DECIMAL(8, 2) DEFAULT 0.00' },
            { name: 'estimated_travel_time', def: 'VARCHAR(100) NULL' },
            { name: 'delivery_charge', def: 'DECIMAL(10, 2) DEFAULT 0.00' }
        ];

        for (const col of colsToAdd) {
            if (!colNames.includes(col.name)) {
                await connection.query(`ALTER TABLE bookings ADD COLUMN ${col.name} ${col.def}`);
                console.log(`   + Added column bookings.${col.name}`);
            }
        }

        // Update status enum to include active
        await connection.query(`
            ALTER TABLE bookings 
            MODIFY COLUMN status ENUM('pending', 'confirmed', 'active', 'cancelled', 'completed') NOT NULL DEFAULT 'pending'
        `);
        console.log('   ✓ Updated bookings.status enum (added active status)');

        // 2. Create delivery_pricing_rules
        console.log('2. Creating delivery_pricing_rules table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS delivery_pricing_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                base_delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 150.00,
                per_km_charge DECIMAL(10, 2) NOT NULL DEFAULT 15.00,
                free_delivery_distance_km DECIMAL(6, 2) NOT NULL DEFAULT 5.00,
                max_delivery_distance_km DECIMAL(6, 2) NOT NULL DEFAULT 150.00,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Seed default rule
        const [rules] = await connection.query('SELECT id FROM delivery_pricing_rules WHERE id = 1');
        if (rules.length === 0) {
            await connection.query(`
                INSERT INTO delivery_pricing_rules (id, base_delivery_charge, per_km_charge, free_delivery_distance_km, max_delivery_distance_km, is_active)
                VALUES (1, 150.00, 15.00, 5.00, 150.00, TRUE)
            `);
            console.log('   ✓ Seeded default delivery pricing rule');
        }

        // 3. Create service_hubs
        console.log('3. Creating service_hubs table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS service_hubs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                hub_name VARCHAR(150) NOT NULL,
                address VARCHAR(255) NOT NULL,
                latitude DECIMAL(10, 7) NOT NULL,
                longitude DECIMAL(10, 7) NOT NULL,
                city VARCHAR(100) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.query(`
            INSERT INTO service_hubs (id, hub_name, address, latitude, longitude, city, is_active)
            VALUES
                (1, 'RentIQ Central Hub - Sector 17', 'Sector 17 Plaza, Chandigarh', 30.7398000, 76.7827000, 'Chandigarh', TRUE),
                (2, 'RentIQ Airport Station Hub', 'Shaheed Bhagat Singh International Airport, Mohali', 30.6735000, 76.7885000, 'Mohali', TRUE),
                (3, 'RentIQ Patiala Hub - Railway Station', 'Station Road, Patiala, Punjab', 30.3244000, 76.4018000, 'Patiala', TRUE)
            ON DUPLICATE KEY UPDATE hub_name = VALUES(hub_name)
        `);
        console.log('   ✓ Seeded service hubs');

        // 4. Create vehicle_inspections
        console.log('4. Creating vehicle_inspections table...');
        await connection.query(`
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
            )
        `);
        console.log('   ✓ vehicle_inspections created');

        // 5. Create inspection_photos
        console.log('5. Creating inspection_photos table...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS inspection_photos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                inspection_id INT NOT NULL,
                photo_category ENUM('front', 'rear', 'left', 'right', 'interior', 'dashboard', 'damage', 'tyres', 'other') NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                description VARCHAR(255) NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                FOREIGN KEY (inspection_id) REFERENCES vehicle_inspections(id) ON DELETE CASCADE
            )
        `);
        console.log('   ✓ inspection_photos created');

        // 6. Create rental_agreements
        console.log('6. Creating rental_agreements table...');
        await connection.query(`
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
            )
        `);
        console.log('   ✓ rental_agreements created');

        console.log('\n--- Phase 2 Database Migration Finished Successfully! ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}

runPhase2Migration();

