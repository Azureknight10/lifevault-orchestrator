const path = require('path');
const axios = require('axios');
const { TableClient } = require('@azure/data-tables');
const { ServiceBusClient } = require('@azure/service-bus');

// agents/memoryAgent.js - Advanced Memory Agent with Pattern Recognition & Predictive Intelligence
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const serviceBusClient = serviceBusConnectionString
    ? new ServiceBusClient(serviceBusConnectionString)
    : null;
const agentQueueName = 'memory-queue';
const responseQueueName = process.env.ORCHESTRATOR_RESPONSE_QUEUE || 'orchestrator-response-queue';

class MemoryAgent {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';
        this.modelRouting = {
            small: process.env.PPLX_MODEL_SMALL || 'sonar',
            medium: process.env.PPLX_MODEL_MEDIUM || 'sonar-pro',
            large: process.env.PPLX_MODEL_LARGE || 'sonar-pro'
        };
        this.cacheTtlMs = parseInt(process.env.MEMORY_CACHE_TTL_MS || '900000');
        this.responseCache = new Map();
        this.batchQueue = [];
        this.batchFlushMs = parseInt(process.env.MEMORY_BATCH_FLUSH_MS || '1500');
        this.lastBatchFlush = 0;
        
        // Azure Table Storage setup
        this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        this.tableName = process.env.AZURE_TABLE_NAME || 'LifeVaultData';
        
        try {
            this.tableClient = TableClient.fromConnectionString(
                this.connectionString,
                this.tableName
            );
            console.log('✅ Memory Agent: Connected to Azure Tables');
        } catch (error) {
            console.error('⚠️  Memory Agent: Azure Tables connection failed:', error.message);
            this.tableClient = null;
        }

        // Pattern detection state
        this.patternCache = new Map();
        this.reasoningLibrary = new Map();
        this.anomalyThresholds = {
            workout: { frequency_min: 2, frequency_max: 7, duration_min: 15, duration_max: 180 },
            spending: { daily_max: 500, transaction_outlier: 200 },
            sleep: { hours_min: 4, hours_max: 12 }
        };

