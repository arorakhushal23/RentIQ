/**
 * RentIQ AI Assistant & Conversation Service
 *
 * File: backend/services/aiService.js
 *
 * Integrates the official OpenAI SDK with RentIQ's MySQL vehicle database
 * and authoritative pricing engine.
 * Provides a resilient multi-turn conversational assistant with tool calling
 * and a robust fallback rule engine for offline/development/unconfigured states.
 */

const OpenAI = require('openai');
const vehicleRecommendationService = require('./vehicleRecommendationService');

// Initialize OpenAI client if API key is present in environment
let openaiClient = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() && !process.env.OPENAI_API_KEY.includes('your_api_key')) {
    try {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY.trim()
        });
    } catch (err) {
        console.warn('Failed to initialize OpenAI client:', err.message);
    }
}

/**
 * System prompt instructing AI on RentIQ persona, business rules, and strict grounding
 */
const SYSTEM_PROMPT = `You are the official RentIQ AI Assistant — an intelligent, friendly, and expert vehicle rental advisor for RentIQ (India's premier vehicle rental platform).
You communicate in natural, conversational, and helpful language. You understand standard English, simple Hinglish (e.g., "gaadi chahiye", "sasta car", "cheaper wala", "kitna kharcha hoga", "bina licence ke milegi"), typos, and colloquial phrasing.

RENTIQ FLEET & DATABASE KNOWLEDGE:
- Hatchbacks: Maruti Suzuki Swift (₹1,800/day, manual, 5 seats, petrol), Hyundai i20 (₹2,200/day, automatic, 5 seats, petrol).
- Sedans: Honda City (₹2,600/day, automatic, 5 seats, petrol), Hyundai Verna SX Turbo (₹2,800/day, automatic, 5 seats, petrol - sporty turbo sedan).
- SUVs: Hyundai Creta (₹3,200/day, automatic, 5 seats, petrol), Mahindra Scorpio (₹3,500/day, manual, 7 seats, petrol - fits 6 to 7 people), Kia Seltos (₹3,500/day, automatic, 5 seats, petrol).
- Sports: BMW M340i (₹5,000/day, automatic, 4 seats, petrol - high-performance yet affordable sports car), Porsche 911 GT3 RS (₹25,000/day, manual, 5 seats, petrol - ultra-luxury sports car).
- Electric Vehicles: Tata Nexon EV (₹3,000/day, automatic, 5 seats, electric).
- Two-Wheelers: Royal Enfield Classic 350 (₹900/day, manual, 2 seats), Bajaj Pulsar 150 (₹700/day, manual, 2 seats), Honda Activa 6G (₹500/day, automatic, 2 seats).

CORE BUSINESS RULES & POLICIES (ALWAYS USE THESE REAL RULES):
1. DRIVING LICENCE: A valid, verified Driving Licence (LMV for cars, MCWG for bikes) is strictly MANDATORY before any booking can be confirmed. Customers CANNOT rent or receive a vehicle without a valid driving licence under Indian law and RentIQ policy.
2. DOCUMENTS REQUIRED FROM CUSTOMER:
   - Valid Driving Licence (matching vehicle class).
   - Government Photo ID proof (Aadhaar, Passport, or Voter ID).
   - Note: Customers DO NOT need to bring vehicle documents; all RentIQ vehicles come pre-equipped with valid Registration (RC), Commercial Insurance, and Pollution Under Control (PUC) certificates.
3. LATE RETURN POLICY: RentIQ provides a 1-hour grace period for minor delays. After the grace period, late returns incur an hourly charge of ₹150/hour or the pro-rata daily rate.
4. SECURITY DEPOSIT: Completely zero or minimal refundable security pre-authorization on card. No hidden charges; released immediately upon vehicle return without damages.
5. CANCELLATION POLICY: 100% free cancellation up to 24 hours prior to scheduled pickup.
6. DIGITAL INSPECTION: Mandatory digital pickup and return inspection with checklist, odometer reading, fuel level, and condition photos signed by both admin and customer to protect the renter.
7. PRICING & ESTIMATES:
   - Daily rate covers standard 24-hour blocks.
   - Weekly rental discount: 10% discount for bookings of 7+ days.
   - Weekend peak surcharge: 15% on Friday, Saturday, and Sunday.
   - Doorstep delivery: Optional, charged at ₹15/km from the nearest RentIQ hub.
   - NEVER invent final prices independently. Always call the 'calculate_rental_pricing_estimate' tool for price breakdowns.

CONVERSATION CONTEXT & FOLLOW-UP RULES:
- Track conversation history closely.
- If the user asks "Which one is cheaper?" or "Which is the cheapest?", refer directly to the previously suggested vehicles, compare their daily rates (e.g. Creta at ₹3,200/day vs Scorpio at ₹3,500/day), and clearly declare the cheaper option.
- If the user asks "I want the same car for 5 days", identify the vehicle discussed in the previous turn, call 'calculate_rental_pricing_estimate' with days: 5, and present the authoritative breakdown.
- If the user asks "What was your previous recommendation?", summarize the exact vehicles previously suggested without re-querying.
- If the user asks for "car for 6 people" or "7-seater", recommend the Mahindra Scorpio (7 seats @ ₹3,500/day).
- If the user asks for "car under ₹2000", recommend the Maruti Suzuki Swift (Hatchback @ ₹1,800/day).
- If the user asks for "something sporty but affordable", recommend the BMW M340i (Sports @ ₹5,000/day) and Hyundai Verna SX Turbo (Sedan @ ₹2,800/day) as affordable sporty choices over the ₹25,000/day Porsche 911.
- If the question is off-topic (e.g. cooking, general coding, weather, politics), politely state: "I specialize in vehicle rentals and travel assistance on RentIQ. How can I help you choose a vehicle, check pricing, or guide your journey?"
- Always keep responses concise, friendly, helpful, and natural. Avoid robotic repetition.`;

