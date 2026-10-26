/**
 * Administrator Role Promotion Script
 *
 * File: backend/scripts/promoteAdmin.js
 * Purpose: Safely promote an existing registered account to the 'admin' role.
 * Supports:
 *   - Interactive mode: prompts for user email.
 *   - CLI flag mode: node scripts/promoteAdmin.js --email "..."
 * Safety:
 *   - Verifies target account exists in the MySQL database.
 *   - Does not overwrite password or create arbitrary roles; strictly promotes to 'admin'.
 *   - Parameterized SQL prevents SQL injection.
 *   - Never outputs database secrets or credentials.
 */

const path = require('path');
const readline = require('readline');

// Ensure environment variables from backend/.env are loaded regardless of execution cwd
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
                parsed[key] = args[i + 1];
                i++;
            } else {
                parsed[key] = true;
            }
        }
    }
    return parsed;
}

function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(typeof answer === 'string' ? answer.trim() : '');
        });
    });
}

async function main() {
    console.log('====================================================');
    console.log('       RentIQ — Administrator Account Promotion     ');
    console.log('====================================================\n');

    const flags = parseArgs();
    let emailInput = flags.email ? String(flags.email).trim() : '';

    if (!emailInput) {
        emailInput = await prompt('Enter user email address to promote to admin: ');
    }

    if (!emailInput) {
        console.error('\n[VALIDATION ERROR] Email address is required.');
        process.exitCode = 1;
        try { await db.end(); } catch (_) {}
        return;
    }

    const normalizedEmail = emailInput.toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        console.error('\n[VALIDATION ERROR] Invalid email format. Expected standard address (e.g. user@domain.com).');
        process.exitCode = 1;
        try { await db.end(); } catch (_) {}
        return;
    }

    try {
        const [users] = await db.query(
            'SELECT user_id, name, email, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            console.error(`\n[ERROR] No account found with email "${normalizedEmail}".`);
            console.error('To provision a new administrator account, run: node scripts/createAdmin.js');
            process.exitCode = 1;
            return;
        }

        const targetUser = users[0];

        if (targetUser.role === 'admin') {
            console.log(`\n[INFO] Account "${normalizedEmail}" (User ID: ${targetUser.user_id}, Name: ${targetUser.name}) already has the "admin" role.`);
            return;
        }

        const [result] = await db.query(
            'UPDATE users SET role = ? WHERE user_id = ? AND role = ?',
            ['admin', targetUser.user_id, 'customer']
        );

        if (result.affectedRows === 0) {
            console.error('\n[ERROR] Role update failed: no matching customer record was updated.');
            process.exitCode = 1;
            return;
        }

        console.log('\n====================================================');
        console.log('       User Successfully Promoted to Admin!         ');
        console.log('====================================================');
        console.log(`User ID : ${targetUser.user_id}`);
        console.log(`Name    : ${targetUser.name}`);
        console.log(`Email   : ${targetUser.email}`);
        console.log(`Old Role: customer`);
        console.log(`New Role: admin`);
        console.log('====================================================');
        console.log('The user can now log in and access all administrative functions.\n');

    } catch (error) {
        console.error('\n[SYSTEM ERROR] An error occurred during admin promotion:');
        console.error(error.message || error);
        process.exitCode = 1;
    } finally {
        try {
            await db.end();
        } catch (_) {}
    }
}

main();
