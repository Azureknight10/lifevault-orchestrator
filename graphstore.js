require('dotenv').config();

const neo4j = require('neo4j-driver');

const uri = process.env.NEO4J_URI;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASSWORD;

console.log('Neo4j URI:', uri);

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function saveMemory({ userId, id, text, topics = [], sourceAgent }) {
    const session = driver.session();

    try {
        const result = await session.run(
            `
            MATCH (u:User {userId: $userId})
            MERGE (m:Memory {id: $id})
            SET m.text = $text,
                m.createdAt = datetime(),
                m.sourceAgent = $sourceAgent
            MERGE (u)-[:HAS_MEMORY]->(m)
            WITH m
            UNWIND $topics AS topicName
            MATCH (t:Topic {name: topicName})
            MERGE (m)-[:ABOUT_TOPIC]->(t)
            RETURN m { .* } AS memory
            `,
            {
                userId,
                id,
                text,
                topics,
                sourceAgent,
            }
        );

        const record = result.records[0];
        return record ? record.get('memory') : null;
    } finally {
        await session.close();
    }
}

async function getMemoriesForTopic(userId, topicName, limit = 20) {
    const session = driver.session();

    try {
        const result = await session.run(
            `
            MATCH (u:User {userId: $userId})-[:HAS_MEMORY]->(m:Memory)-[:ABOUT_TOPIC]->(t:Topic {name: $topicName})
            RETURN m { .* } AS memory
            ORDER BY m.createdAt DESC
            LIMIT $limit
            `,
            {
                userId,
                topicName,
                limit: neo4j.int(limit),
            }
        );

        return result.records.map(record => record.get('memory'));
    } finally {
        await session.close();
    }
}

async function closeDriver() {
    await driver.close();
}

module.exports = { saveMemory, getMemoriesForTopic, closeDriver };