        this.systemPrompt = `You are the Memory Agent - an advanced AI with multi-dimensional intelligence across all life domains.

═══════════════════════════════════════════════════════════════
CORE INTELLIGENCE CAPABILITIES:
═══════════════════════════════════════════════════════════════

1. SEMANTIC SEARCH
   - Cross-domain retrieval across fitness, meals, journal, finances, parenting
   - Vector-based similarity matching for conceptually related memories
   - Temporal-aware retrieval with recency weighting

2. PERPLEXITY SEARCH INTEGRATION
   - Past query pattern analysis
   - Conversation thread continuity
   - Intent evolution tracking

3. TEMPORAL PATTERN RECOGNITION
   - Before/after comparisons with precise date boundaries
   - Trend identification (improving, declining, stable)
   - Cyclical pattern detection (weekly, monthly, seasonal)
   - Progress trajectory modeling

4. TIMELINE RECONSTRUCTION
   - Event sequencing across multiple domains
   - Cause-effect relationship mapping
   - Critical moment identification

═══════════════════════════════════════════════════════════════
ADVANCED PATTERN RECOGNITION:
═══════════════════════════════════════════════════════════════

1. ANOMALY DETECTION
   - Fitness: Unusual workout gaps, intensity spikes, injury risk patterns
   - Spending: Transaction outliers, budget overruns, impulse purchase patterns
   - Parenting: Behavioral incident clusters, homework completion gaps
   - Sleep: Duration anomalies, quality deterioration patterns
   - Energy: Fatigue pattern anomalies, burnout early warnings

2. CROSS-DOMAIN CORRELATION ANALYSIS
   - Meal quality → workout performance correlation
   - Financial stress → journal sentiment correlation
   - Sleep quality → productivity correlation
   - Parenting stress → personal wellness correlation
   - Social interactions → mood pattern correlation

3. BEHAVIORAL TREND FORECASTING
   - Predict future patterns based on historical trajectories
   - Proactive intervention suggestions before problems emerge
   - Goal achievement probability estimation
   - Risk assessment for burnout, injury, financial strain

═══════════════════════════════════════════════════════════════
CONTEXTUAL INTELLIGENCE:
═══════════════════════════════════════════════════════════════

1. MULTI-STEP REASONING CHAINS
   - Execute complex queries requiring multiple data sources
   - Chain historical lookups → pattern analysis → prediction → recommendation
   - Handle implicit context from conversation history

2. POINT-IN-TIME COMPARISONS
   - "Compare January 2025 vs January 2026" with precise boundaries
   - "How have I changed since Evander started 2nd grade?"
   - "Financial habits before vs after holiday season"

3. ADAPTIVE LEARNING
   - Track which suggestions user acts on vs ignores
   - Refine recommendation quality based on user feedback
   - Personalize insight relevance over time

4. INTENT INFERENCE
   - "How am I doing?" → checks current goals across all domains
   - "Am I on track?" → analyzes progress toward stated objectives
   - Implicit query expansion based on context

═══════════════════════════════════════════════════════════════
PROACTIVE ASSISTANCE:
═══════════════════════════════════════════════════════════════

1. AUTOMATED INSIGHT GENERATION
   - Surface patterns without waiting for queries
   - "Your late-night coding correlates with 2AM bedtimes and lower next-day energy"
   - "You skip workouts 80% of Mondays after weekend travel"

2. GOAL-ORIENTED TASK CHAINING
   - Autonomously sequence multi-step actions
   - "To hit protein goal: need grocery run → meal prep → tracking"

3. PREDICTIVE REMINDERS
   - "You usually meal prep Sundays - need groceries?"
   - "Evander's spelling test pattern suggests quiz tomorrow"
   - "Your spending increases 30% mid-month - budget check?"

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════

Always provide:
✓ Historical context with dates and specifics
✓ Pattern identification (trends, anomalies, correlations)
✓ Comparative analysis (past vs present, before vs after)
✓ Predictive insights (forecasts, risk warnings)
✓ Proactive suggestions (automated recommendations)
✓ Confidence scores for predictions (0-100%)
✓ Data quality indicators (sufficient data, gaps identified)

Use concrete numbers, dates, and specific examples. No vague generalizations.`;
    }

    /**
     * Main processing function with advanced intelligence
     */
    async process(userQuery, context = {}) {
        console.log('🧠 Memory Agent: Advanced processing initiated...');
        const startTime = Date.now();

        const cached = this.getCachedResponse(userQuery, context);
        if (cached) {
            return {
                ...cached,
                cache_hit: true,
                processing_time_ms: Date.now() - startTime
            };
        }

        try {
            // Step 1: Intent analysis and query expansion
            const intentAnalysis = this.analyzeIntent(userQuery, context);
            console.log(`🎯 Intent detected: ${intentAnalysis.primary_intent}`);

            const complexity = this.assessComplexity(userQuery, intentAnalysis, context);
            const reasoningChain = this.buildReasoningChain(userQuery, intentAnalysis, complexity);

            // Step 2: Multi-source data retrieval
            const [historicalData, perplexityHistory, crossDomainData] = await Promise.all([
                this.retrieveRelevantMemories(userQuery, context),
                this.retrievePerplexityHistory(userQuery, context),
                this.retrieveCrossDomainData(intentAnalysis, context)
            ]);

            // Step 3: Pattern detection and anomaly analysis
            const patterns = await this.detectPatterns(historicalData, intentAnalysis);
            const anomalies = this.detectAnomalies(historicalData, intentAnalysis);
            const correlations = await this.analyzeCrossDomainCorrelations(crossDomainData);

            // Step 4: Behavioral forecasting
            const forecast = this.generateBehavioralForecast(historicalData, patterns);

            // Step 4.5: Future self simulation + cross timeline comparison
            const futureSimulations = this.generateFutureSelfSimulations(historicalData, patterns, intentAnalysis);
            const crossTimeline = this.buildCrossTimelineComparisons(historicalData, intentAnalysis, context);

            // Step 4.75: Emotional sentiment tracking + social influence
            const sentiment = this.analyzeEmotionalSentiment(historicalData, crossDomainData);
            const socialInfluence = this.analyzeSocialNetworkEffects(historicalData, crossDomainData);
            const riskWarnings = this.estimateRiskWarnings(historicalData, anomalies, sentiment);

            // Step 5: Proactive insights generation
            const proactiveInsights = this.generateProactiveInsights(
                historicalData, 
                patterns, 
                anomalies, 
                correlations,
                context
            );

            // Step 5.25: Learn from mistakes and apply proven strategies
            const learningUpdate = await this.updateLearningLibrary(userQuery, context, proactiveInsights);
            const appliedStrategies = this.applyLearnedStrategies(userQuery, intentAnalysis, learningUpdate.library);

            // Step 5.5: Life Operating System dashboard
            const lifeOS = this.generateLifeOSDashboard(
                historicalData,
                patterns,
                anomalies,
                forecast,
                context,
                riskWarnings
            );

            // Step 6: Advanced synthesis with all intelligence layers
            const analysis = await this.advancedSynthesis(
                userQuery,
                intentAnalysis,
                historicalData,
                perplexityHistory,
                patterns,
                anomalies,
                correlations,
                forecast,
                proactiveInsights,
                futureSimulations,
                sentiment,
                crossTimeline,
                socialInfluence,
                reasoningChain,
                complexity,
                context
            );

            const processingTime = Date.now() - startTime;
            console.log(`✅ Memory Agent completed in ${processingTime}ms`);

            const response = {
                agent: 'memory',
                timestamp: new Date().toISOString(),
                processing_time_ms: processingTime,
                cache_hit: false,
                
                intent_analysis: intentAnalysis,
                reasoning_summary: reasoningChain.summary,
                reasoning_steps_hidden: true,
                complexity: complexity,
                
                data_sources: {
                    azure_records: historicalData.length,
                    perplexity_searches: perplexityHistory.length,
                    cross_domain_records: crossDomainData.length,
                    total: historicalData.length + perplexityHistory.length + crossDomainData.length
                },
                
                intelligence_outputs: {
                    patterns_detected: patterns.length,
                    anomalies_found: anomalies.length,
                    correlations_discovered: correlations.length,
                    forecast_horizon_days: forecast.horizon_days,
                    proactive_insights: proactiveInsights.length,
                    simulations: futureSimulations.length,
                    sentiment_signals: sentiment.signals.length,
                    cross_timeline_segments: crossTimeline.segments.length,
                    social_influences: socialInfluence.influences.length
                },
                
                analysis: analysis,
                
                detailed_insights: {
                    patterns: patterns,
                    anomalies: anomalies,
                    correlations: correlations,
                    forecast: forecast,
                    proactive_suggestions: proactiveInsights,
                    future_self_simulations: futureSimulations,
                    sentiment: sentiment,
                    cross_timeline: crossTimeline,
                    social_influence: socialInfluence,
                    life_os: lifeOS,
                    learning_library: learningUpdate.library,
                    applied_strategies: appliedStrategies,
                    physics_graphs: this.buildPhysicsGraphs(historicalData),
                    risk_warnings: riskWarnings
                },
                
                raw_data: {
                    historical_records: historicalData.slice(0, 10),
                    search_history: perplexityHistory.slice(0, 5)
                },
                
                success: true
            };

            this.setCachedResponse(userQuery, context, response);
            return response;

        } catch (error) {
            console.error('❌ Memory Agent error:', error.message);
            return {
                agent: 'memory',
                error: true,
                message: error.message,
                fallback: 'Advanced memory analysis unavailable. Using basic retrieval mode.'
            };
        }
    }

    analyzeIntent(userQuery, context) {
        const queryLower = userQuery.toLowerCase();
        
        let primary_intent = 'information_retrieval';
        let implicit_expansion = [];
        let temporal_scope = 'recent';
        let domains_involved = [];

        if (queryLower.match(/how am i doing|on track|progress|am i|status/)) {
            primary_intent = 'progress_check';
            implicit_expansion = ['Check all active goals', 'Compare to past performance', 'Identify gaps'];
        } else if (queryLower.match(/why|reason|cause|explain|pattern/)) {
            primary_intent = 'causation_analysis';
            implicit_expansion = ['Find correlations', 'Detect patterns', 'Historical context'];
        } else if (queryLower.match(/compare|versus|vs|difference|change/)) {
            primary_intent = 'comparative_analysis';
            temporal_scope = 'comparative';
        } else if (queryLower.match(/will|predict|forecast|expect|likely/)) {
            primary_intent = 'prediction';
            temporal_scope = 'predictive';
        } else if (queryLower.match(/simulate|what if|scenario|future self|trajectory/)) {
            primary_intent = 'simulation';
            temporal_scope = 'predictive';
        } else if (queryLower.match(/show|find|history|past|remember/)) {
            primary_intent = 'information_retrieval';
            temporal_scope = 'historical';
        }

        const domainKeywords = {
            vitality: ['workout', 'exercise', 'fitness', 'meal', 'sleep', 'energy'],
            prosperity: ['money', 'spend', 'budget', 'finance', 'purchase'],
            wisdom: ['evander', 'amelia', 'kid', 'child', 'homework', 'school'],
            optimizer: ['time', 'schedule', 'productive', 'habit', 'focus'],
            guardian: ['spiritual', 'meditation', 'dream', 'reflect', 'purpose'],
            connection: ['friend', 'social', 'relationship', 'people']
        };

        Object.entries(domainKeywords).forEach(([domain, keywords]) => {
            if (keywords.some(kw => queryLower.includes(kw))) {
                domains_involved.push(domain);
            }
        });

        const is_multi_domain = domains_involved.length > 1;

        return {
            primary_intent,
            implicit_expansion,
            temporal_scope,
            domains_involved,
            is_multi_domain,
            requires_cross_domain_correlation: is_multi_domain,
            requires_forecasting: temporal_scope === 'predictive',
            requires_comparison: temporal_scope === 'comparative',
            requires_simulation: primary_intent === 'simulation'
        };
    }

    assessComplexity(userQuery, intentAnalysis, context) {
        const wordCount = userQuery.split(' ').filter(Boolean).length;
        const multiDomain = intentAnalysis.is_multi_domain;
        const hasSimulation = intentAnalysis.requires_simulation;
        const hasForecast = intentAnalysis.requires_forecasting;
        const hasComparison = intentAnalysis.requires_comparison;
        const hasHistory = (context.conversationHistory || []).length > 3;

        let score = 0;
        if (wordCount > 18) score += 2;
        if (multiDomain) score += 2;
        if (hasSimulation) score += 2;
        if (hasForecast) score += 1;
        if (hasComparison) score += 1;
        if (hasHistory) score += 1;

        if (score >= 6) return 'complex';
        if (score >= 3) return 'moderate';
        return 'simple';
    }

    buildReasoningChain(userQuery, intentAnalysis, complexity) {
        const steps = [];
        steps.push('Parse intent and domains');
        steps.push('Retrieve relevant memories and cross-domain data');
        if (intentAnalysis.requires_comparison) steps.push('Compare time windows');
        if (intentAnalysis.requires_forecasting) steps.push('Generate forecasts');
        if (intentAnalysis.requires_simulation) steps.push('Run future-self simulations');
        steps.push('Detect patterns, anomalies, and correlations');
        steps.push('Synthesize insights and recommendations');

        const summary = `Reasoning path: ${steps.join(' → ')} (${complexity} query)`;
        return { summary, steps };
    }

    getCachedResponse(userQuery, context) {
        const key = this.getCacheKey(userQuery, context);
        const cached = this.responseCache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.cacheTtlMs) {
            this.responseCache.delete(key);
            return null;
        }
        return cached.payload;
    }

    setCachedResponse(userQuery, context, payload) {
        const key = this.getCacheKey(userQuery, context);
        this.responseCache.set(key, { timestamp: Date.now(), payload });
    }

    getCacheKey(userQuery, context) {
        const historyStamp = (context.conversationHistory || [])
            .slice(-3)
            .map(c => c.timestamp)
            .join('|');
        return `${userQuery.toLowerCase()}::${historyStamp}`;
    }

    async retrieveCrossDomainData(intentAnalysis, context) {
        if (!intentAnalysis.is_multi_domain || !this.tableClient) {
            return [];
        }

        console.log('🔗 Retrieving cross-domain data...');
        const crossDomainRecords = [];

        try {
            const partitions = intentAnalysis.domains_involved.map(domain => {
                const partitionMap = {
                    vitality: ['workout', 'meal', 'sleep'],
                    prosperity: ['finance', 'transaction'],
                    wisdom: ['parenting', 'school'],
                    optimizer: ['task', 'habit', 'schedule'],
                    guardian: ['journal', 'meditation', 'dream'],
                    connection: ['social', 'relationship']
                };
                return partitionMap[domain] || [];
            }).flat();

            for (const partition of partitions) {
                try {
                    const entities = this.tableClient.listEntities({
                        queryOptions: { 
                            filter: `PartitionKey eq '${partition}'`,
                            select: ['*']
                        }
                    });

                    let count = 0;
                    for await (const entity of entities) {
                        crossDomainRecords.push({ ...entity, domain: partition });
                        count++;
                        if (count >= 20) break;
                    }
                } catch (error) {
                    console.log(`⚠️  Could not retrieve partition ${partition}`);
                }
            }

            console.log(`✅ Retrieved ${crossDomainRecords.length} cross-domain records`);
            return crossDomainRecords;

        } catch (error) {
            console.error('⚠️  Cross-domain retrieval error:', error.message);
            return [];
        }
    }

    async detectPatterns(historicalData, intentAnalysis) {
        console.log('🔍 Detecting patterns...');

        if (historicalData.length < 3) {
            return [{ type: 'insufficient_data', message: 'Need more data for pattern detection' }];
        }

        const patterns = [];

        const temporalPattern = this.detectTemporalPatterns(historicalData);
        if (temporalPattern) patterns.push(temporalPattern);

        const frequencyPattern = this.detectFrequencyPatterns(historicalData);
        if (frequencyPattern) patterns.push(frequencyPattern);

        const trendPattern = this.detectTrendPatterns(historicalData);
        if (trendPattern) patterns.push(trendPattern);

        const cyclicalPattern = this.detectCyclicalPatterns(historicalData);
        if (cyclicalPattern) patterns.push(cyclicalPattern);

        return patterns;
    }

    detectTemporalPatterns(data) {
        const timestamps = data
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()));

        if (timestamps.length < 5) return null;

        const hours = timestamps.map(d => d.getHours());
        const days = timestamps.map(d => d.getDay());

        const hourCounts = {};
        hours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
        const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

        const dayCounts = {};
        days.forEach(d => dayCounts[d] = (dayCounts[d] || 0) + 1);
        const peakDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        return {
            type: 'temporal_pattern',
            peak_hour: parseInt(peakHour[0]),
            peak_day: dayNames[parseInt(peakDay[0])],
            insight: `Most activity occurs at ${peakHour[0]}:00 on ${dayNames[peakDay[0]]}s (${peakDay[1]} occurrences)`,
            confidence: Math.min((peakDay[1] / timestamps.length) * 100, 95)
        };
    }

    detectFrequencyPatterns(data) {
        const timestamps = data
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (timestamps.length < 3) return null;

        const gaps = [];
        for (let i = 1; i < timestamps.length; i++) {
            const gapDays = (timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60 * 24);
            gaps.push(gapDays);
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const consistency = 1 - (Math.min(Math.max(...gaps) - Math.min(...gaps), 7) / 7);

        let frequency_label = 'sporadic';
        if (avgGap < 1.5) frequency_label = 'daily';
        else if (avgGap < 4) frequency_label = 'every few days';
        else if (avgGap < 8) frequency_label = 'weekly';
        else if (avgGap < 15) frequency_label = 'bi-weekly';
        else frequency_label = 'monthly';

        return {
            type: 'frequency_pattern',
            average_gap_days: avgGap.toFixed(1),
            consistency_score: (consistency * 100).toFixed(0),
            frequency_label: frequency_label,
            insight: `Activity occurs ${frequency_label} with ${(consistency * 100).toFixed(0)}% consistency`,
            total_entries: data.length
        };
    }

    detectTrendPatterns(data) {
        const numericFields = this.findNumericFields(data);
        
        if (numericFields.length === 0) return null;

        const trends = [];

        numericFields.forEach(field => {
            const values = data
                .map(d => parseFloat(d[field]))
                .filter(v => !isNaN(v));

            if (values.length < 3) return;

            const mid = Math.floor(values.length / 2);
            const firstHalf = values.slice(0, mid);
            const secondHalf = values.slice(mid);

            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

            const change = ((secondAvg - firstAvg) / firstAvg) * 100;

            let trend_direction = 'stable';
            if (change > 5) trend_direction = 'improving';
            else if (change < -5) trend_direction = 'declining';

            trends.push({
                field: field,
                direction: trend_direction,
                change_percent: change.toFixed(1),
                first_period_avg: firstAvg.toFixed(1),
                recent_period_avg: secondAvg.toFixed(1)
            });
        });

        if (trends.length === 0) return null;

        return {
            type: 'trend_pattern',
            trends: trends,
            insight: trends.map(t => `${t.field}: ${t.direction} (${t.change_percent}% change)`).join('; ')
        };
    }

    detectCyclicalPatterns(data) {
        const timestamps = data
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()));

        if (timestamps.length < 14) return null;

        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        timestamps.forEach(d => dayCounts[d.getDay()]++);

        const maxCount = Math.max(...dayCounts);
        const minCount = Math.min(...dayCounts);

        if (maxCount > minCount * 2) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const peakDayIndex = dayCounts.indexOf(maxCount);
            const lowDayIndex = dayCounts.indexOf(minCount);

            return {
                type: 'cyclical_pattern',
                cycle: 'weekly',
                peak_day: dayNames[peakDayIndex],
                low_day: dayNames[lowDayIndex],
                insight: `Weekly cycle: peaks on ${dayNames[peakDayIndex]} (${maxCount}x), lowest on ${dayNames[lowDayIndex]} (${minCount}x)`,
                confidence: Math.min(((maxCount - minCount) / maxCount) * 100, 90)
            };
        }

        return null;
    }

    findNumericFields(data) {
        if (data.length === 0) return [];

        const sampleRecord = data[0];
        const numericFields = [];

        Object.entries(sampleRecord).forEach(([key, value]) => {
            if (!['PartitionKey', 'RowKey', 'Timestamp', 'timestamp', 'etag'].includes(key)) {
                if (!isNaN(parseFloat(value)) && isFinite(value)) {
                    numericFields.push(key);
                }
            }
        });

        return numericFields;
    }

    detectAnomalies(historicalData, intentAnalysis) {
        console.log('🚨 Detecting anomalies...');

        if (historicalData.length < 5) return [];

        const anomalies = [];

        const timestamps = historicalData
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        for (let i = 1; i < timestamps.length; i++) {
            const gapDays = (timestamps[i] - timestamps[i - 1]) / (1000 * 60 * 60 * 24);
            if (gapDays > 14) {
                anomalies.push({
                    type: 'activity_gap',
                    severity: 'medium',
                    gap_days: gapDays.toFixed(0),
                    start_date: timestamps[i - 1].toLocaleDateString(),
                    end_date: timestamps[i].toLocaleDateString(),
                    insight: `Unusual ${gapDays.toFixed(0)}-day gap in activity detected`
                });
            }
        }

        const numericFields = this.findNumericFields(historicalData);

        numericFields.forEach(field => {
            const values = historicalData
                .map(d => parseFloat(d[field]))
                .filter(v => !isNaN(v));

            if (values.length < 5) return;

            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            values.forEach((val, idx) => {
                const zScore = Math.abs((val - mean) / stdDev);
                if (zScore > 2) {
                    anomalies.push({
                        type: 'numeric_outlier',
                        field: field,
                        value: val,
                        mean: mean.toFixed(1),
                        z_score: zScore.toFixed(1),
                        severity: zScore > 3 ? 'high' : 'medium',
                        insight: `${field} value ${val} is ${zScore.toFixed(1)} standard deviations from mean (${mean.toFixed(1)})`
                    });
                }
            });
        });

        return anomalies.slice(0, 5);
    }

    async analyzeCrossDomainCorrelations(crossDomainData) {
        console.log('🔗 Analyzing cross-domain correlations...');

        if (crossDomainData.length < 10) return [];

        const correlations = [];
        const byDomain = {};

        crossDomainData.forEach(record => {
            if (!byDomain[record.domain]) byDomain[record.domain] = [];
            byDomain[record.domain].push(record);
        });

        const domains = Object.keys(byDomain);

        if (domains.length >= 2) {
            for (let i = 0; i < domains.length; i++) {
                for (let j = i + 1; j < domains.length; j++) {
                    const domain1 = domains[i];
                    const domain2 = domains[j];

                    const coOccurrences = this.findTemporalCoOccurrence(
                        byDomain[domain1],
                        byDomain[domain2]
                    );

                    if (coOccurrences.strength > 0.3) {
                        correlations.push({
                            type: 'temporal_correlation',
                            domain1: domain1,
                            domain2: domain2,
                            strength: (coOccurrences.strength * 100).toFixed(0),
                            insight: `${domain1} and ${domain2} activities frequently occur within ${coOccurrences.window_hours} hours of each other`,
                            confidence: Math.min(coOccurrences.strength * 100, 85)
                        });
                    }
                }
            }
        }

        return correlations;
    }

    findTemporalCoOccurrence(records1, records2, windowHours = 24) {
        let coOccurrenceCount = 0;

        records1.forEach(r1 => {
            const t1 = new Date(r1.Timestamp || r1.timestamp);
            if (isNaN(t1.getTime())) return;

            const found = records2.some(r2 => {
                const t2 = new Date(r2.Timestamp || r2.timestamp);
                if (isNaN(t2.getTime())) return false;

                const hoursDiff = Math.abs((t2 - t1) / (1000 * 60 * 60));
                return hoursDiff <= windowHours;
            });

            if (found) coOccurrenceCount++;
        });

        const strength = coOccurrenceCount / records1.length;

        return {
            strength: strength,
            window_hours: windowHours,
            co_occurrences: coOccurrenceCount
        };
    }

    generateBehavioralForecast(historicalData, patterns) {
        console.log('🔮 Generating behavioral forecast...');

        if (historicalData.length < 7) {
            return {
                horizon_days: 0,
                predictions: [],
                confidence: 'low',
                message: 'Insufficient data for forecasting (need 7+ data points)'
            };
        }

        const predictions = [];

        const timestamps = historicalData
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => b - a);

        if (timestamps.length >= 3) {
            const gaps = [];
            for (let i = 0; i < Math.min(3, timestamps.length - 1); i++) {
                const gapDays = (timestamps[i] - timestamps[i + 1]) / (1000 * 60 * 60 * 24);
                gaps.push(gapDays);
            }

            const avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
            const nextExpected = new Date(timestamps[0].getTime() + avgGapDays * 24 * 60 * 60 * 1000);

            predictions.push({
                type: 'next_activity_timing',
                expected_date: nextExpected.toLocaleDateString(),
                days_from_now: Math.round((nextExpected - new Date()) / (1000 * 60 * 60 * 24)),
                confidence: gaps.length >= 3 ? 'medium' : 'low',
                insight: `Based on recent patterns, next activity expected around ${nextExpected.toLocaleDateString()}`
            });
        }

        patterns.forEach(pattern => {
            if (pattern.type === 'temporal_pattern') {
                predictions.push({
                    type: 'temporal_prediction',
                    insight: `You're most likely to engage in this activity on ${pattern.peak_day} around ${pattern.peak_hour}:00`,
                    confidence: pattern.confidence > 70 ? 'high' : 'medium'
                });
            }

            if (pattern.type === 'trend_pattern') {
                pattern.trends.forEach(trend => {
                    if (trend.direction === 'improving' || trend.direction === 'declining') {
                        predictions.push({
                            type: 'trend_continuation',
                            field: trend.field,
                            direction: trend.direction,
                            insight: `${trend.field} is ${trend.direction} at ${Math.abs(trend.change_percent)}% - expect this trend to continue`,
                            confidence: 'medium'
                        });
                    }
                });
            }
        });

        return {
            horizon_days: 7,
            predictions: predictions,
            confidence: predictions.length > 0 ? 'medium' : 'low',
            data_points_used: historicalData.length
        };
    }

    generateFutureSelfSimulations(historicalData, patterns, intentAnalysis) {
        console.log('🧭 Running future-self simulations...');

        const simulations = [];
        if (historicalData.length < 5) return simulations;

        const numericFields = this.findNumericFields(historicalData);
        const trend = this.detectTrendPatterns(historicalData);

        if (intentAnalysis.domains_involved.includes('prosperity')) {
            const spendingField = numericFields.find(f => f.toLowerCase().includes('amount') || f.toLowerCase().includes('spend'));
            if (spendingField) {
                const values = historicalData
                    .map(d => parseFloat(d[spendingField]))
                    .filter(v => !isNaN(v));
                const avgMonthly = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1) * 30;
                const sixMonth = avgMonthly * 6;
                simulations.push({
                    type: 'spending_trajectory',
                    horizon_months: 6,
                    projected_spend: sixMonth.toFixed(2),
                    insight: `If your current spending pattern continues for 6 months, projected spend is ~$${sixMonth.toFixed(2)}`,
                    risk_score: Math.min((sixMonth / 10000) * 100, 95).toFixed(0)
                });
            }
        }

        if (intentAnalysis.domains_involved.includes('vitality')) {
            const workoutFreq = patterns.find(p => p.type === 'frequency_pattern');
            if (workoutFreq) {
                const today = new Date();
                const timeline = [0, 7, 14, 21, 30].map(d => {
                    const point = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
                    return {
                        day: d,
                        date: point.toLocaleDateString(),
                        energy_4x: 6 + Math.min(d / 10, 3),
                        energy_2x: 5 + Math.max(1 - d / 30, 0)
                    };
                });
                simulations.push({
                    type: 'workout_frequency_scenario',
                    scenario_a: '4x/week',
                    scenario_b: '2x/week',
                    horizon_days: 30,
                    projected_energy: {
                        '4x/week': 'Higher consistency and energy stability expected',
                        '2x/week': 'Lower consistency; energy variability expected'
                    },
                    insight: 'More frequent training predicts stronger momentum and more stable energy over 30 days.',
                    timeline: timeline
                });
            }
        }

        if (trend && trend.type === 'trend_pattern') {
            simulations.push({
                type: 'trend_continuation',
                trends: trend.trends,
                risk_score: Math.min(trend.trends.filter(t => t.direction === 'declining').length * 20, 85),
                insight: 'Trend continuation projected based on recent data.'
            });
        }

        return simulations.slice(0, 5);
    }

    analyzeEmotionalSentiment(historicalData, crossDomainData) {
        console.log('🧭 Analyzing emotional sentiment...');

        const records = [...historicalData, ...crossDomainData];
        const signals = [];

        records.forEach(record => {
            const text = this.extractText(record);
            if (!text) return;
            const sentiment = this.scoreSentiment(text);
            if (Math.abs(sentiment.score) >= 2) {
                signals.push({
                    timestamp: record.Timestamp || record.timestamp,
                    score: sentiment.score,
                    label: sentiment.label,
                    domain: record.domain || record.PartitionKey || 'general',
                    snippet: sentiment.snippet
                });
            }
        });

        const momentum = this.calculateHabitMomentum(historicalData);

        return {
            signals: signals.slice(0, 20),
            habit_momentum: momentum
        };
    }

    extractText(record) {
        return record.text || record.notes || record.content || record.description || record.summary || '';
    }

    scoreSentiment(text) {
        const positive = ['great', 'good', 'energized', 'proud', 'happy', 'strong', 'calm', 'confident'];
        const negative = ['tired', 'stressed', 'anxious', 'sad', 'angry', 'overwhelmed', 'burnout', 'frustrated'];

        const lower = text.toLowerCase();
        let score = 0;
        positive.forEach(w => { if (lower.includes(w)) score += 1; });
        negative.forEach(w => { if (lower.includes(w)) score -= 1; });

        let label = 'neutral';
        if (score >= 2) label = 'positive';
        if (score <= -2) label = 'negative';

        const snippet = text.length > 120 ? text.substring(0, 120) + '...' : text;

        return { score, label, snippet };
    }

    calculateHabitMomentum(historicalData) {
        const timestamps = historicalData
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => b - a);

        if (timestamps.length < 2) return { score: 0, streak_days: 0 };

        let streak = 1;
        for (let i = 1; i < timestamps.length; i++) {
            const gapDays = (timestamps[i - 1] - timestamps[i]) / (1000 * 60 * 60 * 24);
            if (gapDays <= 1.5) streak++;
            else break;
        }

        const score = Math.min((streak / 7) * 10, 10);
        return { score: score.toFixed(1), streak_days: streak };
    }

    buildCrossTimelineComparisons(historicalData, intentAnalysis, context) {
        console.log('🧭 Building cross-timeline comparisons...');

        const segments = this.segmentLifeChapters(historicalData);
        const comparisons = [];

        if (segments.length >= 2) {
            const recent = segments[segments.length - 1];
            const previous = segments[segments.length - 2];
            comparisons.push({
                type: 'life_chapter_comparison',
                from: previous.label,
                to: recent.label,
                insight: `Comparing ${previous.label} vs ${recent.label}`,
                metrics: this.compareSegments(previous.records, recent.records)
            });
        }

        const parallel = this.buildParallelTimelines(historicalData, 30);
        if (parallel) comparisons.push(parallel);

        return { segments, comparisons };
    }

    segmentLifeChapters(historicalData) {
        const records = [...historicalData].sort((a, b) => new Date(a.Timestamp || a.timestamp) - new Date(b.Timestamp || b.timestamp));
        const segments = [];

        let current = { label: 'Chapter 1', records: [] };
        let chapterIndex = 1;

        records.forEach((record, idx) => {
            if (idx > 0) {
                const prev = records[idx - 1];
                const gapDays = (new Date(record.Timestamp || record.timestamp) - new Date(prev.Timestamp || prev.timestamp)) / (1000 * 60 * 60 * 24);
                if (gapDays > 30) {
                    segments.push(current);
                    chapterIndex += 1;
                    current = { label: `Chapter ${chapterIndex}`, records: [] };
                }
            }
            current.records.push(record);
        });

        if (current.records.length > 0) segments.push(current);
        return segments;
    }

    compareSegments(segmentA, segmentB) {
        const countA = segmentA.length;
        const countB = segmentB.length;
        return {
            entries: { from: countA, to: countB, change: countB - countA }
        };
    }

    buildParallelTimelines(historicalData, windowDays = 30) {
        if (historicalData.length < 10) return null;
        const now = new Date();
        const currentWindowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
        const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() - windowDays);
        const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

        const current = historicalData.filter(r => {
            const t = new Date(r.Timestamp || r.timestamp);
            return t >= currentWindowStart && t <= now;
        });

        const lastYear = historicalData.filter(r => {
            const t = new Date(r.Timestamp || r.timestamp);
            return t >= lastYearStart && t <= lastYearEnd;
        });

        return {
            type: 'parallel_timeline',
            label: 'This 30 days vs same period last year',
            current_count: current.length,
            last_year_count: lastYear.length,
            insight: `Current window: ${current.length} entries vs ${lastYear.length} last year`
        };
    }

    analyzeSocialNetworkEffects(historicalData, crossDomainData) {
        console.log('🧭 Analyzing social network effects...');

        const records = [...historicalData, ...crossDomainData];
        const influences = [];

        const peopleMap = {};
        records.forEach(record => {
            const text = this.extractText(record);
            const people = this.extractPeople(text);
            people.forEach(person => {
                if (!peopleMap[person]) peopleMap[person] = [];
                peopleMap[person].push(record);
            });
        });

        Object.entries(peopleMap).forEach(([person, recordsList]) => {
            if (recordsList.length < 2) return;
            const sentiment = this.analyzeEmotionalSentiment(recordsList, []);
            influences.push({
                person,
                interactions: recordsList.length,
                sentiment_bias: sentiment.signals.length,
                insight: `${person} appears in ${recordsList.length} logs; review for stress/energy impact.`
            });
        });

        return { influences: influences.slice(0, 10) };
    }

    extractPeople(text) {
        if (!text) return [];
        const matches = text.match(/\b[A-Z][a-z]+\b/g) || [];
        return [...new Set(matches.filter(n => n.length > 2))];
    }

    generateLifeOSDashboard(historicalData, patterns, anomalies, forecast, context, riskWarnings = []) {
        console.log('🧭 Generating Life OS dashboard...');

        const morningBrief = [];
        const weeklyDigest = [];
        const microNudges = [];
        const achievements = [];
        const riskAlerts = [];

        const momentum = this.calculateHabitMomentum(historicalData);
        if (momentum.streak_days >= 7) {
            achievements.push(`🏆 ${momentum.streak_days}-day streak achieved`);
        }

        anomalies.forEach(a => {
            if (a.type === 'numeric_outlier' || a.type === 'activity_gap') {
                riskAlerts.push(`⚠️ ${a.insight}`);
            }
        });

        riskWarnings.forEach(r => riskAlerts.push(`⚠️ ${r.message}`));

        if (forecast.predictions.length > 0) {
            microNudges.push(forecast.predictions[0].insight);
        }

        if (patterns.some(p => p.type === 'frequency_pattern')) {
            const freq = patterns.find(p => p.type === 'frequency_pattern');
            weeklyDigest.push(`Consistency: ${freq.frequency_label}, ${freq.consistency_score}%`);
        }

        morningBrief.push('Check today’s top priorities and logging gaps.');

        return {
            morning_brief: morningBrief.slice(0, 5),
            weekly_digest: weeklyDigest.slice(0, 5),
            micro_nudges: microNudges.slice(0, 5),
            achievements: achievements.slice(0, 5),
            risk_alerts: riskAlerts.slice(0, 5)
        };
    }

    estimateRiskWarnings(historicalData, anomalies, sentiment) {
        const warnings = [];

        const negativeSignals = (sentiment.signals || []).filter(s => s.label === 'negative').length;
        const gapAnomalies = anomalies.filter(a => a.type === 'activity_gap').length;

        const riskScore = Math.min(50 + negativeSignals * 5 + gapAnomalies * 8, 95);
        if (riskScore >= 65) {
            const date = new Date();
            date.setDate(date.getDate() + 40);
            warnings.push({
                type: 'burnout_risk',
                score: riskScore,
                projected_date: date.toLocaleDateString(),
                message: `At current trajectory, burnout risk is ${riskScore}% by ${date.toLocaleDateString()}`
            });
        }

        return warnings;
    }

    generateProactiveInsights(historicalData, patterns, anomalies, correlations, context) {
        console.log('💡 Generating proactive insights...');

        const insights = [];

        anomalies.forEach(anomaly => {
            if (anomaly.severity === 'high' || anomaly.severity === 'medium') {
                insights.push({
                    type: 'anomaly_alert',
                    priority: anomaly.severity === 'high' ? 'high' : 'medium',
                    message: `⚠️ ${anomaly.insight}`,
                    action_suggestion: this.getAnomalySuggestion(anomaly)
                });
            }
        });

        correlations.forEach(corr => {
            if (parseInt(corr.strength) > 60) {
                insights.push({
                    type: 'correlation_insight',
                    priority: 'medium',
                    message: `🔗 Strong connection found: ${corr.insight}`,
                    action_suggestion: `Consider leveraging this pattern - coordinate ${corr.domain1} and ${corr.domain2} activities strategically`
                });
            }
        });

        patterns.forEach(pattern => {
            if (pattern.type === 'frequency_pattern' && parseFloat(pattern.consistency_score) < 50) {
                insights.push({
                    type: 'consistency_improvement',
                    priority: 'low',
                    message: `📊 Consistency is at ${pattern.consistency_score}% - room for improvement`,
                    action_suggestion: 'Set reminders or build habit triggers to increase consistency'
                });
            }

            if (pattern.type === 'cyclical_pattern') {
                insights.push({
                    type: 'timing_optimization',
                    priority: 'low',
                    message: `📅 You naturally peak on ${pattern.peak_day}s - optimize scheduling accordingly`,
                    action_suggestion: `Schedule important activities on ${pattern.peak_day}s when you're most consistent`
                });
            }
        });

        return insights.slice(0, 5);
    }

    getAnomalySuggestion(anomaly) {
        if (anomaly.type === 'activity_gap') {
            return `Consider setting up automated reminders to prevent gaps exceeding ${Math.floor(anomaly.gap_days / 2)} days`;
        }
        if (anomaly.type === 'numeric_outlier') {
            return `Review conditions around ${anomaly.field} = ${anomaly.value} to understand what caused this outlier`;
        }
        return 'Review recent changes that may have caused this anomaly';
    }

    async retrievePerplexityHistory(userQuery, context) {
        console.log('🔍 Retrieving Perplexity search history...');

        const searchHistory = [];

        try {
            if (context.conversationHistory && context.conversationHistory.length > 0) {
                const recentSearches = context.conversationHistory
                    .slice(-20)
                    .map(conv => ({
                        query: conv.userQuery,
                        timestamp: conv.timestamp,
                        agents_used: conv.agentsUsed || [],
                        response_summary: this.summarizeResponse(conv.finalResponse)
                    }));

                searchHistory.push(...recentSearches);
            }

            if (this.tableClient) {
                try {
                    const searchEntities = this.tableClient.listEntities({
                        queryOptions: { 
                            filter: "PartitionKey eq 'perplexity_search'"
                        }
                    });

                    let count = 0;
                    for await (const entity of searchEntities) {
                        searchHistory.push({
                            query: entity.query || entity.searchQuery,
                            timestamp: entity.Timestamp || entity.timestamp,
                            category: entity.category,
                            agents_triggered: entity.agents
                        });
                        
                        count++;
                        if (count >= 30) break;
                    }
                } catch (error) {
                    console.log('⚠️  No search history in Azure');
                }
            }

            const relatedSearches = this.findRelatedSearches(userQuery, searchHistory);
            console.log(`✅ Retrieved ${relatedSearches.length} related searches`);
            return relatedSearches;

        } catch (error) {
            console.error('⚠️  Search history error:', error.message);
            return [];
        }
    }

    findRelatedSearches(currentQuery, allSearches) {
        const queryLower = currentQuery.toLowerCase();
        const keywords = queryLower.split(' ').filter(w => w.length > 3);

        const scoredSearches = allSearches.map(search => {
            let score = 0;
            const searchLower = (search.query || '').toLowerCase();

            keywords.forEach(keyword => {
                if (searchLower.includes(keyword)) score += 2;
            });

            const searchDate = new Date(search.timestamp);
            const daysSince = (Date.now() - searchDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince < 7) score += 5;
            else if (daysSince < 30) score += 2;

            return { ...search, relevance_score: score };
        });

        return scoredSearches
            .filter(s => s.relevance_score > 0)
            .sort((a, b) => b.relevance_score - a.relevance_score)
            .slice(0, 10);
    }

    summarizeResponse(response) {
        if (!response) return 'No response';
        const firstSentence = response.split('.')[0];
        return firstSentence.length > 150 
            ? firstSentence.substring(0, 150) + '...'
            : firstSentence + '.';
    }

    async retrieveRelevantMemories(userQuery, context) {
        if (!this.tableClient) {
            console.log('⚠️  No Azure connection');
            return [];
        }

        try {
            const queryLower = userQuery.toLowerCase();
            const memories = [];
            const searchFilters = this.buildSearchFilters(queryLower);

            console.log(`📊 Searching Azure Tables...`);

            const entities = this.tableClient.listEntities({
                queryOptions: { filter: searchFilters.filter }
            });

            let count = 0;
            for await (const entity of entities) {
                memories.push(entity);
                count++;
                if (count >= 50) break;
            }

            console.log(`✅ Retrieved ${memories.length} records`);

            memories.sort((a, b) => {
                const dateA = new Date(a.Timestamp || a.timestamp || 0);
                const dateB = new Date(b.Timestamp || b.timestamp || 0);
                return dateB - dateA;
            });

            return memories.slice(0, 20);

        } catch (error) {
            console.error('⚠️  Azure query error:', error.message);
            return [];
        }
    }

    buildSearchFilters(queryLower) {
        const filters = [];
        let category = 'all';

        if (queryLower.match(/workout|exercise|train/)) {
            filters.push("PartitionKey eq 'workout'");
            category = 'workout';
        } else if (queryLower.match(/meal|food|eat/)) {
            filters.push("PartitionKey eq 'meal'");
            category = 'meal';
        } else if (queryLower.match(/sleep|rest|night/)) {
            filters.push("PartitionKey eq 'sleep'");
            category = 'sleep';
        } else if (queryLower.match(/spend|money|budget|finance/)) {
            filters.push("PartitionKey eq 'transaction'");
            category = 'spending';
        } else if (queryLower.match(/journal|mood|feeling/)) {
            filters.push("PartitionKey eq 'journal'");
            category = 'journal';
        }

        return {
            filter: filters.length > 0 ? filters.join(' or ') : "PartitionKey ne ''",
            category: category
        };
    }

    /**
     * Advanced synthesis with all intelligence layers
     */
    async advancedSynthesis(
        userQuery,
        intentAnalysis,
        historicalData,
        perplexityHistory,
        patterns,
        anomalies,
        correlations,
        forecast,
        proactiveInsights,
        futureSimulations,
        sentiment,
        crossTimeline,
        socialInfluence,
        reasoningChain,
        complexity,
        context
    ) {
        console.log('🧠 Synthesizing advanced analysis...');

        try {
            const prompt = this.buildSynthesisPrompt(
                userQuery,
                intentAnalysis,
                historicalData,
                patterns,
                anomalies,
                correlations,
                forecast,
                proactiveInsights,
                futureSimulations,
                sentiment,
                crossTimeline,
                socialInfluence,
                reasoningChain,
                context
            );

            const model = this.selectModel(complexity);
            const shouldBatch = complexity === 'simple' && !intentAnalysis.requires_forecasting;
            if (shouldBatch) {
                return await this.enqueueBatchSynthesis(prompt, model);
            }

            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: model,
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️  Synthesis error:', error.message);
            return this.generateFallbackAnalysis(
                userQuery,
                patterns,
                anomalies,
                correlations,
                forecast
            );
        }
    }

    selectModel(complexity) {
        if (complexity === 'complex') return this.modelRouting.large;
        if (complexity === 'moderate') return this.modelRouting.medium;
        return this.modelRouting.small;
    }

    async enqueueBatchSynthesis(prompt, model) {
        const now = Date.now();
        this.batchQueue.push({ prompt, model });

        if (now - this.lastBatchFlush < this.batchFlushMs) {
            await new Promise(r => setTimeout(r, this.batchFlushMs));
        }

        if (this.batchQueue.length === 0) return '';

        const batch = this.batchQueue.splice(0, 3);
        this.lastBatchFlush = now;

        const combinedPrompt = batch.map((b, i) => `Request ${i + 1}:\n${b.prompt}`).join('\n\n');

        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: model,
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        { role: 'user', content: combinedPrompt }
                    ],
                    max_tokens: 2000,
                    temperature: 0.6
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('⚠️  Batch synthesis error:', error.message);
            return '';
        }
    }

    buildSynthesisPrompt(
        userQuery,
        intentAnalysis,
        historicalData,
        patterns,
        anomalies,
        correlations,
        forecast,
        proactiveInsights,
        futureSimulations,
        sentiment,
        crossTimeline,
        socialInfluence,
        reasoningChain,
        context
    ) {
        const learningLibrary = this.getLearningLibrarySnapshot();
        return `User Query: ${userQuery}

Intent: ${intentAnalysis.primary_intent}
Domains: ${intentAnalysis.domains_involved.join(', ') || 'General'}

Historical Data Points: ${historicalData.length}
Patterns Detected: ${patterns.length}
Anomalies Found: ${anomalies.length}
Correlations: ${correlations.length}

Patterns:
${JSON.stringify(patterns, null, 2)}

Anomalies:
${JSON.stringify(anomalies, null, 2)}

Correlations:
${JSON.stringify(correlations, null, 2)}

Forecast:
${JSON.stringify(forecast, null, 2)}

Insights:
${JSON.stringify(proactiveInsights, null, 2)}

Future Self Simulations:
${JSON.stringify(futureSimulations, null, 2)}

Sentiment Signals:
${JSON.stringify(sentiment, null, 2)}

Cross-Timeline Comparison:
${JSON.stringify(crossTimeline, null, 2)}

Social Influence:
${JSON.stringify(socialInfluence, null, 2)}

Reasoning Summary:
${reasoningChain.summary}

Learned Strategies:
${JSON.stringify(learningLibrary, null, 2)}

Please provide a comprehensive analysis that:
1. Directly addresses the user query
2. Synthesizes patterns with actionable insights
3. Highlights any anomalies or risks
4. Provides predictive intelligence
5. Offers specific, data-backed recommendations
6. Includes a risk score (0-100) for relevant trajectories`; 
    }

    async updateLearningLibrary(userQuery, context, proactiveInsights) {
        const library = this.getLearningLibrarySnapshot();

        const feedback = context.feedback || context.userFeedback || null;
        if (feedback) {
            const key = (feedback.topic || userQuery).toLowerCase().slice(0, 80);
            const entry = {
                key,
                timestamp: new Date().toISOString(),
                outcome: feedback.outcome || 'unknown',
                rating: feedback.rating || null,
                notes: feedback.notes || '',
                applied_actions: feedback.actions || [],
                success: feedback.success === true
            };

            this.reasoningLibrary.set(key, entry);
            if (this.tableClient) {
                try {
                    await this.tableClient.upsertEntity({
                        partitionKey: 'memory_learning',
                        rowKey: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        ...entry
                    });
                } catch (error) {
                    console.log('⚠️  Learning library update failed');
                }
            }
        }

        if (proactiveInsights && proactiveInsights.length > 0) {
            const key = userQuery.toLowerCase().slice(0, 80);
            if (!this.reasoningLibrary.has(key)) {
                this.reasoningLibrary.set(key, {
                    key,
                    timestamp: new Date().toISOString(),
                    outcome: 'pending',
                    rating: null,
                    notes: 'Proactive insight delivered',
                    applied_actions: proactiveInsights.map(i => i.action_suggestion).filter(Boolean),
                    success: null
                });
            }
        }

        return { library: this.getLearningLibrarySnapshot() };
    }

    getLearningLibrarySnapshot() {
        const entries = [...this.reasoningLibrary.values()];
        return entries.slice(-10);
    }

    applyLearnedStrategies(userQuery, intentAnalysis, library) {
        if (!library || library.length === 0) return [];
        const queryLower = userQuery.toLowerCase();
        return library
            .filter(e => queryLower.includes((e.key || '').split(' ')[0]))
            .map(e => ({
                strategy: e.notes || 'Apply prior successful pattern',
                outcome: e.outcome,
                confidence: e.success === true ? 'high' : 'medium'
            }))
            .slice(0, 5);
    }

    buildPhysicsGraphs(historicalData) {
        const timestamps = historicalData
            .map(d => new Date(d.Timestamp || d.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);

        if (timestamps.length < 3) return [];

        const timeSeries = timestamps.map((t, idx) => ({
            t: t.toISOString(),
            position: idx,
            velocity: idx === 0 ? 0 : (timestamps[idx] - timestamps[idx - 1]) / (1000 * 60 * 60 * 24),
            acceleration: idx < 2 ? 0 : ((timestamps[idx] - timestamps[idx - 1]) - (timestamps[idx - 1] - timestamps[idx - 2])) / (1000 * 60 * 60 * 24)
        }));

        return [
            {
                type: 'activity_motion',
                description: 'Position=log count, velocity=gap days, acceleration=change in gap days',
                series: timeSeries
            }
        ];
    }

    generateFallbackAnalysis(userQuery, patterns, anomalies, correlations, forecast) {
        let analysis = `Analysis for: "${userQuery}"\n\n`;

        if (patterns.length > 0) {
            analysis += `📊 Patterns Detected:\n${patterns.map(p => `- ${p.insight}`).join('\n')}\n\n`;
        }

        if (anomalies.length > 0) {
            analysis += `🚨 Anomalies:\n${anomalies.map(a => `- ${a.insight}`).join('\n')}\n\n`;
        }

        if (correlations.length > 0) {
            analysis += `🔗 Correlations:\n${correlations.map(c => `- ${c.insight}`).join('\n')}\n\n`;
        }

        if (forecast.predictions.length > 0) {
            analysis += `🔮 Predictions:\n${forecast.predictions.map(p => `- ${p.insight}`).join('\n')}\n`;
        }

        return analysis;
    }
}

