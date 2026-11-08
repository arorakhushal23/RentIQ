const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';

async function testBrowserAuthUI() {
    console.log('Starting Puppeteer browser authentication UI test...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // 1. Visit Login page
        console.log('Navigating to http://localhost:5173/login...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });

        // Screenshot login page
        const artifactDir = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';
        const loginScreenshotPath = path.join(artifactDir, 'admin_login_page.png');
        await page.screenshot({ path: loginScreenshotPath });
        console.log(`Saved screenshot to ${loginScreenshotPath}`);

        // 2. Type admin credentials
        await page.waitForSelector('#email');
        await page.click('#email', { clickCount: 3 });
        await page.type('#email', 'admin@rentiq.com');

        await page.waitForSelector('#password');
        await page.click('#password', { clickCount: 3 });
        await page.type('#password', 'Admin@123');

        // Click Login
        await page.click('button[type="submit"]');

        // Wait for redirect to /admin
        await new Promise(r => setTimeout(r, 2000));
        const currentUrl = page.url();
        console.log('Current URL after login:', currentUrl);

        if (!currentUrl.includes('/admin')) {
            throw new Error(`Expected redirect to /admin, but got ${currentUrl}`);
        }
        console.log('✓ Successfully logged in and redirected to /admin');

        // 3. Navigate to /profile to verify Change Password UI
        console.log('Navigating to /profile...');
        await page.goto(`${FRONTEND_URL}/profile`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // Click Settings tab
        const settingsTab = await page.waitForSelector('#profile-tab-settings');
        await settingsTab.click();
        await new Promise(r => setTimeout(r, 1000));

        // Verify Change Password form inputs
        const currentPassInput = await page.$('#currentPassword');
        const newPassInput = await page.$('#newPassword');
        const confirmPassInput = await page.$('#confirmPassword');

        if (!currentPassInput || !newPassInput || !confirmPassInput) {
            throw new Error('Change Password form inputs not found in DOM!');
        }
        console.log('✓ Change Password form found and verified in Profile Settings tab!');

        // Save screenshot of Settings with Change Password form
        const settingsScreenshotPath = path.join(artifactDir, 'admin_profile_change_password.png');
        await page.screenshot({ path: settingsScreenshotPath });
        console.log(`Saved screenshot to ${settingsScreenshotPath}`);

        console.log('All browser UI checks passed successfully!');
    } finally {
        await browser.close();
    }
}

testBrowserAuthUI().catch(err => {
    console.error('Puppeteer test failed:', err);
    process.exit(1);
});
