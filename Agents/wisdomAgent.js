// agents/wisdomAgent.js - Strategic life guidance, decision frameworks, and accountability coaching
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');
const { ServiceBusClient } = require('@azure/service-bus');
const { saveMemory, getMemoriesForTopic } = require('../graphstore');

const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const serviceBusClient = serviceBusConnectionString
    ? new ServiceBusClient(serviceBusConnectionString)
    : null;
const agentQueueName = 'wisdom-queue';
const responseQueueName = process.env.ORCHESTRATOR_RESPONSE_QUEUE || 'orchestrator-response-queue';

class WisdomAgent {
    constructor() {
        this.perplexityApiKey = process.env.PERPLEXITY_API_KEY;
        this.perplexityEndpoint = 'https://api.perplexity.ai/chat/completions';

        this.systemPrompt = `You are WisdomAgent, Shane's strategic advisor and highest-self architect.

Your mission:
- Help Shane become the greatest version of himself across vitality, work, family, and purpose.
- Synthesize insights from all domains (Vitality, Analytics, Memory) and guide Shane toward decisions aligned with his deepest values and long-term vision.
- Be the voice that asks the hard questions, holds Shane accountable, and keeps him from drifting into busyness without purpose.

═══════════════════════════════════════════════════════════════
CORE CAPABILITIES:
═══════════════════════════════════════════════════════════════

1. STRATEGIC LIFE GUIDANCE
   - Clarify Shane's vision, values, and priorities across all life domains
   - Provide decision-making frameworks for complex, multi-domain tradeoffs
   - Identify second-order consequences and long-term implications
   - Balance short-term wins with sustainable, compounding outcomes

2. CROSS-DOMAIN SYNTHESIS
   - Integrate insights from health, career, parenting, relationships, personal growth, and finances
   - Translate data from Analytics and patterns from Memory into clear strategic direction
   - Find leverage points: the few actions that unlock disproportionate gains
   - Design compounding habit systems that reinforce each other

3. PHILOSOPHICAL AND MEANING-DRIVEN PERSPECTIVE
   - Offer timeless principles and deeper context for difficult choices
   - Encourage decisions rooted in integrity, meaning, and purpose, not just optimization
   - Tie tactical plans back to identity and who Shane wants to become

4. LONG-TERM PLANNING AND ARCHITECTURE
   - Build 90-day, 1-year, and 3–5 year roadmaps with clear milestones
   - Define success metrics and checkpoints that matter
   - Anticipate tradeoffs, constraints, and decision branches
   - Connect short-term actions to long-term identity and legacy

5. ACCOUNTABILITY COACHING (John Maxwell-inspired)
   - Encourage ownership, clarity, and follow-through
   - Provide 3–5 concrete, ranked next steps with deadlines
   - Ask direct, constructive coaching questions that reinforce commitment
   - Celebrate wins and flag drift with honesty and encouragement

═══════════════════════════════════════════════════════════════
INPUT YOU RECEIVE
═══════════════════════════════════════════════════════════════

You will receive:
- query: Shane's current question, decision, or challenge.
- context: JSON with goals, recent events, vitality status, analytics patterns, memory insights, constraints, and summaries from other agents.
- intent (when present): what Shane wants (e.g., "big_decision", "reflect", "plan_sprint", "weekly_review").

Always read and integrate the full context. Never give generic advice—every answer must be tailored to Shane's real life, constraints, and aspirations.

═══════════════════════════════════════════════════════════════
RESPONSE STRUCTURE
═══════════════════════════════════════════════════════════════

Always respond in this structure:

1) Strategic summary (3–5 sentences)
- Plain-language overview of the situation, the core tension or opportunity, and your recommended path forward.

2) Layer 1: Next 24–48 hours (immediate actions)
- 3–5 ranked, concrete steps Shane should take right now.
- Include simple success metrics for each (e.g., "by 10 PM tonight", "rated 7+/10 buy-in").

3) Layer 2: 1–4 week plan (tactical rhythm)
- How to structure the next 1–4 weeks to make real progress on this decision/goal.
- Include adaptive "if–then" pathways (at least 3).
- Tie to habits, milestones, and weekly check-ins.

4) Layer 3: Long-term architecture (90 days to 3 years)
- How this decision/plan fits into Shane's bigger life systems and identity.
- Define feedback loops, compounding effects, and how to know if the strategy is working.
- Include habit formation principles and one suggested ritual or review cadence.

5) Coaching questions (1–2)
- Direct, powerful questions that reinforce ownership and clarity (e.g., "What would the highest version of you do here?", "What are you willing to sacrifice to make this real?").

6) Perspective from books
- When helpful, briefly bring in ideas or perspectives from books that fit Shane’s current situation.
- Do not list titles; instead, summarize the key idea (1–2 sentences) and how it applies to Shane’s life and decision.

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS:
═══════════════════════════════════════════════════════════════

✓ Provide structured guidance with clear frameworks and principles
✓ Offer 3–5 concrete next actions, ranked by impact
✓ Define success metrics and accountability check-ins
✓ Always end with 1–2 coaching questions that drive ownership
✓ Include a book quote that adds wisdom and perspective to the situation
✓ Tie everything back to Shane's identity, values, and long-term vision

Your tone:
- Direct, wise, and encouraging. No fluff or platitudes.
- Treat Shane as capable and intelligent; challenge him to think bigger and act with integrity.
- Balance honesty (call out drift or misalignment) with belief in his potential.
- Be the voice that keeps him honest, focused, and moving toward his highest self.`;
    }

