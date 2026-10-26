/**
 * Administrator Provisioning Script
 *
 * File: backend/scripts/createAdmin.js
 * Purpose: Provision a new administrator account with a secure bcrypt password hash.
 * Supports:
 *   - Interactive mode: prompts for name, email, and password (masked).
 *   - CLI flag mode: node scripts/createAdmin.js --name "..." --email "..." --password "..." [--promote]
 * Safety:
 *   - Never prompts for or accepts user-supplied arbitrary roles (strictly 'admin').
 *   - Prevents accidental overwrite unless explicit --promote flag is supplied.
 *   - Never outputs or logs plaintext passwords, password hashes, or database secrets.
 *   - Enforces the project's existing email format and password policies (min 6 characters).
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

    const flags = parseArgs();
    const isCliMode = Boolean(flags.email && flags.password);

    let terminal = null;
    let name = '';
    let emailInput = '';
    let password = '';
    let allowPromote = Boolean(flags.promote);

    // Handle abrupt cancellation gracefully (e.g. Ctrl+C)
    let isTerminating = false;
    const handleSigint = async () => {
        if (isTerminating) return;
        isTerminating = true;
        console.log('\n[INFO] Operation cancelled by operator. Exiting...');
        if (terminal) terminal.close();
        try {
            await db.end();
        } catch (_) {}
        process.exit(130);
    };
    process.once('SIGINT', handleSigint);

    try {
        if (isCliMode) {
            name = (flags.name || 'Admin User').trim();
            emailInput = flags.email.trim();
            password = flags.password;
        } else {
            terminal = createTerminal();
            name = await terminal.ask('Enter administrator full name: ');
            emailInput = await terminal.ask('Enter administrator email address: ');
        }

        // Validate name
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

        // Validate email
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

        // Check for existing account
        const [existingUsers] = await db.query(
            'SELECT user_id, name, email, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (existingUsers.length > 0) {
            const existing = existingUsers[0];
            if (!allowPromote) {
                console.error(`\n[ABORTED] An account with the email "${normalizedEmail}" already exists.`);
                console.error(`Existing Record Details -> User ID: ${existing.user_id}, Current Role: "${existing.role}".`);
                console.error('Safety Policy: If you intended to promote this existing account or update its password,');
                console.error('pass --promote flag or use: node scripts/promoteAdmin.js --email "' + normalizedEmail + '"');
                process.exitCode = 1;
                return;
            }
        }

        // Collect password if interactive
        if (!isCliMode) {
            password = await terminal.askPassword('Enter administrator password (min 6 characters): ');
            const confirmPassword = await terminal.askPassword('Confirm administrator password: ');
            if (password !== confirmPassword) {
                console.error('\n[VALIDATION ERROR] Passwords do not match. Aborting.');
                process.exitCode = 1;
                return;
            }
        }

        // Validate password length
        if (!password || password.length < 6) {
            console.error('\n[VALIDATION ERROR] Password must be at least 6 characters long.');
            process.exitCode = 1;
            return;
        }

        console.log('\nValidating inputs and generating secure password hash...');
        const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        if (existingUsers.length > 0 && allowPromote) {
            const existing = existingUsers[0];
            await db.query(
                'UPDATE users SET role = ?, password_hash = ? WHERE user_id = ?',
                ['admin', passwordHash, existing.user_id]
            );

            console.log('\n====================================================');
            console.log('    Existing User Promoted to Administrator!        ');
            console.log('====================================================');
            console.log(`User ID : ${existing.user_id}`);
            console.log(`Name    : ${existing.name}`);
            console.log(`Email   : ${normalizedEmail}`);
            console.log(`Role    : admin`);
            console.log('====================================================\n');
        } else {
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
        }

    } catch (error) {
        console.error('\n[SYSTEM ERROR] An error occurred during administrator provisioning:');
        console.error(error.message || error);
        process.exitCode = 1;
    } finally {
        process.removeListener('SIGINT', handleSigint);
        if (terminal) terminal.close();
        try {
            await db.end();
        } catch (_) {}
    }
}

main();
