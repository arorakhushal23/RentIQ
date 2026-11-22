const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function captureScreenshots() {
    console.log('Starting visual verification and screenshot capture...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 1050 });

        // 1. Login as Admin
        console.log('1. Navigating to login page...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 600));

        console.log('2. Logging in as Admin (admin@rentiq.com)...');
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));

        // 2. Navigate to Admin Vehicles
        console.log('3. Navigating to Admin Vehicle Management (/admin/vehicles)...');
        await page.goto(`${FRONTEND_URL}/admin/vehicles`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // 4. Capture Admin Vehicles in Light Mode
        console.log('4. Setting Light Mode and capturing screenshot...');
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'light');
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.style.colorScheme = 'light';
        });
        await new Promise(r => setTimeout(r, 800));

        const adminLightPath = path.join(ARTIFACT_DIR, 'admin_vehicles_availability_light.png');
        await page.screenshot({ path: adminLightPath, fullPage: false });
        console.log(`Saved: ${adminLightPath}`);

        // 5. Capture Admin Vehicles in Dark Mode
        console.log('5. Setting Dark Mode and capturing screenshot...');
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        });
        await new Promise(r => setTimeout(r, 800));

        const adminDarkPath = path.join(ARTIFACT_DIR, 'admin_vehicles_availability_dark.png');
        await page.screenshot({ path: adminDarkPath, fullPage: false });
        console.log(`Saved: ${adminDarkPath}`);

        // 6. Navigate to Customer Vehicle Details for Scorpio (#6)
        console.log('6. Navigating to Customer Vehicle Details for Mahindra Scorpio (/vehicles/6)...');
        await page.goto(`${FRONTEND_URL}/vehicles/6`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Click on "Compliance Status" tab to show document compliance breakdown
        const compTabClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.section-nav-btn'));
            const compBtn = btns.find(b => b.textContent.includes('Compliance Status'));
            if (compBtn) {
                compBtn.click();
                return true;
            }
            return false;
        });
        console.log('Compliance status tab clicked:', compTabClicked);
        await new Promise(r => setTimeout(r, 800));

        const custViewPath = path.join(ARTIFACT_DIR, 'customer_vehicle_compliance_required.png');
        await page.screenshot({ path: custViewPath, fullPage: false });
        console.log(`Saved: ${custViewPath}`);

        console.log('\nAll availability screenshots captured successfully!');
    } finally {
        await browser.close();
    }
}

captureScreenshots().catch(err => {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
});