    async process(userQuery, context = {}) {
        console.log('🧭 Wisdom Agent processing...');

        try {
            const queryAnalysis = this.analyzeQuery(userQuery);
            const insights = this.extractAgentInsights(context);

            const guidance = await this.generateWisdomGuidance(
                userQuery,
                queryAnalysis,
                insights,
                context
            );

            const responseText = guidance;
            const topics = ['wisdom', 'self_improvement'];
            const lower = (userQuery || '').toLowerCase();

            if (lower.includes('nutrition') || lower.includes('food') || lower.includes('diet')) {
                topics.push('nutrition');
            }
            if (lower.includes('workout') || lower.includes('exercise') || lower.includes('gym')) {
                topics.push('workouts');
            }
            if (lower.includes('sleep') || lower.includes('rest')) {
                topics.push('sleep');
            }

            const memoryId = `wisdom-${Date.now()}`;
            const resolvedUserId = context.userId || context.context?.userId;

            await saveMemory({
                userId: resolvedUserId || 'user-001',
                id: memoryId,
                text: responseText,
                topics,
                sourceAgent: 'wisdom',
            });

            return {
                agent: 'wisdom',
                timestamp: new Date().toISOString(),
                query_type: queryAnalysis.type,
                domains: queryAnalysis.domains,
                time_horizon: queryAnalysis.time_horizon,
                insights_used: insights.summary,
                guidance: guidance,
                success: true
            };
        } catch (error) {
            console.error('❌ Wisdom Agent error:', error.message);
            return {
                agent: 'wisdom',
                error: true,
                message: error.message,
                guidance: this.fallbackWisdomGuidance(userQuery),
                success: false
            };
        }
    }

    analyzeQuery(query) {
        const q = query.toLowerCase();

        let type = 'general_guidance';
        if (q.match(/decide|decision|choice|tradeoff|trade-off|prioritize/)) {
            type = 'decision_framework';
        } else if (q.match(/plan|planning|strategy|roadmap|vision|long-term|long term/)) {
            type = 'long_term_planning';
        } else if (q.match(/accountability|commit|follow through|discipline|consistency/)) {
            type = 'accountability_coaching';
        } else if (q.match(/reflect|meaning|purpose|values|why/)) {
            type = 'philosophical_perspective';
        }

        const domains = [];
        if (q.match(/parent|parenting|dad|kid|child|school|homework|evander|amelia/)) domains.push('parenting');
        if (q.match(/career|job|promotion|manager|leadership|business|work/)) domains.push('career');
        if (q.match(/health|fitness|workout|sleep|nutrition|energy/)) domains.push('health');
        if (q.match(/growth|habit|mindset|identity|discipline|learning/)) domains.push('personal_growth');
        if (q.match(/relationship|marriage|partner|friend|family|communication/)) domains.push('relationships');

        let time_horizon = 'near_term';
        if (q.match(/year|annual|long-term|long term|5 year|3 year|vision/)) time_horizon = 'long_term';
        if (q.match(/quarter|90 day|month|monthly/)) time_horizon = 'mid_term';

        return { type, domains: domains.length ? domains : ['multi_domain'], time_horizon };
    }

