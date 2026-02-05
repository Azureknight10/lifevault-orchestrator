// contextManager.js - Manages shared state across agents
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { TableClient } = require('@azure/data-tables');

class ContextManager {
	constructor() {
		this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
		this.tableName = process.env.AZURE_TABLE_NAME || 'LifeVaultData';


		this.tableClient = null;
		this.sessionCache = new Map();

		if (this.connectionString) {
			try {
				this.tableClient = TableClient.fromConnectionString(
					this.connectionString,
					this.tableName
				);
				console.log('✅ Context Manager: Connected to Azure Tables');
			} catch (error) {
				console.error('⚠️  Context Manager: Azure Tables connection failed:', error.message);
				this.tableClient = null;
			}
		} else {
			console.log('⚠️  Context Manager: AZURE_STORAGE_CONNECTION_STRING not set');
		}
	}

	// Initialize context for a new query
	async getContext(userId, sessionId) {
		const cacheKey = `${userId}_${sessionId}`;

		if (this.sessionCache.has(cacheKey)) {
			return this.sessionCache.get(cacheKey);
		}

		const context = {
			userId: userId,
			sessionId: sessionId,
			timestamp: new Date().toISOString(),
			conversationHistory: await this.getRecentHistory(userId, 5),
			userProfile: await this.getUserProfile(userId),
			activeGoals: await this.getActiveGoals(userId),
			recentInsights: await this.getRecentInsights(userId)
		};

		this.sessionCache.set(cacheKey, context);
		return context;
	}

	// Update context with new information
	async updateContext(userId, sessionId, updates) {
		const cacheKey = `${userId}_${sessionId}`;
		const context = this.sessionCache.get(cacheKey) || {};

		Object.assign(context, updates);
		this.sessionCache.set(cacheKey, context);

		await this.saveContextSnapshot(userId, sessionId, context);
	}

	// Get recent conversation history
	async getRecentHistory(userId, limit = 5) {
		if (!this.tableClient) return [];

		try {
			const entities = this.tableClient.listEntities({
				queryOptions: {
					filter: `PartitionKey eq '${userId}' and entity_type eq 'conversation'`,
					select: ['query', 'response', 'timestamp', 'agents_used']
				}
			});

			const history = [];
			for await (const entity of entities) {
				history.push(entity);
				if (history.length >= limit) break;
			}

			return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		} catch (error) {
			console.error('Error fetching history:', error.message);
			return [];
		}
	}

	// Get user profile data
	async getUserProfile(userId) {
		if (!this.tableClient) {
			return {
				preferences: {},
				workoutGoals: {},
				nutritionPreferences: {},
				energyPatterns: {}
			};
		}

		try {
			const entity = await this.tableClient.getEntity(userId, 'profile');
			return {
				preferences: entity.preferences || {},
				workoutGoals: entity.workoutGoals || {},
				nutritionPreferences: entity.nutritionPreferences || {},
				energyPatterns: entity.energyPatterns || {}
			};
		} catch (error) {
			return {
				preferences: {},
				workoutGoals: {},
				nutritionPreferences: {},
				energyPatterns: {}
			};
		}
	}

	// Get active goals
	async getActiveGoals(userId) {
		if (!this.tableClient) return [];

		try {
			const entities = this.tableClient.listEntities({
				queryOptions: {
					filter: `PartitionKey eq '${userId}' and entity_type eq 'goal' and status eq 'active'`
				}
			});

			const goals = [];
			for await (const entity of entities) {
				goals.push({
					id: entity.rowKey,
					title: entity.title,
					category: entity.category,
					deadline: entity.deadline
				});
			}
			return goals;
		} catch (error) {
			return [];
		}
	}

	// Get recent agent insights
	async getRecentInsights(userId) {
		if (!this.tableClient) return [];

		try {
			const entities = this.tableClient.listEntities({
				queryOptions: {
					filter: `PartitionKey eq '${userId}' and entity_type eq 'insight'`,
					select: ['agent', 'insight', 'timestamp', 'confidence']
				}
			});

			const insights = [];
			for await (const entity of entities) {
				insights.push(entity);
				if (insights.length >= 10) break;
			}

			return insights.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
		} catch (error) {
			return [];
		}
	}

	// Save context snapshot
	async saveContextSnapshot(userId, sessionId, context) {
		if (!this.tableClient) return;

		try {
			const entity = {
				partitionKey: userId,
				rowKey: `context_${sessionId}_${Date.now()}`,
				entity_type: 'context_snapshot',
				sessionId: sessionId,
				timestamp: new Date().toISOString(),
				contextData: JSON.stringify(context)
			};
			await this.tableClient.createEntity(entity);
		} catch (error) {
			console.error('Error saving context:', error.message);
		}
	}

	// Clear session cache
	clearSession(userId, sessionId) {
		const cacheKey = `${userId}_${sessionId}`;
		this.sessionCache.delete(cacheKey);
	}
}

module.exports = new ContextManager();
