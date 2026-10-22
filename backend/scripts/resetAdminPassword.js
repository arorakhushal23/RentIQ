/**
 * Administrator Password Reset Script
 *
 * File: backend/scripts/resetAdminPassword.js
 * Purpose: Interactively update the password hash of an existing administrator account.
 * Safety:
 *   - Verifies the target account exists and strictly holds the 'admin' role.
 *   - Updates ONLY the 'password_hash' column; never modifies email, name, role, or other fields.
 *   - Never outputs or logs plaintext passwords, password hashes, or database secrets.
 *   - Masks password input in terminal using Node.js built-in readline and stream modules.
 *   - Enforces the project's existing password policies (minimum 6 characters).
 */

const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');

// Ensure environment variables from backend/.env are loaded regardless of execution cwd
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Validation regular expression matching authController.js and createAdmin.js
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Creates an interactive prompt interface that supports visible text input
 * and hidden (masked) password input without external dependencies.
 */
function createTerminal() {
    let muted = false;

    const mutableStdout = new Writable({
        write(chunk, encoding, callback) {
            if (!muted) {
                process.stdout.write(chunk, encoding);
            }
            callback();
        }
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
    });

    return {
        ask(promptText) {
            return new Promise((resolve) => {
                muted = false;
                rl.question(promptText, (answer) => {
                    resolve(typeof answer === 'string' ? answer.trim() : '');
                });
            });
        },
        askPassword(promptText) {
            return new Promise((resolve) => {
                process.stdout.write(promptText);
                muted = true;
                rl.question('', (answer) => {
                    muted = false;
                    process.stdout.write('\n');
                    resolve(typeof answer === 'string' ? answer : '');
                });
            });
        },
        close() {
            rl.close();
        }
    };
}

async function main() {
    console.log('====================================================');
    console.log('       RentIQ — Administrator Password Reset        ');
    console.log('====================================================\n');

    const terminal = createTerminal();

    // Handle abrupt cancellation gracefully (e.g. Ctrl+C)
    let isTerminating = false;
    const handleSigint = async () => {
        if (isTerminating) return;
        isTerminating = true;
        console.log('\n[INFO] Operation cancelled by operator. Exiting...');
        terminal.close();
        try {
            await db.end();
        } catch (_) {}
        process.exit(130);
    };
    process.once('SIGINT', handleSigint);

    try {
        // Step 1: Prompt for administrator email
        const emailInput = await terminal.ask('Enter administrator email address: ');
        if (!emailInput) {
            console.error('\n[VALIDATION ERROR] Email is required and cannot be empty.');
            process.exitCode = 1;
            return;
        }

        const normalizedEmail = emailInput.toLowerCase();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            console.error('\n[VALIDATION ERROR] Invalid email format. Expected standard address (e.g. user@domain.com).');
            process.exitCode = 1;
            return;
        }

        if (normalizedEmail.length > 150) {
            console.error('\n[VALIDATION ERROR] Email must not exceed 150 characters.');
            process.exitCode = 1;
            return;
        }

        // Step 2: Query MySQL to verify administrator account existence and role
        const [users] = await db.query(
            'SELECT user_id, name, email, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (users.length === 0) {
            console.error(`\n[ERROR] No account found with email "${normalizedEmail}".`);
            process.exitCode = 1;
            return;
        }

        const adminUser = users[0];

        // Safety Policy: Only existing accounts with role === 'admin' can be modified by this script
        if (adminUser.role !== 'admin') {
            console.error(`\n[ABORTED] The account "${normalizedEmail}" is not an administrator (current role: "${adminUser.role}").`);
            console.error('Safety Policy: This script only resets passwords for accounts with the "admin" role.');
            console.error('Customer accounts must use standard customer password reset procedures.');
            process.exitCode = 1;
            return;
        }

        console.log(`\nVerified target administrator: ${adminUser.name} (User ID: ${adminUser.user_id})`);

        // Step 3: Prompt for new password (masked)
        const newPassword = await terminal.askPassword('\nEnter new administrator password (min 6 characters): ');
        if (!newPassword || newPassword.length < 6) {
            console.error('\n[VALIDATION ERROR] Password must be at least 6 characters long.');
            process.exitCode = 1;
            return;
        }

        // Step 4: Confirm new password (masked)
        const confirmPassword = await terminal.askPassword('Confirm new administrator password: ');
        if (newPassword !== confirmPassword) {
            console.error('\n[VALIDATION ERROR] Passwords do not match. Aborting.');
            process.exitCode = 1;
            return;
        }

        console.log('\nGenerating secure bcrypt password hash...');

        // Step 5: Hash password using bcryptjs with 10 salt rounds (matching authController & createAdmin)
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

        // Step 6: Parameterized update targeting strictly password_hash for this user
        const [result] = await db.query(
            'UPDATE users SET password_hash = ? WHERE user_id = ? AND role = ?',
            [passwordHash, adminUser.user_id, 'admin']
        );

        if (result.affectedRows === 0) {
            console.error('\n[ERROR] Password update failed: no matching administrator record was updated.');
            process.exitCode = 1;
            return;
        }

        console.log('\n====================================================');
        console.log('   Administrator Password Updated Successfully!     ');
        console.log('====================================================');
        console.log(`User ID : ${adminUser.user_id}`);
        console.log(`Name    : ${adminUser.name}`);
        console.log(`Email   : ${adminUser.email}`);
        console.log(`Role    : ${adminUser.role}`);
        console.log('====================================================');
        console.log('The administrator can now log in with the new password.\n');

    } catch (error) {
        console.error('\n[SYSTEM ERROR] An error occurred during password reset:');
        console.error(error.message || error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', handleSigint);
        terminal.close();
        try {
            await db.end();
        } catch (_) {}
    }
}

main();
