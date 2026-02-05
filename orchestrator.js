// orchestrator.js - Advanced multi-agent orchestration with Perplexity
const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '.env') });
const contextManager = require('./contextmanager');
if (dotenvResult.error) {
    console.error('[Orchestrator] dotenv load error:', dotenvResult.error.message);
} else {
    const loadedKeys = Object.keys(dotenvResult.parsed || {});
    console.log(`[Orchestrator] dotenv keys loaded: ${loadedKeys.join(', ')}`);
    if (!process.env.AZURE_SERVICE_BUS_CONNECTION_STRING && dotenvResult.parsed?.AZURE_SERVICE_BUS_CONNECTION_STRING) {
        process.env.AZURE_SERVICE_BUS_CONNECTION_STRING = dotenvResult.parsed.AZURE_SERVICE_BUS_CONNECTION_STRING;
    }
}
const axios = require('axios');
const { ServiceBusClient } = require('@azure/service-bus');
const { upsertMemory } = require('./vectorStore');

class Orchestrator {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';

        // Service Bus setup
        const rawServiceBusConnection = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
        const hasServiceBusEnvKey = Object.prototype.hasOwnProperty.call(
            process.env,
            'AZURE_SERVICE_BUS_CONNECTION_STRING'
        );
        console.log(
            `[Orchestrator] Service Bus env key present: ${hasServiceBusEnvKey}, length: ${rawServiceBusConnection ? rawServiceBusConnection.length : 0}`
        );
        this.serviceBusConnectionString = rawServiceBusConnection && rawServiceBusConnection.trim()
            ? rawServiceBusConnection.trim()
            : null;
        this.serviceBusClient = this.serviceBusConnectionString
            ? new ServiceBusClient(this.serviceBusConnectionString)
            : null;
        this.agentQueues = {
            wisdom: 'wisdom-queue',
            vitality: 'vitality-queue',
            analytics: 'analytics-queue',
            memory: 'memory-queue'
        };
        this.responseQueueName = process.env.ORCHESTRATOR_RESPONSE_QUEUE || 'orchestrator-response-queue';
        this.pendingResponses = new Map();

        this.conversationHistory = [];
        this.agentCapabilities = this.buildCapabilityMap();

        if (this.serviceBusClient) {
            this.listenForResponses();
        } else {
            console.log('⚠️ Orchestrator: Service Bus connection string not set. Messaging disabled.');
        }
    }

   /**
 * Enhanced capability mapping with granular detection and priority scoring
 */
