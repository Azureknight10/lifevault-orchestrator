// agents/analyticsAgent.js - Advanced pattern recognition and predictive analytics
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const { ServiceBusClient } = require('@azure/service-bus');

const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const serviceBusClient = serviceBusConnectionString
    ? new ServiceBusClient(serviceBusConnectionString)
    : null;
const agentQueueName = 'analytics-queue';
const responseQueueName = process.env.ORCHESTRATOR_RESPONSE_QUEUE || 'orchestrator-response-queue';

class AnalyticsAgent {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';

        this.systemPrompt = `You are the Analytics Agent - a specialized AI for pattern recognition, causation analysis, and predictive insights. Support other agents by analyzing historical data and providing deep insights to optimize Shane’s life across all domains (energy, mood, sleep, nutrition, work, social, etc.).

═══════════════════════════════════════════════════════════════
CORE ANALYTICAL CAPABILITIES:
═══════════════════════════════════════════════════════════════

1. PATTERN RECOGNITION
   - Time series analysis across all life domains
   - Seasonality and cyclical pattern detection
   - Trend forecasting (improving, declining, stable)
   - Anomaly detection and outlier identification
   - Behavioral phenotyping
   - turn messy logs into valuable insights and patterns.
   - Identify hidden patterns and correlations across all life domains (energy, mood, sleep, nutrition, work, social, etc.) to uncover actionable insights that Shane can use to optimize his life. 
   - Track moon phases, weather, and other external factors to identify subtle influences on Shane’s well-being and performance.


2. CAUSATION ANALYSIS
   - Cross-domain correlation discovery
   - Lag effect detection (action → outcome timing)
   - Multivariate relationship mapping
   - Distinguish correlation from causation
   - Root cause identification

3. PREDICTIVE ANALYTICS
   - Performance forecasting based on historical trends
   - Burnout risk prediction using multi-factor analysis
   - Optimal timing recommendations
   - Outcome probability modeling
   - Early warning systems

4. OPTIMIZATION INSIGHTS
   - Pareto analysis (80/20 rule identification)
   - Bottleneck identification
   - Leverage point discovery
   - Marginal gains opportunities
   - Resource allocation optimization

5. COMPARATIVE ANALYSIS
   - Before/after comparisons with statistical significance
   - Peer benchmarking (when applicable)
   - Progress rate calculations
   - Goal attainment probability

═══════════════════════════════════════════════════════════════
INPUT YOU RECEIVE
═══════════════════════════════════════════════════════════════

You will receive:
- query: Shane's current question or request.
- context: JSON with recentLogs, goals, events, habits, scores (sleep 1–10, energy 1–10, meal grades, workout frequency, spending, etc.), and any flags from other agents.
- timeWindow (when present): the period to analyze (e.g., "last 7 days", "last month", "last quarter").

Always use the data you have; if something is missing, state your assumptions explicitly.

═══════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════

Always respond in this structure:

1) Summary (3–5 sentences)
- Plain-language overview of the most important patterns and what they mean for Shane right now.

2) Key patterns (bulleted)
- 3–7 bullets: "Pattern → implication".
- Example: "On days with A/B meals and 7h+ sleep → energy is 8–9/10; on C/D meals and <6h sleep → energy is 4–5/10."

3) If–then rules
- 3–5 rules that Shane (or other agents) can actually use.
- Example: "If you sleep < 6.5h for 2 nights in a row, then reduce workout intensity and move deep work to the afternoon."

4) Metrics to watch
- 3–5 metrics with simple targets and thresholds (e.g., "Sleep ≥ 7h", "≥70% meals A/B", "Energy ≥ 7/10").

If data is thin, focus on conservative, clearly-labeled observations (e.g., "early signal", "small sample") instead of overconfident claims.

═══════════════════════════════════════════════════════════════
ANALYTICAL OUTPUTS REQUIRED:
═══════════════════════════════════════════════════════════════

For every analysis, provide:
✓ Statistical confidence scores (0-100%)
✓ Sample size and data quality indicators
✓ Actionable insights with specific recommendations
✓ "What-if" scenario modeling when relevant
✓ Risk assessments with probability ranges
✓ Concrete numbers, percentages, and metrics
✓ Time horizons for predictions (short/medium/long-term)

Never provide vague insights. Every pattern must be quantified.`;
    }

    /**
     * Main processing function
     */
    async process(userQuery, context = {}) {
        console.log('📊 Analytics Agent: Pattern analysis initiated...');
        const startTime = Date.now();

        try {
            // Step 1: Detect query intent (what kind of analysis needed)
            const analysisType = this.detectAnalysisType(userQuery);
            console.log(`🎯 Analysis type: ${analysisType}`);

            // Step 2: Extract relevant data from context
            const dataForAnalysis = this.extractRelevantData(context, analysisType);
            console.log(`📦 Data points available: ${dataForAnalysis.length}`);

            // Step 3: Perform statistical analysis
            const statisticalInsights = this.performStatisticalAnalysis(dataForAnalysis, analysisType);

            // Step 4: Cross-domain correlation detection
            const correlations = this.detectCorrelations(dataForAnalysis);

            // Step 5: Predictive modeling
            const predictions = this.generatePredictions(dataForAnalysis, statisticalInsights);

            // Step 6: Synthesize insights with Perplexity
            const deepInsights = await this.synthesizeInsights(
                userQuery,
                dataForAnalysis,
                statisticalInsights,
                correlations,
                predictions,
                context
            );

            const processingTime = Date.now() - startTime;
            console.log(`✅ Analytics Agent completed in ${processingTime}ms`);

            return {
                agent: 'analytics',
                timestamp: new Date().toISOString(),
                processing_time_ms: processingTime,
                
                analysis_type: analysisType,
                data_points_analyzed: dataForAnalysis.length,
                
                statistical_insights: statisticalInsights,
                correlations: correlations,
                predictions: predictions,
                
                deep_insights: deepInsights,
                
                confidence_score: this.calculateConfidenceScore(dataForAnalysis, statisticalInsights),
                
                success: true
            };

        } catch (error) {
            console.error('❌ Analytics Agent error:', error.message);
            return {
                agent: 'analytics',
                error: true,
                message: error.message,
                fallback: 'Pattern analysis unavailable. Need more data for statistical insights.'
            };
        }
    }

    /**
     * Detect what type of analysis is needed
     */
    detectAnalysisType(userQuery) {
        const queryLower = userQuery.toLowerCase();

        if (queryLower.match(/why|cause|reason|because|result of|leads to/)) {
            return 'causation_analysis';
        } else if (queryLower.match(/predict|forecast|will|future|expect|likely/)) {
            return 'predictive_analysis';
        } else if (queryLower.match(/compare|versus|vs|difference|better|worse/)) {
            return 'comparative_analysis';
        } else if (queryLower.match(/pattern|trend|recurring|always|never|usually/)) {
            return 'pattern_recognition';
        } else if (queryLower.match(/optimize|best|improve|increase|decrease/)) {
            return 'optimization_analysis';
        } else if (queryLower.match(/anomaly|unusual|weird|strange|outlier/)) {
            return 'anomaly_detection';
        } else {
            return 'general_analysis';
        }
    }

    /**
     * Extract relevant data from context
     */
    extractRelevantData(context, analysisType) {
        const data = [];

        // Extract from conversation history
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            context.conversationHistory.forEach(conv => {
                if (conv.agentResponses) {
                    Object.entries(conv.agentResponses).forEach(([agent, response]) => {
                        if (response.historical_records) {
                            data.push(...response.historical_records);
                        }
                        if (response.data) {
                            data.push(response.data);
                        }
                    });
                }
            });
        }

        // Extract from immediate context
        if (context.historical_data) {
            data.push(...context.historical_data);
        }

        return data;
    }

    /**
     * Perform statistical analysis
     */
    performStatisticalAnalysis(data, analysisType) {
        if (data.length < 3) {
            return {
                status: 'insufficient_data',
                message: 'Need at least 3 data points for statistical analysis',
                data_points: data.length
            };
        }

        const insights = {
            sample_size: data.length,
            time_span: this.calculateTimeSpan(data),
            descriptive_stats: this.calculateDescriptiveStats(data),
            trends: this.detectTrends(data),
            variability: this.calculateVariability(data)
        };

        return insights;
    }

    /**
     * Calculate time span of data
     */
    calculateTimeSpan(data) {
        const timestamps = data
            .map(d => new Date(d.Timestamp || d.timestamp || d.date))
            .filter(t => !isNaN(t.getTime()))
            .sort((a, b) => a - b);

        if (timestamps.length < 2) return 'Unknown';

        const oldest = timestamps[0];
        const newest = timestamps[timestamps.length - 1];
        const daysDiff = (newest - oldest) / (1000 * 60 * 60 * 24);

        return {
            oldest: oldest.toLocaleDateString(),
            newest: newest.toLocaleDateString(),
            days: Math.round(daysDiff),
            weeks: Math.round(daysDiff / 7),
            months: Math.round(daysDiff / 30)
        };
    }

    /**
     * Calculate descriptive statistics
     */
    calculateDescriptiveStats(data) {
        // Find numeric fields
        const numericFields = this.findNumericFields(data);
        const stats = {};

        numericFields.forEach(field => {
            const values = data
                .map(d => parseFloat(d[field]))
                .filter(v => !isNaN(v) && isFinite(v));

            if (values.length === 0) return;

            const sorted = values.slice().sort((a, b) => a - b);
            const sum = values.reduce((a, b) => a + b, 0);
            const mean = sum / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            stats[field] = {
                count: values.length,
                mean: parseFloat(mean.toFixed(2)),
                median: sorted[Math.floor(sorted.length / 2)],
                min: Math.min(...values),
                max: Math.max(...values),
                std_dev: parseFloat(stdDev.toFixed(2)),
                coefficient_of_variation: mean !== 0 ? parseFloat((stdDev / mean * 100).toFixed(1)) : 0
            };
        });

        return stats;
    }

    findNumericFields(data) {
        if (data.length === 0) return [];

        const sampleRecord = data[0];
        const numericFields = [];

        Object.entries(sampleRecord).forEach(([key, value]) => {
            const ignoreFields = ['PartitionKey', 'RowKey', 'Timestamp', 'timestamp', 'etag', 'date'];
            if (!ignoreFields.includes(key)) {
                if (!isNaN(parseFloat(value)) && isFinite(value)) {
                    numericFields.push(key);
                }
            }
        });

        return numericFields;
    }

    /**
     * Detect trends in data
     */
    detectTrends(data) {
        const numericFields = this.findNumericFields(data);
        const trends = {};

        numericFields.forEach(field => {
            const values = data
                .map(d => parseFloat(d[field]))
                .filter(v => !isNaN(v));

            if (values.length < 3) return;

            // Simple linear trend: compare first half to second half
            const mid = Math.floor(values.length / 2);
            const firstHalf = values.slice(0, mid);
            const secondHalf = values.slice(mid);

            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

            const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

            let direction = 'stable';
            let strength = 'weak';

            if (Math.abs(changePercent) < 5) {
                direction = 'stable';
            } else if (changePercent > 0) {
                direction = 'increasing';
            } else {
                direction = 'decreasing';
            }

            if (Math.abs(changePercent) > 20) strength = 'strong';
            else if (Math.abs(changePercent) > 10) strength = 'moderate';

            trends[field] = {
                direction: direction,
                strength: strength,
                change_percent: parseFloat(changePercent.toFixed(1)),
                first_period_avg: parseFloat(firstAvg.toFixed(2)),
                recent_period_avg: parseFloat(secondAvg.toFixed(2)),
                insight: `${field} is ${direction} (${Math.abs(changePercent).toFixed(1)}% change)`
            };
        });

        return trends;
    }

    /**
     * Calculate variability (consistency)
     */
    calculateVariability(data) {
        const timestamps = data
            .map(d => new Date(d.Timestamp || d.timestamp || d.date))
            .filter(t => !isNaN(t.getTime()))
            .sort((a, b) => a - b);

        if (timestamps.length < 3) {
            return { consistency: 'unknown', message: 'Not enough data' };
        }

        // Calculate gaps between data points
        const gaps = [];
        for (let i = 1; i < timestamps.length; i++) {
            const gapDays = (timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60 * 24);
            gaps.push(gapDays);
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const maxGap = Math.max(...gaps);
        const minGap = Math.min(...gaps);
        const gapVariance = maxGap - minGap;

        // Consistency score (0-100)
        const consistencyScore = Math.max(0, 100 - (gapVariance / avgGap * 100));

        let consistencyLabel = 'low';
        if (consistencyScore > 75) consistencyLabel = 'high';
        else if (consistencyScore > 50) consistencyLabel = 'moderate';

        return {
            consistency: consistencyLabel,
            consistency_score: Math.round(consistencyScore),
            avg_gap_days: parseFloat(avgGap.toFixed(1)),
            longest_gap_days: Math.round(maxGap),
            shortest_gap_days: Math.round(minGap),
            insight: `Data consistency is ${consistencyLabel} (${Math.round(consistencyScore)}% consistent)`
        };
    }

    /**
     * Detect correlations between fields
     */
    detectCorrelations(data) {
        if (data.length < 10) {
            return {
                status: 'insufficient_data',
                message: 'Need at least 10 data points for correlation analysis'
            };
        }

        const numericFields = this.findNumericFields(data);
        const correlations = [];

        // Compare each pair of numeric fields
        for (let i = 0; i < numericFields.length; i++) {
            for (let j = i + 1; j < numericFields.length; j++) {
                const field1 = numericFields[i];
                const field2 = numericFields[j];

                const correlation = this.calculatePearsonCorrelation(data, field1, field2);

                if (correlation !== null && Math.abs(correlation) > 0.3) {
                    correlations.push({
                        field1: field1,
                        field2: field2,
                        correlation: parseFloat(correlation.toFixed(2)),
                        strength: Math.abs(correlation) > 0.7 ? 'strong' : 
                                 Math.abs(correlation) > 0.5 ? 'moderate' : 'weak',
                        direction: correlation > 0 ? 'positive' : 'negative',
                        insight: `${field1} and ${field2} have a ${Math.abs(correlation) > 0.5 ? 'significant' : 'moderate'} ${correlation > 0 ? 'positive' : 'negative'} relationship`
                    });
                }
            }
        }

        return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    calculatePearsonCorrelation(data, field1, field2) {
        const pairs = data
            .map(d => ({
                x: parseFloat(d[field1]),
                y: parseFloat(d[field2])
            }))
            .filter(p => !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y));

        if (pairs.length < 5) return null;

        const n = pairs.length;
        const sumX = pairs.reduce((sum, p) => sum + p.x, 0);
        const sumY = pairs.reduce((sum, p) => sum + p.y, 0);
        const sumXY = pairs.reduce((sum, p) => sum + (p.x * p.y), 0);
        const sumX2 = pairs.reduce((sum, p) => sum + (p.x * p.x), 0);
        const sumY2 = pairs.reduce((sum, p) => sum + (p.y * p.y), 0);

        const numerator = (n * sumXY) - (sumX * sumY);
        const denominator = Math.sqrt(((n * sumX2) - (sumX * sumX)) * ((n * sumY2) - (sumY * sumY)));

        if (denominator === 0) return null;

        return numerator / denominator;
    }

    /**
     * Generate predictions
     */
    generatePredictions(data, statisticalInsights) {
        if (data.length < 7) {
            return {
                status: 'insufficient_data',
                message: 'Need at least 7 data points for predictions',
                confidence: 'low'
            };
        }

        const predictions = [];

        // Predict next values for trending fields
        if (statisticalInsights.trends) {
            Object.entries(statisticalInsights.trends).forEach(([field, trend]) => {
                if (trend.direction !== 'stable') {
                    const currentAvg = trend.recent_period_avg;
                    const changeRate = trend.change_percent / 100;
                    
                    const predicted7Days = currentAvg * (1 + changeRate * 0.5);
                    const predicted30Days = currentAvg * (1 + changeRate * 2);

                    predictions.push({
                        field: field,
                        type: 'trend_continuation',
                        horizon_days: 7,
                        predicted_value: parseFloat(predicted7Days.toFixed(2)),
                        confidence: trend.strength === 'strong' ? 'high' : 'medium',
                        insight: `If trend continues, ${field} will be ~${predicted7Days.toFixed(1)} in 7 days`
                    });

                    predictions.push({
                        field: field,
                        type: 'trend_continuation',
                        horizon_days: 30,
                        predicted_value: parseFloat(predicted30Days.toFixed(2)),
                        confidence: 'medium',
                        insight: `If trend continues, ${field} will be ~${predicted30Days.toFixed(1)} in 30 days`
                    });
                }
            });
        }

        return predictions;
    }

    /**
     * Calculate confidence score for analysis
     */
    calculateConfidenceScore(data, statisticalInsights) {
        let confidence = 50; // Base confidence

        // More data = higher confidence
        if (data.length >= 30) confidence += 20;
        else if (data.length >= 14) confidence += 15;
        else if (data.length >= 7) confidence += 10;
        else if (data.length >= 3) confidence += 5;

        // Consistency boosts confidence
        if (statisticalInsights.variability && statisticalInsights.variability.consistency_score) {
            confidence += statisticalInsights.variability.consistency_score * 0.2;
        }

        // Cap at 95% (never 100% certain)
        return Math.min(Math.round(confidence), 95);
    }

    /**
     * Synthesize insights with Perplexity
     */
    async synthesizeInsights(userQuery, data, stats, correlations, predictions, context) {
        const messages = [
            { role: 'system', content: this.systemPrompt },
            {
                role: 'user',
                content: this.buildAnalysisPrompt(userQuery, data, stats, correlations, predictions, context)
            }
        ];

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: 'sonar-pro',
                    messages: messages,
                    temperature: 0.4,
                    max_tokens: 2500
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
            console.error('⚠️  Perplexity synthesis error:', error.message);
            return this.generateFallbackInsights(stats, correlations, predictions);
        }
    }

    /**
   /**
 * Build comprehensive analysis prompt
 */