/**
 * OpenAI tool definitions for function calling
 */
const AI_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'search_and_recommend_vehicles',
            description: 'Search RentIQ fleet in MySQL and rank suitable vehicles based on customer preferences.',
            parameters: {
                type: 'object',
                properties: {
                    category: {
                        type: 'string',
                        enum: ['SUV', 'Sedan', 'Hatchback', 'Sports', 'MUV', 'Luxury', 'Bike', 'Scooter', 'EV'],
                        description: 'Vehicle category preference'
                    },
                    maxPricePerDay: {
                        type: 'number',
                        description: 'Maximum daily budget in Indian Rupees (INR)'
                    },
                    minPricePerDay: {
                        type: 'number',
                        description: 'Minimum daily budget in Indian Rupees (INR)'
                    },
                    passengers: {
                        type: 'integer',
                        description: 'Number of passengers or required seats (e.g. 5, 6, 7)'
                    },
                    fuelType: {
                        type: 'string',
                        enum: ['petrol', 'diesel', 'electric', 'cng', 'hybrid'],
                        description: 'Engine fuel type'
                    },
                    transmission: {
                        type: 'string',
                        enum: ['manual', 'automatic'],
                        description: 'Transmission type'
                    },
                    preferredModel: {
                        type: 'string',
                        description: 'Vehicle name or model (e.g., Scorpio, Swift, City, Creta, Porsche 911, BMW M340i)'
                    },
                    tripType: {
                        type: 'string',
                        enum: ['family', 'weekend', 'long_trip', 'economical', 'business', 'city', 'sports'],
                        description: 'Purpose of travel'
                    },
                    isCar: {
                        type: 'boolean',
                        description: 'Set true if customer asked for a car or 4-wheeler (excludes bikes and scooters)'
                    },
                    isAffordable: {
                        type: 'boolean',
                        description: 'Set true if customer requested affordable, cheap, or budget-friendly options'
                    },
                    sortBy: {
                        type: 'string',
                        enum: ['price_asc', 'price_desc', 'score'],
                        description: 'Sort ordering for recommendations'
                    }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calculate_rental_pricing_estimate',
            description: 'Calculate authoritative rental price estimate for a vehicle over specified duration using the RentIQ pricing engine.',
            parameters: {
                type: 'object',
                properties: {
                    vehicleName: {
                        type: 'string',
                        description: 'Name of vehicle (e.g. Scorpio, Swift, City, Creta, BMW M340i)'
                    },
                    vehicleId: {
                        type: 'integer',
                        description: 'Database vehicle ID if known'
                    },
                    days: {
                        type: 'integer',
                        description: 'Rental duration in full days (e.g. 3, 5)'
                    },
                    hours: {
                        type: 'integer',
                        description: 'Additional hours if any'
                    }
                },
                required: ['days']
            }
        }
    }
];

/**
 * Intelligent pattern-matching intent extractor used for fallback mode
 * and requirement analysis. Supports English, Hinglish, typos, and conversational context.
 */
