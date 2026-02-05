// testOrchestrator.js
require('dotenv').config();

const { ServiceBusClient } = require('@azure/service-bus');

const serviceBusConnectionString = process.env.AZURE_SERVICE_BUS_CONNECTION_STRING;
const orchestratorRequestQueue = 'orchestrator-request-queue';
const orchestratorResponseQueue = 'orchestrator-response-queue';

async function testOrchestrator() {
  console.log('=== ORCHESTRATOR END-TO-END TEST ===\n');

  const serviceBusClient = new ServiceBusClient(serviceBusConnectionString);
  
  const testQuery = 'Give me a 7-day plan to improve my energy, focus, and reduce spending on junk food';
  const userId = 'test-user-001';
  const sessionId = `test-session-${Date.now()}`;
  const conversationId = `test-conv-${Date.now()}`;

  console.log('Test Query:', testQuery);
  console.log('User ID:', userId);
  console.log('Session ID:', sessionId);
  console.log('\nSending query to orchestrator...\n');

  const sender = serviceBusClient.createSender(orchestratorRequestQueue);
  
  await sender.sendMessages({
    body: {
      query: testQuery,
      userId,
      sessionId,
      conversationId,
      context: {}
    }
  });
  
  await sender.close();
  console.log('✓ Query sent to orchestrator-request-queue\n');

  const receiver = serviceBusClient.createReceiver(orchestratorResponseQueue);
  const responses = [];
  const startTime = Date.now();
  const timeout = 45000;

  console.log('Waiting for agent responses...\n');

  const messageHandler = async (messageReceived) => {
    const body = messageReceived.body;
    const agentName = body.agentName || body.response?.agent || 'unknown';
    
    console.log(`✓ Response received from: ${agentName}`);
    
    responses.push({
      agent: agentName,
      timestamp: body.timestamp,
      success: body.response?.success !== false,
      preview: body.response?.guidance?.substring(0, 100) || 
               body.response?.response?.substring(0, 100) ||
               JSON.stringify(body.response).substring(0, 100)
    });
  };

  const errorHandler = async (error) => {
    console.error('Error receiving message:', error.message);
  };

  receiver.subscribe({
    processMessage: messageHandler,
    processError: errorHandler
  });

  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      
      if (responses.length >= 4 || elapsed > timeout) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);
  });

  await receiver.close();
  await serviceBusClient.close();

  console.log('\n=== TEST RESULTS ===\n');
  console.log(`Total responses received: ${responses.length}/4`);
  console.log('Expected agents: Vitality, Analytics, Memory, Wisdom\n');

  responses.forEach((r, i) => {
    console.log(`${i + 1}. ${r.agent.toUpperCase()}`);
    console.log(`   Success: ${r.success}`);
    console.log(`   Preview: ${r.preview}...\n`);
  });

  if (responses.length === 4) {
    console.log('✅ ALL AGENTS RESPONDED - Orchestrator working end-to-end!\n');
  } else {
    console.log(`⚠️  Only ${responses.length}/4 agents responded within timeout.`);
    console.log('Check that all agent workers are running.\n');
  }

  process.exit(0);
}

testOrchestrator().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