    extractAgentInsights(context) {
        const insightSources = {
            memory: [],
            vitality: [],
            analytics: []
        };

        const history = context.conversationHistory || [];
        const recent = history.slice(-3);

        recent.forEach(entry => {
            const responses = entry.agentResponses || {};
            if (responses.memory) insightSources.memory.push(responses.memory);
            if (responses.vitality) insightSources.vitality.push(responses.vitality);
            if (responses.analytics) insightSources.analytics.push(responses.analytics);
        });

        if (context.agentResponses) {
            if (context.agentResponses.memory) insightSources.memory.push(context.agentResponses.memory);
            if (context.agentResponses.vitality) insightSources.vitality.push(context.agentResponses.vitality);
            if (context.agentResponses.analytics) insightSources.analytics.push(context.agentResponses.analytics);
        }

        const summary = {
            memory_records: insightSources.memory.length,
            vitality_records: insightSources.vitality.length,
            analytics_records: insightSources.analytics.length,
            has_any: insightSources.memory.length + insightSources.vitality.length + insightSources.analytics.length > 0
        };

        return { insightSources, summary };
    }

    async generateWisdomGuidance(userQuery, queryAnalysis, insights, context) {
        const prompt = `USER QUERY: "${userQuery}"

QUERY ANALYSIS:
${JSON.stringify(queryAnalysis, null, 2)}

AVAILABLE INSIGHTS (memory/vitality/analytics):
${JSON.stringify(insights.summary, null, 2)}

RECENT AGENT INSIGHTS (use if available):
${JSON.stringify(insights.insightSources, null, 2)}

RESPONSE FORMAT:
## Strategic Guidance
- 3-5 concise, actionable recommendations

## Decision Framework
- Apply a clear framework (e.g., 10-10-10, regret minimization, second-order effects, opportunity cost)

## Long-Term Vision & Plan
- Define 90-day, 1-year, and 3-5 year focus points
- Include measurable milestones

## Accountability
- Define 1-3 commitments
- Define check-in cadence and success metrics

End with 1-2 John Maxwell-style coaching questions that drive ownership.`;

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
                    max_tokens: 1600
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.perplexityApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            const recommendations = this.formatBookRecommendations(
                this.getBookRecommendations(queryAnalysis)
            );

            return response.data.choices[0].message.content + recommendations;
        } catch (error) {
            console.error('⚠️ Wisdom synthesis error:', error.message);
            return this.fallbackWisdomGuidance(userQuery, queryAnalysis);
        }
    }

    fallbackWisdomGuidance(userQuery, queryAnalysis = {}) {
        return `Strategic Guidance
- Clarify the real objective and the tradeoffs you are willing to accept.
- Identify the single highest‑leverage action you can take in the next 7 days.
- Protect your energy: align the choice with sleep, health, and family priorities.
- Define a simple scorecard so you can review progress every week.

Decision Framework
Use the 10–10–10 lens: How will this choice feel in 10 days, 10 months, and 10 years?  
Choose the option that best protects your long‑term integrity, growth, and relationships.

Long‑Term Vision & Plan
- 90 days:** Define one clear, measurable outcome and build a weekly rhythm that supports it.
- 1 year:** Set 2–3 milestones that would signal real, undeniable progress.
- 3–5 years:** Ensure this path aligns with your core values and the identity you’re building.

Accountability
- Commitment: Choose one daily habit and one weekly review ritual tied to this decision.
- Check‑in cadence:At least one 15‑minute weekly review to adjust course.
- Success metric: One primary number to track (e.g., focused hours, key behaviors, or milestones completed).

Coaching question: What are you absolutely unwilling to compromise on here—and what must change this week to honor that?

${this.formatBookRecommendations(this.getBookRecommendations(queryAnalysis))}`;
    }

    getBookRecommendations(queryAnalysis = {}) {
        const domains = queryAnalysis.domains || ['multi_domain'];
        const type = queryAnalysis.type || 'general_guidance';

        const library = [
            { tags: ['decision_framework'], title: 'Decisive', author: 'Chip Heath & Dan Heath', reason: 'Practical frameworks to reduce bias and improve decisions.' },
            { tags: ['decision_framework'], title: 'Thinking in Bets', author: 'Annie Duke', reason: 'Decision-making under uncertainty with real-world tools.' },
            { tags: ['long_term_planning', 'accountability_coaching'], title: 'The 12 Week Year', author: 'Brian P. Moran & Michael Lennington', reason: 'Turns long-term goals into near-term execution.' },
            { tags: ['accountability_coaching', 'personal_growth'], title: 'Atomic Habits', author: 'James Clear', reason: 'Builds consistency through systems, not willpower.' },
            { tags: ['career'], title: 'The 21 Irrefutable Laws of Leadership', author: 'John C. Maxwell', reason: 'Leadership principles aligned with accountability coaching.' },
            { tags: ['career'], title: 'Deep Work', author: 'Cal Newport', reason: 'Focus and execution in high-stakes career growth.' },
            { tags: ['parenting'], title: 'The Whole-Brain Child', author: 'Daniel J. Siegel & Tina Payne Bryson', reason: 'Practical tools for guiding child behavior with empathy.' },
            { tags: ['parenting'], title: 'How to Talk So Kids Will Listen', author: 'Adele Faber & Elaine Mazlish', reason: 'Improves communication and reduces conflict.' },
            { tags: ['health'], title: 'Why We Sleep', author: 'Matthew Walker', reason: 'Foundational for energy, mood, and decision quality.' },
            { tags: ['health'], title: 'Outlive', author: 'Peter Attia', reason: 'Long-term health strategy and risk reduction.' },
            { tags: ['relationships'], title: 'Crucial Conversations', author: 'Kerry Patterson et al.', reason: 'Handle high-stakes conversations with clarity.' },
            { tags: ['relationships'], title: 'Nonviolent Communication', author: 'Marshall B. Rosenberg', reason: 'De-escalation and connection in relationships.' },
            { tags: ['personal_growth'], title: 'Essentialism', author: 'Greg McKeown', reason: 'Clarify priorities and eliminate non-essentials.' },
            { tags: ['personal_growth'], title: 'Man’s Search for Meaning', author: 'Viktor E. Frankl', reason: 'Perspective and purpose during hard seasons.' }
        ];

        const targetTags = new Set([type, ...domains]);
        const matches = library.filter(book => book.tags.some(tag => targetTags.has(tag)));

        const fallback = library.filter(book =>
            ['personal_growth', 'accountability_coaching', 'decision_framework'].some(tag => book.tags.includes(tag))
        );

        const picks = (matches.length ? matches : fallback).slice(0, 3);
        return picks;
    }

    formatBookRecommendations(books) {
        if (!books || books.length === 0) return '';

        const lines = books.map(book =>
            `- **${book.title}** — ${book.author}: ${book.reason}`
        ).join('\n');

        return `\n\n## Book Recommendations\n${lines}`;
    }
}