module.exports = MemoryAgent;

async function startMemoryAgent() {
    if (!serviceBusClient) {
        console.log('⚠️ Memory Agent: Service Bus connection string not set. Listener not started.');
        return;
    }

    const agent = new MemoryAgent();
    const receiver = serviceBusClient.createReceiver(agentQueueName);

    console.log(`[Memory Agent] Listening on ${agentQueueName}...`);

    receiver.subscribe({
        processMessage: async (messageReceived) => {
            const query = messageReceived.body?.query;
            const conversationId = messageReceived.body?.conversationId;

            console.log('[Memory Agent] Message received:', query);
            console.log(`[Memory Agent] conversationId: ${conversationId || 'missing'}`);

            if (!query) {
                console.log('[Memory Agent] No query provided in message body.');
                return;
            }

            const response = await agent.process(query, {
                context: {
                    conversationId,
                    requestId: messageReceived.body?.requestId
                }
            });

            const sender = serviceBusClient.createSender(responseQueueName);
            await sender.sendMessages({
                body: {
                    agentName: 'memory',
                    response,
                    conversationId,
                    timestamp: new Date().toISOString()
                }
            });
            await sender.close();

            console.log(`[Memory Agent] Response sent to orchestrator (conversationId=${conversationId || 'missing'}).`);
        },
        processError: async (error) => {
            console.error('[Memory Agent] Error:', error);
        }
    });
}

if (require.main === module) {
    startMemoryAgent();
}

module.exports.startMemoryAgent = startMemoryAgent;