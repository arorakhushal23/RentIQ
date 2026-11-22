const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function captureInspectionReport() {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1050 });

        // Login as Admin
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 500));
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));

        // Go to Admin Bookings
        await page.goto(`${FRONTEND_URL}/admin/bookings`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Click Inspection button on Booking #561
        await page.evaluate(() => {
            const btn = document.querySelector('button.booking-action-button.booking-action-inspection:not(:disabled)');
            if (btn) btn.click();
        });
        await page.waitForSelector('.inspection-modal-window', { timeout: 8000 });
        await new Promise(r => setTimeout(r, 1500));

        // Capture Inspection report view (showing saved pickup inspection and pending customer status)
        const reportPath = path.join(ARTIFACT_DIR, 'admin_booking_inspection_report_view.png');
        await page.screenshot({ path: reportPath, fullPage: false });
        console.log(`Saved: ${reportPath}`);

    } finally {
        await browser.close();
    }
}

captureInspectionReport().catch(err => {
    console.error('Failed to capture report screenshot:', err);
    process.exit(1);
});
