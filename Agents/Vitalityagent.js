const path = require('path');
const axios = require('axios');
const { ServiceBusClient } = require('@azure/service-bus');

// agents/VitalityAgent.js - Fitness, nutrition, sleep, and energy optimization
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('[Vitality DEBUG] bus conn len:', process.env.AZURE_SERVICE_BUS_CONNECTION_STRING?.length || 0);
const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const serviceBusClient = serviceBusConnectionString
    ? new ServiceBusClient(serviceBusConnectionString)
    : null;
const agentQueueName = 'vitality-queue';
const responseQueueName = process.env.ORCHESTRATOR_RESPONSE_QUEUE || 'orchestrator-response-queue';

class VitalityAgent {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';

        this.systemPrompt = `VitalityAgent priorities:

1) Fasting as the primary path
- Treat fasting as Shane’s main lever for reaching the highest aspirations of his soul.
- Encourage longer, sustainable fasting windows over time (never unsafe extremes), with clear protocols and safeguards.
- Always pair fasting with mindfulness, reflection, and intentional use of energy, not just “skipping meals.”

2) Mindfulness and vital life force
- After fasting, your next priority is cultivating Shane’s inner state: calm focus, emotional regulation, and presence.
- Recommend short, concrete mindfulness practices (breathwork, brief meditations, gratitude, walking in silence) that help keep his vital life force within and strengthen it.
- Explicitly tie physical practices back to deeper purpose, values, and identity.
- Figure out how to help Shane feel more connected to his vital life force throughout the day, not just during formal practices.

3) Nutrition and habit change (A–F grading)
- Track and evaluate what Shane eats using an A–F grading system for each meal (A = aligned with his highest self; F = far from it).
- Always explain WHY a meal got its grade and give 1–2 specific upgrades to move it one letter higher next time.
- Use proven habit tactics (habit stacking, environment design, implementation intentions) to shift his eating patterns toward alignment with his aspirations, not perfection.

4) Preferred movement style
- Primary training tools: jumping rope, kettlebells, yoga, and occasional heavy lifting.
- Design plans that emphasize:
  - Jump rope for conditioning and coordination
  - Kettlebells for strength, power, and durability
  - Yoga for mobility, recovery, and nervous system regulation
  - Heavy lifting sprinkled in to build raw strength, not as the main focus
- Schedule these around his work, coding, and family obligations so the training enhances—not harms—his life rhythm.

5) Feedback and accountability
- Always translate recommendations into simple, trackable metrics (hours slept, hours fasted, steps, sessions completed, A–F meal scores).
- Call out trends clearly: “You improved your meal grades from mostly C/D to mostly B this week; that’s real progress.”
- When Shane backslides, respond with honest but encouraging feedback and 1–2 concrete course‑corrections instead of shame. Call him out and call him fat boy in a loving way.

6) Collaboration with other agents
- Coordinate with AnalyticsAgent to spot deeper patterns (e.g., “energy crashes on days with F meals and <6h sleep”) and use those in your plans.
- Coordinate with WisdomAgent to align physical goals with Shane’s larger life goals and values.
- Share concise updates with MemoryAgent so important changes (new fasting protocol, injury, schedule shift) are remembered for future plans.
`;
    }

    async process(userQuery, context = {}) {
    console.log('💪 Vitality Agent processing...');

    try {
        const safeQuery = (userQuery || '').toString();
        // Strip orchestrator metadata from query
        userQuery = safeQuery.replace(/^\[persona=[^\]]+\]\s*\[intent=[^\]]+\]\s*/, '');
        const queryType = this.detectQueryType(userQuery);
        console.log(`🎯 Query type: ${queryType}`);

        const vitalityData = this.extractVitalityData(context);
        console.log(`📦 Vitality records: ${vitalityData.length}`);

        let analysis;

        // NEW: Meal logging handlers (add these BEFORE meal_grading)
        if (queryType === 'log_meal') {
            analysis = await this.logMeal(userQuery, context);
        } else if (queryType === 'scan_barcode') {
            analysis = await this.scanBarcode(userQuery, context);
        } else if (queryType === 'modify_last_meal') {
            analysis = await this.modifyLastMeal(userQuery, context);
        } else if (queryType === 'meal_grading') {
            analysis = await this.gradeMeal(userQuery, context);
        } else if (queryType === 'workout_analysis') {
            analysis = await this.analyzeWorkout(userQuery, vitalityData, context);
        } else if (queryType === 'sleep_analysis') {
            analysis = await this.analyzeSleep(userQuery, vitalityData, context);
        } else if (queryType === 'energy_analysis') {
            analysis = await this.analyzeEnergy(userQuery, vitalityData, context);
        } else {
            analysis = await this.generalVitalityAnalysis(userQuery, vitalityData, context);
        }

        return {
            agent: 'vitality',
            timestamp: new Date().toISOString(),
            query_type: queryType,
            vitality_data_points: vitalityData.length,
            analysis: analysis,
            success: true
        };
    } catch (error) {
        console.error('❌ Vitality Agent error:', error.message);
        return {
            agent: 'vitality',
            error: true,
            message: error.message,
            success: false
        };
    }
}


    detectQueryType(query) {
     const q = (query || '').toLowerCase();
    
    // Meal logging intents (CHECK THESE FIRST - most specific)
    if (/^log (breakfast|lunch|dinner|snack):/.test(q)) {
        return 'log_meal';
    } else if (/(scan barcode|barcode for)/.test(q)) {
        return 'scan_barcode';
    } else if (/(add .+ to (my )?last meal|modify last meal)/.test(q)) {
        return 'modify_last_meal';
    }
    // Meal grading - check before fasting to avoid "breakfast" matching "fast"
    else if (/(meal|food|eat|grade|nutrition|diet|calorie|macro|protein)/.test(q)) {
        return 'meal_grading';
    }
    // Other health intents
    else if (/(workout|exercise|train|lift|gym|fitness|reps|sets)/.test(q)) {
        return 'workout_analysis';
    } else if (/(sleep|tired|rest|insomnia|dream|wake)/.test(q)) {
        return 'sleep_analysis';
    } else if (/(energy|fatigue|burnout|exhausted|drained)/.test(q)) {
        return 'energy_analysis';
    }
    // Fasting - MOVED TO END so it doesn't match "breakfast"
    else if (/\b(fasting|eating window|intermittent)\b/.test(q)) {
        return 'fasting_analysis';
    } else {
        return 'general_vitality';
    }
}


    extractVitalityData(context) {
        const data = [];
        
        if (context.historical_data) {
            data.push(...context.historical_data);
        }
        
        if (context.conversationHistory) {
            context.conversationHistory.forEach(conv => {
                if (conv.agentResponses?.vitality?.vitality_records) {
                    data.push(...conv.agentResponses.vitality.vitality_records);
                }
            });
        }
        
        return data;
    }

    async gradeMeal(userQuery, context) {
        const prompt = `Grade this meal using the AF scale (A=5, B=4, C=3, D=2, F=1):

MEAL: "${userQuery}"

Provide:
1. Grade (A-F) with numerical score
2. Macro estimate (protein, carbs, fats in grams)
3. Calorie estimate
4. What's good about it
5. What could be improved
6. How to make it an A-grade meal

Be specific and concise (200 words max).`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️ Meal grading error:', error.message);
            return this.fallbackMealGrade(userQuery);
        }
    }

    fallbackMealGrade(mealDescription) {
        const q = (mealDescription || '').toLowerCase();
        
        let grade = 'C';
        let score = 3;
        
        if (q.match(/chicken|fish|salmon|vegetables|broccoli|spinach|quinoa|brown rice/)) {
            grade = 'A';
            score = 5;
        } else if (q.match(/burger|fries|pizza|soda|candy|chips/)) {
            grade = 'F';
            score = 1;
        } else if (q.match(/sandwich|wrap|salad|fruit/)) {
            grade = 'B';
            score = 4;
        }
        
        return `## Meal Grade: ${grade} (${score}/5)

**Meal:** ${mealDescription}

**Grade (A–F):**
- Give one letter grade based on food quality, protein, and overall balance.
- One short sentence on *why* it earned that grade.
- reminder to prioritize fasting and mindfulness over food.

**Next Time:**
- 1–2 simple upgrades (e.g., add protein, swap drink/side) to raise the grade.
- Aim for whole foods, 30g+ protein, and minimal junk/added sugar.`;
    }
