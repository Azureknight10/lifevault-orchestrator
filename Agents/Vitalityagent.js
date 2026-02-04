const path = require('path');
const axios = require('axios');
const { ServiceBusClient } = require('@azure/service-bus');

// agents/VitalityAgent.js - Fitness, nutrition, sleep, and energy optimization
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

        this.systemPrompt = `You are the Vitality Agent - specialized in fitness, nutrition, sleep, and energy optimization.

═══════════════════════════════════════════════════════════════
CORE CAPABILITIES:
═══════════════════════════════════════════════════════════════

1. WORKOUT OPTIMIZATION
   - Exercise programming and progression
   - Form analysis and injury prevention
   - Progressive overload tracking
   - Recovery optimization
   - Training splits and periodization

2. NUTRITION ANALYSIS
   - Meal grading using AF scale (A=5, B=4, C=3, D=2, F=1)
   - Macro tracking (protein, carbs, fats)
   - Meal timing optimization
   - Hydration monitoring
   - Supplement recommendations

3. SLEEP OPTIMIZATION
   - Sleep quality scoring (1-10)
   - Sleep cycle analysis
   - Circadian rhythm alignment
   - Recovery impact assessment

4. ENERGY MANAGEMENT
   - Energy level tracking (1-10)
   - Fatigue pattern detection
   - Burnout risk assessment
   - Energy-nutrition-sleep correlations

5. FASTING PROTOCOLS
   - Intermittent fasting strategies
   - Eating window optimization
   - Fasted vs fed training analysis

═══════════════════════════════════════════════════════════════
AF MEAL GRADING SCALE:
═══════════════════════════════════════════════════════════════

A (5 points): Excellent - Whole foods, balanced macros, nutrient-dense
B (4 points): Good - Mostly whole foods, minor processed items
C (3 points): Average - Mix of whole and processed, could be better
D (2 points): Poor - Mostly processed, lacking nutrition
F (1 point): Failing - Fast food, junk food, very poor choices

Provide specific, actionable fitness and nutrition advice with exact numbers.`;
    }

    async process(userQuery, context = {}) {
        console.log('💪 Vitality Agent processing...');

        try {
            const queryType = this.detectQueryType(userQuery);
            console.log(`🎯 Query type: ${queryType}`);

            const vitalityData = this.extractVitalityData(context);
            console.log(`📦 Vitality records: ${vitalityData.length}`);

            let analysis;
            if (queryType === 'meal_grading') {
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
        const q = query.toLowerCase();
        
        if (q.match(/meal|food|eat|grade|nutrition|diet|calorie|macro|protein/)) {
            return 'meal_grading';
        } else if (q.match(/workout|exercise|train|lift|gym|fitness|reps|sets/)) {
            return 'workout_analysis';
        } else if (q.match(/sleep|tired|rest|insomnia|dream|wake/)) {
            return 'sleep_analysis';
        } else if (q.match(/energy|fatigue|burnout|exhausted|drained/)) {
            return 'energy_analysis';
        } else if (q.match(/fast|fasting|eating window|intermittent/)) {
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
        const q = mealDescription.toLowerCase();
        
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

**Quick Analysis:**
- Grade based on food quality and macronutrient balance
- For detailed grading, describe specific foods and portions
- AI grading temporarily unavailable

**General Recommendations:**
- Aim for whole foods, lean protein, vegetables
- Limit processed foods, added sugars, deep fried items
- Target: 30g+ protein per meal for muscle maintenance`;
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
2. Volume trends (increasing/decreasing)
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