const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT || process.env.SEARCH_ENDPOINT;
const searchApiKey = process.env.AZURE_SEARCH_API_KEY || process.env.SEARCH_API_KEY;
const searchIndexName = process.env.AZURE_SEARCH_INDEX_NAME || process.env.SEARCH_INDEX_NAME || 'lifevault-memories';

const openAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const openAiApiKey = process.env.AZURE_OPENAI_API_KEY;
const embeddingsDeployment = process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT;
const openAiApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';

function normalizeEndpoint(endpoint) {
    if (!endpoint) return '';
    return endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
}

function createOpenAiClient() {
    if (!openAiEndpoint || !openAiApiKey || !embeddingsDeployment) {
        throw new Error('Azure OpenAI configuration missing. Check AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT.');
    }

    const baseURL = `${normalizeEndpoint(openAiEndpoint)}/openai/deployments/${embeddingsDeployment}`;
    return new OpenAI({
        apiKey: openAiApiKey,
        baseURL,
        defaultQuery: { 'api-version': openAiApiVersion },
        defaultHeaders: { 'api-key': openAiApiKey }
    });
}

function createSearchClient() {
    if (!searchEndpoint || !searchApiKey) {
        throw new Error('Azure Search configuration missing. Check AZURE_SEARCH_ENDPOINT/AZURE_SEARCH_API_KEY (or SEARCH_ENDPOINT/SEARCH_API_KEY).');
    }

    return new SearchClient(searchEndpoint, searchIndexName, new AzureKeyCredential(searchApiKey));
}

async function getEmbedding(openAiClient, text) {
    const response = await openAiClient.embeddings.create({
        model: embeddingsDeployment,
        input: text
    });

    const embedding = response.data?.[0]?.embedding;
    if (!embedding) {
        throw new Error('Embedding generation failed.');
    }

    return embedding;
}

async function upsertMemory({ userId, source, timestamp, text }) {
    if (!userId || !source || !text) {
        throw new Error('Missing required fields: userId, source, text');
    }

    const client = createSearchClient();
    const openAiClient = createOpenAiClient();
    const embedding = await getEmbedding(openAiClient, text);

    const document = {
        id: uuidv4(),
        userId,
        source,
        timestamp: timestamp || new Date().toISOString(),
        text,
        embedding
    };

    await client.mergeOrUploadDocuments([document]);
    return document;
}

async function searchMemories({ userId, query, topK = 5 }) {
    if (!userId || !query) {
        throw new Error('Missing required fields: userId, query');
    }

    const client = createSearchClient();
    const openAiClient = createOpenAiClient();
    const embedding = await getEmbedding(openAiClient, query);

    const searchResults = await client.search(query, {
        filter: `userId eq '${userId}'`,
        top: topK,
        select: ['id', 'userId', 'source', 'timestamp', 'text'],
        vectorSearch: {
            queries: [
                {
                    kind: 'vector',
                    vector: embedding,
                    fields: 'embedding',
                    kNearestNeighborsCount: topK
                }
            ]
        }
    });

    const results = [];
    for await (const result of searchResults.results) {
        results.push({
            score: result.score,
            rerankerScore: result.rerankerScore,
            ...result.document
        });
    }

    return results;
}

module.exports = {
    upsertMemory,
    searchMemories
};
