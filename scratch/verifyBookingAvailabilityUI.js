const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function runBrowserVerification() {
    console.log('====================================================');
    console.log('RentIQ Customer Booking Availability UI Verification');
    console.log('====================================================\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
    });

    let passedTests = 0;
    let failedTests = 0;

    const assert = (cond, msg) => {
        if (cond) {
            console.log(`[PASS] ${msg}`);
            passedTests++;
        } else {
            console.error(`[FAIL] ${msg}`);
            failedTests++;
        }
    };

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 1050 });

        // Step 1: Login as verified customer
        console.log('1. Logging in as customer (admin@rentiq.com)...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        // -----------------------------------------------------------------
        // TEST A: Unavailable Vehicle on Step 1 (Vehicle 4 Verna - expired insurance)
        // -----------------------------------------------------------------
        console.log('\n2. Navigating to Vehicle 4 (Hyundai Verna - expired insurance)...');
        await page.goto(`${FRONTEND_URL}/vehicles/4`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        const v4Step1 = await page.evaluate(() => {
            const statusRow = document.querySelector('.vehicle-status-row')?.textContent || '';
            const nextBtn = document.querySelector('.step-btn.next-btn');
            const errorMsg = document.querySelector('.form-field-error')?.textContent || '';
            return {
                statusText: statusRow.trim(),
                nextDisabled: nextBtn ? nextBtn.disabled : false,
                errorMsg: errorMsg.trim()
            };
        });

        console.log('Vehicle 4 Step 1 status:', v4Step1);
        assert(v4Step1.statusText.includes('Currently Unavailable'), 'Vehicle 4 Step 1 status badge shows Currently Unavailable');
        assert(v4Step1.nextDisabled === true, 'Vehicle 4 Step 1 Next button is DISABLED');
        assert(v4Step1.errorMsg.includes('routine compliance maintenance') || v4Step1.errorMsg.includes('unavailable'), 'Vehicle 4 Step 1 displays compliance maintenance message');

        // -----------------------------------------------------------------
        // TEST B: Vehicle 2 (i20) with rental dates past PUC expiry (2026-11-27)
        // Tests the final booking confirmation screen (Step 5) unavailability handling
        // -----------------------------------------------------------------
        console.log('\n3. Navigating to Vehicle 2 (i20) and configuring dates past PUC expiry (2026-11-27)...');
        await page.goto(`${FRONTEND_URL}/vehicles/2`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        // Advance Step 1 -> Step 2 (Location)
        console.log('Advancing Step 1 -> Step 2 (Location)...');
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 800));

        // Advance Step 2 -> Step 3 (Schedule)
        console.log('Advancing Step 2 -> Step 3 (Schedule)...');
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 800));

        // On Step 3: Enter return date past PUC expiry (2026-11-27) -> 2026-11-25 to 2026-12-05
        console.log('Setting dates: 2026-11-25 to 2026-12-05 (extending past PUC validity)...');
        await page.evaluate(() => {
            function setVal(id, val) {
                const el = document.getElementById(id);
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setVal('booking-pickup-date', '2026-11-25');
            setVal('booking-return-date', '2026-12-05');
        });
        await new Promise(r => setTimeout(r, 1000));

        // Advance Step 3 -> Step 4 (Review)
        console.log('Advancing Step 3 -> Step 4 (Review)...');
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 1200));

        // Advance Step 4 -> Step 5 (Confirm)
        console.log('Advancing Step 4 -> Step 5 (Confirm & Reserve)...');
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 1500));

        // Evaluate Step 5 for Vehicle 2 with expired PUC
        const step5Eval = await page.evaluate(() => {
            const submitBtn = document.querySelector('.confirm-submit-btn');
            const unavailableBanner = document.querySelector('.booking-unavailable-banner');
            const bannerHeader = unavailableBanner?.querySelector('h4')?.textContent;
            const bannerMsg = unavailableBanner?.querySelector('.unavailable-message')?.textContent;
            const backFleetBtn = unavailableBanner?.querySelector('.back-to-fleet-btn');
            const backReviewBtn = document.querySelector('.step-btn.back-btn');

            return {
                submitBtnExists: Boolean(submitBtn),
                submitBtnDisabled: submitBtn ? submitBtn.disabled : false,
                submitBtnText: submitBtn ? submitBtn.textContent.trim() : '',
                hasUnavailableClass: submitBtn ? submitBtn.classList.contains('btn-disabled-unavailable') : false,
                unavailableBannerExists: Boolean(unavailableBanner),
                bannerHeader,
                bannerMsg,
                backFleetLink: backFleetBtn?.getAttribute('href'),
                backReviewBtnDisabled: backReviewBtn ? backReviewBtn.disabled : false
            };
        });

        console.log('Step 5 Evaluation for PUC expired window:', step5Eval);

        assert(step5Eval.submitBtnDisabled === true, 'Step 5 Confirm & Book Now button is DISABLED when vehicle is unavailable');
        assert(step5Eval.hasUnavailableClass === true, 'Step 5 button has .btn-disabled-unavailable class');
        assert(step5Eval.submitBtnText.includes('Vehicle Unavailable for Reservation'), 'Step 5 button displays "🚫 Vehicle Unavailable for Reservation"');
        assert(step5Eval.unavailableBannerExists === true, 'Step 5 displays .booking-unavailable-banner');
        assert(step5Eval.bannerHeader === 'Vehicle Unavailable for Reservation', 'Banner header states "Vehicle Unavailable for Reservation"');
        assert(step5Eval.bannerMsg.includes('routine compliance maintenance'), 'Banner message states "This vehicle is temporarily unavailable due to routine compliance maintenance. Please choose another vehicle."');
        assert(step5Eval.backReviewBtnDisabled === false, 'Step 5 Back: Review button remains ENABLED');
        assert(step5Eval.backFleetLink === '/vehicles', 'Step 5 provides action link "← Back to Vehicle Selection" (/vehicles)');

        // Capture screenshot of Step 5 in unavailable state
        const unavailableScreenshot = path.join(ARTIFACT_DIR, 'vehicle_unavailable_booking_step5.png');
        await page.screenshot({ path: unavailableScreenshot, fullPage: false });
        console.log(`Saved screenshot: ${unavailableScreenshot}`);

        // Test Back Button Functionality: click Back: Review
        console.log('\n4. Testing Back button on Step 5...');
        const backBtn = await page.$('.step-btn.back-btn');
        await backBtn.click();
        await new Promise(r => setTimeout(r, 1000));

        const currentStepAfterBack = await page.evaluate(() => {
            const panelBadge = document.querySelector('.panel-badge');
            const pickupDateVal = document.getElementById('booking-pickup-date')?.value;
            return {
                badgeText: panelBadge ? panelBadge.textContent.trim() : '',
                pickupDateVal
            };
        });
        console.log('Panel after clicking Back:', currentStepAfterBack);
        assert(currentStepAfterBack.badgeText.includes('Step 4 of 5'), 'Clicking Back on Step 5 successfully navigated back to Step 4 (Review)');

        // -----------------------------------------------------------------
        // TEST C: Available Vehicle (Vehicle 1 Swift) on valid dates
        // -----------------------------------------------------------------
        console.log('\n5. Navigating to Vehicle 1 (Maruti Suzuki Swift - fully compliant)...');
        await page.goto(`${FRONTEND_URL}/vehicles/1`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));

        // Advance Step 1 -> Step 2
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 800));

        // Advance Step 2 -> Step 3
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 800));

        // Set valid future dates: 2027-01-10 to 2027-01-12
        await page.evaluate(() => {
            function setVal(id, val) {
                const el = document.getElementById(id);
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(el, val);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            setVal('booking-pickup-date', '2027-01-10');
            setVal('booking-return-date', '2027-01-12');
        });
        await new Promise(r => setTimeout(r, 1000));

        // Advance Step 3 -> Step 4
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 1200));

        // Advance Step 4 -> Step 5
        await page.click('.step-btn.next-btn');
        await new Promise(r => setTimeout(r, 1500));

        // Check terms checkbox
        console.log('Checking terms checkbox on Step 5 for Vehicle 1...');
        await page.evaluate(() => {
            const cb = document.getElementById('booking-terms-agree');
            if (cb && !cb.checked) {
                cb.click();
            }
        });
        await new Promise(r => setTimeout(r, 1000));

        const v1Step5Eval = await page.evaluate(() => {
            const submitBtn = document.querySelector('.confirm-submit-btn');
            const unavailableBanner = document.querySelector('.booking-unavailable-banner');

            return {
                submitBtnDisabled: submitBtn ? submitBtn.disabled : true,
                submitBtnText: submitBtn ? submitBtn.textContent.trim() : '',
                hasUnavailableClass: submitBtn ? submitBtn.classList.contains('btn-disabled-unavailable') : false,
                unavailableBannerExists: Boolean(unavailableBanner)
            };
        });

        console.log('Vehicle 1 (Available) Step 5 Evaluation:', v1Step5Eval);

        assert(v1Step5Eval.submitBtnDisabled === false, 'Vehicle 1 Confirm & Book Now button is ENABLED for available vehicle');
        assert(v1Step5Eval.unavailableBannerExists === false, 'Vehicle 1 does NOT show unavailable banner');
        assert(v1Step5Eval.submitBtnText.includes('Confirm & Book Now'), 'Vehicle 1 button displays active Confirm & Book Now action');

        // Capture screenshot of Step 5 in available state
        const availableScreenshot = path.join(ARTIFACT_DIR, 'vehicle_available_booking_step5.png');
        await page.screenshot({ path: availableScreenshot, fullPage: false });
        console.log(`Saved screenshot: ${availableScreenshot}`);

    } catch (err) {
        console.error('Browser verification encountered an error:', err);
        failedTests++;
    } finally {
        await browser.close();
        console.log('\n====================================================');
        console.log(`BROWSER UI VERIFICATION SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('====================================================');
        process.exit(failedTests === 0 ? 0 : 1);
    }
}

runBrowserVerification();
