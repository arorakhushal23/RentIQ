const db = require('../config/db');

async function runEnhancementMigration() {
    console.log('Starting RentIQ Advanced Vehicle, Document & Licence Management Migration...');

    // 1. Inspect existing columns in vehicles
    const [cols] = await db.query('DESCRIBE vehicles');
    const existingColNames = cols.map(c => c.Field);
    console.log('Existing columns in vehicles:', existingColNames);

    const columnsToAdd = [
        { name: 'model', spec: 'VARCHAR(100) NULL AFTER brand' },
        { name: 'manufacturing_year', spec: 'INT NULL AFTER model' },
        { name: 'vehicle_color', spec: 'VARCHAR(50) NULL AFTER manufacturing_year' },
        { name: 'registration_number', spec: 'VARCHAR(50) NULL AFTER vehicle_color' },
        { name: 'registration_state', spec: 'VARCHAR(100) NULL AFTER registration_number' },
        { name: 'registration_date', spec: 'DATE NULL AFTER registration_state' },
        { name: 'registration_validity', spec: 'DATE NULL AFTER registration_date' },
        { name: 'fuel_type', spec: "ENUM('petrol', 'diesel', 'electric', 'hybrid', 'cng') DEFAULT 'petrol' AFTER registration_validity" },
        { name: 'mileage', spec: 'VARCHAR(50) NULL AFTER fuel_type' },
        { name: 'engine_capacity', spec: 'VARCHAR(100) NULL AFTER mileage' },
        { name: 'description', spec: 'TEXT NULL AFTER engine_capacity' },
        { name: 'engine_number', spec: 'VARCHAR(100) NULL AFTER description' },
        { name: 'chassis_number', spec: 'VARCHAR(100) NULL AFTER engine_number' },
        { name: 'vehicle_identification_number', spec: 'VARCHAR(100) NULL AFTER chassis_number' },
        { name: 'doors', spec: 'INT DEFAULT 4 AFTER vehicle_identification_number' },
        { name: 'boot_space', spec: 'VARCHAR(50) NULL AFTER doors' },
        { name: 'max_passengers', spec: 'INT NULL AFTER boot_space' }
    ];

    for (const col of columnsToAdd) {
        if (!existingColNames.includes(col.name)) {
            console.log(`Adding column vehicles.${col.name}...`);
            await db.query(`ALTER TABLE vehicles ADD COLUMN ${col.name} ${col.spec}`);
        } else {
            console.log(`Column vehicles.${col.name} already exists.`);
        }
    }

    // Index on registration_number
    const [indexes] = await db.query('SHOW INDEX FROM vehicles');
    const hasRegIdx = indexes.some(i => i.Key_name === 'idx_vehicles_registration_number');
    if (!hasRegIdx) {
        try {
            console.log('Creating unique index on registration_number...');
            await db.query('CREATE UNIQUE INDEX idx_vehicles_registration_number ON vehicles(registration_number)');
        } catch (idxErr) {
            console.warn('Could not create unique index on registration_number (may contain duplicates or nulls):', idxErr.message);
        }
    }

    // 2. Create vehicle_documents table
    console.log('Creating vehicle_documents table...');
    await db.query(`
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
        )
    `);

    // 3. Create customer_licenses table
    console.log('Creating customer_licenses table...');
    await db.query(`
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
        )
    `);

    // 4. Create notifications table
    console.log('Creating notifications table...');
    await db.query(`
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
        )
    `);

    // 5. Backfill existing vehicles with rich data if not set
    console.log('Backfilling rich vehicle data...');
    const vehicleSeed = [
        {
            id: 1,
            model: 'VXi',
            year: 2023,
            color: 'Silky Silver',
            regNo: 'DL01AB1001',
            regState: 'Delhi',
            regDate: '2023-04-15',
            regValidity: '2038-04-14',
            fuel: 'petrol',
            mileage: '22.3 km/l',
            engineCap: '1197 cc',
            desc: 'The Maruti Suzuki Swift is a fuel-efficient and nimble hatchback perfect for city commutes and weekend getaways. Features power steering, touchscreen infotainment, and dual front airbags.',
            engineNo: 'K12M1892831',
            chassisNo: 'MA3FCA12S30018291',
            vin: 'MA3FCA12S30018291',
            doors: 4,
            boot: '268 Litres',
            maxPass: 5
        },
        {
            id: 2,
            model: 'Asta (O)',
            year: 2023,
            color: 'Polar White',
            regNo: 'DL01AB1002',
            regState: 'Delhi',
            regDate: '2023-06-20',
            regValidity: '2038-06-19',
            fuel: 'petrol',
            mileage: '20.0 km/l',
            engineCap: '1197 cc',
            desc: 'Hyundai i20 combines premium styling with seamless automatic convenience. Features digital instrument cluster, Bose audio, and sunroof.',
            engineNo: 'G4LA9821734',
            chassisNo: 'MALC1234F90123841',
            vin: 'MALC1234F90123841',
            doors: 4,
            boot: '311 Litres',
            maxPass: 5
        },
        {
            id: 3,
            model: 'ZX CVT',
            year: 2024,
            color: 'Golden Brown Metallic',
            regNo: 'HR26BC2003',
            regState: 'Haryana',
            regDate: '2024-01-10',
            regValidity: '2039-01-09',
            fuel: 'petrol',
            mileage: '18.4 km/l',
            engineCap: '1498 cc i-VTEC',
            desc: 'Honda City is the gold standard of comfort and highway stability. Features spacious legroom, lane watch camera, and plush leatherette seating.',
            engineNo: 'L15Z1928471',
            chassisNo: 'MAKGM1234H8192841',
            vin: 'MAKGM1234H8192841',
            doors: 4,
            boot: '506 Litres',
            maxPass: 5
        },
        {
            id: 4,
            model: 'SX (O) Turbo',
            year: 2024,
            color: 'Abyss Black',
            regNo: 'HR26BC2004',
            regState: 'Haryana',
            regDate: '2024-02-18',
            regValidity: '2039-02-17',
            fuel: 'petrol',
            mileage: '18.6 km/l',
            engineCap: '1482 cc Turbo GDi',
            desc: 'The next-gen Hyundai Verna offers futuristic cockpit displays, ventilated front seats, and exhilarating turbo acceleration.',
            engineNo: 'G4FS2819381',
            chassisNo: 'MALB98127H1928391',
            vin: 'MALB98127H1928391',
            doors: 4,
            boot: '528 Litres',
            maxPass: 5
        },
        {
            id: 5,
            model: 'SX Tech',
            year: 2024,
            color: 'Titan Grey',
            regNo: 'UP16CD3005',
            regState: 'Uttar Pradesh',
            regDate: '2024-03-01',
            regValidity: '2039-02-28',
            fuel: 'diesel',
            mileage: '19.1 km/l',
            engineCap: '1493 cc CRDi',
            desc: 'India’s favorite compact SUV with panoramic sunroof, connected car tech, and commanding road presence.',
            engineNo: 'D4FA8291039',
            chassisNo: 'MALC81928K9182741',
            vin: 'MALC81928K9182741',
            doors: 5,
            boot: '433 Litres',
            maxPass: 5
        },
        {
            id: 6,
            model: 'Z8L 4x4',
            year: 2023,
            color: 'Napoli Black',
            regNo: 'UP16CD3006',
            regState: 'Uttar Pradesh',
            regDate: '2023-08-12',
            regValidity: '2038-08-11',
            fuel: 'diesel',
            mileage: '15.2 km/l',
            engineCap: '2184 cc mHawk',
            desc: 'Rugged 7-seater SUV built for tough roads and adventurous long drives with four-wheel drive capability.',
            engineNo: 'MHWK9182738',
            chassisNo: 'MA1TA2819L1928391',
            vin: 'MA1TA2819L1928391',
            doors: 5,
            boot: '460 Litres',
            maxPass: 7
        },
        {
            id: 7,
            model: 'Signals Edition',
            year: 2023,
            color: 'Desert Sand',
            regNo: 'DL04EF4007',
            regState: 'Delhi',
            regDate: '2023-05-11',
            regValidity: '2038-05-10',
            fuel: 'petrol',
            mileage: '35.0 km/l',
            engineCap: '349 cc J-Series',
            desc: 'Timeless retro cruiser motorcycle engineered for relaxing highway thumps and iconic design.',
            engineNo: 'J349E1928381',
            chassisNo: 'ME3J34912L1928391',
            vin: 'ME3J34912L1928391',
            doors: 0,
            boot: 'None',
            maxPass: 2
        },
        {
            id: 8,
            model: 'Twin Disc Neon',
            year: 2022,
            color: 'Sparkle Black',
            regNo: 'DL04EF4008',
            regState: 'Delhi',
            regDate: '2022-09-05',
            regValidity: '2037-09-04',
            fuel: 'petrol',
            mileage: '45.0 km/l',
            engineCap: '149.5 cc DTS-i',
            desc: 'Sporty commuter bike known for high torque, comfortable riding ergonomics, and exceptional mileage.',
            engineNo: 'DTSI1829102',
            chassisNo: 'MD2A14918K1928381',
            vin: 'MD2A14918K1928381',
            doors: 0,
            boot: 'None',
            maxPass: 2
        },
        {
            id: 9,
            model: '6G Premium',
            year: 2023,
            color: 'Pearl Siren Blue',
            regNo: 'DL07GH5009',
            regState: 'Delhi',
            regDate: '2023-11-20',
            regValidity: '2038-11-19',
            fuel: 'petrol',
            mileage: '50.0 km/l',
            engineCap: '109.5 cc eSP',
            desc: 'Effortless automatic scooter offering telescopic suspension, external fuel lid, and smooth engine start.',
            engineNo: 'JF50E9182918',
            chassisNo: 'ME4JF5018M1928371',
            vin: 'ME4JF5018M1928371',
            doors: 0,
            boot: '18 Litres Underseat',
            maxPass: 2
        },
        {
            id: 10,
            model: 'Empowered Plus LR',
            year: 2024,
            color: 'Pristine White',
            regNo: 'DL01JK6010',
            regState: 'Delhi',
            regDate: '2024-04-10',
            regValidity: '2039-04-09',
            fuel: 'electric',
            mileage: '465 km per full charge',
            engineCap: 'Permanent Magnet Synchronous Motor (143 hp)',
            desc: 'Zero-emission electric SUV with high energy density 40.5 kWh battery, V2V charging, and whisper-quiet ride.',
            engineNo: 'EV405K1928381',
            chassisNo: 'MAT628192N1928391',
            vin: 'MAT628192N1928391',
            doors: 5,
            boot: '350 Litres',
            maxPass: 5
        },
        {
            id: 11,
            model: 'GTX Plus',
            year: 2024,
            color: 'Glacier White Pearl',
            regNo: 'HR26LM7011',
            regState: 'Haryana',
            regDate: '2024-05-15',
            regValidity: '2039-05-14',
            fuel: 'petrol',
            mileage: '17.7 km/l',
            engineCap: '1482 cc Turbo GDi',
            desc: 'Dynamic design SUV with dual 10.25-inch panoramic screens, ADAS Level 2 safety suite, and 360-degree camera.',
            engineNo: 'G4FS9182931',
            chassisNo: 'MZ6SP8192P1928381',
            vin: 'MZ6SP8192P1928381',
            doors: 5,
            boot: '433 Litres',
            maxPass: 5
        }
    ];

    for (const v of vehicleSeed) {
        await db.query(`
            UPDATE vehicles
            SET
                model = COALESCE(model, ?),
                manufacturing_year = COALESCE(manufacturing_year, ?),
                vehicle_color = COALESCE(vehicle_color, ?),
                registration_number = COALESCE(registration_number, ?),
                registration_state = COALESCE(registration_state, ?),
                registration_date = COALESCE(registration_date, ?),
                registration_validity = COALESCE(registration_validity, ?),
                fuel_type = COALESCE(fuel_type, ?),
                mileage = COALESCE(mileage, ?),
                engine_capacity = COALESCE(engine_capacity, ?),
                description = COALESCE(description, ?),
                engine_number = COALESCE(engine_number, ?),
                chassis_number = COALESCE(chassis_number, ?),
                vehicle_identification_number = COALESCE(vehicle_identification_number, ?),
                doors = COALESCE(doors, ?),
                boot_space = COALESCE(boot_space, ?),
                max_passengers = COALESCE(max_passengers, ?)
            WHERE vehicle_id = ?
        `, [
            v.model, v.year, v.color, v.regNo, v.regState, v.regDate, v.regValidity,
            v.fuel, v.mileage, v.engineCap, v.desc, v.engineNo, v.chassisNo, v.vin,
            v.doors, v.boot, v.maxPass, v.id
        ]);
    }

    // 6. Seed vehicle documents for test / demo vehicles
    const [existingDocs] = await db.query('SELECT COUNT(*) as count FROM vehicle_documents');
    if (existingDocs[0].count === 0) {
        console.log('Seeding initial vehicle documents for Vehicle 1 (Swift - All Valid)...');
        // Vehicle 1 has valid RC, valid Insurance, valid PUC
        await db.query(`
            INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks)
            VALUES
                (1, 'rc', 'RC-DL01AB1001-2023', '2023-04-15', '2038-04-14', 'sample_rc_swift.pdf', 'valid', 'Original registration certificate verified by RTO Delhi.'),
                (1, 'insurance', 'INS-HDFC-9918274', '2026-04-15', '2027-04-14', 'sample_insurance_swift.pdf', 'valid', 'Comprehensive zero-depreciation policy active.'),
                (1, 'puc', 'PUC-DL-88291039', '2026-08-01', '2027-02-01', 'sample_puc_swift.pdf', 'valid', 'Emission test within BS6 compliance limits.')
        `);

        console.log('Seeding vehicle documents for Vehicle 2 (i20 - PUC expiring soon)...');
        // Expiry within 20 days
        const futureDate20 = new Date();
        futureDate20.setDate(futureDate20.getDate() + 20);
        const expSoonStr = futureDate20.toISOString().split('T')[0];

        await db.query(`
            INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks)
            VALUES
                (2, 'rc', 'RC-DL01AB1002-2023', '2023-06-20', '2038-06-19', 'sample_rc_i20.pdf', 'valid', 'Registration certificate verified.'),
                (2, 'insurance', 'INS-ICICI-8192837', '2026-06-20', '2027-06-19', 'sample_insurance_i20.pdf', 'valid', 'Active motor insurance.'),
                (2, 'puc', 'PUC-DL-77291028', '2026-05-10', ?, 'sample_puc_i20.pdf', 'expiring_soon', 'PUC renewal due within 30 days.')
        `, [expSoonStr]);

        console.log('Seeding vehicle documents for Vehicle 4 (Verna - Expired Insurance for testing compliance)...');
        // Expired 15 days ago
        const pastDate15 = new Date();
        pastDate15.setDate(pastDate15.getDate() - 15);
        const expiredStr = pastDate15.toISOString().split('T')[0];

        await db.query(`
            INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status, admin_remarks)
            VALUES
                (4, 'rc', 'RC-HR26BC2004-2024', '2024-02-18', '2039-02-17', 'sample_rc_verna.pdf', 'valid', 'Registration verified.'),
                (4, 'insurance', 'INS-TATA-7182931', '2025-02-18', ?, 'sample_insurance_verna.pdf', 'expired', 'Policy expired! Renewal required before accepting bookings.'),
                (4, 'puc', 'PUC-HR-66182910', '2026-06-01', '2026-12-01', 'sample_puc_verna.pdf', 'valid', 'Valid BS6 emission certificate.')
        `, [expiredStr]);
    }

    // 7. Seed customer licence records for test users
    const [existingLic] = await db.query('SELECT COUNT(*) as count FROM customer_licenses');
    if (existingLic[0].count === 0) {
        console.log('Seeding customer licence records...');
        // User 1 (testuser@rentiq.com) -> verified LMV licence
        await db.query(`
            INSERT INTO customer_licenses (
                user_id, license_number, holder_name, date_of_birth, issue_date, expiry_date,
                vehicle_class, front_document_path, back_document_path, verification_status,
                verified_by, verified_at
            ) VALUES (
                1, 'DL-0420110012345', 'Test User', '1995-08-15', '2015-08-20', '2035-08-19',
                'LMV', 'demo_license_front.png', 'demo_license_back.png', 'verified',
                12, NOW()
            )
        `);

        // User 2 (fulluser@rentiq.com) -> verified LMV licence
        await db.query(`
            INSERT INTO customer_licenses (
                user_id, license_number, holder_name, date_of_birth, issue_date, expiry_date,
                vehicle_class, front_document_path, back_document_path, verification_status,
                verified_by, verified_at
            ) VALUES (
                2, 'DL-1420180098765', 'Full User', '1992-04-10', '2018-04-15', '2038-04-14',
                'LMV', 'demo_license_front2.png', 'demo_license_back2.png', 'verified',
                12, NOW()
            )
        `);

        // User 8 (Khushal, abc1234@gmail.com) -> pending verification
        await db.query(`
            INSERT INTO customer_licenses (
                user_id, license_number, holder_name, date_of_birth, issue_date, expiry_date,
                vehicle_class, front_document_path, back_document_path, verification_status
            ) VALUES (
                8, 'UP-1620200054321', 'Khushal', '1998-12-05', '2020-01-10', '2040-01-09',
                'LMV', 'demo_license_front8.png', 'demo_license_back8.png', 'pending'
            )
        `);
    }

    console.log('Migration finished successfully!');
}

runEnhancementMigration()
    .then(() => {
        console.log('RentIQ Enhancement Migration complete.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Enhancement Migration failed:', err);
        process.exit(1);
    });

