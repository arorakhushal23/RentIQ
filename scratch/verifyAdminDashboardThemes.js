const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function runThemeVerification() {
    console.log('Launching browser to verify Admin Dashboard styling in Light and Dark mode...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 1050 });

        // Navigate to login
        console.log('1. Navigating to login page...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 600));

        // Login as Admin
        console.log('2. Logging in as Admin...');
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));

        console.log('Logged in. Current URL:', page.url());

        // Ensure we are on /admin
        if (!page.url().includes('/admin')) {
            await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 1200));
        }

        // Set Light Mode first
        console.log('3. Setting Light Mode...');
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'light');
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.style.colorScheme = 'light';
        });
        await new Promise(r => setTimeout(r, 600));

        // Capture Light Mode Admin Dashboard
        const lightDashPath = path.join(ARTIFACT_DIR, 'admin_dashboard_light.png');
        await page.screenshot({ path: lightDashPath, fullPage: true });
        console.log('✓ Captured Light Mode Admin Dashboard:', lightDashPath);

        // Switch to Dark Mode
        console.log('4. Switching to Dark Mode...');
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        });
        await new Promise(r => setTimeout(r, 600));

        // Capture Dark Mode Admin Dashboard
        const darkDashPath = path.join(ARTIFACT_DIR, 'admin_dashboard_dark.png');
        await page.screenshot({ path: darkDashPath, fullPage: true });
        console.log('✓ Captured Dark Mode Admin Dashboard:', darkDashPath);

        // Navigate to /admin/maintenance in Dark Mode
        console.log('5. Navigating to /admin/maintenance in Dark Mode...');
        await page.goto(`${FRONTEND_URL}/admin/maintenance`, { waitUntil: 'networkidle2' });
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        });
        await new Promise(r => setTimeout(r, 1200));

        const darkMaintPath = path.join(ARTIFACT_DIR, 'admin_maintenance_dark.png');
        await page.screenshot({ path: darkMaintPath, fullPage: true });
        console.log('✓ Captured Dark Mode Admin Maintenance:', darkMaintPath);

        // Navigate to /admin/pricing in Dark Mode
        console.log('6. Navigating to /admin/pricing in Dark Mode...');
        await page.goto(`${FRONTEND_URL}/admin/pricing`, { waitUntil: 'networkidle2' });
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        });
        await new Promise(r => setTimeout(r, 1200));

        const darkPricingPath = path.join(ARTIFACT_DIR, 'admin_pricing_dark.png');
        await page.screenshot({ path: darkPricingPath, fullPage: true });
        console.log('✓ Captured Dark Mode Admin Pricing:', darkPricingPath);

        console.log('\nAll theme verification screenshots successfully captured!');
    } catch (err) {
        console.error('Error during theme verification:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

runThemeVerification();

