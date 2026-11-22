const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function testUI() {
    console.log('Launching Chrome to test Forgot Password & Reset Password UI flows...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // 1. Visit Login page and click "Forgot Password?"
        console.log('1. Navigating to Login page...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 600));

        const forgotLink = await page.$('.forgot-password-link');
        if (!forgotLink) {
            throw new Error('Could not find .forgot-password-link on Login page!');
        }
        console.log('Found "Forgot Password?" link on Login page. Clicking...');
        await forgotLink.click();
        await new Promise(r => setTimeout(r, 1000));

        if (!page.url().includes('/forgot-password')) {
            throw new Error(`Expected URL to contain /forgot-password, but got: ${page.url()}`);
        }
        console.log('✓ Successfully navigated to /forgot-password');

        // Screenshot 1: Forgot Password Page
        const forgotPath = path.join(ARTIFACT_DIR, 'forgot_password_page.png');
        await page.screenshot({ path: forgotPath });
        console.log(`Saved screenshot: ${forgotPath}`);

        // 2. Submit email on Forgot Password page
        console.log('Submitting email on Forgot Password page...');
        await page.type('#email', 'admin@rentiq.com');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 1500));

        // Verify success state
        const successBox = await page.$('.forgot-success-box');
        if (!successBox) {
            throw new Error('Forgot password success box did not display!');
        }
        console.log('✓ Forgot password success confirmation displayed correctly');

        // 3. Visit Reset Password Page with mock token
        console.log('2. Navigating to Reset Password page with token...');
        const testToken = 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef';
        await page.goto(`${FRONTEND_URL}/reset-password?token=${testToken}`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 800));

        // Test typing password and observing strength meter
        const newPassInput = await page.$('input[name="newPassword"]');
        if (!newPassInput) {
            throw new Error('New password input not found on Reset Password page!');
        }
        await newPassInput.type('StrongPass@2026');
        await new Promise(r => setTimeout(r, 400));

        // Toggle show password
        const toggleBtn = await page.$('.pwd-toggle-btn');
        if (toggleBtn) {
            await toggleBtn.click();
        }

        // Fill confirm password
        const confirmPassInput = await page.$('input[name="confirmPassword"]');
        if (confirmPassInput) {
            await confirmPassInput.type('StrongPass@2026');
        }

        // Screenshot 2: Reset Password Page
        const resetPath = path.join(ARTIFACT_DIR, 'reset_password_page.png');
        await page.screenshot({ path: resetPath });
        console.log(`Saved screenshot: ${resetPath}`);

        // 4. Log in and verify enhanced Change Password section in Profile
        console.log('3. Logging in as admin to verify Profile Change Password section...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await page.click('#email', { clickCount: 3 });
        await page.type('#email', 'admin@rentiq.com');
        await page.click('#password', { clickCount: 3 });
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));

        await page.goto(`${FRONTEND_URL}/profile`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // Switch to Settings tab
        const settingsTab = await page.waitForSelector('#profile-tab-settings');
        await settingsTab.click();
        await new Promise(r => setTimeout(r, 1000));

        // Type into new password to see strength meter
        const profNewPass = await page.$('#newPassword');
        if (profNewPass) {
            await profNewPass.type('MyNewStrongPassword@2026');
            await new Promise(r => setTimeout(r, 400));
        }

        // Screenshot 3: Profile Change Password Enhanced
        const profilePath = path.join(ARTIFACT_DIR, 'profile_change_password_enhanced.png');
        await page.screenshot({ path: profilePath });
        console.log(`Saved screenshot: ${profilePath}`);

        console.log('\nAll browser UI steps passed cleanly!');
    } finally {
        await browser.close();
    }
}

testUI().catch(err => {
    console.error('Browser test failed:', err);
    process.exit(1);
});

