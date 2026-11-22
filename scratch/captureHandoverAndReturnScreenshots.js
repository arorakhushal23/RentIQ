const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function captureReturnAndDiff() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1050 });

        page.on('dialog', async dialog => {
            console.log('Dialog:', dialog.message());
            await dialog.accept();
        });

        // 1. Login as Admin
        console.log('1. Logging in as Admin...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 500));
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));

        // 2. Go to Admin Bookings
        console.log('2. Navigating to Admin Bookings...');
        await page.goto(`${FRONTEND_URL}/admin/bookings`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // 3. Open Inspection Modal for Booking #561
        await page.evaluate(() => {
            const btn = document.querySelector('button.booking-action-button.booking-action-inspection:not(:disabled)');
            if (btn) btn.click();
        });
        await page.waitForSelector('.inspection-modal-window', { timeout: 8000 });
        await new Promise(r => setTimeout(r, 1500));

        // 4. Click on "Record Return Inspection" tab
        console.log('3. Switching to "Record Return Inspection" tab...');
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('button.sub-tab-btn'));
            const returnTab = tabs.find(t => t.textContent.includes('Record Return Inspection'));
            if (returnTab) returnTab.click();
        });
        await new Promise(r => setTimeout(r, 1200));

        // 5. Fill return inspection: clear starting 24500 and set 24900 (400 km travelled)
        console.log('4. Filling return inspection details (24,900 km, 85% fuel)...');
        await page.evaluate(() => {
            const input = document.querySelector('input[type="number"]');
            if (input) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(input, '24900');
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.evaluate(() => {
            const fuelSlider = document.querySelector('input[type="range"]');
            if (fuelSlider) {
                fuelSlider.value = '85';
                fuelSlider.dispatchEvent(new Event('input', { bubbles: true }));
                fuelSlider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await page.type('textarea', 'Vehicle returned in clean condition. No new damage or dents detected.');
        await new Promise(r => setTimeout(r, 500));

        // 6. Save return inspection
        console.log('5. Submitting return inspection...');
        await page.click('button.submit-insp-btn');
        await new Promise(r => setTimeout(r, 3000));

        // 7. Capture completed difference report view
        console.log('6. Capturing Difference Analysis & Settlement view...');
        const diffReportPath = path.join(ARTIFACT_DIR, 'admin_booking_inspection_diff_report.png');
        await page.screenshot({ path: diffReportPath, fullPage: false });
        console.log(`Saved: ${diffReportPath}`);

        console.log('\nReturn inspection & Difference report captured successfully!');
    } finally {
        await browser.close();
    }
}

captureReturnAndDiff().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
});