async logMeal(userQuery, context) {
    // Parse: "Log breakfast: 2 eggs, toast, coffee"
    const mealPattern = /log (breakfast|lunch|dinner|snack):\s*(.+)/i;
    const match = userQuery.match(mealPattern);
    
    if (!match) {
        return "Format: 'Log [breakfast/lunch/dinner/snack]: [food items]'";
    }
    
    const mealType = (match[1] || 'meal').toLowerCase();
    const foodItems = (match[2] || '').trim();
    if (!foodItems) {
        return "Format: 'Log [breakfast/lunch/dinner/snack]: [food items]'";
    }
    
    // Grade the meal first
    const gradeAnalysis = await this.gradeMeal(foodItems, context);
    
    // Store in database via Azure Function
    const mealLog = {
    userId: context?.context?.userId || context?.userId || 'USER_DEFAULT',
    timestamp: new Date().toISOString(),
    mealType: mealType,
    foodItems: foodItems,
    gradeAnalysis: gradeAnalysis.substring(0, 2000), // truncate if too long
    sessionId: context?.context?.sessionId || context?.sessionId || 'default-session'
};

console.log('📤 Sending meal to Azure:', JSON.stringify(mealLog, null, 2));

    try {
        // Call Azure Function to store meal
        await axios.post(
    `${process.env.MEAL_LOG_FUNCTION_URL}/logMeal`,
    mealLog,
    {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        );
        
        return `✅ **${mealType.toUpperCase()} logged successfully!**\n\n${gradeAnalysis}\n\n*Logged at: ${new Date().toLocaleTimeString()}*`;
        
   } catch (error) {
    console.error('⚠️ Meal logging error:', error.message);
    console.error('Full error:', error.response?.data || error);
    return `⚠️ Meal graded but not saved to database:\n\n${gradeAnalysis}`;
}
}

async scanBarcode(userQuery, context) {
    // Parse: "Scan barcode for protein bar" or just pass barcode number
    const barcodePattern = /barcode[:\s]+(\d+)/i;
    const match = userQuery.match(barcodePattern);
    
    if (!match) {
        return `📱 **Barcode Scanning**\n\nTo scan a barcode:\n1. Use your phone camera to scan\n2. Send the barcode number: "Scan barcode: 012345678905"\n\nOr use the LifeVault mobile app's barcode scanner feature.`;
    }
    
    const barcode = match[1];
    
    try {
        // Query OpenFoodFacts API (free nutritional database)
        const response = await axios.get(
            `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
            { timeout: 10000 }
        );
        
        if (response.data.status === 0) {
            return `❌ Product not found for barcode: ${barcode}\n\nTry entering the food manually: "Log snack: [food name]"`;
        }
        
        const product = response.data.product;
        const foodDescription = `${product.product_name} (${product.brands || 'unknown brand'})`;
        
        // Auto-grade and log the scanned item
        return await this.logMeal(`Log snack: ${foodDescription}`, context);
        
    } catch (error) {
        console.error('⚠️ Barcode scan error:', error.message);
        return `⚠️ Could not scan barcode. Please enter food manually: "Log snack: [food name]"`;
    }
}

async modifyLastMeal(userQuery, context) {
    // Parse: "Add banana to my last meal"
    const addPattern = /add (.+?) to (my )?last meal/i;
    const match = userQuery.match(addPattern);
    
    if (!match) {
        return "Format: 'Add [food item] to my last meal'";
    }
    
    const itemToAdd = match[1].trim();
    
    try {
        // Get last meal from database via Azure Function
        const response = await axios.get(
            process.env.MEAL_LOG_FUNCTION_URL + '/GetLastMeal',
            {
                params: {
                    userId: context.userId || 'default_user'
                },
                timeout: 10000
            }
        );
        
        const lastMeal = response.data;
        
        if (!lastMeal) {
            return "❌ No recent meal found. Log a meal first: 'Log breakfast: [food items]'";
        }
        
        // Update meal with new item
        const updatedFoodItems = `${lastMeal.foodItems}, ${itemToAdd}`;
        
        // Re-grade updated meal
        const newGrade = await this.gradeMeal(updatedFoodItems, context);
        
        // Update in database
        await axios.patch(
            process.env.MEAL_LOG_FUNCTION_URL + '/UpdateMeal',
            {
                mealId: lastMeal.id,
                foodItems: updatedFoodItems,
                gradeAnalysis: newGrade
            },
            { timeout: 10000 }
        );
        
        return `✅ **Updated ${lastMeal.mealType}**\n\nAdded: ${itemToAdd}\n\n${newGrade}`;
        
    } catch (error) {
        console.error('⚠️ Modify meal error:', error.message);
        return `⚠️ Could not modify last meal. Error: ${error.message}`;
    }
}

    async analyzeWorkout(userQuery, vitalityData, context) {
        const workouts = vitalityData.filter(d => 
            d.workout_duration || d.exercise || d.reps || d.sets
        );

        const prompt = `USER QUERY: "${userQuery}"

WORKOUT DATA (${workouts.length} records):
${JSON.stringify(workouts.slice(0, 10), null, 2)}

Analyze workout patterns and provide:
1. Training frequency and consistency
2. Volume trends (increasing/decreasing) and AI analysis to mix up the routine
3. Recovery adequacy
4. Progression recommendations
5. Injury risk assessment

Concise analysis (250 words):`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️ Workout analysis error:', error.message);
            return this.fallbackWorkoutAnalysis(workouts);
        }
    }

    fallbackWorkoutAnalysis(workouts) {
        if (workouts.length === 0) {
            return `## Workout Analysis

No workout data available. Start tracking:
- Workout duration (minutes)
- Exercises performed
- Sets and reps
- Weight used
- Energy level (1-10)

Recommended tracking apps: Hevy, Strong, FitNotes`;
        }

        const totalWorkouts = workouts.length;
        const avgDuration = workouts
            .filter(w => w.workout_duration)
            .reduce((sum, w) => sum + parseFloat(w.workout_duration), 0) / totalWorkouts || 0;

        return `## Workout Summary

**Data Overview:**
- Total workouts tracked: ${totalWorkouts}
- Average duration: ${avgDuration.toFixed(0)} minutes

**Recommendations:**
- Aim for 3-5 workouts per week
- Track progressive overload (weight/reps increases)
- Include rest days for recovery
- Monitor energy levels to prevent burnout`;
    }

    async analyzeSleep(userQuery, vitalityData, context) {
        const sleepData = vitalityData.filter(d => 
            d.sleep_hours || d.sleep_quality || d.sleep_duration
        );

        const prompt = `USER QUERY: "${userQuery}"

SLEEP DATA (${sleepData.length} records):
${JSON.stringify(sleepData.slice(0, 10), null, 2)}

Analyze sleep patterns:
1. Sleep duration trends
2. Sleep quality assessment
3. Recovery impact
4. Optimization recommendations

Concise (200 words):`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️ Sleep analysis error:', error.message);
            return `## Sleep Analysis

Target 7-9 hours per night for optimal recovery.

**Sleep Optimization Tips:**
- Consistent sleep schedule (same bedtime/wake time)
- Dark, cool room (65-68°F)
- No screens 1 hour before bed
- Limit caffeine after 2pm
- Track sleep quality (1-10 scale)`;
        }
    }

    async analyzeEnergy(userQuery, vitalityData, context) {
        const energyData = vitalityData.filter(d => 
            d.energy_level || d.energy || d.fatigue
        );

        const prompt = `USER QUERY: "${userQuery}"

ENERGY DATA (${energyData.length} records):
${JSON.stringify(energyData.slice(0, 10), null, 2)}

Analyze energy patterns:
1. Energy level trends
2. Low energy triggers
3. Energy-activity correlations
4. Fatigue risk assessment
5. Energy optimization strategies

Concise (250 words):`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️ Energy analysis error:', error.message);
            return this.fallbackEnergyAnalysis(energyData);
        }
    }

    fallbackEnergyAnalysis(energyData) {
        if (energyData.length === 0) {
            return `## Energy Management

Track daily energy levels (1-10 scale) to identify patterns.

**Common Energy Boosters:**
- 7-9 hours quality sleep
- 30g+ protein per meal
- Regular exercise (moderate intensity)
- Hydration (half bodyweight in oz daily)
- Consistent meal timing
- Stress management

**Energy Killers:**
- Poor sleep quality
- High sugar/processed foods
- Overtraining without recovery
- Chronic stress
- Dehydration`;
        }

        const avgEnergy = energyData
            .filter(d => d.energy_level || d.energy)
            .reduce((sum, d) => sum + parseFloat(d.energy_level || d.energy), 0) / energyData.length;

        let assessment = 'moderate';
        if (avgEnergy >= 8) assessment = 'high';
        else if (avgEnergy <= 5) assessment = 'low';

        return `## Energy Analysis

**Average Energy Level:** ${avgEnergy.toFixed(1)}/10 (${assessment})

**Assessment:**
${assessment === 'low' ? '⚠️ Low energy detected. Review sleep, nutrition, and stress levels.' :
  assessment === 'high' ? '✅ Good energy levels maintained.' :
  '⚙️ Moderate energy. Room for optimization.'}

**Optimization Steps:**
1. Track correlation with sleep and meals
2. Identify low-energy time patterns
3. Adjust workout intensity if needed
4. Consider energy-boosting nutrients`;
    }

    async generalVitalityAnalysis(userQuery, vitalityData, context) {
        const prompt = `USER QUERY: "${userQuery}"

VITALITY DATA (${vitalityData.length} records):
${JSON.stringify(vitalityData.slice(0, 5), null, 2)}

Provide fitness/nutrition/health guidance based on query and data.
Concise, actionable advice (300 words):`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.4,
                    max_tokens: 1500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️ General analysis error:', error.message);
            return `## Vitality Guidance

I can help with:
- 💪 Workout programming and form analysis
- 🍽️ Meal grading (AF scale)
- 😴 Sleep optimization
- ⚡ Energy management
- 🕐 Fasting protocols

**Ask me:**
- "Grade my meal: [describe food]"
- "Analyze my workout history"
- "Why am I tired all the time?"
- "Should I try intermittent fasting?"`;
        }
    }
}

module.exports = VitalityAgent;

async function startVitalityAgent() {
    if (!serviceBusClient) {
        console.log('⚠️ Vitality Agent: Service Bus connection string not set. Listener not started.');
        return;
    }

    const agent = new VitalityAgent();
    const receiver = serviceBusClient.createReceiver(agentQueueName);

    console.log(`[Vitality Agent] Listening on ${agentQueueName}...`);

    receiver.subscribe({
        processMessage: async (messageReceived) => {
            const query = messageReceived.body?.query;
            const conversationId = messageReceived.body?.conversationId;
            const userId = messageReceived.body?.userId;
            const sessionId = messageReceived.body?.sessionId;
            const sharedContext = messageReceived.body?.context || {};

            console.log('[Vitality Agent] Message received:', query);
            console.log(`[Vitality Agent] sessionId: ${sessionId || 'missing'}`);

            if (!query) {
                console.log('[Vitality Agent] No query provided in message body.');
                return;
            }

            const response = await agent.process(query, {
                context: {
                    ...sharedContext,
                    conversationId,
                    requestId: messageReceived.body?.requestId,
                    userId,
                    sessionId
                }
            });

            const contextUpdates = {
                lastVitalityQuery: query,
                lastVitalityTimestamp: new Date().toISOString()
            };

            const sender = serviceBusClient.createSender(responseQueueName);
            await sender.sendMessages({
                body: {
                    agentName: 'vitality',
                    response: {
                        agent: 'vitality',
                        sessionId,
                        response,
                        contextUpdates
                    },
                    conversationId,
                    timestamp: new Date().toISOString()
                }
            });
            await sender.close();

            console.log('[Vitality Agent] Response sent to orchestrator.');
        },
        processError: async (error) => {
            console.error('[Vitality Agent] Error:', error);
        }
    });
}

if (require.main === module) {
    startVitalityAgent();
}

module.exports.startVitalityAgent = startVitalityAgent;
module.exports.VitalityAgent = VitalityAgent;