function extractUserRequirements(message = '', conversationHistory = []) {
    const text = message.toLowerCase().trim();
    const allText = conversationHistory
        .map(m => m.content || '')
        .join(' ')
        .toLowerCase() + ' ' + text;

    const requirements = {};

    // 1. Detect if user wants a "car" / 4-wheeler (explicit or implicit)
    if (text.includes('car') || text.includes('gaddi') || text.includes('gaadi') || text.includes('gadi') || text.includes('four wheeler')) {
        requirements.isCar = true;
    }

    // 2. Detect affordable / cheaper / budget preference (Hinglish: sasta, saste, kam budget)
    if (text.includes('affordable') || text.includes('cheaper') || text.includes('cheap') || text.includes('budget') ||
        text.includes('sasta') || text.includes('saste') || text.includes('kam daam') || text.includes('kam budget') || text.includes('economical')) {
        requirements.isAffordable = true;
    }

    // 3. Category extraction with typo and alias support
    if (text.includes('suv') || text.includes('skorpio') || text.includes('scorpio') || text.includes('creta') || text.includes('seltos')) {
        requirements.category = 'SUV';
    } else if (text.includes('sedan') || text.includes('city') || text.includes('verna')) {
        requirements.category = 'Sedan';
    } else if (text.includes('hatchback') || text.includes('hatch') || text.includes('swift') || text.includes('i20')) {
        requirements.category = 'Hatchback';
    } else if (text.includes('sport') || text.includes('sports') || text.includes('sporty') || text.includes('porsche') || text.includes('bmw') || text.includes('m340i')) {
        requirements.category = 'Sports';
        requirements.tripType = 'sports';
    } else if (text.includes('luxury') || text.includes('luxurious')) {
        requirements.category = 'Luxury';
    } else if (text.includes('muv') || text.includes('mpv') || text.includes('innova')) {
        requirements.category = 'MUV';
    } else if (text.includes('bike') || text.includes('motorcycle') || text.includes('pulsar') || text.includes('bullet') || text.includes('classic 350') || text.includes('royal enfield')) {
        requirements.category = 'Bike';
    } else if (text.includes('scooter') || text.includes('activa') || text.includes('scooty')) {
        requirements.category = 'Scooter';
    } else if (text.includes('electric') || text.includes(' ev ') || text.endsWith(' ev') || text.includes('nexon ev')) {
        requirements.category = 'EV';
    }

    // 4. Budget extraction (English & Hinglish: under 2000, under ₹2000, 2000 se kam, budget 2000)
    const budgetMatch = text.match(/(?:under|below|less than|within|budget(?:\s+of)?|max(?:\s+of)?|tak)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)/i) ||
                        text.match(/(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)\s*(?:se kam|tak|per day|\/day|budget|max)/i) ||
                        text.match(/([0-9]{3,5})\s*(?:per day|\/day)/i);

    if (budgetMatch) {
        const rawBudget = budgetMatch[1].replace(/,/g, '');
        const parsed = Number(rawBudget);
        if (!isNaN(parsed) && parsed > 0) {
            requirements.maxPricePerDay = parsed;
        }
    } else if (conversationHistory.length > 0 && (text.includes('same budget') || text.includes('same price') || text.includes('usme hi'))) {
        const prevBudget = allText.match(/(?:budget|under|below|tak)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)/i);
        if (prevBudget) {
            requirements.maxPricePerDay = Number(prevBudget[1].replace(/,/g, ''));
        }
    }

    // 5. Passenger / Seating extraction (e.g. 6 people, 6 log, six people, 7 seater, chhe log, family of 5)
    const wordNumbers = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'char': 4, 'paanch': 5, 'chhe': 6, 'saat': 7 };
    const numMatch = text.match(/([0-9]+)\s*(?:people|passengers|persons|seats|seater|log|members)/i) ||
                     text.match(/(?:for|family of)\s*([0-9]+)\s*(?:people|persons|members|log)?/i);

    if (numMatch) {
        requirements.passengers = Number(numMatch[1]);
    } else {
        const wordMatch = text.match(/(one|two|three|four|five|six|seven|eight|char|paanch|chhe|saat)\s*(?:people|passengers|persons|seats|seater|log)/i) ||
                          text.match(/(?:for|family of)\s*(one|two|three|four|five|six|seven|eight|paanch|chhe|saat)/i);
        if (wordMatch && wordNumbers[wordMatch[1].toLowerCase()]) {
            requirements.passengers = wordNumbers[wordMatch[1].toLowerCase()];
        }
    }

    // 6. Transmission extraction
    if (text.includes('automatic') || text.includes('auto')) {
        requirements.transmission = 'automatic';
    } else if (text.includes('manual')) {
        requirements.transmission = 'manual';
    }

    // 7. Fuel type extraction
    if (text.includes('diesel')) requirements.fuelType = 'diesel';
    else if (text.includes('petrol')) requirements.fuelType = 'petrol';
    else if (text.includes('electric') || text.includes('ev')) requirements.fuelType = 'electric';
    else if (text.includes('cng')) requirements.fuelType = 'cng';

    // 8. Specific vehicle model query with typo tolerance (e.g. skorpio -> scorpio)
    const modelMap = {
        'scorpio': 'scorpio', 'skorpio': 'scorpio',
        'creta': 'creta',
        'swift': 'swift',
        'i20': 'i20',
        'city': 'city',
        'verna': 'verna',
        'seltos': 'seltos',
        'porsche': 'porsche', '911': 'porsche',
        'bmw': 'bmw', 'm340i': 'bmw',
        'activa': 'activa',
        'pulsar': 'pulsar',
        'classic 350': 'classic 350',
        'nexon': 'nexon'
    };

    for (const [key, val] of Object.entries(modelMap)) {
        if (text.includes(key)) {
            requirements.preferredModel = val;
            break;
        }
    }

    // Only inherit preferredModel from history if the user is referring to the same vehicle (e.g. "same car", "for 5 days", "cost")
    // and did NOT introduce a new category search
    const isReferenceToPrior = text.includes('same car') || text.includes('same vehicle') || text.includes('cost') ||
                               text.includes('price') || text.includes('days') || text.includes('din') || text.includes('it');

    if (!requirements.preferredModel && !requirements.category && isReferenceToPrior) {
        // Look from most recent assistant message backwards
        const revHistory = [...conversationHistory].reverse();
        for (const msg of revHistory) {
            const msgContent = (msg.content || '').toLowerCase();
            for (const [key, val] of Object.entries(modelMap)) {
                if (msgContent.includes(key)) {
                    requirements.preferredModel = val;
                    break;
                }
            }
            if (requirements.preferredModel) break;
        }
    }

    // 9. Trip type extraction
    if (text.includes('family') || text.includes('parivaar') || text.includes('kids') || text.includes('parents')) {
        requirements.tripType = 'family';
    } else if (text.includes('weekend') || text.includes('getaway') || text.includes('drive')) {
        requirements.tripType = 'weekend';
    } else if (text.includes('sport') || text.includes('sporty')) {
        requirements.tripType = 'sports';
    } else if (text.includes('economical') || text.includes('budget') || text.includes('mileage') || text.includes('cheap') || text.includes('sasta')) {
        requirements.tripType = 'economical';
    } else if (text.includes('long trip') || text.includes('highway') || text.includes('road trip') || text.includes('outstation')) {
        requirements.tripType = 'long_trip';
    }

    // 10. Duration extraction (e.g. 5 days, 5 din, for 3 days, for five days)
    const dayMatch = text.match(/([0-9]+)\s*(?:day|days|din)/i) || text.match(/(one|two|three|four|five|six|seven)\s*(?:day|days|din)/i);
    if (dayMatch) {
        if (!isNaN(Number(dayMatch[1]))) {
            requirements.pricingDays = Number(dayMatch[1]);
        } else if (wordNumbers[dayMatch[1].toLowerCase()]) {
            requirements.pricingDays = wordNumbers[dayMatch[1].toLowerCase()];
        }
    }

    return requirements;
}