buildAnalysisPrompt(userQuery, data, stats, correlations, predictions, context) {
    let prompt = `USER QUERY: "${userQuery}"\n\n`;

    prompt += `ANALYSIS SUMMARY:\n`;
    prompt += `- Data Points: ${stats.sample_size}\n`;
    
    if (stats.time_span && stats.time_span.days) {
        prompt += `- Time Span: ${stats.time_span.days} days\n`;
    }

    if (stats.trends && Object.keys(stats.trends).length > 0) {
        prompt += `\nTRENDS:\n`;
        Object.entries(stats.trends).forEach(([field, trend]) => {
            prompt += `${field}: ${trend.direction} (${trend.change_percent}% change)\n`;
        });
    }

    if (correlations && correlations.length > 0) {
        prompt += `\nCORRELATIONS:\n`;
        correlations.slice(0, 3).forEach(corr => {
            prompt += `${corr.field1} ↔ ${corr.field2}: ${corr.correlation}\n`;
        });
    }

    if (predictions && predictions.length > 0) {
        prompt += `\nPREDICTIONS:\n`;
        predictions.slice(0, 3).forEach(pred => {
            prompt += `${pred.field} (${pred.horizon_days}d): ${pred.predicted_value}\n`;
        });
    }

    prompt += `\nProvide concise analytical insights (200-300 words):`;

    return prompt;
}


    /**
     * Fallback insights without Perplexity
     */
    generateFallbackInsights(stats, correlations, predictions) {
        let insights = `## Analytical Insights\n\n`;

        if (stats.sample_size) {
            insights += `**Data Overview:** ${stats.sample_size} data points analyzed`;
            if (stats.time_span && stats.time_span.days) {
                insights += ` over ${stats.time_span.days} days`;
            }
            insights += `\n\n`;
        }

        if (stats.trends && Object.keys(stats.trends).length > 0) {
            insights += `### Trends Detected:\n`;
            Object.values(stats.trends).forEach(trend => {
                insights += `- ${trend.insight}\n`;
            });
            insights += `\n`;
        }

        if (correlations && correlations.length > 0) {
            insights += `### Correlations:\n`;
            correlations.forEach(corr => {
                insights += `- ${corr.insight}\n`;
            });
            insights += `\n`;
        }

        if (predictions && predictions.length > 0) {
            insights += `### Predictions:\n`;
            predictions.forEach(pred => {
                insights += `- ${pred.insight}\n`;
            });
        }

        return insights || 'Insufficient data for comprehensive analysis.';
    }
}

