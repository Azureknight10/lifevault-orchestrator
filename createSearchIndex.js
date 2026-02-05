const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

const searchEndpoint = process.env.SEARCH_ENDPOINT;
const searchApiKey = process.env.SEARCH_API_KEY;
const searchIndexName = process.env.SEARCH_INDEX_NAME || 'lifevault-memories';
const vectorDimensions = parseInt(process.env.SEARCH_VECTOR_DIMENSIONS || '1536');

if (!searchEndpoint || !searchApiKey) {
    console.error('Missing SEARCH_ENDPOINT or SEARCH_API_KEY');
    process.exit(1);
}

async function createIndex() {
    const client = new SearchIndexClient(searchEndpoint, new AzureKeyCredential(searchApiKey));

    const indexDefinition = {
        name: searchIndexName,
        fields: [
            { name: 'id', type: 'Edm.String', key: true, filterable: true },
            { name: 'userId', type: 'Edm.String', filterable: true },
            { name: 'source', type: 'Edm.String', filterable: true },
            { name: 'timestamp', type: 'Edm.DateTimeOffset', sortable: true },
            { name: 'text', type: 'Edm.String', searchable: true },
            {
                name: 'embedding',
                type: 'Collection(Edm.Single)',
                searchable: true,
                vectorSearchDimensions: vectorDimensions,
                vectorSearchProfile: 'vector-profile'
            }
        ],
        vectorSearch: {
            algorithms: [
                {
                    name: 'vector-algorithm',
                    kind: 'hnsw',
                    parameters: { metric: 'cosine' }
                }
            ],
            profiles: [
                {
                    name: 'vector-profile',
                    algorithmConfigurationName: 'vector-algorithm'
                }
            ]
        }
    };

    await client.createOrUpdateIndex(indexDefinition);
    console.log(`Index ${searchIndexName} created/updated.`);
}

createIndex().catch((error) => {
    console.error('Failed to create index:', error.message);
    process.exit(1);
});