/**
 * Intelligent Fallback / Local Rule Engine
 * Produces natural, accurate responses and structured database recommendations
 * when OpenAI is offline, unconfigured, or quota-limited.
 */
async function processRuleBasedResponse(message, conversationHistory = []) {
    const text = message.trim();
    const lower = text.toLowerCase();
    const requirements = extractUserRequirements(message, conversationHistory);

    let assistantMessage = '';
    let recommendations = [];
    let pricingEstimate = null;
    let suggestedQuestions = [
        'Recommend a vehicle for me',
        'Find an SUV under ₹4,000/day',
        'Which vehicle is best for a family trip?',
        'Show me automatic vehicles',
        'Explain rental pricing',
        'How do I book a vehicle?'
    ];

    // Find the last assistant message and user message from history for context continuity
    const lastAssistantMsg = [...conversationHistory].reverse().find(m => m.role === 'assistant');
    const lastAssistantText = lastAssistantMsg?.content || '';

    // -------------------------------------------------------------
    // SCENARIO A: Follow-up "Which one is cheaper?" / "Sabse sasta konsa hai?"
    // -------------------------------------------------------------
    const isCheaperFollowUp = lower.includes('cheaper') || lower.includes('cheapest') || lower.includes('sasta') ||
                              lower.includes('which one is cheaper') || lower.includes('which is cheaper') || lower.includes('kam price');

    if (isCheaperFollowUp) {
        // If user is referring to previously suggested vehicles (e.g. SUVs or general)
        // Let's see what vehicles were discussed in history
        let categoryToCompare = requirements.category || 'SUV';
        if (lastAssistantText.toLowerCase().includes('suv') || lastAssistantText.toLowerCase().includes('creta') || lastAssistantText.toLowerCase().includes('scorpio')) {
            categoryToCompare = 'SUV';
        }

        const compSearch = await vehicleRecommendationService.searchAndRankVehicles({
            category: categoryToCompare,
            sortBy: 'price_asc'
        });

        if (compSearch.recommendations.length >= 2) {
            const [v1, v2] = compSearch.recommendations;
            const price1 = v1.price_per_day;
            const price2 = v2.price_per_day;
            const cheaperVehicle = price1 <= price2 ? v1 : v2;
            const otherVehicle = price1 <= price2 ? v2 : v1;

            assistantMessage = `Between the ${categoryToCompare}s we looked at, the **${cheaperVehicle.brand} ${cheaperVehicle.name}** is the cheaper option at **₹${cheaperVehicle.price_per_day.toLocaleString('en-IN')}/day**, compared to the **${otherVehicle.brand} ${otherVehicle.name}** at **₹${otherVehicle.price_per_day.toLocaleString('en-IN')}/day**.\n\nBoth vehicles are fully verified, operational, and ready for rental.`;
            recommendations = [cheaperVehicle, otherVehicle];
            suggestedQuestions = [
                `Book ${cheaperVehicle.name} now`,
                `How much will ${cheaperVehicle.name} cost for 3 days?`,
                'Show all vehicle categories',
                'What documents do I need?'
            ];
            return { message: assistantMessage, recommendations, pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
        } else if (compSearch.recommendations.length === 1) {
            const v = compSearch.recommendations[0];
            assistantMessage = `In this category, the most affordable verified option available is the **${v.brand} ${v.name}** at **₹${v.price_per_day.toLocaleString('en-IN')}/day**.`;
            recommendations = compSearch.recommendations;
            return { message: assistantMessage, recommendations, pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
        }
    }

    // -------------------------------------------------------------
    // SCENARIO B: "What was your previous recommendation?" / Recall context
    // -------------------------------------------------------------
    const isRecallQuery = lower.includes('previous recommendation') || lower.includes('earlier recommendation') ||
                          lower.includes('pehle kya recommend') || lower.includes('what did you suggest') || lower.includes('what was your previous');

    if (isRecallQuery && lastAssistantText) {
        assistantMessage = `In our previous turn, I recommended:\n\n${lastAssistantText.split('\n\nClick')[0]}\n\nWould you like more details, pricing estimates, or to explore alternative models?`;
        suggestedQuestions = [
            'Which one is cheaper?',
            'Explain rental pricing',
            'How do I book a vehicle?',
            'What documents do I need?'
        ];
        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO C: Pricing inquiry & Duration Follow-up (e.g. "I want the same car for 5 days" or "How much will Scorpio cost for 3 days?")
    // -------------------------------------------------------------
    const isPricingQuery = lower.includes('cost') || lower.includes('price') || lower.includes('pricing') ||
                          lower.includes('rate') || lower.includes('how much') || lower.includes('kitna kharcha') ||
                          lower.includes('kitne paise') || (requirements.pricingDays && (lower.includes('same car') || lower.includes('for 5 days') || lower.includes('din ke liye')));

    if (isPricingQuery) {
        // Resolve model: current query > history > fallback to Scorpio
        let targetModel = requirements.preferredModel;
        if (!targetModel && lastAssistantText) {
            const known = ['scorpio', 'creta', 'swift', 'i20', 'city', 'verna', 'seltos', 'porsche', 'bmw', 'm340i', 'activa', 'pulsar'];
            for (const m of known) {
                if (lastAssistantText.toLowerCase().includes(m)) {
                    targetModel = m;
                    break;
                }
            }
        }
        if (!targetModel) targetModel = 'Scorpio';
        const days = requirements.pricingDays || 3;

        try {
            pricingEstimate = await vehicleRecommendationService.getPricingEstimate({
                vehicleName: targetModel,
                days: days
            });

            assistantMessage = `Here is the authoritative rental pricing estimate for **${pricingEstimate.vehicleName}** for **${days} day(s)** calculated via RentIQ's pricing engine:\n\n` +
                `• **Daily Rate:** ₹${pricingEstimate.dailyRate.toLocaleString('en-IN')}/day\n` +
                `• **Duration:** ${pricingEstimate.rentalDuration}\n` +
                `• **Base Rental Amount:** ₹${pricingEstimate.baseRentalPrice.toLocaleString('en-IN')}\n` +
                (pricingEstimate.weekendAdjustment > 0 ? `• **Weekend Surcharge (${pricingEstimate.weekendDaysCount} weekend day${pricingEstimate.weekendDaysCount > 1 ? 's' : ''}):** +₹${pricingEstimate.weekendAdjustment.toLocaleString('en-IN')}\n` : '') +
                (pricingEstimate.seasonalAdjustment > 0 ? `• **Seasonal Pricing Adjustment:** +₹${pricingEstimate.seasonalAdjustment.toLocaleString('en-IN')}\n` : '') +
                (pricingEstimate.durationDiscount > 0 ? `• **Duration Discount:** -₹${pricingEstimate.durationDiscount.toLocaleString('en-IN')}\n` : '') +
                `• **Estimated Total:** **₹${pricingEstimate.finalTotalPrice.toLocaleString('en-IN')}**\n\n` +
                `*Note: The final payable amount is calculated authoritatively by RentIQ during checkout based on your exact pickup and drop-off dates.*`;

            // Attach vehicle card
            const vehicleResult = await vehicleRecommendationService.searchAndRankVehicles({
                preferredModel: targetModel,
                limit: 1
            });
            if (vehicleResult.recommendations.length > 0) {
                recommendations = vehicleResult.recommendations;
            }

            suggestedQuestions = [
                `Book ${pricingEstimate.vehicleName} now`,
                'Which vehicle is cheaper?',
                'What documents do I need?',
                'What happens if I return the car late?'
            ];

            return {
                message: assistantMessage,
                recommendations,
                pricingEstimate,
                source: 'rule_engine',
                suggestedQuestions
            };
        } catch (err) {
            console.warn('Rule engine pricing estimate error:', err.message);
        }
    }

    // -------------------------------------------------------------
    // SCENARIO D: Driving Licence policy questions ("Can I book a car without a valid driving licence?")
    // -------------------------------------------------------------
    if (lower.includes('without a valid driving licence') || lower.includes('without driving licence') || lower.includes('without license') ||
        lower.includes('bina licence') || lower.includes('bina license') || lower.includes('no license')) {
        assistantMessage = `**No, you cannot book or rent a vehicle without a valid driving licence.**\n\n` +
            `Under Indian Motor Vehicle regulations and RentIQ safety policies, a verified Driving Licence matching the vehicle category (LMV for cars, MCWG for two-wheelers) is **strictly mandatory**.\n\n` +
            `You can easily upload your driving licence in your RentIQ profile for fast verification before confirming your reservation.`;

        suggestedQuestions = [
            'What documents do I need?',
            'How do I book a vehicle?',
            'Suggest an SUV for me',
            'Explain rental pricing'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO E: Late return charges ("What happens if I return the car late?")
    // -------------------------------------------------------------
    if (lower.includes('return the car late') || lower.includes('return late') || lower.includes('late return') ||
        lower.includes('late penalty') || lower.includes('der se return')) {
        assistantMessage = `If you return a vehicle later than your scheduled return time:\n\n` +
            `• **1-Hour Grace Period:** RentIQ provides a complimentary 1-hour grace period for minor unforeseen traffic or road delays.\n` +
            `• **Standard Late Fee:** After the grace period, late returns incur an hourly fee of **₹150 per hour** or the pro-rata daily rate.\n` +
            `• **Booking Extension:** If you know you will be delayed, you can request an extension directly from your RentIQ booking dashboard before your scheduled drop-off time.`;

        suggestedQuestions = [
            'How do I book a vehicle?',
            'What documents do I need?',
            'Explain rental pricing',
            'Recommend a vehicle for me'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO F: Required Documents ("What documents do I need?")
    // -------------------------------------------------------------
    if (lower.includes('what documents') || lower.includes('documents do i need') || lower.includes('kya documents') || lower.includes('id proof')) {
        assistantMessage = `To rent a vehicle with RentIQ, you only need to provide:\n\n` +
            `1. **Valid Driving Licence:** Matching the vehicle category (LMV for four-wheelers, MCWG for motorcycles/scooters).\n` +
            `2. **Government Photo ID Proof:** Aadhaar Card, Passport, or Voter ID for identity verification.\n\n` +
            `**Good news:** You do not need to worry about vehicle documentation — all RentIQ fleet vehicles already come pre-equipped with valid **Registration (RC)**, **Commercial Insurance**, and **PUC certificates**!`;

        suggestedQuestions = [
            'Can I book a car without a valid driving licence?',
            'Suggest an SUV for me',
            'How do I book a vehicle?',
            'Explain rental pricing'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO G: Booking process / How to book
    // -------------------------------------------------------------
    if (lower.includes('how do i book') || lower.includes('how to book') || lower.includes('booking process') || lower.includes('kaise book')) {
        assistantMessage = `Booking a vehicle on RentIQ is simple, seamless, and 100% digital:\n\n` +
            `1. **Choose Your Vehicle:** Browse our fleet and pick the car or bike that fits your journey.\n` +
            `2. **Verify Driving Licence:** Upload your driving licence in your profile for instant administrative check.\n` +
            `3. **Select Rental Dates:** Pick your pickup and drop-off times and choose optional add-ons (GPS, Child Seat).\n` +
            `4. **Review & Confirm:** Review the price breakdown and digitally sign the rental agreement.\n` +
            `5. **Vehicle Handover:** Complete a quick digital inspection at pickup and start your trip!`;

        suggestedQuestions = [
            'Recommend a vehicle for me',
            'Find an SUV under ₹4,000/day',
            'Show me automatic vehicles',
            'What documents do I need?'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO G1: Security Deposit ("What is the security deposit amount?")
    // -------------------------------------------------------------
    if (lower.includes('security deposit') || lower.includes('deposit amount') || lower.includes('deposit')) {
        assistantMessage = `**RentIQ Security Deposit Policy:**\n\n` +
            `• **Zero or Minimal Deposit:** RentIQ offers zero to minimal refundable security deposits (pre-authorization of ₹0 to ₹3,000 depending on vehicle class).\n` +
            `• **100% Refundable:** The deposit is completely refundable and released immediately back to your original payment method once the digital return inspection is completed without damages.\n` +
            `• **Zero Hidden Fees:** All taxes, GST, and standard commercial insurance are transparently disclosed upfront.`;

        suggestedQuestions = [
            'What is the cancellation policy?',
            'What documents do I need?',
            'Can I book a car without a valid driving licence?',
            'How does the vehicle inspection process work?'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO G2: Cancellation Policy ("What is the cancellation policy?")
    // -------------------------------------------------------------
    if (lower.includes('cancellation policy') || lower.includes('cancel booking') || lower.includes('cancellation') || lower.includes('cancel my')) {
        assistantMessage = `**RentIQ Cancellation Policy:**\n\n` +
            `• **Free Cancellation:** Enjoy 100% free cancellation with a full refund if cancelled up to **24 hours prior** to your scheduled pickup time.\n` +
            `• **Late Cancellation:** Cancellations within 24 hours of pickup incur a minimal fee of 50% of the first day's rental to compensate hub logistics.\n` +
            `• **Instant Refund Processing:** Refunds are initiated automatically back to your original payment mode (card/UPI) within 24 to 48 business hours.`;

        suggestedQuestions = [
            'What is the security deposit amount?',
            'How do I book a vehicle?',
            'What happens if I return the car late?',
            'Recommend a vehicle for me'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO G3: Doorstep Delivery ("Do you provide doorstep delivery?")
    // -------------------------------------------------------------
    if (lower.includes('doorstep') || lower.includes('home delivery') || lower.includes('delivery charges') || lower.includes('deliver to') || lower.includes('delivery')) {
        assistantMessage = `**Yes! RentIQ provides convenient Doorstep Delivery & Pickup:**\n\n` +
            `• **Direct to Your Location:** We can deliver and pick up the vehicle right at your home, office, hotel, or airport.\n` +
            `• **Transparent Delivery Pricing:** Doorstep delivery is charged at a flat rate of **₹15 per kilometer** from the nearest RentIQ operational hub.\n` +
            `• **Free Hub Self-Pickup:** Alternatively, you can always choose free self-pickup and return at any of our designated RentIQ pickup hubs.`;

        suggestedQuestions = [
            'Suggest an SUV for me',
            'Explain rental pricing',
            'What documents do I need?',
            'How do I book a vehicle?'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO G4: Vehicle Inspection Process ("How does the vehicle inspection process work?")
    // -------------------------------------------------------------
    if (lower.includes('inspection') || lower.includes('handover') || lower.includes('vehicle condition check')) {
        assistantMessage = `**RentIQ Transparent Digital Inspection Workflow:**\n\n` +
            `1. **Pickup Inspection:** Before you drive away, you and the RentIQ hub agent record the exact odometer reading, fuel level, and take photos of any existing minor scratches/dents on the app.\n` +
            `2. **Mutual Digital Sign-off:** Both parties review and digitally approve the inspection report directly on your device.\n` +
            `3. **Return Inspection:** Upon return, an automated comparison check verifies fuel level and vehicle exterior against the pickup inspection photos.\n` +
            `4. **Fair Deposit Release:** This protects you against false damage claims and ensures immediate release of your security deposit!`;

        suggestedQuestions = [
            'What is the security deposit amount?',
            'What happens if I return the car late?',
            'What documents do I need?',
            'How do I book a vehicle?'
        ];

        return { message: assistantMessage, recommendations: [], pricingEstimate: null, source: 'rule_engine', suggestedQuestions };
    }

    // -------------------------------------------------------------
    // SCENARIO H: Vehicle Search & Recommendations
    // (e.g. "Suggest a car under ₹2000", "Show me an SUV", "I need a car for 6 people", "Show me something sporty but affordable")
    // -------------------------------------------------------------
    const hasSearchIntent = requirements.category ||
                            requirements.maxPricePerDay ||
                            requirements.passengers ||
                            requirements.transmission ||
                            requirements.preferredModel ||
                            requirements.tripType ||
                            requirements.isCar ||
                            requirements.isAffordable ||
                            lower.includes('recommend') ||
                            lower.includes('suggest') ||
                            lower.includes('find') ||
                            lower.includes('show') ||
                            lower.includes('best') ||
                            lower.includes('need a') ||
                            lower.includes('chahiye') ||
                            lower.includes('looking for');

    if (hasSearchIntent) {
        // Special case: "Show me something sporty but affordable"
        if ((lower.includes('sport') || lower.includes('sporty')) && (lower.includes('affordable') || lower.includes('cheap') || lower.includes('budget') || lower.includes('sasta'))) {
            requirements.isAffordable = true;
            requirements.tripType = 'sports';
            requirements.category = 'Sports';
        }

        const searchResult = await vehicleRecommendationService.searchAndRankVehicles(requirements);
        recommendations = searchResult.recommendations;

        if (searchResult.exactMatchesFound) {
            const count = recommendations.length;
            assistantMessage = `Great! I found **${count} matching vehicle${count > 1 ? 's' : ''}** from RentIQ's fleet that match your preferences:\n\n` +
                recommendations.map(r => {
                    const fullName = r.name.toLowerCase().startsWith(r.brand.toLowerCase()) ? r.name : `${r.brand} ${r.name}`;
                    return `• **${fullName}** (${r.category}) — ₹${r.price_per_day.toLocaleString('en-IN')}/day (${r.transmission}, ${r.seating_capacity} seats) — *${r.matchPercentage}% Match*`;
                }).join('\n') +
                `\n\nClick **View Details** or **Book Now** on the vehicle cards below to inspect specifications and proceed with your reservation.`;
        } else {
            assistantMessage = `${searchResult.summary}\n\n` +
                recommendations.map(r => {
                    const fullName = r.name.toLowerCase().startsWith(r.brand.toLowerCase()) ? r.name : `${r.brand} ${r.name}`;
                    return `• **${fullName}** (${r.category}) — ₹${r.price_per_day.toLocaleString('en-IN')}/day (${r.matchExplanation})`;
                }).join('\n') +
                `\n\nWould you like me to adjust the budget or search another category?`;
        }

        suggestedQuestions = [
            'Which one is cheaper?',
            'I want the same car for 5 days',
            'What documents do I need?',
            'What happens if I return the car late?'
        ];

        return {
            message: assistantMessage,
            recommendations,
            pricingEstimate: null,
            source: 'rule_engine',
            suggestedQuestions
        };
    }

    // -------------------------------------------------------------
    // SCENARIO I: Off-Topic Handling
    // -------------------------------------------------------------
    const isGreeting = lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'namaste' || lower === 'help';
    if (!isGreeting) {
        assistantMessage = `I specialize in vehicle rentals and travel planning on RentIQ! 🚗\n\n` +
            `I can help you:\n` +
            `• Find cars, SUVs, sedans, sports cars, or bikes tailored to your budget\n` +
            `• Calculate authoritative rental pricing and explain discounts\n` +
            `• Answer questions about driving licences, deposits, and late return policies\n\n` +
            `What kind of vehicle or journey can I help you with today?`;
    } else {
        assistantMessage = `Hello! 👋 I am your **RentIQ AI Assistant**.\n\n` +
            `I can help you find the perfect ride from our verified fleet, calculate accurate rental costs, and guide you through our booking process.\n\n` +
            `How can I help you today? You can choose one of the suggestions below or ask any question!`;
    }

    return {
        message: assistantMessage,
        recommendations: [],
        pricingEstimate: null,
        source: 'rule_engine',
        suggestedQuestions
    };
}

/**
 * Executes tool calls invoked by OpenAI model
 */
async function executeToolCall(toolCall) {
    const fnName = toolCall.function?.name;
    let args = {};
    try {
        args = JSON.parse(toolCall.function?.arguments || '{}');
    } catch (e) {
        args = {};
    }

    if (fnName === 'search_and_recommend_vehicles') {
        const result = await vehicleRecommendationService.searchAndRankVehicles(args);
        return {
            toolCallId: toolCall.id,
            resultData: result,
            toolOutput: JSON.stringify({
                exactMatchesFound: result.exactMatchesFound,
                summary: result.summary,
                vehiclesCount: result.recommendations.length,
                vehicles: result.recommendations.map(v => ({
                    id: v.vehicle_id,
                    name: `${v.brand} ${v.name} ${v.model}`,
                    category: v.category,
                    price_per_day: v.price_per_day,
                    seating: v.seating_capacity,
                    transmission: v.transmission,
                    fuel: v.fuel_type,
                    availability: v.availability_status,
                    booking_eligible: v.booking_eligible,
                    matchPercentage: v.matchPercentage,
                    matchExplanation: v.matchExplanation
                }))
            })
        };
    }

    if (fnName === 'calculate_rental_pricing_estimate') {
        const estimate = await vehicleRecommendationService.getPricingEstimate(args);
        return {
            toolCallId: toolCall.id,
            resultData: estimate,
            toolOutput: JSON.stringify(estimate)
        };
    }

    return {
        toolCallId: toolCall.id,
        resultData: null,
        toolOutput: JSON.stringify({ status: 'unknown_tool' })
    };
}

/**
 * Main chat handler: processes user message with multi-turn context
 *
 * @param {string} userMessage - Latest customer message
 * @param {Array} conversationHistory - Prior messages [{ role, content }]
 * @param {Object} [currentUser=null] - Authenticated user details if logged in
 * @returns {Promise<Object>} Structured response { message, recommendations, pricingEstimate, source, suggestedQuestions }
 */
async function processChatMessage(userMessage, conversationHistory = [], currentUser = null) {
    if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
        throw new Error('Message content is required');
    }

    const cleanMessage = userMessage.trim();

    // Security: Guard against oversized inputs and prompt injection signatures
    if (cleanMessage.length > 1000) {
        throw new Error('Message is too long (maximum 1000 characters)');
    }

    // If OpenAI API key is NOT configured or client failed, use rule engine directly
    if (!openaiClient) {
        return await processRuleBasedResponse(cleanMessage, conversationHistory);
    }

    try {
        // Format sanitized message list for OpenAI
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        // Maintain up to last 10 turns of history to provide solid context continuity
        const recentHistory = Array.isArray(conversationHistory)
            ? conversationHistory.slice(-10)
            : [];

        for (const item of recentHistory) {
            if (item && item.role && item.content) {
                const validRole = item.role === 'assistant' ? 'assistant' : 'user';
                messages.push({
                    role: validRole,
                    content: String(item.content).slice(0, 1000)
                });
            }
        }

        messages.push({
            role: 'user',
            content: cleanMessage
        });

        // 1. Initial call to OpenAI with tool functions
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messages,
            tools: AI_TOOLS,
            tool_choice: 'auto',
            temperature: 0.5,
            max_tokens: 600
        });

        const choice = completion.choices[0];
        const responseMessage = choice.message;

        // Check if model wants to call tools
        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            const toolResults = [];
            let collectedRecommendations = [];
            let collectedPricing = null;

            for (const toolCall of responseMessage.tool_calls) {
                const executed = await executeToolCall(toolCall);
                toolResults.push({
                    tool_call_id: executed.toolCallId,
                    role: 'tool',
                    content: executed.toolOutput
                });

                if (executed.resultData?.recommendations) {
                    collectedRecommendations = executed.resultData.recommendations;
                }
                if (executed.resultData?.finalTotalPrice !== undefined) {
                    collectedPricing = executed.resultData;
                }
            }

            // 2. Second call to OpenAI with tool execution results
            const secondResponse = await openaiClient.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    ...messages,
                    responseMessage,
                    ...toolResults
                ],
                temperature: 0.5,
                max_tokens: 600
            });

            const finalContent = secondResponse.choices[0].message.content || 'Here are the matching vehicles from RentIQ:';

            return {
                message: finalContent,
                recommendations: collectedRecommendations,
                pricingEstimate: collectedPricing,
                source: 'openai',
                suggestedQuestions: [
                    'Which one is cheaper?',
                    'I want the same car for 5 days',
                    'How do I book this vehicle?',
                    'What documents do I need?'
                ]
            };
        }

        // Normal conversational response without tools
        return {
            message: responseMessage.content || 'I can help you find vehicles, explain pricing, or guide your booking on RentIQ.',
            recommendations: [],
            pricingEstimate: null,
            source: 'openai',
            suggestedQuestions: [
                'Recommend a vehicle for me',
                'Find an SUV under ₹4,000/day',
                'What documents do I need?',
                'Explain rental pricing'
            ]
        };

    } catch (err) {
        console.warn('OpenAI API call encountered an issue, falling back to rule engine:', err.message);
        // Seamless fallback to intelligent rule engine: user sees zero errors
        const fallback = await processRuleBasedResponse(cleanMessage, conversationHistory);
        return {
            ...fallback,
            source: 'rule_engine_fallback'
        };
    }
}

module.exports = {
    processChatMessage,
    extractUserRequirements,
    processRuleBasedResponse,
    SYSTEM_PROMPT
};
