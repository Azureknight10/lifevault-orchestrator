// agents/fatherAgent.js - Parenting with progress tracking and session analysis
require('dotenv').config();
const axios = require('axios');
const { TableClient } = require('@azure/data-tables');

class FatherAgent {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';

        // Azure Table Storage for progress tracking
        this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        this.tableName = process.env.AZURE_TABLE_NAME || 'LifeVaultData';
        
        try {
            this.tableClient = TableClient.fromConnectionString(
                this.connectionString,
                this.tableName
            );
            console.log('✅ Father Agent: Connected to Azure Tables');
        } catch (error) {
            console.error('⚠️  Father Agent: Azure Tables connection failed:', error.message);
            this.tableClient = null;
        }

        this.systemPrompt = `You are the Father Agent - specialized in parenting strategy, child development, and family optimization with detailed progress tracking.

═══════════════════════════════════════════════════════════════
CORE CAPABILITIES:
═══════════════════════════════════════════════════════════════

1. ACADEMIC SUPPORT & PROGRESS TRACKING
   - Homework strategy optimization
   - Reading progress tracking (sight words, fluency)
   - Session-by-session improvement analysis
   - Learning style identification
   - Tutoring coordination and effectiveness measurement

2. BEHAVIORAL GUIDANCE & PATTERN ANALYSIS
   - Behavioral incident pattern analysis
   - Discipline strategy effectiveness tracking
   - Positive reinforcement design
   - Emotional regulation teaching
   - Trigger identification and mitigation

3. PROGRESS REPORTS & ANALYTICS
   - Weekly/monthly progress summaries
   - Milestone achievement tracking
   - Trend analysis (improving, declining, stable)
   - Comparative analysis (this week vs last week)
   - Goal attainment probability

4. SESSION LOGGING
   - Homework sessions (duration, focus, completion)
   - Reading practice (sight words mastered, errors, fluency)
   - Tutoring sessions (activities, breakthroughs, struggles)
   - Behavioral incidents (trigger, response, outcome)
   - Quality time activities (type, duration, child engagement)

═══════════════════════════════════════════════════════════════
CHILD PROFILES:
═══════════════════════════════════════════════════════════════

EVANDER (Age 7, 2nd Grade):
- Strengths: Kinesthetic learner, follows instructions well, athletic
- Growth areas: Writing fluency, organization, emotional expression
- Interests: Scooters, video games, sports, working out
- Learning style: Hands-on, index card-based
- Behavioral note: Responds well to physical activity before homework

AMELIA (Age 6):
- Focus: Reading development (sight words, fluency, comprehension)
- Strengths: Visual learner, creative, artistic, responds to games
- Growth areas: Frustration tolerance, persistence
- Tutoring: 2x weekly (sight words, fluency, comprehension)
- Learning style: Visual, game-based
- Current Goal: 100 sight words by June 2026

Provide specific, actionable parenting strategies with developmental context and data-driven progress analysis.`;

