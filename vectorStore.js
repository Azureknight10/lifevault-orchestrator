const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { SearchClient, AzureKeyCredential: SearchKeyCredential } = require('@azure/search-documents');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchApiKey = process.env.AZURE_SEARCH_API_KEY;
const searchIndexName = process.env.AZURE_SEARCH_INDEX_NAME || 'lifevault-memories';

const openAiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const openAiApiKey = process.env.AZURE_OPENAI_API_KEY;
const embeddingsDeployment = process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT;
const openAiApiVersion = process.env.AZURE_OPENAI_API_VERSION;

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function createSearchClient() {
  requireEnv('AZURE_SEARCH_ENDPOINT');
  requireEnv('AZURE_SEARCH_API_KEY');
  requireEnv('AZURE_SEARCH_INDEX_NAME');

  return new SearchClient(
    searchEndpoint,
    searchIndexName,
    new SearchKeyCredential(searchApiKey)
  );
}

// Use the official openai JS client pointed at Azure
function createOpenAiClient() {
  requireEnv('AZURE_OPENAI_ENDPOINT');
  requireEnv('AZURE_OPENAI_API_KEY');
  requireEnv('AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT');
  requireEnv('AZURE_OPENAI_API_VERSION');

  return new OpenAI({
    apiKey: openAiApiKey,
    baseURL: `${openAiEndpoint}/openai/deployments/${embeddingsDeployment}`,
    defaultQuery: { 'api-version': openAiApiVersion },
    defaultHeaders: { 'api-key': openAiApiKey }
  });
}

async function getEmbedding(openAiClient, text) {
  const response = await openAiClient.embeddings.create({
    model: embeddingsDeployment,
    input: text
  });

  const embedding = response?.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding generation failed.');
  }

  return embedding;
}

async function storeMemory(userId, content, metadata) {
  try {
    if (!userId || !content) {
      throw new Error('Missing required parameters: userId, content');
    }

    const searchClient = createSearchClient();
    const openAiClient = createOpenAiClient();
    const embedding = await getEmbedding(openAiClient, content);

    const document = {
      id: uuidv4(),
      userId,
      content,
      contentVector: embedding,
      // store as JSON string because metadata field is Edm.String
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date().toISOString()
    };

    await searchClient.mergeOrUploadDocuments([document]);
    console.log(`Stored memory ${document.id} for user ${userId}.`);
    return document.id;
  } catch (error) {
    console.error('Failed to store memory:', error.message);
    throw error;
  }
}

async function searchMemories(userId, query, topK = 5) {
  try {
    if (!userId || !query) {
      throw new Error('Missing required parameters: userId, query');
    }

    const searchClient = createSearchClient();
    const openAiClient = createOpenAiClient();
    const embedding = await getEmbedding(openAiClient, query);

    const searchResults = await searchClient.search('', {
      filter: `userId eq '${userId}'`,
      top: topK,
      select: ['id', 'userId', 'content', 'metadata', 'timestamp'],
      vectorSearch: {
        queries: [
          {
            kind: 'vector',
            vector: embedding,
            fields: 'contentVector',
            kNearestNeighborsCount: topK
          }
        ]
      }
    });

    const results = [];
    for await (const result of searchResults.results) {
      const doc = result.document || {};
      let parsedMetadata = null;
      if (doc.metadata) {
        try {
          parsedMetadata = JSON.parse(doc.metadata);
        } catch {
          parsedMetadata = doc.metadata;
        }
      }

      results.push({
        score: result.score,
        ...doc,
        metadata: parsedMetadata
      });
    }

    console.log(`Found ${results.length} memories for user ${userId}.`);
    return results;
  } catch (error) {
    console.error('Failed to search memories:', error.message);
    throw error;
  }
}

module.exports = {
  storeMemory,
  searchMemories
};