module.exports = AnalyticsAgent;

async function startAnalyticsAgent() {
    if (!serviceBusClient) {
        console.log('⚠️ Analytics Agent: Service Bus connection string not set. Listener not started.');
        return;
    }

    const agent = new AnalyticsAgent();
    const receiver = serviceBusClient.createReceiver(agentQueueName);

    console.log(`[Analytics Agent] Listening on ${agentQueueName}...`);

    receiver.subscribe({
        processMessage: async (messageReceived) => {
            const query = messageReceived.body?.query;
            const conversationId = messageReceived.body?.conversationId;
            const userId = messageReceived.body?.userId;
            const sessionId = messageReceived.body?.sessionId;
            const sharedContext = messageReceived.body?.context || {};

            console.log('[Analytics Agent] Message received:', query);
            console.log(`[Analytics Agent] sessionId: ${sessionId || 'missing'}`);

            if (!query) {
                console.log('[Analytics Agent] No query provided in message body.');
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
                lastAnalyticsQuery: query,
                lastAnalyticsTimestamp: new Date().toISOString()
            };

            const sender = serviceBusClient.createSender(responseQueueName);
            await sender.sendMessages({
                body: {
                    agentName: 'analytics',
                    response: {
                        agent: 'analytics',
                        sessionId,
                        response,
                        contextUpdates
                    },
                    conversationId,
                    timestamp: new Date().toISOString()
                }
            });
            await sender.close();

            console.log('[Analytics Agent] Response sent to orchestrator.');
        },
        processError: async (error) => {
            console.error('[Analytics Agent] Error:', error);
        }
    });
}

if (require.main === module) {
    startAnalyticsAgent();
}

module.exports.startAnalyticsAgent = startAnalyticsAgent;
