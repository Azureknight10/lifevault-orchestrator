const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { SearchIndexClient, AzureKeyCredential } = require('@azure/search-documents');

const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
const searchApiKey = process.env.AZURE_SEARCH_API_KEY;
const searchIndexName = process.env.AZURE_SEARCH_INDEX_NAME || 'lifevault-memories';
const vectorDimensions = 1536;

if (!searchEndpoint || !searchApiKey) {
    console.error('Missing AZURE_SEARCH_ENDPOINT or AZURE_SEARCH_API_KEY');
    process.exit(1);
}

async function createIndex() {
    const client = new SearchIndexClient(searchEndpoint, new AzureKeyCredential(searchApiKey));

    const indexDefinition = {
        name: 'lifevault-memories',
        fields: [
            { name: 'id', type: 'Edm.String', key: true, filterable: true, retrievable: true },
            { name: 'userId', type: 'Edm.String', filterable: true, searchable: false, retrievable: true },
            { name: 'content', type: 'Edm.String', searchable: true, retrievable: true },
            { name: 'metadata', type: 'Edm.String', retrievable: true },
            { name: 'timestamp', type: 'Edm.DateTimeOffset', filterable: true, sortable: true, retrievable: true },
            {
                name: 'contentVector',
                type: 'Collection(Edm.Single)',
                searchable: true,
                dimensions: 1536,
                vectorSearchConfiguration: 'default'
            }
        ],
        vectorSearch: {
            algorithmConfigurations: [
                {
                    name: 'default',
                    kind: 'hnsw'
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
