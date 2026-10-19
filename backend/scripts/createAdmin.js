/**
 * Administrator Provisioning Script
 *
 * File: backend/scripts/createAdmin.js
 * Purpose: Interactively provision a new administrator account with a secure bcrypt password hash.
 * Safety:
 *   - Never prompts for or accepts user-supplied roles (role is strictly hardcoded to 'admin').
 *   - Never modifies, updates, or promotes an existing account if the email is already in use.
 *   - Never outputs or logs plaintext passwords, password hashes, or database secrets.
 *   - Masks password input in terminal using Node.js built-in readline and stream modules.
 *   - Enforces the project's existing email format and password policies.
 */

const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');

// Ensure environment variables from backend/.env are loaded regardless of execution cwd
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Validation regular expression matching authController.js
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
    console.log('       RentIQ — Administrator Account Provisioning   ');
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
        // Step 1: Prompt for administrator name
        const name = await terminal.ask('Enter administrator full name: ');
        if (!name) {
            console.error('\n[VALIDATION ERROR] Name is required and cannot be empty.');
            process.exitCode = 1;
            return;
        }
        if (name.length > 100) {
            console.error('\n[VALIDATION ERROR] Name must not exceed 100 characters.');
            process.exitCode = 1;
            return;
        }

        // Step 2: Prompt for administrator email
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

        // Step 3: Check for existing account BEFORE collecting password
        const [existingUsers] = await db.query(
            'SELECT user_id, name, email, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            const existing = existingUsers[0];
            console.error(`\n[ABORTED] An account with the email "${normalizedEmail}" already exists.`);
            console.error(`Existing Record Details -> User ID: ${existing.user_id}, Current Role: "${existing.role}".`);
            console.error('Safety Policy: This script will NEVER modify, overwrite, or promote an existing account.');
            console.error('If this account requires administrative privileges or a password reset,');
            console.error('please perform a deliberate, audited database update separately.');
            process.exitCode = 1;
            return;
        }

        // Step 4: Prompt for password (masked)
        const password = await terminal.askPassword('Enter administrator password (min 6 characters): ');
        if (!password || password.length < 6) {
            console.error('\n[VALIDATION ERROR] Password must be at least 6 characters long.');
            process.exitCode = 1;
            return;
        }

        // Step 5: Confirm password (masked)
        const confirmPassword = await terminal.askPassword('Confirm administrator password: ');
        if (password !== confirmPassword) {
            console.error('\n[VALIDATION ERROR] Passwords do not match. Aborting.');
            process.exitCode = 1;
            return;
        }

        console.log('\nValidating inputs and generating secure password hash...');

        // Step 6: Hash password using bcryptjs with 10 salt rounds (matching authController)
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // Step 7: Insert administrator into database
        const [result] = await db.query(
            'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [name, normalizedEmail, passwordHash, 'admin']
        );

        console.log('\n====================================================');
        console.log('       Administrator Created Successfully!          ');
        console.log('====================================================');
        console.log(`User ID : ${result.insertId}`);
        console.log(`Name    : ${name}`);
        console.log(`Email   : ${normalizedEmail}`);
        console.log(`Role    : admin`);
        console.log('====================================================');
        console.log('The administrator can now log in using standard authentication.\n');

    } catch (error) {
        console.error('\n[SYSTEM ERROR] An error occurred during administrator provisioning:');
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