        this.childProfiles = {
            evander: {
                age: 7,
                grade: '2nd',
                strengths: ['kinesthetic_learner', 'follows_instructions', 'athletic'],
                growth_areas: ['writing_fluency', 'organization', 'emotional_expression'],
                interests: ['scooters', 'video_games', 'sports', 'working_out'],
                learning_style: 'hands_on_kinesthetic',
                behavioral_notes: 'responds well to physical activity before homework',
                tracking_metrics: ['homework_duration', 'focus_level', 'completion_rate', 'writing_quality']
            },
            amelia: {
                age: 6,
                focus_areas: ['reading_development', 'sight_words', 'fluency'],
                strengths: ['visual_learner', 'creative', 'artistic', 'game_responsive'],
                growth_areas: ['frustration_tolerance', 'persistence'],
                tutoring: {
                    frequency: '2x_weekly',
                    focus: ['sight_words', 'fluency', 'comprehension']
                },
                learning_style: 'visual_game_based',
                behavioral_notes: 'gives up easily when frustrated',
                current_goals: {
                    sight_words: { target: 100, deadline: '2026-06-30' },
                    fluency: 'age_appropriate_by_end_of_year'
                },
                tracking_metrics: ['sight_words_mastered', 'reading_fluency_wpm', 'frustration_incidents', 'persistence_score']
            }
        };
    }

    async process(userQuery, context = {}) {
        console.log('👨‍👦 Father Agent processing...');

        try {
            // Detect query type
            const queryAnalysis = this.analyzeQuery(userQuery);
            console.log(`🎯 Child: ${queryAnalysis.child}, Topic: ${queryAnalysis.topic}, Action: ${queryAnalysis.action}`);

            // Route to appropriate handler
            let result;
            
            if (queryAnalysis.action === 'log_session') {
                result = await this.logSession(userQuery, queryAnalysis, context);
            } else if (queryAnalysis.action === 'progress_report') {
                result = await this.generateProgressReport(queryAnalysis, context);
            } else if (queryAnalysis.action === 'compare_progress') {
                result = await this.compareProgress(queryAnalysis, context);
            } else {
                result = await this.provideGuidance(userQuery, queryAnalysis, context);
            }

            return {
                agent: 'father',
                timestamp: new Date().toISOString(),
                child_focus: queryAnalysis.child,
                topic: queryAnalysis.topic,
                action: queryAnalysis.action,
                ...result,
                success: true
            };

        } catch (error) {
            console.error('❌ Father Agent error:', error.message);
            return {
                agent: 'father',
                error: true,
                message: error.message,
                success: false
            };
        }
    }

    analyzeQuery(query) {
        const q = query.toLowerCase();
        
        // Detect child
        let child = null;
        if (q.match(/evander|my son|him|he|his/i)) {
            child = 'evander';
        } else if (q.match(/amelia|my daughter|her|she/i)) {
            child = 'amelia';
        }

        // Detect action
        let action = 'guidance';
        if (q.match(/log|record|track|session|completed|practiced|worked on/)) {
            action = 'log_session';
        } else if (q.match(/progress report|how is.*doing|show.*progress|summary|weekly report|monthly report/)) {
            action = 'progress_report';
        } else if (q.match(/compare|versus|vs|improvement|change since|better than/)) {
            action = 'compare_progress';
        }

        // Detect topic
        let topic = 'general_parenting';
        if (q.match(/homework|school|study|learning|education|grades/)) {
            topic = 'academic';
        } else if (q.match(/reading|sight word|fluency|book|comprehension/)) {
            topic = 'reading';
        } else if (q.match(/behavior|discipline|misbehave|acting out|consequence/)) {
            topic = 'behavioral';
        } else if (q.match(/quality time|spend time|bond|connection|activity/)) {
            topic = 'quality_time';
        }

        return { child, topic, action };
    }

    /**
     * LOG SESSION - Save progress data
     */
    async logSession(userQuery, queryAnalysis, context) {
        console.log('📝 Logging session...');

        // Extract session details from query using AI
        const sessionData = await this.extractSessionData(userQuery, queryAnalysis);

     // Save to Azure Tables
if (this.tableClient && sessionData) {
    try {
        // Flatten sessionData for Azure Tables (no nested objects)
        const flattenedData = this.flattenForAzure(sessionData);

        const entity = {
            partitionKey: `Child_${queryAnalysis.child || 'general'}`,
            rowKey: `Session_${Date.now()}`,
            timestamp: new Date().toISOString(),
            child: queryAnalysis.child,
            topic: queryAnalysis.topic,
            ...flattenedData
        };

                await this.tableClient.createEntity(entity);
                console.log('✅ Session logged to Azure');

                // Generate immediate feedback
                const feedback = await this.generateSessionFeedback(sessionData, queryAnalysis);

                return {
                    session_logged: true,
                    session_data: sessionData,
                    feedback: feedback
                };

            } catch (error) {
                console.error('⚠️  Error logging session:', error.message);
            }
        }

        return {
            session_logged: false,
            message: 'Session data extracted but not saved (Azure unavailable)',
            session_data: sessionData
        };
    }

    async extractSessionData(userQuery, queryAnalysis) {
        const prompt = `Extract structured session data from this parent's log:

"${userQuery}"

Return JSON with relevant fields:
- For reading: { sight_words_practiced: number, sight_words_mastered: number, new_words: [], errors: number, fluency_wpm: number, frustration_level: 1-10, session_duration_min: number }
- For homework: { subject: string, duration_min: number, focus_level: 1-10, completion_rate: percentage, struggled_with: string }
- For behavioral: { incident_type: string, trigger: string, response_strategy: string, effectiveness: 1-10, notes: string }

Return only valid JSON, no other text.`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.2,
                    max_tokens: 500
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            const jsonText = response.data.choices[0].message.content;
            const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;

        } catch (error) {
            console.error('⚠️  Error extracting session data:', error.message);
            return null;
        }
    }

    async generateSessionFeedback(sessionData, queryAnalysis) {
        const childProfile = this.childProfiles[queryAnalysis.child];

        let feedback = `## Session Feedback\n\n`;
        feedback += `**Child:** ${queryAnalysis.child}\n`;
        feedback += `**Date:** ${new Date().toLocaleDateString()}\n\n`;

        // Topic-specific feedback
        if (sessionData.sight_words_mastered !== undefined) {
            feedback += `### Reading Practice Results:\n`;
            feedback += `- Sight words mastered: **${sessionData.sight_words_mastered}**\n`;
            feedback += `- Practice duration: ${sessionData.session_duration_min} minutes\n`;
            feedback += `- Frustration level: ${sessionData.frustration_level}/10\n\n`;

            if (childProfile && childProfile.current_goals) {
                const remaining = childProfile.current_goals.sight_words.target - sessionData.sight_words_mastered;
                feedback += `**Goal Progress:** ${remaining} sight words remaining to reach 100\n\n`;
            }

            feedback += `**Next Steps:**\n`;
            feedback += `- Continue daily 10-15 min sessions\n`;
            feedback += `- Focus on words with high error rate\n`;
            if (sessionData.frustration_level > 7) {
                feedback += `- ⚠️ High frustration detected - shorten sessions, add more rewards\n`;
            }
        }

        if (sessionData.focus_level !== undefined) {
            feedback += `### Homework Session Results:\n`;
            feedback += `- Duration: ${sessionData.duration_min} minutes\n`;
            feedback += `- Focus level: ${sessionData.focus_level}/10\n`;
            feedback += `- Completion: ${sessionData.completion_rate}%\n\n`;

            if (sessionData.focus_level < 6) {
                feedback += `**Next Steps:**\n`;
                feedback += `- Try physical activity break before homework\n`;
                feedback += `- Reduce session length\n`;
                feedback += `- Eliminate distractions\n`;
            }
        }

        feedback += `\n_Session data saved for progress tracking_`;

        return feedback;
    }

    /**
     * PROGRESS REPORT - Generate analytical report
     */
    async generateProgressReport(queryAnalysis, context) {
        console.log('📊 Generating progress report...');

        // Retrieve historical data
        const historicalData = await this.retrieveChildData(queryAnalysis.child);
        console.log(`📦 Retrieved ${historicalData.length} historical records`);

        if (historicalData.length === 0) {
            return {
                report: 'No historical data available. Start logging sessions to track progress.',
                data_points: 0
            };
        }

        // Analyze progress
        const progressAnalysis = this.analyzeProgressData(historicalData, queryAnalysis);

        // Generate AI-powered report
        const report = await this.synthesizeProgressReport(
            queryAnalysis,
            historicalData,
            progressAnalysis
        );

        return {
            report: report,
            data_points: historicalData.length,
            progress_analysis: progressAnalysis
        };
    }

    async retrieveChildData(child, daysBack = 30) {
        if (!this.tableClient) return [];

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysBack);

            const entities = [];
            const query = child ? 
                `PartitionKey eq 'Child_${child}'` : 
                `PartitionKey ge 'Child_'`;

            const iterator = this.tableClient.listEntities({ queryOptions: { filter: query } });

            for await (const entity of iterator) {
                const entityDate = new Date(entity.timestamp);
                if (entityDate >= cutoffDate) {
                    entities.push(entity);
                }
                if (entities.length >= 100) break;
            }

            return entities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        } catch (error) {
            console.error('⚠️  Error retrieving child data:', error.message);
            return [];
        }
    }

    analyzeProgressData(data, queryAnalysis) {
        const analysis = {
            total_sessions: data.length,
            date_range: {
                oldest: data[data.length - 1]?.timestamp,
                newest: data[0]?.timestamp
            },
            trends: {},
            milestones: []
        };

        // Analyze reading progress (Amelia)
        const readingData = data.filter(d => d.sight_words_mastered !== undefined);
        if (readingData.length > 0) {
            const sightWords = readingData.map(d => d.sight_words_mastered).filter(n => !isNaN(n));
            const frustrationLevels = readingData.map(d => d.frustration_level).filter(n => !isNaN(n));

            analysis.trends.reading = {
                total_sessions: readingData.length,
                current_sight_words: Math.max(...sightWords),
                avg_frustration: frustrationLevels.length > 0 ?
                    (frustrationLevels.reduce((a, b) => a + b, 0) / frustrationLevels.length).toFixed(1) : 'N/A',
                progress_rate: sightWords.length >= 2 ? 
                    ((sightWords[0] - sightWords[sightWords.length - 1]) / ((new Date(data[0].timestamp) - new Date(data[data.length - 1].timestamp)) / (1000 * 60 * 60 * 24 * 7))).toFixed(1) + ' words/week' : 'Insufficient data'
            };

            // Check milestones
            if (sightWords[0] >= 50 && sightWords[sightWords.length - 1] < 50) {
                analysis.milestones.push('🎉 Reached 50 sight words!');
            }
            if (sightWords[0] >= 75 && sightWords[sightWords.length - 1] < 75) {
                analysis.milestones.push('🎉 Reached 75 sight words!');
            }
        }

        // Analyze homework progress (Evander)
        const homeworkData = data.filter(d => d.focus_level !== undefined);
        if (homeworkData.length > 0) {
            const focusLevels = homeworkData.map(d => d.focus_level).filter(n => !isNaN(n));
            const durations = homeworkData.map(d => d.duration_min).filter(n => !isNaN(n));

            analysis.trends.homework = {
                total_sessions: homeworkData.length,
                avg_focus: focusLevels.length > 0 ?
                    (focusLevels.reduce((a, b) => a + b, 0) / focusLevels.length).toFixed(1) : 'N/A',
                avg_duration: durations.length > 0 ?
                    (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0) + ' min' : 'N/A',
                focus_trend: focusLevels.length >= 2 && focusLevels[0] > focusLevels[focusLevels.length - 1] ? 'improving' : 'stable'
            };
        }

        return analysis;
    }

    async synthesizeProgressReport(queryAnalysis, historicalData, progressAnalysis) {
        const childProfile = this.childProfiles[queryAnalysis.child];

        const prompt = `Generate a parent-friendly progress report:

CHILD: ${queryAnalysis.child} (${childProfile?.age} years old)
TIME PERIOD: ${progressAnalysis.date_range.oldest} to ${progressAnalysis.date_range.newest}
TOTAL SESSIONS: ${progressAnalysis.total_sessions}

PROGRESS DATA:
${JSON.stringify(progressAnalysis, null, 2)}

RECENT SESSIONS (last 5):
${JSON.stringify(historicalData.slice(0, 5), null, 2)}

Provide:
1. Overall progress summary (2-3 sentences)
2. Key wins and achievements
3. Areas needing attention
4. Specific action steps for next week
5. Goal attainment probability (if applicable)

Format as parent-friendly report (300 words max).`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 2000
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
            console.error('⚠️  Error generating report:', error.message);
            return this.fallbackProgressReport(progressAnalysis, childProfile);
        }
    }

    fallbackProgressReport(progressAnalysis, childProfile) {
        let report = `## Progress Report\n\n`;
        report += `**Child:** ${childProfile ? childProfile.age + ' years old' : 'Unknown'}\n`;
        report += `**Total Sessions:** ${progressAnalysis.total_sessions}\n\n`;

        if (progressAnalysis.trends.reading) {
            const r = progressAnalysis.trends.reading;
            report += `### Reading Progress:\n`;
            report += `- Current sight words: **${r.current_sight_words}**\n`;
            report += `- Progress rate: ${r.progress_rate}\n`;
            report += `- Average frustration: ${r.avg_frustration}/10\n`;
            report += `- Sessions completed: ${r.total_sessions}\n\n`;
        }

        if (progressAnalysis.trends.homework) {
            const h = progressAnalysis.trends.homework;
            report += `### Homework Progress:\n`;
            report += `- Average focus: ${h.avg_focus}/10\n`;
            report += `- Average duration: ${h.avg_duration}\n`;
            report += `- Trend: ${h.focus_trend}\n`;
            report += `- Sessions completed: ${h.total_sessions}\n\n`;
        }

        if (progressAnalysis.milestones.length > 0) {
            report += `### Milestones Achieved:\n`;
            progressAnalysis.milestones.forEach(m => report += `${m}\n`);
            report += `\n`;
        }

        report += `**Keep up the consistent tracking!**`;

        return report;
    }

    /**
     * COMPARE PROGRESS - Before/after analysis
     */
    async compareProgress(queryAnalysis, context) {
        console.log('📈 Comparing progress...');

        const allData = await this.retrieveChildData(queryAnalysis.child, 60);

        if (allData.length < 10) {
            return {
                comparison: 'Need at least 10 sessions for meaningful comparison analysis.',
                data_points: allData.length
            };
        }

        // Split into two periods
        const mid = Math.floor(allData.length / 2);
        const recentPeriod = allData.slice(0, mid);
        const earlierPeriod = allData.slice(mid);

        const recentAnalysis = this.analyzeProgressData(recentPeriod, queryAnalysis);
        const earlierAnalysis = this.analyzeProgressData(earlierPeriod, queryAnalysis);

        const comparison = this.compareAnalyses(recentAnalysis, earlierAnalysis);

        return {
            comparison: comparison,
            recent_sessions: recentPeriod.length,
            earlier_sessions: earlierPeriod.length
        };
    }

    compareAnalyses(recent, earlier) {
        let comp = `## Progress Comparison\n\n`;
        comp += `**Recent Period:** ${recent.total_sessions} sessions\n`;
        comp += `**Earlier Period:** ${earlier.total_sessions} sessions\n\n`;

        // Compare reading
        if (recent.trends.reading && earlier.trends.reading) {
            const wordDiff = recent.trends.reading.current_sight_words - 
                           (earlier.trends.reading.current_sight_words || 0);
            const frustDiff = parseFloat(recent.trends.reading.avg_frustration) - 
                            parseFloat(earlier.trends.reading.avg_frustration);

            comp += `### Reading:\n`;
            comp += `- Sight words gained: **+${wordDiff}** words\n`;
            comp += `- Frustration change: ${frustDiff > 0 ? '📈 +' : '📉 '}${frustDiff.toFixed(1)}\n`;
            comp += `- ${wordDiff > 0 ? '✅ Improving!' : '⚠️ Needs attention'}\n\n`;
        }

        // Compare homework
        if (recent.trends.homework && earlier.trends.homework) {
            const focusDiff = parseFloat(recent.trends.homework.avg_focus) - 
                            parseFloat(earlier.trends.homework.avg_focus);

            comp += `### Homework:\n`;
            comp += `- Focus change: ${focusDiff > 0 ? '📈 +' : '📉 '}${focusDiff.toFixed(1)}\n`;
            comp += `- ${focusDiff > 0 ? '✅ Improving!' : '⚠️ Needs attention'}\n\n`;
        }

        return comp;
    }

    /**
     * PROVIDE GUIDANCE - General parenting advice
     */
    async provideGuidance(userQuery, queryAnalysis, context) {
        const parentingData = await this.retrieveChildData(queryAnalysis.child, 14);
        const childProfile = queryAnalysis.child ? this.childProfiles[queryAnalysis.child] : null;

        const prompt = `USER QUERY: "${userQuery}"

${childProfile ? `CHILD PROFILE:\n${JSON.stringify(childProfile, null, 2)}\n\n` : ''}

${parentingData.length > 0 ? `RECENT DATA (${parentingData.length} sessions):\n${JSON.stringify(parentingData.slice(0, 3), null, 2)}\n\n` : ''}

Provide specific parenting guidance (300 words):`;

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.5,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return {
                guidance: response.data.choices[0].message.content,
                data_points: parentingData.length
            };

        } catch (error) {
            console.error('⚠️  Error generating guidance:', error.message);
            return {
                guidance: this.fallbackGuidance(queryAnalysis, childProfile),
                data_points: parentingData.length
            };
        }
    }

    fallbackGuidance(queryAnalysis, childProfile) {
        return `## Parenting Guidance

I can help you with:
- 📝 **Log sessions:** "Amelia practiced 10 sight words today, mastered 3"
- 📊 **Progress reports:** "Show me Amelia's reading progress"
- 📈 **Compare progress:** "How has Evander improved this month?"

**Start tracking to get personalized insights!**`;
    }

    flattenForAzure(data) {
    const flattened = {};
    
    for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
            // Convert arrays to comma-separated strings
            flattened[key] = value.join(', ');
        } else if (typeof value === 'object' && value !== null) {
            // Flatten nested objects
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (Array.isArray(nestedValue)) {
                    flattened[nestedKey] = nestedValue.join(', ');
                } else {
                    flattened[nestedKey] = nestedValue;
                }
            }
        } else {
            flattened[key] = value;
        }
    }
    
    return flattened;
    }
}

module.exports = FatherAgent;
