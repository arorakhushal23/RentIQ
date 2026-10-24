const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigration() {
    console.log('Starting migration to datetime support for bookings...');

    // 1. Inspect bookings table
    const [cols] = await db.query('DESCRIBE bookings');
    const colNames = cols.map(c => c.Field);
    console.log('Current columns in bookings:', colNames);

    if (colNames.includes('pickup_datetime') && colNames.includes('return_datetime')) {
        console.log('Columns pickup_datetime and return_datetime already exist in bookings table.');
        return;
    }

    const [rowsBefore] = await db.query('SELECT COUNT(*) as count FROM bookings');
    console.log(`Existing bookings before migration: ${rowsBefore[0].count}`);

    // Check existing constraints
    const [chk] = await db.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'bookings'
          AND CONSTRAINT_TYPE = 'CHECK'
    `);
    console.log('Existing check constraints:', chk.map(c => c.CONSTRAINT_NAME));

    // Execute step by step
    console.log('Step 1: Adding pickup_datetime and return_datetime columns...');
    await db.query(`
        ALTER TABLE bookings
            ADD COLUMN pickup_datetime DATETIME NULL AFTER vehicle_id,
            ADD COLUMN return_datetime DATETIME NULL AFTER pickup_datetime
    `);

    console.log('Step 2: Backfilling existing bookings with 10:00:00 interpretation...');
    const [updateResult] = await db.query(`
        UPDATE bookings
        SET
            pickup_datetime = CAST(CONCAT(start_date, ' 10:00:00') AS DATETIME),
            return_datetime = CAST(CONCAT(end_date, ' 10:00:00') AS DATETIME)
        WHERE pickup_datetime IS NULL
    `);
    console.log(`Updated ${updateResult.affectedRows} existing rows.`);

    console.log('Step 3: Enforcing NOT NULL on pickup_datetime and return_datetime...');
    await db.query(`
        ALTER TABLE bookings
            MODIFY COLUMN pickup_datetime DATETIME NOT NULL,
            MODIFY COLUMN return_datetime DATETIME NOT NULL
    `);

    console.log('Step 4: Making start_date and end_date NULLable for backwards compatibility...');
    await db.query(`
        ALTER TABLE bookings
            MODIFY COLUMN start_date DATE NULL,
            MODIFY COLUMN end_date DATE NULL
    `);

    console.log('Step 5: Dropping old check constraint bookings_chk_1...');
    const hasOldChk = chk.some(c => c.CONSTRAINT_NAME === 'bookings_chk_1');
    if (hasOldChk) {
        await db.query('ALTER TABLE bookings DROP CHECK bookings_chk_1');
    }

    console.log('Step 6: Adding new check constraint bookings_chk_datetime...');
    await db.query('ALTER TABLE bookings ADD CONSTRAINT bookings_chk_datetime CHECK (return_datetime > pickup_datetime)');

    console.log('Step 7: Updating index on vehicle_id and datetimes...');
    const [indexes] = await db.query('SHOW INDEX FROM bookings');
    const hasNewIndex = indexes.some(idx => idx.Key_name === 'idx_bookings_vehicle_datetime');
    if (!hasNewIndex) {
        await db.query('CREATE INDEX idx_bookings_vehicle_datetime ON bookings(vehicle_id, pickup_datetime, return_datetime)');
    }
    const hasOldIndex = indexes.some(idx => idx.Key_name === 'idx_bookings_vehicle');
    if (hasOldIndex) {
        await db.query('ALTER TABLE bookings DROP INDEX idx_bookings_vehicle');
    }

    const [rowsAfter] = await db.query('SELECT booking_id, user_id, vehicle_id, pickup_datetime, return_datetime, start_date, end_date, total_price, status FROM bookings LIMIT 5');
    console.log('Migration completed successfully! Sample rows after migration:', rowsAfter);

    const [countAfter] = await db.query('SELECT COUNT(*) as count FROM bookings');
    console.log(`Total bookings preserved: ${countAfter[0].count} (must equal ${rowsBefore[0].count})`);
}

runMigration()
    .then(() => {
        console.log('All migration tasks finished.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