module.exports = WisdomAgent;

async function startWisdomAgent() {
    if (!serviceBusClient) {
        console.log('⚠️ Wisdom Agent: Service Bus connection string not set. Listener not started.');
        return;
    }

    const agent = new WisdomAgent();
    const receiver = serviceBusClient.createReceiver(agentQueueName);

    console.log(`[Wisdom Agent] Listening on ${agentQueueName}...`);

    receiver.subscribe({
        processMessage: async (messageReceived) => {
            const query = messageReceived.body?.query;
            const conversationId = messageReceived.body?.conversationId;
            const userId = messageReceived.body?.userId;
            const sessionId = messageReceived.body?.sessionId;
            const sharedContext = messageReceived.body?.context || {};

            console.log('[Wisdom Agent] Message received:', query);
            console.log(`[Wisdom Agent] sessionId: ${sessionId || 'missing'}`);

            if (!query) {
                console.log('[Wisdom Agent] No query provided in message body.');
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
                lastWisdomQuery: query,
                lastWisdomTimestamp: new Date().toISOString()
            };

            const sender = serviceBusClient.createSender(responseQueueName);
            await sender.sendMessages({
                body: {
                    agentName: 'wisdom',
                    response: {
                        agent: 'wisdom',
                        sessionId,
                        response,
                        contextUpdates
                    },
                    conversationId,
                    timestamp: new Date().toISOString()
                }
            });
            await sender.close();

            console.log('[Wisdom Agent] Response sent to orchestrator.');
        },
        processError: async (error) => {
            console.error('[Wisdom Agent] Error:', error);
        }
    });
}

if (require.main === module) {
    startWisdomAgent();
}

module.exports.startWisdomAgent = startWisdomAgent;
