const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function captureInspectionScreenshots() {
    console.log('Starting vehicle inspection visual verification & screenshot capture...');
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1050 });

        // 1. Login as Admin
        console.log('1. Logging in as Admin (admin@rentiq.com)...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 600));

        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));

        // 2. Navigate to Admin Bookings
        console.log('2. Navigating to Admin Bookings (/admin/bookings)...');
        await page.goto(`${FRONTEND_URL}/admin/bookings`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Capture table with Inspection button visible and styled
        console.log('3. Capturing Admin Bookings table with Inspection buttons...');
        const bookingsTablePath = path.join(ARTIFACT_DIR, 'admin_bookings_inspection_buttons.png');
        await page.screenshot({ path: bookingsTablePath, fullPage: false });
        console.log(`Saved: ${bookingsTablePath}`);

        // 4. Click Inspection button on Booking #561 (or first enabled Inspection button)
        console.log('4. Clicking the Inspection button for active/confirmed booking...');
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button.booking-action-button.booking-action-inspection:not(:disabled)'));
            if (buttons.length > 0) {
                buttons[0].click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            throw new Error('Could not find an enabled Inspection button on Admin Bookings page');
        }

        console.log('Inspection button clicked successfully! Waiting for modal window...');
        await page.waitForSelector('.inspection-modal-window', { timeout: 8000 });
        await new Promise(r => setTimeout(r, 1000));

        // Capture Inspection Modal open (Light Mode)
        console.log('5. Capturing Inspection Modal (Light Mode)...');
        const modalOpenPath = path.join(ARTIFACT_DIR, 'admin_booking_inspection_modal_open.png');
        await page.screenshot({ path: modalOpenPath, fullPage: false });
        console.log(`Saved: ${modalOpenPath}`);

        // Capture Inspection Modal in Dark Mode
        console.log('6. Toggling Dark Mode and capturing Inspection Modal...');
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'dark');
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.style.colorScheme = 'dark';
        });
        await new Promise(r => setTimeout(r, 800));

        const modalDarkPath = path.join(ARTIFACT_DIR, 'admin_booking_inspection_modal_dark.png');
        await page.screenshot({ path: modalDarkPath, fullPage: false });
        console.log(`Saved: ${modalDarkPath}`);

        // Switch back to light mode
        await page.evaluate(() => {
            localStorage.setItem('rentiq-theme', 'light');
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.style.colorScheme = 'light';
        });
        await new Promise(r => setTimeout(r, 500));

        // Click on "Record Pickup Inspection" tab button if available
        console.log('7. Switching to "Record Pickup Inspection" tab...');
        const tabSwitched = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('button.sub-tab-btn'));
            const pickupTab = tabs.find(t => t.textContent.includes('Record Pickup Inspection'));
            if (pickupTab) {
                pickupTab.click();
                return true;
            }
            return false;
        });
        console.log('Pickup tab clicked:', tabSwitched);
        await new Promise(r => setTimeout(r, 800));

        // 8. Fill in Pickup Inspection details
        console.log('8. Filling in Pickup Inspection Form...');
        const inputFound = await page.evaluate(() => {
            const odoInput = document.querySelector('input[type="number"]');
            if (odoInput) {
                odoInput.value = '24500';
                odoInput.dispatchEvent(new Event('input', { bubbles: true }));
                odoInput.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
            return false;
        });

        // Scroll modal body down slightly to show checklist and photo upload categories
        await page.evaluate(() => {
            const modalBody = document.querySelector('.inspection-modal-body');
            if (modalBody) modalBody.scrollTop = 250;
        });
        await new Promise(r => setTimeout(r, 800));

        const modalFormFilledPath = path.join(ARTIFACT_DIR, 'admin_booking_inspection_form_checklist.png');
        await page.screenshot({ path: modalFormFilledPath, fullPage: false });
        console.log(`Saved: ${modalFormFilledPath}`);

        console.log('\nAll vehicle inspection screenshots captured successfully!');
    } finally {
        await browser.close();
    }
}

captureInspectionScreenshots().catch(err => {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
});
