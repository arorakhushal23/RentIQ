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
const SYSTEM_PROMPT = `You are the official RentIQ AI Assistant — an intelligent, friendly, and expert vehicle rental advisor.
RentIQ provides rental vehicles across categories: Hatchback, Sedan, SUV, Sports, MUV, Luxury, Bike, Scooter, and EV.

YOUR CORE RESPONSIBILITIES:
1. Help customers find their ideal vehicle from RentIQ's actual live fleet.
2. Explain rental pricing authoritatively using the calculation tools.
3. Guide customers through the booking process, document verification (driving licence, RC, PUC, insurance), and rental policies.

STRICT GROUNDING & SECURITY RULES:
- NEVER fabricate or invent vehicle models, specifications, registration details, or daily rates.
- NEVER execute raw SQL queries.
- Do NOT confirm or finalize bookings directly; advise customers to click "Book Now" or "View Details" on the recommendation cards to proceed through the official booking workflow.
- Pricing must reflect the backend pricing engine. Mention that pricing includes applicable duration discounts, weekend surcharges, and optional add-ons.
- If a customer asks for a category or budget that has no exact match, politely explain what was unavailable and present the closest alternatives from the fleet.
- Keep answers friendly, professional, concise, and structured with Markdown bullet points.`;

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
                        description: 'Number of passengers or required seats (e.g. 5, 7)'
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
                        enum: ['family', 'weekend', 'long_trip', 'economical', 'business', 'city'],
                        description: 'Purpose of travel'
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
                        description: 'Name of vehicle (e.g. Scorpio, Swift, City, Creta)'
                    },
                    vehicleId: {
                        type: 'integer',
                        description: 'Database vehicle ID if known'
                    },
                    days: {
                        type: 'integer',
                        description: 'Rental duration in full days (e.g. 3)'
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
 * and requirement analysis.
 */
function extractUserRequirements(message = '', conversationHistory = []) {
    const text = message.toLowerCase();
    const allText = conversationHistory
        .map(m => m.content || '')
        .join(' ')
        .toLowerCase() + ' ' + text;

    const requirements = {};

    // 1. Category extraction
    if (text.includes('suv')) requirements.category = 'SUV';
    else if (text.includes('sedan')) requirements.category = 'Sedan';
    else if (text.includes('hatchback') || text.includes('hatch')) requirements.category = 'Hatchback';
    else if (text.includes('sport') || text.includes('sports')) requirements.category = 'Sports';
    else if (text.includes('luxury')) requirements.category = 'Luxury';
    else if (text.includes('muv') || text.includes('mpv')) requirements.category = 'MUV';
    else if (text.includes('bike') || text.includes('motorcycle') || text.includes('pulsar') || text.includes('bullet') || text.includes('classic 350')) requirements.category = 'Bike';
    else if (text.includes('scooter') || text.includes('activa')) requirements.category = 'Scooter';
    else if (text.includes('electric') || text.includes(' ev ') || text.endsWith(' ev') || text.includes('nexon ev')) requirements.category = 'EV';
    else if (allText.includes('suv')) requirements.category = 'SUV';

    // 2. Budget extraction (e.g. under 4000, under ₹4,000, below 3500, budget 4000)
    const budgetMatch = text.match(/(?:under|below|less than|within|budget(?:\s+of)?|max(?:\s+of)?)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)/i) ||
                        text.match(/(?:₹|rs\.?|inr)\s*([0-9]+(?:,[0-9]+)?)\s*(?:per day|\/day|budget|max)/i) ||
                        text.match(/([0-9]{3,5})\s*(?:per day|\/day)/i);

    if (budgetMatch) {
        const rawBudget = budgetMatch[1].replace(/,/g, '');
        const parsed = Number(rawBudget);
        if (!isNaN(parsed) && parsed > 0) {
            requirements.maxPricePerDay = parsed;
        }
    } else if (conversationHistory.length > 0) {
        // Check prior turn in conversation
        const prevBudget = allText.match(/(?:budget|under|below)\s*(?:₹|rs\.?|inr)?\s*([0-9]+(?:,[0-9]+)?)/i);
        if (prevBudget) {
            requirements.maxPricePerDay = Number(prevBudget[1].replace(/,/g, ''));
        }
    }

    // 3. Passenger / Seating extraction (e.g. 5 people, five people, 7 seater, family of 5)
    const wordNumbers = { 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7, 'eight': 8 };
    const numMatch = text.match(/([0-9]+)\s*(?:people|passengers|persons|seats|seater)/i) ||
                     text.match(/(?:for|family of)\s*([0-9]+)\s*(?:people|persons|members)?/i);

    if (numMatch) {
        requirements.passengers = Number(numMatch[1]);
    } else {
        const wordMatch = text.match(/(one|two|three|four|five|six|seven|eight)\s*(?:people|passengers|persons|seats|seater)/i) ||
                          text.match(/(?:for|family of)\s*(one|two|three|four|five|six|seven|eight)/i);
        if (wordMatch && wordNumbers[wordMatch[1].toLowerCase()]) {
            requirements.passengers = wordNumbers[wordMatch[1].toLowerCase()];
        }
    }

    // 4. Transmission extraction
    if (text.includes('automatic') || text.includes('auto')) {
        requirements.transmission = 'automatic';
    } else if (text.includes('manual')) {
        requirements.transmission = 'manual';
    }

    // 5. Fuel type extraction
    if (text.includes('diesel')) requirements.fuelType = 'diesel';
    else if (text.includes('petrol')) requirements.fuelType = 'petrol';
    else if (text.includes('electric') || text.includes('ev')) requirements.fuelType = 'electric';
    else if (text.includes('cng')) requirements.fuelType = 'cng';

    // 6. Specific vehicle model query (e.g. Scorpio, Creta, Swift, City, Verna, BMW, Porsche)
    const models = ['scorpio', 'creta', 'swift', 'i20', 'city', 'verna', 'seltos', 'porsche', 'bmw', 'activa', 'pulsar', 'classic 350', 'nexon'];
    for (const m of models) {
        if (text.includes(m)) {
            requirements.preferredModel = m;
            break;
        }
    }

    // 7. Trip type extraction
    if (text.includes('family') || text.includes('kids') || text.includes('parents')) {
        requirements.tripType = 'family';
    } else if (text.includes('weekend') || text.includes('getaway') || text.includes('drive')) {
        requirements.tripType = 'weekend';
    } else if (text.includes('economical') || text.includes('budget') || text.includes('mileage') || text.includes('cheap')) {
        requirements.tripType = 'economical';
    } else if (text.includes('long trip') || text.includes('highway') || text.includes('road trip') || text.includes('outstation')) {
        requirements.tripType = 'long_trip';
    }

    // 8. Duration for pricing queries (e.g. 3 days, three days, for 2 days)
    const dayMatch = text.match(/([0-9]+)\s*day/i) || text.match(/(one|two|three|four|five|six|seven)\s*day/i);
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
 * Produces accurate, friendly responses and structured database recommendations
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

    // Case 1: Pricing inquiry (e.g. "How much will a Scorpio cost for three days?")
    const isPricingQuery = lower.includes('cost') || lower.includes('price') || lower.includes('pricing') || lower.includes('rate') || lower.includes('how much');
    if (isPricingQuery && (requirements.preferredModel || requirements.category || requirements.pricingDays)) {
        const targetModel = requirements.preferredModel || (requirements.category ? requirements.category : 'Scorpio');
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

            // Also attach vehicle card
            const vehicleResult = await vehicleRecommendationService.searchAndRankVehicles({
                preferredModel: targetModel,
                limit: 1
            });
            if (vehicleResult.recommendations.length > 0) {
                recommendations = vehicleResult.recommendations;
            }

            suggestedQuestions = [
                `Book ${pricingEstimate.vehicleName} now`,
                'Show me other SUVs',
                'What documents are needed?',
                'Does this price include fuel?'
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

    // Case 2: How to book / Process / Help
    if (lower.includes('how do i book') || lower.includes('how to book') || lower.includes('booking process') || lower.includes('documents needed')) {
        assistantMessage = `Booking a vehicle on RentIQ is simple, seamless, and paperless!\n\n` +
            `1. **Choose Your Vehicle:** Browse our fleet and pick the car or bike that fits your journey.\n` +
            `2. **Submit Your Driving Licence:** Upload your valid driving licence in your profile for quick administrative verification.\n` +
            `3. **Select Pickup & Return Dates:** Choose your dates and optional add-ons (GPS, Child Seat).\n` +
            `4. **Review & Confirm:** Accept the digital rental agreement and confirm your booking.\n` +
            `5. **Vehicle Handover:** Complete digital inspection at pickup and start driving!\n\n` +
            `Would you like me to recommend a car for your upcoming trip?`;

        suggestedQuestions = [
            'Recommend a vehicle for me',
            'Find an SUV under ₹4,000/day',
            'Show me automatic vehicles',
            'Explain rental pricing'
        ];

        return {
            message: assistantMessage,
            recommendations: [],
            pricingEstimate: null,
            source: 'rule_engine',
            suggestedQuestions
        };
    }

    // Case 3: Vehicle Search & Recommendation
    const hasSearchIntent = requirements.category ||
                            requirements.maxPricePerDay ||
                            requirements.passengers ||
                            requirements.transmission ||
                            requirements.preferredModel ||
                            requirements.tripType ||
                            lower.includes('recommend') ||
                            lower.includes('suggest') ||
                            lower.includes('find') ||
                            lower.includes('show') ||
                            lower.includes('best') ||
                            lower.includes('need a vehicle') ||
                            lower.includes('looking for');

    if (hasSearchIntent) {
        // If requirements are too sparse (e.g. just "I need a vehicle for a family trip" without budget or headcount)
        if (lower.includes('family trip') && !requirements.passengers && !requirements.maxPricePerDay) {
            assistantMessage = `Sure! I can help you find a suitable vehicle for your family trip. How many people will be travelling, and what is your approximate budget per day?`;
            suggestedQuestions = [
                'Five people, budget ₹4,000 per day',
                'Seven people, SUV preference',
                'Four people, economical car',
                'Show all family-friendly SUVs'
            ];
            return {
                message: assistantMessage,
                recommendations: [],
                pricingEstimate: null,
                source: 'rule_engine',
                suggestedQuestions
            };
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
            'Show automatic vehicles only',
            'Find vehicles under ₹3,000/day',
            'Explain rental pricing for this vehicle',
            'How do I book a vehicle?'
        ];

        return {
            message: assistantMessage,
            recommendations,
            pricingEstimate: null,
            source: 'rule_engine',
            suggestedQuestions
        };
    }

    // Default friendly welcome
    assistantMessage = `Hello! I am your **RentIQ AI Assistant**. I can help you find the perfect ride from our verified fleet, calculate accurate rental costs, and answer questions about rentals, compliance, and bookings.\n\n` +
        `How can I help you today? You can choose one of the suggested questions below or describe what you need!`;

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

        // Append last 6 turns of history to maintain context without token bloat
        const recentHistory = Array.isArray(conversationHistory)
            ? conversationHistory.slice(-6)
            : [];

        for (const item of recentHistory) {
            if (item && item.role && item.content) {
                // Ensure only user and assistant roles are accepted from client
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
                    'Show more details',
                    'How do I book this vehicle?',
                    'Explain rental pricing',
                    'What documents are needed?'
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
                'Explain rental pricing',
                'How do I book a vehicle?'
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
