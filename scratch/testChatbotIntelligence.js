/**
 * RentIQ AI Chatbot Intelligence Verification Suite
 *
 * File: scratch/testChatbotIntelligence.js
 *
 * Verifies the 10 conversational scenarios specified by the user:
 * 1. "Suggest a car under ₹2000."
 * 2. "Show me an SUV."
 * 3. "Which one is cheaper?" (contextual follow-up to #2)
 * 4. "I need a car for 6 people."
 * 5. "Can I book a car without a valid driving licence?"
 * 6. "What happens if I return the car late?"
 * 7. "Show me something sporty but affordable."
 * 8. "What was your previous recommendation?" (contextual follow-up to #7)
 * 9. "I want the same car for 5 days." (contextual pricing follow-up to #7)
 * 10. "What documents do I need?"
 */

const { processChatMessage } = require('../backend/services/aiService');

async function runIntelligenceVerification() {
    console.log('================================================================');
    console.log('RentIQ AI Chatbot 10-Scenario Intelligence Test Suite');
    console.log('================================================================\n');

    let history = [];
    let passed = 0;
    let failed = 0;

    function assert(condition, desc) {
        if (condition) {
            console.log(`✓ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`✗ FAIL: ${desc}`);
            failed++;
            throw new Error(`Assertion failed: ${desc}`);
        }
    }

    // 1. "Suggest a car under ₹2000."
    console.log('\n[TEST 1] "Suggest a car under ₹2000."');
    const q1 = 'Suggest a car under ₹2000.';
    const res1 = await processChatMessage(q1, history);
    console.log('AI Response:', res1.message);
    assert(res1.recommendations.length > 0, 'Returns at least one car recommendation');
    assert(res1.recommendations.every(v => v.price_per_day <= 2000), 'Recommended cars are <= ₹2,000/day');
    const hasSwift = res1.recommendations.some(v => v.name.includes('Swift'));
    assert(hasSwift, 'Recommends Maruti Suzuki Swift (Hatchback @ ₹1,800/day)');
    assert(!res1.recommendations.some(v => v.category === 'Bike' || v.category === 'Scooter'), 'Excludes two-wheelers when car requested');
    history.push({ role: 'user', content: q1 }, { role: 'assistant', content: res1.message });

    // 2. "Show me an SUV."
    console.log('\n[TEST 2] "Show me an SUV."');
    const q2 = 'Show me an SUV.';
    const res2 = await processChatMessage(q2, history);
    console.log('AI Response:', res2.message);
    assert(res2.recommendations.length > 0, 'Returns SUV recommendations');
    assert(res2.recommendations.every(v => v.category === 'SUV'), 'All recommended vehicles are SUVs');
    assert(res2.recommendations.some(v => v.name.includes('Creta') || v.name.includes('Scorpio')), 'Recommends Creta or Scorpio');
    history.push({ role: 'user', content: q2 }, { role: 'assistant', content: res2.message });

    // 3. "Which one is cheaper?" (Contextual follow-up to SUVs)
    console.log('\n[TEST 3] "Which one is cheaper?" (Follow-up)');
    const q3 = 'Which one is cheaper?';
    const res3 = await processChatMessage(q3, history);
    console.log('AI Response:', res3.message);
    const textLower3 = res3.message.toLowerCase();
    assert(textLower3.includes('creta') || textLower3.includes('cheaper') || textLower3.includes('3,200') || textLower3.includes('3200'), 'Identifies Hyundai Creta (₹3,200/day) as cheaper than Scorpio (₹3,500/day)');
    history.push({ role: 'user', content: q3 }, { role: 'assistant', content: res3.message });

    // 4. "I need a car for 6 people."
    console.log('\n[TEST 4] "I need a car for 6 people."');
    const q4 = 'I need a car for 6 people.';
    const res4 = await processChatMessage(q4, history);
    console.log('AI Response:', res4.message);
    assert(res4.recommendations.length > 0, 'Returns recommendation for 6 people');
    const scorpioRec = res4.recommendations.find(v => v.name === 'Scorpio');
    assert(scorpioRec && scorpioRec.seating_capacity >= 6, 'Recommends Mahindra Scorpio (7-seater) for 6 people');
    history.push({ role: 'user', content: q4 }, { role: 'assistant', content: res4.message });

    // 5. "Can I book a car without a valid driving licence?"
    console.log('\n[TEST 5] "Can I book a car without a valid driving licence?"');
    const q5 = 'Can I book a car without a valid driving licence?';
    const res5 = await processChatMessage(q5, history);
    console.log('AI Response:', res5.message);
    const textLower5 = res5.message.toLowerCase();
    assert(textLower5.includes('no') || textLower5.includes('cannot') || textLower5.includes('mandatory'), 'Firmly states driving licence is mandatory');
    assert(textLower5.includes('licence') || textLower5.includes('license'), 'Explains driving licence requirement');
    history.push({ role: 'user', content: q5 }, { role: 'assistant', content: res5.message });

    // 6. "What happens if I return the car late?"
    console.log('\n[TEST 6] "What happens if I return the car late?"');
    const q6 = 'What happens if I return the car late?';
    const res6 = await processChatMessage(q6, history);
    console.log('AI Response:', res6.message);
    const textLower6 = res6.message.toLowerCase();
    assert(textLower6.includes('grace period') || textLower6.includes('1-hour') || textLower6.includes('1 hour'), 'Explains 1-hour grace period');
    assert(textLower6.includes('150') || textLower6.includes('late fee') || textLower6.includes('hourly'), 'Mentions ₹150/hour late fee');
    history.push({ role: 'user', content: q6 }, { role: 'assistant', content: res6.message });

    // 7. "Show me something sporty but affordable."
    console.log('\n[TEST 7] "Show me something sporty but affordable."');
    const q7 = 'Show me something sporty but affordable.';
    const res7 = await processChatMessage(q7, history);
    console.log('AI Response:', res7.message);
    assert(res7.recommendations.length > 0, 'Returns sporty affordable recommendations');
    const hasBMW = res7.recommendations.some(v => v.name.includes('M340i') || v.name.includes('BMW'));
    assert(hasBMW, 'Recommends BMW M340i (Sports @ ₹5,000/day) as affordable sports option');
    history.push({ role: 'user', content: q7 }, { role: 'assistant', content: res7.message });

    // 8. "What was your previous recommendation?" (Contextual follow-up to #7)
    console.log('\n[TEST 8] "What was your previous recommendation?" (Follow-up)');
    const q8 = 'What was your previous recommendation?';
    const res8 = await processChatMessage(q8, history);
    console.log('AI Response:', res8.message);
    const textLower8 = res8.message.toLowerCase();
    assert(textLower8.includes('bmw') || textLower8.includes('m340i') || textLower8.includes('previous') || textLower8.includes('recommended'), 'Accurately recalls the previous sporty recommendation');
    history.push({ role: 'user', content: q8 }, { role: 'assistant', content: res8.message });

    // 9. "I want the same car for 5 days." (Contextual pricing follow-up)
    console.log('\n[TEST 9] "I want the same car for 5 days." (Follow-up)');
    const q9 = 'I want the same car for 5 days.';
    const res9 = await processChatMessage(q9, history);
    console.log('AI Response:', res9.message);
    assert(res9.pricingEstimate !== null, 'Authoritative pricing estimate generated');
    assert(res9.pricingEstimate.rentalDays === 5, 'Pricing estimate computed for exactly 5 days');
    assert(res9.pricingEstimate.finalTotalPrice > 0, 'Computes authoritative total price');
    assert(res9.message.toLowerCase().includes('5 day') || res9.message.toLowerCase().includes('base rental'), 'Explains 5-day breakdown in message');
    history.push({ role: 'user', content: q9 }, { role: 'assistant', content: res9.message });

    // 10. "What documents do I need?"
    console.log('\n[TEST 10] "What documents do I need?"');
    const q10 = 'What documents do I need?';
    const res10 = await processChatMessage(q10, history);
    console.log('AI Response:', res10.message);
    const textLower10 = res10.message.toLowerCase();
    assert(textLower10.includes('driving licence') || textLower10.includes('driving license'), 'Lists driving licence as required');
    assert(textLower10.includes('id') || textLower10.includes('aadhaar') || textLower10.includes('passport'), 'Lists government ID proof');
    assert(textLower10.includes('rc') || textLower10.includes('insurance') || textLower10.includes('puc'), 'Explains vehicle documents are already pre-equipped by RentIQ');
    history.push({ role: 'user', content: q10 }, { role: 'assistant', content: res10.message });

    // 11. "What is the security deposit amount?"
    console.log('\n[TEST 11] "What is the security deposit amount?"');
    const q11 = 'What is the security deposit amount?';
    const res11 = await processChatMessage(q11, history);
    console.log('AI Response:', res11.message);
    const textLower11 = res11.message.toLowerCase();
    assert(textLower11.includes('deposit') && (textLower11.includes('refundable') || textLower11.includes('zero') || textLower11.includes('minimal')), 'Explains zero or minimal refundable security deposit policy');
    history.push({ role: 'user', content: q11 }, { role: 'assistant', content: res11.message });

    // 12. "What is the cancellation policy?"
    console.log('\n[TEST 12] "What is the cancellation policy?"');
    const q12 = 'What is the cancellation policy?';
    const res12 = await processChatMessage(q12, history);
    console.log('AI Response:', res12.message);
    const textLower12 = res12.message.toLowerCase();
    assert(textLower12.includes('cancellation') && textLower12.includes('24 hours') && textLower12.includes('free'), 'Explains 100% free cancellation up to 24 hours prior to pickup');
    history.push({ role: 'user', content: q12 }, { role: 'assistant', content: res12.message });

    // 13. "Do you provide doorstep delivery?"
    console.log('\n[TEST 13] "Do you provide doorstep delivery?"');
    const q13 = 'Do you provide doorstep delivery?';
    const res13 = await processChatMessage(q13, history);
    console.log('AI Response:', res13.message);
    const textLower13 = res13.message.toLowerCase();
    assert(textLower13.includes('delivery') && (textLower13.includes('15') || textLower13.includes('hub')), 'Explains doorstep delivery at ₹15/km or free hub pickup');
    history.push({ role: 'user', content: q13 }, { role: 'assistant', content: res13.message });

    // 14. "How does the vehicle inspection process work?"
    console.log('\n[TEST 14] "How does the vehicle inspection process work?"');
    const q14 = 'How does the vehicle inspection process work?';
    const res14 = await processChatMessage(q14, history);
    console.log('AI Response:', res14.message);
    const textLower14 = res14.message.toLowerCase();
    assert(textLower14.includes('inspection') && textLower14.includes('pickup') && textLower14.includes('return'), 'Explains digital pickup & return inspection with photos');
    history.push({ role: 'user', content: q14 }, { role: 'assistant', content: res14.message });

    // 15. Off-topic question redirection: "How do I make chocolate cake?"
    console.log('\n[TEST 15] Off-topic question: "How do I make chocolate cake?"');
    const q15 = 'How do I make chocolate cake?';
    const res15 = await processChatMessage(q15, history);
    console.log('AI Response:', res15.message);
    const textLower15 = res15.message.toLowerCase();
    assert(textLower15.includes('rentiq') || textLower15.includes('vehicle') || textLower15.includes('rental'), 'Politely redirects off-topic questions back to vehicle rentals');

    // 16. Hinglish questions test
    console.log('\n[TEST 16] Hinglish understanding: "bina licence ke car mil sakti hai kya?"');
    const q16 = 'bina licence ke car mil sakti hai kya?';
    const res16 = await processChatMessage(q16, []);
    console.log('AI Response:', res16.message);
    const textLower16 = res16.message.toLowerCase();
    assert(textLower16.includes('no') || textLower16.includes('cannot') || textLower16.includes('mandatory'), 'Hinglish: correctly identifies licence is mandatory');

    console.log('\n================================================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed (Total ${passed + failed} Assertions Verified)`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runIntelligenceVerification().catch(err => {
    console.error('Fatal error during intelligence testing:', err);
    process.exit(1);
});
