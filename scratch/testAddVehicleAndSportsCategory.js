const puppeteer = require('C:/Projects/RentIQ/backend/node_modules/puppeteer-core');
const path = require('path');
const db = require('../backend/config/db');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FRONTEND_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:/Users/arora/.gemini/antigravity/brain/3fec6bd4-2241-4393-88b5-00f3e39c9bf1';

async function runTests() {
    console.log('============================================================');
    console.log('RentIQ Add Vehicle & Sports Category Automated Verification');
    console.log('============================================================\n');

    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,1050']
    });

    let createdVehicleId = null;

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1050 });

        // Handle browser dialogs if any
        page.on('dialog', async dialog => {
            console.log('  [DIALOG]:', dialog.message());
            await dialog.accept();
        });

        // ----------------------------------------------------
        // Step 1: Admin Login
        // ----------------------------------------------------
        console.log('1. Admin Login at /login...');
        await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 500));
        await page.type('#email', 'admin@rentiq.com');
        await page.type('#password', 'Admin@123');
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));

        // ----------------------------------------------------
        // Step 2: Navigate to Admin Vehicles
        // ----------------------------------------------------
        console.log('2. Navigating to Admin Vehicles (/admin/vehicles)...');
        await page.goto(`${FRONTEND_URL}/admin/vehicles`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        // ----------------------------------------------------
        // Step 3: Test Failed Creation keeps form open and preserves data
        // ----------------------------------------------------
        console.log('3. Testing Failed Submission (Preserves Form & Data)...');
        await page.click('button.admin-vehicles-primary-btn');
        await page.waitForSelector('.admin-vehicle-modal', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 600));

        // Fill Name but invalid seating / price to trigger client/server validation
        await page.type('#vehicle-name', 'Test Vehicle Incomplete');
        // Clear price and leave invalid
        await page.click('#vehicle-price', { clickCount: 3 });
        await page.keyboard.press('Backspace');
        await page.type('#vehicle-price', '-50'); // Invalid price <= 0

        // Click submit
        const submitBtn = await page.$('.modal-submission-buttons button[type="submit"]');
        await submitBtn.click();
        await new Promise(r => setTimeout(r, 800));

        // Verify modal remains open
        const modalStillOpen = await page.$('.admin-vehicle-modal');
        if (!modalStillOpen) throw new Error('Expected modal to remain open on validation failure');

        // Verify preserved input
        const nameVal = await page.$eval('#vehicle-name', el => el.value);
        if (nameVal !== 'Test Vehicle Incomplete') throw new Error(`Expected preserved name, got: ${nameVal}`);

        // Capture screenshot of failed form preservation
        const failedFormPath = path.join(ARTIFACT_DIR, 'admin_vehicles_failed_form_preserved.png');
        await page.screenshot({ path: failedFormPath, fullPage: false });
        console.log(`  PASSED: Failed submission kept form open and preserved entered data. Saved: ${failedFormPath}`);

        // Cancel modal
        await page.click('.modal-submission-buttons button.admin-vehicles-secondary-btn');
        await new Promise(r => setTimeout(r, 500));

        // ----------------------------------------------------
        // Step 4: Test Sports appears in Category Dropdown & Add Sports Vehicle
        // ----------------------------------------------------
        console.log('4. Opening Add Vehicle form and checking Sports category...');
        await page.click('button.admin-vehicles-primary-btn');
        await page.waitForSelector('.admin-vehicle-modal', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 600));

        // Check options in category dropdown
        const categoriesOptions = await page.$$eval('#vehicle-category option', opts => opts.map(o => ({
            text: o.textContent.trim(),
            val: o.value
        })));
        console.log('  Category dropdown options:', categoriesOptions.map(o => o.text));

        const sportsOption = categoriesOptions.find(o => o.text === 'Sports');
        if (!sportsOption) {
            throw new Error('Sports category option not found in #vehicle-category dropdown!');
        }

        // Verify the requested category list is present
        const expectedCategories = ['SUV', 'Sedan', 'Hatchback', 'MUV', 'Luxury', 'Sports', 'Other'];
        for (const exp of expectedCategories) {
            const found = categoriesOptions.some(o => o.text === exp);
            if (!found) throw new Error(`Expected category "${exp}" not found in dropdown!`);
        }
        console.log('  PASSED: All standard categories (SUV, Sedan, Hatchback, MUV, Luxury, Sports, Other) present in dropdown.');

        // Select Sports category
        await page.select('#vehicle-category', sportsOption.val);

        // Fill out complete Sports car data (Porsche 911 GT3)
        const timestamp = Date.now().toString().slice(-4);
        const testRegNumber = `MH02SP${timestamp}`;
        await page.type('#vehicle-name', 'Porsche 911');
        await page.type('#vehicle-brand', 'Porsche');
        await page.type('#vehicle-model', 'GT3 RS');
        await page.type('#vehicle-color', 'Guards Red');
        await page.type('#vehicle-price', '25000');
        await page.type('#vehicle-description', 'Track-focused, high-performance sports car engineered with precision aerodynamics and raw flat-six power.');

        // Next to Technical Specs
        await page.evaluate(() => {
            const nextBtns = Array.from(document.querySelectorAll('button.admin-vehicles-secondary-btn'));
            const techBtn = nextBtns.find(b => b.textContent.includes('Next: Technical Specs'));
            if (techBtn) techBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));

        await page.type('#tech-doors', '2');
        await page.type('#tech-boot', '132 L');

        // Next to Registration Details
        await page.evaluate(() => {
            const nextBtns = Array.from(document.querySelectorAll('button.admin-vehicles-secondary-btn'));
            const regBtn = nextBtns.find(b => b.textContent.includes('Next: Registration Details'));
            if (regBtn) regBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));

        await page.type('#reg-number', testRegNumber);
        await page.type('#reg-state', 'Maharashtra');

        // Switch back to Basic tab to capture screenshot with Sports selected
        await page.click('button.modal-tab-pill:first-child');
        await new Promise(r => setTimeout(r, 400));

        const addDropdownPath = path.join(ARTIFACT_DIR, 'admin_vehicles_add_sports_dropdown.png');
        await page.screenshot({ path: addDropdownPath, fullPage: false });
        console.log(`  Saved Add Vehicle Form with Sports category: ${addDropdownPath}`);

        // ----------------------------------------------------
        // Step 5: Submit and Verify Auto-Close & Success Notification
        // ----------------------------------------------------
        console.log('5. Submitting Add Vehicle form...');
        const addSubmitBtn = await page.$('.modal-submission-buttons button[type="submit"]');
        await addSubmitBtn.click();

        // Wait for modal to automatically close
        await page.waitForSelector('.admin-vehicle-modal-backdrop', { hidden: true, timeout: 8000 });
        console.log('  PASSED: Add Vehicle modal automatically closed after successful creation!');

        // Wait for success alert
        await page.waitForSelector('.admin-vehicles-success-alert', { timeout: 5000 });
        const successText = await page.$eval('.admin-vehicles-success-alert', el => el.textContent.trim());
        console.log(`  PASSED: Success notification displayed: "${successText}"`);
        if (!successText.includes('Vehicle added successfully!')) {
            throw new Error(`Expected "Vehicle added successfully!", got: "${successText}"`);
        }

        // Verify the newly added vehicle appears immediately in the table
        await new Promise(r => setTimeout(r, 1000));
        const vehicleNames = await page.$$eval('strong.vehicle-name-title', els => els.map(el => el.textContent.trim()));
        console.log('  First few vehicles in table:', vehicleNames.slice(0, 5));
        if (!vehicleNames.includes('Porsche 911')) {
            throw new Error('Newly created vehicle "Porsche 911" does not appear in vehicle table!');
        }
        console.log('  PASSED: "Porsche 911" appears immediately in the Admin Vehicle list without manual page reload.');

        // Capture screenshot of vehicle list with success alert and new vehicle
        const addSuccessPath = path.join(ARTIFACT_DIR, 'admin_vehicles_added_success.png');
        await page.screenshot({ path: addSuccessPath, fullPage: false });
        console.log(`  Saved Admin Vehicles with Success Banner: ${addSuccessPath}`);

        // ----------------------------------------------------
        // Step 6: Verify in MySQL Database
        // ----------------------------------------------------
        console.log('6. Verifying Sports vehicle in MySQL database...');
        const [dbRows] = await db.query(
            `SELECT v.vehicle_id, v.name, v.brand, v.model, v.registration_number, c.name as category_name
             FROM vehicles v
             JOIN categories c ON v.category_id = c.category_id
             WHERE v.registration_number = ?`,
            [testRegNumber]
        );
        if (dbRows.length === 0) {
            throw new Error(`Vehicle with registration ${testRegNumber} not found in MySQL!`);
        }
        const createdVeh = dbRows[0];
        createdVehicleId = createdVeh.vehicle_id;
        console.log('  MySQL row:', createdVeh);
        if (createdVeh.category_name !== 'Sports') {
            throw new Error(`Expected category "Sports", got: "${createdVeh.category_name}"`);
        }
        // Add valid compliance documents for the new sports vehicle
        await db.query(`
            INSERT INTO vehicle_documents (vehicle_id, document_type, document_number, issue_date, expiry_date, file_path, verification_status)
            VALUES
                (?, 'rc', CONCAT('RC-', ?), '2024-01-01', '2039-01-01', 'sports_rc.pdf', 'valid'),
                (?, 'insurance', CONCAT('INS-', ?), '2024-01-01', '2029-01-01', 'sports_ins.pdf', 'valid'),
                (?, 'puc', CONCAT('PUC-', ?), '2024-01-01', '2029-01-01', 'sports_puc.pdf', 'valid')
        `, [createdVeh.vehicle_id, testRegNumber, createdVeh.vehicle_id, testRegNumber, createdVeh.vehicle_id, testRegNumber]);

        // ----------------------------------------------------
        // Step 7: Test Admin Category Filter (Sports)
        // ----------------------------------------------------
        console.log('7. Testing Admin Vehicle Category Filter for "Sports"...');
        await page.select('#category-filter', 'Sports');
        await new Promise(r => setTimeout(r, 600));

        const filteredRowsCount = await page.$$eval('.admin-vehicles-table tbody tr:not(.empty-state-row)', rows => rows.length);
        console.log(`  Filtered vehicles count for category "Sports": ${filteredRowsCount}`);
        const filteredCategories = await page.$$eval('.vehicle-cat-tag', tags => tags.map(t => t.textContent.trim()));
        console.log('  Rendered category tags in table:', filteredCategories);
        if (filteredCategories.some(c => c !== 'Sports')) {
            throw new Error('Non-Sports vehicles found when filtering by category "Sports"!');
        }
        console.log('  PASSED: Admin category filtering works exclusively for "Sports".');

        const adminFilterPath = path.join(ARTIFACT_DIR, 'admin_vehicles_sports_filter.png');
        await page.screenshot({ path: adminFilterPath, fullPage: false });
        console.log(`  Saved Admin Filtered View: ${adminFilterPath}`);

        // Reset filter
        await page.select('#category-filter', 'all');
        await new Promise(r => setTimeout(r, 400));

        // ----------------------------------------------------
        // Step 8: Test Edit Vehicle preserves Sports category
        // ----------------------------------------------------
        console.log('8. Testing Edit Vehicle preserves "Sports" category...');
        // Search for our created vehicle
        await page.type('#vehicle-search', testRegNumber);
        await new Promise(r => setTimeout(r, 600));

        const editBtn = await page.$('button.admin-vehicle-edit-btn');
        if (!editBtn) throw new Error('Edit button not found for created vehicle!');
        await editBtn.click();
        await page.waitForSelector('.admin-vehicle-modal', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 600));

        const editSelectedCategory = await page.$eval('#vehicle-category', el => {
            const opt = el.options[el.selectedIndex];
            return opt ? opt.textContent.trim() : '';
        });
        console.log(`  Selected category in Edit Vehicle: "${editSelectedCategory}"`);
        if (editSelectedCategory !== 'Sports') {
            throw new Error(`Expected "Sports" to be selected in Edit Vehicle, got: "${editSelectedCategory}"`);
        }
        console.log('  PASSED: Edit Vehicle form correctly preserves "Sports" category!');

        const editSportsPath = path.join(ARTIFACT_DIR, 'admin_vehicle_edit_sports.png');
        await page.screenshot({ path: editSportsPath, fullPage: false });
        console.log(`  Saved Edit Vehicle View: ${editSportsPath}`);

        // Close edit modal
        await page.click('.modal-submission-buttons button.admin-vehicles-secondary-btn');
        await new Promise(r => setTimeout(r, 500));

        // ----------------------------------------------------
        // Step 9: Customer Catalog - Sports Filter & Badge
        // ----------------------------------------------------
        console.log('9. Navigating to Customer Vehicles Catalog (/vehicles)...');
        await page.goto(`${FRONTEND_URL}/vehicles`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1200));

        // Verify Sports appears in category filter
        const custCategories = await page.$$eval('#filter-category option', opts => opts.map(o => o.textContent.trim()));
        console.log('  Customer category filter options:', custCategories);
        if (!custCategories.includes('Sports')) {
            throw new Error('Sports category not found in customer category filter dropdown!');
        }

        // Filter by Sports
        console.log('  Selecting "Sports" category in customer filter...');
        await page.select('#filter-category', 'sports');
        await new Promise(r => setTimeout(r, 1500));

        // Verify vehicle cards have SPORTS badge
        const badgePills = await page.$$eval('.vehicle-badge-pill', pills => pills.map(p => p.textContent.trim()));
        console.log('  Badges on displayed vehicle cards:', badgePills);
        if (!badgePills.includes('SPORTS') && !badgePills.includes('Sports')) {
            throw new Error('Vehicle card did not render "SPORTS" badge!');
        }
        console.log('  PASSED: Customer catalog renders "SPORTS" category badge on vehicle card.');

        const custCatalogPath = path.join(ARTIFACT_DIR, 'customer_catalog_sports_filter.png');
        await page.screenshot({ path: custCatalogPath, fullPage: false });
        console.log(`  Saved Customer Catalog Filtered by Sports: ${custCatalogPath}`);

        // ----------------------------------------------------
        // Step 10: Customer Vehicle Details Page - Sports Category
        // ----------------------------------------------------
        console.log(`10. Navigating to Customer Vehicle Details (/vehicles/${createdVehicleId})...`);
        await page.goto(`${FRONTEND_URL}/vehicles/${createdVehicleId}`, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        const detailCatPill = await page.$eval('.vehicle-cat-pill', el => el.textContent.trim());
        console.log(`  Category pill on Vehicle Details page: "${detailCatPill}"`);
        if (detailCatPill.toLowerCase() !== 'sports') {
            throw new Error(`Expected category pill "Sports", got: "${detailCatPill}"`);
        }
        console.log('  PASSED: Vehicle Details page displays "Sports" category pill!');

        const custDetailsPath = path.join(ARTIFACT_DIR, 'customer_vehicle_details_sports.png');
        await page.screenshot({ path: custDetailsPath, fullPage: false });
        console.log(`  Saved Customer Vehicle Details Page: ${custDetailsPath}`);

        console.log('\n============================================================');
        console.log('ALL 10 VERIFICATION SCENARIOS PASSED WITH ZERO ERRORS!');
        console.log('============================================================\n');

    } finally {
        await browser.close();
    }
}

runTests().catch(err => {
    console.error('\nVerification FAILED:', err);
    process.exit(1);
});
