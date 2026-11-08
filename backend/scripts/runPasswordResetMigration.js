/**
 * Database Migration Script: Password Reset Tokens
 *
 * File: backend/scripts/runPasswordResetMigration.js
 * Creates `password_reset_tokens` table with appropriate indexes and foreign keys.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/db');

async function runMigration() {
    console.log('====================================================');
    console.log('RentIQ Migration: Password Reset Tokens Table');
    console.log('====================================================\n');

    try {
        const [tables] = await db.query("SHOW TABLES LIKE 'password_reset_tokens'");
        if (tables.length > 0) {
            console.log('Table `password_reset_tokens` already exists. Verifying columns...');
        } else {
            console.log('Creating table `password_reset_tokens`...');
            await db.query(`
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    token_hash VARCHAR(64) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    used_at DATETIME NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    INDEX idx_reset_token_hash (token_hash),
                    INDEX idx_reset_user_expires (user_id, expires_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✓ Successfully created `password_reset_tokens` table.');
        }

        const [cols] = await db.query('DESCRIBE password_reset_tokens');
        console.log('Columns:');
        console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));

        console.log('\nMigration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();

