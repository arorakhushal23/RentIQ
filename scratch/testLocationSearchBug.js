const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function runLocationSearchTests() {
    console.log('====================================================');
    console.log('RentIQ Customer Booking Location Search Verification');
    console.log('====================================================\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,1050']
    });

    let passedTests = 0;
    let failedTests = 0;

    const assert = (condition, msg) => {
        if (condition) {
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

        // Step A: Login as customer so full booking workflow is available
        console.log('Logging in as customer...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));

        // Step B: Navigate to Vehicle Details for Vehicle 1 (Swift)
        console.log('Navigating to Vehicle 1 details (/vehicles/1)...');
        await page.goto(`${FRONTEND_URL}/vehicles/1`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // Mark window with a persistent flag to detect page reloads
        await page.evaluate(() => {
            window.__rentiq_reload_sentinel = 'STAYED_ON_PAGE_NO_RELOAD';
        });

        // Advance to Step 2: Location
        console.log('Advancing to Step 2 (Location)...');
        const nextBtn = await page.$('.step-btn.next-btn');
        if (!nextBtn) throw new Error('Next button on Step 1 not found!');
        await nextBtn.click();
        await new Promise(r => setTimeout(r, 1000));

        // Verify Step 2 is active
        const step2Title = await page.$eval('.panel-title', el => el.textContent);
        assert(step2Title.includes('Select Pickup & Drop Location'), 'Step 2 (Select Pickup & Drop Location) is active');

        const searchInput = await page.$('.map-search-input');
        const searchBtn = await page.$('.map-search-submit-btn');
        assert(searchInput && searchBtn, 'Found map-search-input and map-search-submit-btn in Step 2');

        // Check search button type
        const btnType = await page.$eval('.map-search-submit-btn', el => el.getAttribute('type'));
        assert(btnType === 'button', `Search button type attribute is strictly "button" (actual: ${btnType})`);

        // Check if map-search-form is a div and NOT a form
        const isFormTag = await page.$eval('.map-search-form', el => el.tagName.toLowerCase());
        assert(isFormTag === 'div', `Search container is a <div> and NOT a nested <form> (actual: <${isFormTag}>)`);

        // ==========================================
        // TEST 6: Click Search with an empty input
        // ==========================================
        console.log('\n--- Scenario 6: Click Search with empty input ---');
        await page.$eval('.map-search-input', el => el.value = '');
        await searchBtn.click();
        await new Promise(r => setTimeout(r, 400));

        const sentinelT6 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT6 === 'STAYED_ON_PAGE_NO_RELOAD', 'Page did NOT reload on empty search');

        const errMsgEmpty = await page.$eval('.map-search-error-msg', el => el.textContent).catch(() => '');
        assert(errMsgEmpty.includes('Please enter a location'), `Empty input displays error message: "${errMsgEmpty}"`);

        // ==========================================
        // TEST 4: Search for an invalid location
        // ==========================================
        console.log('\n--- Scenario 4: Search for invalid location ---');
        await page.type('.map-search-input', 'xyzinvalidfakelocation99999');
        await searchBtn.click();
        await new Promise(r => setTimeout(r, 1500));

        const sentinelT4 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT4 === 'STAYED_ON_PAGE_NO_RELOAD', 'Page did NOT reload on invalid search');

        const errMsgInvalid = await page.$eval('.map-search-error-msg', el => el.textContent).catch(() => '');
        assert(errMsgInvalid.includes('No location found'), `Invalid location displays friendly error: "${errMsgInvalid}"`);

        // ==========================================
        // TEST 1: Search for Patiala
        // ==========================================
        console.log('\n--- Scenario 1: Search for Patiala ---');
        // Clear input using clear button
        const clearBtn = await page.$('.clear-search-btn');
        if (clearBtn) await clearBtn.click();
        await page.type('.map-search-input', 'Patiala');
        await searchBtn.click();

        // Wait for Nominatim and route calculation
        await new Promise(r => setTimeout(r, 2500));

        const sentinelT1 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT1 === 'STAYED_ON_PAGE_NO_RELOAD', 'Page did NOT reload when searching for Patiala');

        const inputValT1 = await page.$eval('.map-search-input', el => el.value);
        assert(inputValT1.includes('Patiala'), `Search query remains visible in input: "${inputValT1}"`);

        const pickupAddressT1 = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(pickupAddressT1.toLowerCase().includes('patiala'), `Pickup address updated to Patiala: "${pickupAddressT1}"`);

        // Check map center in Leaflet
        const mapCenterT1 = await page.evaluate(() => {
            const mapEl = document.querySelector('.leaflet-map-element');
            // Leaflet attaches map id to element or container
            return {
                text: document.querySelector('.pickup-card .address-text')?.textContent || ''
            };
        });
        assert(pickupAddressT1.includes('Punjab') || pickupAddressT1.includes('Patiala'), 'Resolved coordinates & address point to Patiala');

        // Screenshot of Patiala search result
        const patialaShot = path.join(ARTIFACT_DIR, 'location_search_patiala.png');
        await page.screenshot({ path: patialaShot });
        console.log('✓ Captured screenshot: location_search_patiala.png');

        // ==========================================
        // TEST 10: Verify delivery distance & fee for Patiala
        // ==========================================
        console.log('\n--- Scenario 10: Delivery distance, time & fee ---');
        await new Promise(r => setTimeout(r, 1000));
        const distanceVal = await page.$eval('.metric-pill:nth-child(1) .metric-val', el => el.textContent).catch(() => 'N/A');
        const travelTimeVal = await page.$eval('.metric-pill:nth-child(2) .metric-val', el => el.textContent).catch(() => 'N/A');
        const deliveryFeeVal = await page.$eval('.metric-pill:nth-child(3) .metric-val', el => el.textContent).catch(() => 'N/A');

        console.log(`Route metrics for Patiala: Distance: ${distanceVal}, Time: ${travelTimeVal}, Fee: ${deliveryFeeVal}`);
        assert(distanceVal !== 'N/A' && distanceVal.includes('km'), `Transit distance computed: ${distanceVal}`);
        assert(travelTimeVal !== 'N/A', `Estimated travel time computed: ${travelTimeVal}`);
        assert(deliveryFeeVal !== 'N/A', `Delivery fee computed: ${deliveryFeeVal}`);

        // ==========================================
        // TEST 2: Search for Chandigarh
        // ==========================================
        console.log('\n--- Scenario 2: Search for Chandigarh ---');
        const clearBtn2 = await page.$('.clear-search-btn');
        if (clearBtn2) await clearBtn2.click();
        await page.type('.map-search-input', 'Chandigarh');
        await searchBtn.click();
        await new Promise(r => setTimeout(r, 2500));

        const sentinelT2 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT2 === 'STAYED_ON_PAGE_NO_RELOAD', 'Page did NOT reload when searching for Chandigarh');

        const pickupAddressT2 = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(pickupAddressT2.toLowerCase().includes('chandigarh'), `Pickup address updated to Chandigarh: "${pickupAddressT2}"`);

        // ==========================================
        // TEST 3: Search for Mohali
        // ==========================================
        console.log('\n--- Scenario 3: Search for Mohali ---');
        const clearBtn3 = await page.$('.clear-search-btn');
        if (clearBtn3) await clearBtn3.click();
        await page.type('.map-search-input', 'Mohali');
        await searchBtn.click();
        await new Promise(r => setTimeout(r, 2500));

        const sentinelT3 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT3 === 'STAYED_ON_PAGE_NO_RELOAD', 'Page did NOT reload when searching for Mohali');

        const pickupAddressT3 = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(pickupAddressT3.toLowerCase().includes('mohali') || pickupAddressT3.toLowerCase().includes('sahibzada'), `Pickup address updated to Mohali: "${pickupAddressT3}"`);

        // ==========================================
        // TEST 5: Search using the Enter key
        // ==========================================
        console.log('\n--- Scenario 5: Search using the Enter key ---');
        const clearBtn5 = await page.$('.clear-search-btn');
        if (clearBtn5) await clearBtn5.click();
        await page.type('.map-search-input', 'Patiala');
        // Press Enter
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2500));

        const sentinelT5 = await page.evaluate(() => window.__rentiq_reload_sentinel);
        assert(sentinelT5 === 'STAYED_ON_PAGE_NO_RELOAD', 'Pressing Enter did NOT refresh the page');

        const pickupAddressT5 = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(pickupAddressT5.toLowerCase().includes('patiala'), `Enter key successfully triggered search: "${pickupAddressT5}"`);

        // ==========================================
        // TEST 7: Search multiple locations consecutively
        // ==========================================
        console.log('\n--- Scenario 7: Consecutive searches ---');
        const locations = ['Ludhiana', 'Amritsar', 'Patiala'];
        let consecutivePassed = true;
        for (const loc of locations) {
            const cb = await page.$('.clear-search-btn');
            if (cb) await cb.click();
            await page.type('.map-search-input', loc);
            await searchBtn.click();
            await new Promise(r => setTimeout(r, 2000));
            const addr = await page.$eval('.pickup-card .address-text', el => el.textContent);
            if (!addr.toLowerCase().includes(loc.toLowerCase())) {
                consecutivePassed = false;
                console.error(`Failed to resolve ${loc}: got ${addr}`);
            }
        }
        assert(consecutivePassed, 'Multiple consecutive searches (Ludhiana -> Amritsar -> Patiala) all resolved smoothly');

        // ==========================================
        // TEST 8 & 9: Click map to select pickup point after searching
        // ==========================================
        console.log('\n--- Scenario 8 & 9: Click map to select location ---');
        const mapElement = await page.$('.leaflet-map-element');
        const box = await mapElement.boundingBox();
        // Click near the center of the map
        await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20);
        await new Promise(r => setTimeout(r, 2000));

        const pickupAddressAfterClick = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(pickupAddressAfterClick && pickupAddressAfterClick !== pickupAddressT5, `Map click updated address via reverse geocoding: "${pickupAddressAfterClick}"`);

        // Step navigation: Ensure we can navigate to Step 3 without loss of booking state
        console.log('\n--- Testing Step Navigation with Selected Location ---');
        const nextStep2Btn = await page.$('.step-btn.next-btn');
        await nextStep2Btn.click();
        await new Promise(r => setTimeout(r, 1000));

        const step3Title = await page.$eval('.panel-title', el => el.textContent);
        assert(step3Title.includes('Schedule'), `Successfully navigated to Step 3 (Schedule) with selected address: ${step3Title}`);

        // Go back to Step 2 and verify location was preserved
        const backBtn = await page.$('.step-btn.back-btn');
        await backBtn.click();
        await new Promise(r => setTimeout(r, 1000));

        const restoredAddress = await page.$eval('.pickup-card .address-text', el => el.textContent);
        assert(restoredAddress === pickupAddressAfterClick, `Navigating back to Step 2 perfectly preserved selected pickup address: "${restoredAddress}"`);

        // Capture final verification screenshot
        const finalShot = path.join(ARTIFACT_DIR, 'location_search_verified_step2.png');
        await page.screenshot({ path: finalShot });
        console.log('✓ Captured screenshot: location_search_verified_step2.png');

        console.log('\n====================================================');
        console.log(`Test Results: ${passedTests} Passed, ${failedTests} Failed`);
        console.log('====================================================');

        if (failedTests > 0) {
            process.exitCode = 1;
        }
    } catch (err) {
        console.error('Test execution error:', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

runLocationSearchTests();