buildCapabilityMap() {
    return {
        vitality: {
            // Expanded keywords with context awareness
            keywords: {
                primary: ['workout', 'exercise', 'train', 'lift', 'run', 'yoga', 'fitness', 'gym', 'kinect', 'form'],
                nutrition: ['nutrition', 'meal', 'food', 'eat', 'diet', 'calorie', 'macro', 'protein', 'carb', 'fat', 'hungry', 'grade my meal', 'what should i eat'],
                sleep: ['sleep', 'tired', 'exhausted', 'rest', 'recovery', 'insomnia', 'wake up', 'dream', 'nightmare', 'rem'],
                energy: ['energy', 'fatigue', 'burnout', 'exhausted', 'drained', 'sluggish', 'lethargic'],
                fasting: ['fast', 'fasting', 'intermittent', 'eating window', 'autophagy', 'ketosis'],
                recovery: ['sore', 'injury', 'pain', 'strain', 'recover', 'healing', 'inflammation'],
                biometrics: ['weight', 'body fat', 'muscle', 'strength', 'endurance', 'vo2', 'heart rate']
            },
            capabilities: {
                core: [
                    'workout_programming',
                    'exercise_form_analysis',
                    'kinect_video_analysis',
                    'progressive_overload_tracking',
                    'exercise_selection_optimization'
                ],
                nutrition: [
                    'meal_grading_af_scale',
                    'macro_nutrient_analysis',
                    'meal_timing_optimization',
                    'supplement_recommendations',
                    'hydration_tracking',
                    'food_sensitivity_detection'
                ],
                sleep: [
                    'sleep_quality_scoring',
                    'sleep_cycle_optimization',
                    'dream_pattern_analysis',
                    'circadian_rhythm_alignment',
                    'sleep_environment_optimization',
                    'nap_strategy_design'
                ],
                fasting: [
                    'fasting_protocol_design',
                    'eating_window_optimization',
                    'hunger_management_strategies',
                    'autophagy_maximization',
                    'workout_fasted_vs_fed_analysis'
                ],
                recovery: [
                    'recovery_score_calculation',
                    'deload_week_timing',
                    'injury_prevention_analysis',
                    'mobility_prescription',
                    'active_recovery_design'
                ],
                integration: [
                    'energy_nutrition_sleep_correlation',
                    'workout_recovery_balance',
                    'stress_physical_impact_analysis'
                ]
            },
            priority_triggers: {
                critical: ['injury', 'pain', 'exhausted', 'burnout', 'insomnia'],
                high: ['workout', 'meal', 'sleep', 'energy', 'form', 'fasting'],
                medium: ['nutrition', 'recovery', 'tired'],
                collaborative: ['sleep + energy', 'nutrition + performance', 'fasting + workout']
            },
            data_requirements: ['workout_logs', 'meal_logs', 'sleep_data', 'energy_levels', 'kinect_recordings'],
            output_format: 'actionable_with_metrics'
        },

        analytics: {
            keywords: {
                pattern: ['pattern', 'trend', 'recurring', 'always', 'never', 'usually', 'typically', 'consistently'],
                causation: ['why', 'because', 'cause', 'reason', 'explain', 'due to', 'result of', 'leads to'],
                comparison: ['compare', 'versus', 'vs', 'difference', 'better', 'worse', 'best', 'optimal'],
                prediction: ['predict', 'forecast', 'will', 'future', 'expect', 'likely', 'probability'],
                insight: ['insight', 'discover', 'find', 'reveal', 'uncover', 'hidden', 'connection'],
                anomaly: ['unusual', 'weird', 'strange', 'unexpected', 'anomaly', 'outlier', 'different'],
                correlation: ['related', 'connected', 'associated', 'linked', 'affects', 'influences']
            },
            capabilities: {
                temporal: [
                    'time_series_analysis',
                    'seasonality_detection',
                    'trend_forecasting',
                    'cyclical_pattern_identification',
                    'progression_rate_calculation'
                ],
                correlation: [
                    'cross_domain_correlation_analysis',
                    'lag_effect_detection',
                    'multivariate_relationship_mapping',
                    'causation_vs_correlation_distinction'
                ],
                prediction: [
                    'performance_forecasting',
                    'burnout_risk_prediction',
                    'optimal_timing_prediction',
                    'outcome_probability_modeling'
                ],
                anomaly: [
                    'outlier_detection',
                    'deviation_from_baseline_analysis',
                    'early_warning_system',
                    'pattern_break_identification'
                ],
                optimization: [
                    'pareto_analysis_80_20',
                    'bottleneck_identification',
                    'leverage_point_discovery',
                    'marginal_gains_analysis'
                ],
                segmentation: [
                    'cluster_analysis',
                    'behavioral_phenotyping',
                    'context_specific_pattern_recognition'
                ]
            },
            priority_triggers: {
                always_include: ['any query requiring "why" or "what if"'],
                critical: ['predict', 'trend', 'pattern', 'why', 'correlation'],
                collaborative_boost: ['pairs with any agent for deeper insights']
            },
            data_requirements: ['minimum 7 days historical data', 'cross_domain_datasets'],
            output_format: 'statistical_with_confidence_intervals'
        },

        memory: {
            keywords: {
                temporal: ['past', 'history', 'previous', 'last time', 'ago', 'before', 'used to', 'back when'],
                retrieval: ['remember', 'recall', 'find', 'show me', 'what was', 'when did', 'lookup'],
                comparison: ['compared to', 'versus last', 'change since', 'improvement from'],
                contextual: ['similar to', 'like when', 'that time', 'reminds me of']
            },
            capabilities: {
                retrieval: [
                    'semantic_search_across_all_domains',
                    'exact_match_retrieval',
                    'fuzzy_temporal_search',
                    'multi_modal_retrieval_text_image_data'
                ],
                contextualization: [
                    'historical_context_building',
                    'temporal_relationship_mapping',
                    'event_sequence_reconstruction',
                    'pattern_context_enrichment'
                ],
                synthesis: [
                    'cross_reference_multiple_sources',
                    'timeline_generation',
                    'historical_summary_creation',
                    'change_over_time_analysis'
                ],
                vector_operations: [
                    'embedding_based_similarity_search',
                    'concept_clustering',
                    'semantic_nearest_neighbor_retrieval'
                ]
            },
            priority_triggers: {
                critical: ['specific dates', 'past events', 'historical comparisons'],
                high: ['trend analysis', 'before/after comparisons'],
                always_with: ['analytics_for_patterns', 'any_agent_needing_context']
            },
            data_requirements: ['azure_table_storage', 'vector_database', 'journal_entries'],
            output_format: 'chronological_with_relevance_scores'
        },






        wisdom: {
            keywords: {
                guidance: ['advice', 'guidance', 'mentor', 'coach', 'wisdom', 'counsel', 'perspective'],
                decision: ['decision', 'decide', 'choice', 'tradeoff', 'prioritize', 'trade-off'],
                planning: ['plan', 'planning', 'vision', 'strategy', 'roadmap', 'long-term', 'goal'],
                accountability: ['accountability', 'follow through', 'commit', 'discipline', 'consistency'],
                parenting: ['parent', 'parenting', 'dad', 'raise', 'raising', 'child', 'children', 'kid', 'kids', 'son', 'daughter', 'evander', 'amelia'],
                career: ['career', 'job', 'promotion', 'leadership', 'manager', 'work', 'business'],
                health: ['health', 'fitness', 'sleep', 'nutrition', 'energy', 'wellness'],
                personal_growth: ['growth', 'identity', 'values', 'purpose', 'habits', 'mindset'],
                relationships: ['relationship', 'marriage', 'family', 'friends', 'communication']
            },
            capabilities: {
                strategic_guidance: [
                    'decision_frameworks_and_tradeoff_analysis',
                    'long_term_vision_and_life_strategy',
                    'values_alignment_and_priority_setting',
                    'second_order_effects_analysis',
                    'risk_reward_scenario_planning'
                ],
                synthesis: [
                    'cross_agent_insight_synthesis',
                    'contextual_wisdom_application',
                    'pattern_informed_guidance',
                    'philosophical_perspective_on_choices'
                ],
                planning: [
                    'goal_architecture_and_milestones',
                    'annual_quarterly_monthly_planning',
                    'vision_statement_refinement',
                    'life_domain_balance_planning'
                ],
                accountability: [
                    'commitment_contracts',
                    'weekly_review_checklists',
                    'habit_consistency_protocols',
                    'progress_tracking_and_reflection'
                ],
                domain_guidance: [
                    'parenting_counsel',
                    'career_leadership_coaching',
                    'health_and_energy_alignment',
                    'personal_growth_coaching',
                    'relationship_and_communication_wisdom'
                ]
            },
            priority_triggers: {
                critical: ['child safety', 'major life decision', 'crisis', 'emotional distress', 'relationship rupture'],
                high: ['career crossroads', 'parenting conflict', 'health tradeoff', 'long-term planning'],
                collaborative: [
                    'analytics_for_patterns',
                    'memory_for_historical_context',
                    'vitality_for_energy_and_health_alignment'
                ]
            },
            data_requirements: [
                'core_values_and_principles',
                'life_goals_and_milestones',
                'decision_logs',
                'weekly_reviews',
                'health_and_energy_metrics',
                'career_performance_notes',
                'relationship_checkins'
            ],
            output_format: 'strategic_wisdom_with_actionable_accountability_steps'
        }
    };
}

    /**
     * Main entry point - enhanced with multi-step reasoning
     */
    async processQuery(userQuery) {
        const requestId = this.generateRequestId();
        const conversationId = this.generateConversationId();
        const userId = process.env.ORCHESTRATOR_USER_ID || 'default_user';
        const sessionId = conversationId;

        console.log(`\n${'='.repeat(80)}`);
        console.log(`[PROCESSING] "${userQuery}"`);
        console.log('='.repeat(80) + '\n');

        // Step 1: Enhanced routing with priority scoring
        console.log(`[Orchestrator] Loading context (userId=${userId}, sessionId=${sessionId})...`);
        let sharedContext = {};
        try {
            sharedContext = await contextManager.getContext(userId, sessionId);
            console.log('[Orchestrator] Context loaded.');
        } catch (error) {
            console.error('[Orchestrator] Context load failed:', error.message);
        }
        const routingDecision = await this.intelligentRouting(userQuery);
        console.log(`[REQUEST] ID: ${requestId}`);
        console.log(`[AGENTS] Selected Agents: ${routingDecision.agents.join(', ')}`);
        console.log(`[LOGIC] Routing Logic: ${JSON.stringify(routingDecision.reasoning, null, 2)}\n`);

        // Step 2: Parallel agent execution with error handling
        const agentResponses = await this.executeAgentsParallel(
            userQuery, 
            routingDecision.agents,
            {
                ...routingDecision.context,
                requestId,
                conversationId,
                userId,
                sessionId,
                sharedContext
            }
        );

        // Step 3: Cross-agent validation and conflict resolution
        const validatedResponses = await this.validateAndResolveConflicts(agentResponses);

        const contextUpdates = this.extractContextUpdates(validatedResponses);
        if (Object.keys(contextUpdates).length > 0) {
            try {
                await contextManager.updateContext(userId, sessionId, contextUpdates);
                console.log(`[Orchestrator] Context updated with keys: ${Object.keys(contextUpdates).join(', ')}`);
            } catch (error) {
                console.error('[Orchestrator] Context update failed:', error.message);
            }
        }

        // Step 4: Multi-layered synthesis with actionable insights
        const finalResponse = await this.enhancedSynthesis(
            userQuery,
            validatedResponses,
            routingDecision.context
        );

        try {
            await upsertMemory({
                userId,
                source: 'conversation',
                timestamp: new Date().toISOString(),
                text: `${userQuery}\n\n${finalResponse}`
            });
            console.log('[Orchestrator] Conversation memory upserted.');
        } catch (error) {
            console.error('[Orchestrator] Conversation memory upsert failed:', error.message);
        }

        if (Object.keys(contextUpdates).length > 0) {
            try {
                await upsertMemory({
                    userId,
                    source: 'context_update',
                    timestamp: new Date().toISOString(),
                    text: `Context updates:\n${JSON.stringify(contextUpdates, null, 2)}`
                });
                console.log('[Orchestrator] Context updates memory upserted.');
            } catch (error) {
                console.error('[Orchestrator] Context updates upsert failed:', error.message);
            }
        }

        // Step 5: Store with metadata for learning
        this.conversationHistory.push({
            userQuery,
            timestamp: new Date().toISOString(),
            agentsUsed: routingDecision.agents,
            agentResponses: validatedResponses,
            finalResponse,
            metadata: {
                complexity: routingDecision.complexity,
                confidence: routingDecision.confidence,
                requestId,
                conversationId,
                userId,
                sessionId
            }
        });

        return finalResponse;
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }

    extractContextUpdates(agentResponses) {
        const updates = {};
        Object.values(agentResponses).forEach((response) => {
            if (response && response.contextUpdates) {
                Object.assign(updates, response.contextUpdates);
            }
        });
        return updates;
    }

    /**
     * Enhanced routing with multi-factor scoring
     */
    async intelligentRouting(userQuery) {
        const systemPrompt = `You are an expert query routing system for a personal AI with 8 specialized agents.

AGENT CAPABILITIES:
${Object.entries(this.agentCapabilities).map(([name, info]) => {
    const capabilities = Array.isArray(info.capabilities)
        ? info.capabilities
        : Object.values(info.capabilities || {}).flat();
    return `${name.toUpperCase()}: ${capabilities.join(', ')}`;
}).join('\n')}

═══════════════════════════════════════════════════════════════
PHASE 1: QUERY ANALYSIS & CLASSIFICATION
═══════════════════════════════════════════════════════════════

1. Query Intent Classification:
   - Identify primary intent: informational, analytical, action-oriented, crisis
   - Detect temporal indicators: past (Memory), future (Analytics), present (action agents)
   - Extract domain markers: health, finance, relationships, productivity, parenting

2. Urgency & Priority Scoring (1-10):
   CRITICAL (9-10): Safety concerns, child emergencies, mental health crisis, severe financial distress
   HIGH (7-8): Behavioral issues, performance problems, relationship conflicts, health concerns
   MEDIUM (4-6): Routine optimization, habit building, general questions, planning
   LOW (1-3): General curiosity, informational queries, reflective questions

3. Data Requirements Assessment:
   - Historical data needed? → ALWAYS include Memory agent
   - Pattern analysis needed? → ALWAYS include Analytics agent  
   - Cross-domain insights needed? → Include 3+ agents
   - Real-time action needed? → Prioritize domain-specific agents

═══════════════════════════════════════════════════════════════
PHASE 2: AGENT SELECTION WITH PRIORITY SCORING
═══════════════════════════════════════════════════════════════

Core Selection Algorithm:
1. Score each agent (0-100) based on:
   - Keyword match strength (0-30 points)
   - Priority keyword match (0-20 points)  
   - Recent success rate with similar queries (0-20 points)
   - Agent health status (0-15 points)
   - Synergy with other selected agents (0-15 points)

2. Mandatory Agent Inclusion Rules:
   - "why", "pattern", "trend", "always", "never" → Analytics (force include)
   - "past", "history", "last time", "before", "compared to" → Memory (force include)
    - "Dylan", "Amelia", "Aubrey", "school", "homework", "parenting" → Wisdom (force include)
   - "burnout", "exhausted", "overwhelmed" + multiple domains → Analytics + Vitality (pair)

3. Agent Collaboration Synergies (boost scores by +15 when paired):
    - Wisdom + Analytics: Child behavioral patterns, academic progress trends
   - Vitality + Memory: Holistic well-being tracking
    - Analytics + Wisdom: Parenting insights and behavioral patterns
   - Analytics + Vitality: Physical and activity correlations
   - Memory + Analytics: Historical pattern analysis, progress tracking
   - Memory + Analytics: Temporal pattern recognition and insights

4. Selection Constraints:
   - Minimum: 1 agent (simple, single-domain queries)
   - Optimal: 2-3 agents (most queries with collaboration)
   - Maximum: 4 agents (complex, multi-domain crises only)
   - Circuit breaker: Exclude agents with status "circuit_open"

═══════════════════════════════════════════════════════════════
PHASE 3: CONFLICT PREDICTION & RESOLUTION STRATEGY
═══════════════════════════════════════════════════════════════

Pre-emptive Conflict Detection:
1. Identify potential agent conflicts BEFORE execution:
   - Vitality ("train harder") vs Memory ("track patterns") → Interpretation conflict
    - Analytics ("analyze patterns") vs Wisdom ("prioritize relationships") → Focus conflict
   - Memory ("historical data") vs Vitality ("present action") → Temporal focus conflict

2. Conflict Resolution Strategy (include in routing decision):
   - HIERARCHICAL: Assign priority order (e.g., child safety > work productivity)
   - CONSENSUS: Weight recommendations proportionally (60% Vitality, 40% Guardian)
   - SEQUENTIAL: Time-box recommendations (morning: work, evening: family)
   - SYNTHESIS: Create hybrid solution combining both perspectives

3. Priority Agent Designation:
   When conflicts expected, designate PRIMARY agent whose recommendations take precedence:
    - Child safety queries: Wisdom is PRIMARY
   - Health emergencies: Vitality is PRIMARY
   - Mental health: Guardian is PRIMARY
   - Financial questions: Analytics is PRIMARY

═══════════════════════════════════════════════════════════════
PHASE 4: CONTEXT-AWARE ROUTING METADATA
═══════════════════════════════════════════════════════════════

Enhanced Context Object:
{
    "query_characteristics": {
        "type": "single_domain | multi_domain | analytical | crisis | routine",
        "urgency": "critical | high | medium | low",
        "temporal_focus": "past | present | future | timeless",
        "action_orientation": "immediate_action | strategic_planning | reflection | information"
    },
    
    "data_requirements": {
        "requires_historical_data": true | false,
        "minimum_data_points": number,
        "data_sources_needed": ["workout_logs", "journal_entries", ...],
        "data_freshness_required": "real_time | recent | any"
    },
    
    "expected_outcomes": {
        "response_type": "actionable_steps | deep_analysis | emotional_support | decision_framework",
        "time_horizon": "24_hours | 1_week | 1_month | 3_months | long_term",
        "success_metrics": ["specific metrics to track"],
        "follow_up_needed": true | false
    },
    
    "collaboration_strategy": {
        "primary_agent": "agent_name",
        "supporting_agents": ["agent1", "agent2"],
        "conflict_resolution_method": "hierarchical | consensus | sequential | synthesis",
        "agent_priority_order": ["agent1", "agent2", "agent3"],
        "expected_conflicts": ["description of potential conflicts"],
        "synthesis_approach": "integrate | prioritize | time_box | hybrid"
    }
}

═══════════════════════════════════════════════════════════════
PHASE 5: CONFIDENCE & QUALITY SCORING
═══════════════════════════════════════════════════════════════

Complexity Score (1-10):
1-3: Single agent, clear intent, abundant data, no conflicts
4-6: 2-3 agents, moderate ambiguity, sufficient data, minor conflicts
7-9: 3-4 agents, complex intent, limited data, significant conflicts  
10: Crisis mode, all agents, ambiguous intent, data gaps, critical conflicts

Confidence Score (0.0-1.0):
- Start with base confidence: 0.7
- Add +0.1 for clear keyword matches in query
- Add +0.1 for sufficient historical data available
- Add +0.05 for all selected agents in "healthy" status
- Add +0.05 for strong agent synergy scores
- Subtract -0.1 for expected agent conflicts
- Subtract -0.15 for missing required data sources
- Subtract -0.1 for ambiguous or multi-intent query
- Subtract -0.2 for critical urgency (higher stakes = lower confidence)
- Cap between 0.3 (minimum) and 0.95 (maximum - never 1.0)

Routing Decision Quality Indicators:
- "high_quality" (confidence > 0.8, complexity < 6): Fast execution, minimal validation
- "moderate_quality" (confidence 0.6-0.8, complexity 6-8): Standard validation
- "low_quality" (confidence < 0.6, complexity > 8): Enhanced validation, human review flag

═══════════════════════════════════════════════════════════════
USER QUERY: "${userQuery}"
═══════════════════════════════════════════════════════════════

REQUIRED OUTPUT FORMAT (JSON):

{
    "agents": ["agent1", "agent2"],
    
    "agent_priority_scores": {
        "agent1": 85,
        "agent2": 72,
        "agent3": 45
    },
    
    "reasoning": {
        "selection_rationale": "Detailed explanation of why each agent was selected",
        "collaboration_strategy": "How agents will work together and in what sequence",
        "expected_value": "What unique insights each agent will provide",
        "conflict_mitigation": "How potential conflicts will be resolved"
    },
    
    "complexity": 5,
    "confidence": 0.85,
    "urgency": "high",
    
    "context": {
        "query_characteristics": {
            "type": "multi_domain",
            "urgency": "high", 
            "temporal_focus": "present",
            "action_orientation": "immediate_action"
        },
        
        "data_requirements": {
            "requires_historical_data": true,
            "minimum_data_points": 7,
            "data_sources_needed": ["workout_logs", "meal_logs", "sleep_data"],
            "data_freshness_required": "recent"
        },
        
        "expected_outcomes": {
            "response_type": "actionable_steps",
            "time_horizon": "24_hours",
            "success_metrics": ["energy_level", "task_completion", "stress_reduction"],
            "follow_up_needed": true
        },
        
        "collaboration_strategy": {
            "primary_agent": "vitality",
            "supporting_agents": ["analytics", "memory"],
            "conflict_resolution_method": "consensus",
            "agent_priority_order": ["vitality", "analytics", "memory"],
            "expected_conflicts": [],
            "synthesis_approach": "time_box"
        }
    },
    
    "quality_indicators": {
        "routing_quality": "high_quality",
        "validation_level": "standard",
        "human_review_required": false,
        "estimated_processing_time_ms": 15000
    },
    
    "fallback_strategy": {
        "if_primary_fails": "use analytics alone with memory support",
        "minimum_viable_agents": ["analytics"],
        "degraded_mode_acceptable": true
    }
}`;

        const response = await this.callPerplexity([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ], { temperature: 0.3, response_format: 'json' });

        return JSON.parse(response);
    }

    /**
     * Execute agents in parallel for speed
     */
    async executeAgentsParallel(userQuery, agentNames, context) {
        console.log('[PARALLEL] Executing agents in parallel...\n');

        if (!this.serviceBusClient) {
            throw new Error('Service Bus client not configured. Cannot send agent messages.');
        }

        const timeoutMs = process.env.ORCHESTRATOR_RESPONSE_TIMEOUT_MS
            ? parseInt(process.env.ORCHESTRATOR_RESPONSE_TIMEOUT_MS)
            : 45000;

        const waitForResponsesPromise = this.waitForResponses(
            context?.conversationId,
            agentNames,
            timeoutMs
        );

        const sendPromises = agentNames.map(async (agentName) => {
            if (!this.agentQueues[agentName]) {
                console.log(`[Orchestrator] Unknown agent "${agentName}" - skipping.`);
                return agentName;
            }
            console.log(`  [START] ${agentName} agent queued...`);
            await this.routeQuery(userQuery, agentName, context);
            return agentName;
        });

        await Promise.all(sendPromises);

        const responses = await waitForResponsesPromise;

        console.log('\n[SUCCESS] All agents completed\n');
        return responses;
    }

    async routeQuery(query, agentName, context) {
        if (!this.serviceBusClient) return;

        const queueName = this.agentQueues[agentName];
        if (!queueName) return;

        const sender = this.serviceBusClient.createSender(queueName);

        const message = {
            body: {
                query: query,
                timestamp: new Date().toISOString(),
                conversationId: context?.conversationId || this.generateConversationId(),
                requestId: context?.requestId,
                agentType: agentName,
                userId: context?.userId,
                sessionId: context?.sessionId,
                context: context?.sharedContext || {}
            }
        };

        console.log(`[Orchestrator] Sending to ${queueName}:`, query);
        await sender.sendMessages(message);
        await sender.close();
    }

    listenForResponses() {
        this.responseReceiver = this.serviceBusClient.createReceiver(this.responseQueueName);

        console.log('[Orchestrator] Listening for agent responses...');

        this.responseReceiver.subscribe({
            processMessage: async (messageReceived) => {
                const body = messageReceived.body || {};
                const conversationId = body.conversationId;
                const agentName = body.agentName;

                if (!conversationId || !agentName) {
                    console.log('[Orchestrator] Ignoring response without conversationId/agentName.');
                    return;
                }

                console.log(`[Orchestrator] Incoming response: conversationId=${conversationId}, agentName=${agentName}`);

                const pending = this.pendingResponses.get(conversationId);
                if (!pending) {
                    console.log(`[Orchestrator] No pending request for conversationId ${conversationId}. Pending keys: ${Array.from(this.pendingResponses.keys()).join(', ') || 'none'}`);
                    return;
                }

                pending.responses[agentName] = body.response || body;
                console.log(`[Orchestrator] Response received from ${agentName}.`);

                const allReceived = pending.expectedAgents.every((name) => pending.responses[name]);
                if (allReceived) {
                    clearTimeout(pending.timeoutId);
                    pending.resolve(pending.responses);
                    this.pendingResponses.delete(conversationId);
                }
            },
            processError: async (error) => {
                console.error('[Orchestrator] Error:', error);
            }
        });
    }

    waitForResponses(conversationId, agentNames, timeoutMs) {
        return new Promise((resolve) => {
            if (!conversationId) {
                resolve({});
                return;
            }

            console.log(`[Orchestrator] Waiting for responses (conversationId=${conversationId}) from: ${agentNames.join(', ')}`);

            const timeoutId = setTimeout(() => {
                const pending = this.pendingResponses.get(conversationId);
                if (pending) {
                    const remaining = pending.expectedAgents.filter((name) => !pending.responses[name]);
                    console.error(`[Orchestrator] Response timeout. Returning partial responses. Pending agents: ${remaining.join(', ') || 'none'}`);
                    const responses = pending.responses || {};
                    pending.expectedAgents.forEach((name) => {
                        if (!responses[name]) {
                            responses[name] = { error: true, message: 'Response timeout' };
                        }
                    });
                    this.pendingResponses.delete(conversationId);
                    resolve(responses);
                }
            }, timeoutMs);

            this.pendingResponses.set(conversationId, {
                expectedAgents: agentNames,
                responses: {},
                resolve,
                timeoutId
            });
        });
    }

    /**
     * Validate responses and resolve conflicts
     */
    async validateAndResolveConflicts(agentResponses) {
        // Check for conflicting recommendations
        const conflictPrompt = 'Analyze these agent responses for conflicts or contradictions:\n\n' +
            JSON.stringify(agentResponses, null, 2) +
            '\n\nIdentify any conflicts and suggest resolutions. Return JSON:\n' +
            '{\n' +
            '    "has_conflicts": true or false,\n' +
            '    "conflicts": ["conflict description"],\n' +
            '    "resolutions": ["how to resolve"],\n' +
            '    "validated_responses": {}\n' +
            '}';

        try {
            const validation = await this.callPerplexity([
                { role: 'user', content: conflictPrompt }
            ], { temperature: 0.2, response_format: 'json' });

            const result = JSON.parse(validation);
            
            if (result.has_conflicts) {
                console.log('[WARNING] Conflicts detected, applying resolutions...\n');
            }

            return result.validated_responses || agentResponses;
        } catch (error) {
            console.log('[WARNING] Validation skipped, using raw responses\n');
            return agentResponses;
        }
    }

    /**
     * Enhanced synthesis with 3-layer approach
     */
    async enhancedSynthesis(userQuery, agentResponses, context) {
        const agentInsights = Object.entries(agentResponses).map(([agent, response]) => 
            '\n' + agent.toUpperCase() + ':\n' + JSON.stringify(response, null, 2)
        ).join('\n');
        
        const RESPONSE_SYNTHESIS_FRAMEWORK = {
            structure: {
                layer1: {
                    name: 'IMMEDIATE_ACTION',
                    timeframe: '24_HOURS',
                    requirements: [
                        'actionItems: 3-5 concrete, executable tasks',
                        'specificity: exact timing, methods, success metrics',
                        'priority: ranked by impact × feasibility score'
                    ]
                },
                layer2: {
                    name: 'STRATEGIC_INTEGRATION', 
                    timeframe: '1-4_WEEKS',
                    requirements: [
                        'crossDomainStrategy: integrate health, work, social, cognitive domains',
                        'evidenceBasis: reference user data patterns and behavioral science',
                        'milestones: measurable checkpoints with target metrics',
                        'adaptivePathways: if-then branches based on user context'
                    ]
                },
                layer3: {
                    name: 'SYSTEMS_OPTIMIZATION',
                    timeframe: 'LONG_TERM',
                    requirements: [
                        'architecturalThinking: connect to broader life systems',
                        'habitFormation: leverage atomic habits + implementation intentions',
                        'feedbackLoops: define KPIs and tracking mechanisms',
                        'compoundingEffects: identify synergies across domains'
                    ]
                }
            },

            outputRequirements: {
                dataUtilization: {
                    contextInjection: 'Extract and reference specific metrics from agent responses',
                    personalization: 'Use user\'s historical data, preferences, and behavioral patterns',
                    quantification: 'Include numbers, percentages, timestamps, baseline comparisons'
                },
                
                actionability: {
                    implementation: 'Provide step-by-step execution details with no ambiguity',
                    contingencyPlanning: 'Include 2-3 personalized if-then strategies per layer',
                    resourceSpecification: 'Name exact tools, apps, techniques, or resources',
                    timeAllocation: 'Specify duration for each action (e.g., "15-min daily review")'
                },

                intellectualDepth: {
                    mechanismExplanation: 'Explain WHY approaches work (behavioral science, data trends)',
                    patternRecognition: 'Connect insights across multiple life domains',
                    predictiveGuidance: 'Forecast likely outcomes based on user\'s data trajectory'
                },

                engagementOptimization: {
                    tone: 'Supportive coach + strategic advisor hybrid',
                    structure: 'Use markdown hierarchy: ##, ###, -, numbers, **bold** for emphasis',
                    followUp: 'End with 1-2 open-ended questions that deepen self-awareness'
                }
            },

            differentiationStrategy: {
                vs_generic_ai: {
                    specificity: '+25% more concrete through user data integration',
                    interconnectedness: 'Synthesize across agent responses, not isolated insights',
                    executability: 'Zero abstract advice—every recommendation has clear implementation path',
                    adaptiveness: 'Context-aware branching logic based on user state'
                }
            },

            qualityAssurance: {
                preDelivery: [
                    'Verify all metrics sourced from actual agent data (not generic)',
                    'Confirm actionability: could user execute without additional questions?',
                    'Validate cross-domain connections present in Layer 2 & 3',
                    'Check for ≥3 personalized if-then strategies',
                    'Ensure markdown structure enhances scanability'
                ]
            }
        };

        const synthesisPrompt = 'You are synthesizing multi-agent responses into an exceptional, life-changing answer.\n\n' +
            'USER QUERY: "' + userQuery + '"\n\n' +
            'AGENT INSIGHTS:\n' +
            agentInsights +
            '\n\nREQUIREMENTS:\n' +
            'Layer 1 (24 hours): ' + RESPONSE_SYNTHESIS_FRAMEWORK.structure.layer1.requirements.join(', ') + '\n' +
            'Layer 2 (1-4 weeks): ' + RESPONSE_SYNTHESIS_FRAMEWORK.structure.layer2.requirements.join(', ') + '\n' +
            'Layer 3 (Long-term): ' + RESPONSE_SYNTHESIS_FRAMEWORK.structure.layer3.requirements.join(', ') + '\n\n' +
            'Quality Assurance Checklist:\n' +
            RESPONSE_SYNTHESIS_FRAMEWORK.qualityAssurance.preDelivery.map((item, i) => (i + 1) + '. ' + item).join('\n');

        const response = await this.callPerplexity([
            { role: 'system', content: 'You are a world-class life optimization coach synthesizing AI insights.' },
            { role: 'user', content: synthesisPrompt }
        ], { temperature: 0.7 });

        return response;
    }

    /**
     * Perplexity API call wrapper
     */
    async callPerplexity(messages, options = {}) {
        try {
            const response = await axios.post(
                this.perplexityEndpoint,
                {
                    model: options.model || 'sonar-pro',
                    messages: messages,
                    temperature: options.temperature || 0.7,
                    max_tokens: options.max_tokens || 4000,
                    ...(options.response_format === 'json' && {
                        response_format: {
                            type: 'json_schema',
                            json_schema: {
                                name: 'response',
                                schema: {
                                    type: 'object',
                                    additionalProperties: true
                                }
                            }
                        }
                    })
                },
                {
                    headers: {
                        'Authorization': 'Bearer ' + this.perplexityApiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            console.error('Perplexity API Error:', error.response?.data || error.message);
            throw new Error('Perplexity API call failed: ' + error.message);
        }
    }

    getHistory() {
        return this.conversationHistory;
    }
}

module.exports = Orchestrator;

// Test runner
if (require.main === module) {
    const orchestrator = new Orchestrator();
    
    const testQuery = process.argv[2] || "I'm burnt out, my kids need attention, and I'm overspending. Help me fix this.";
    
    orchestrator.processQuery(testQuery)
        .then(response => {
            console.log('\n' + '='.repeat(80));
            console.log('[RESULT] FINAL SYNTHESIZED RESPONSE:');
            console.log('='.repeat(80) + '\n');
            console.log(response);
            console.log('\n' + '='.repeat(80) + '\n');
        })
        .catch(error => {
            console.error('[ERROR] Error:', error.message);
            process.exit(1);
        });
}
