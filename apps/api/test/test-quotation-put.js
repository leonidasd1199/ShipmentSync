#!/usr/bin/env node

/**
 * Test script for Quotation PUT Endpoint
 * 
 * Tests the PUT /quotations/:id endpoint to verify it works correctly
 * 
 * Usage:
 *   node test-quotation-put.js [API_URL]
 * 
 * Example:
 *   node test-quotation-put.js http://localhost:3000
 */

const http = require('http');
const https = require('https');

const API_URL = process.argv[2] || 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let authToken = '';
let testQuotationId = '';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test helper
async function test(name, testFn) {
  process.stdout.write(`\n${COLORS.cyan}Testing: ${name}${COLORS.reset}... `);
  try {
    await testFn();
    console.log(`${COLORS.green}✓ PASSED${COLORS.reset}`);
    return true;
  } catch (error) {
    console.log(`${COLORS.red}✗ FAILED${COLORS.reset}`);
    console.log(`  ${COLORS.red}Error:${COLORS.reset} ${error.message}`);
    if (error.response) {
      console.log(`  Status: ${error.response.status}`);
      console.log(`  Body: ${JSON.stringify(error.response.body, null, 2)}`);
    }
    return false;
  }
}

// Login to get auth token
async function login() {
  console.log(`${COLORS.blue}Logging in...${COLORS.reset}`);
  const response = await makeRequest('POST', '/auth/login', {
    email: 'john.doe@shipsync.com',
    password: 'password123',
  });

  if (response.status === 200 && response.body.access_token) {
    authToken = response.body.access_token;
    console.log(`${COLORS.green}Login successful${COLORS.reset}`);
    return true;
  } else {
    console.log(`${COLORS.red}Login failed:${COLORS.reset}`, response.body);
    return false;
  }
}

// Get a draft quotation for testing
async function getDraftQuotation() {
  const response = await makeRequest('GET', '/quotations?limit=10', null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (response.status !== 200) {
    throw new Error(`Failed to get quotations: ${response.status}`);
  }

  // Find a draft quotation
  const draftQuotation = response.body.items?.find((q) => q.status === 'draft');
  if (draftQuotation) {
    return draftQuotation.id;
  }

  // If no draft quotation exists, create one
  console.log(`\n    ${COLORS.yellow}No draft quotation found, creating one...${COLORS.reset}`);
  
  // First get helper data
  const [shippingLines, clients, company] = await Promise.all([
    makeRequest('GET', '/quotations/helpers/shipping-lines', null, {
      Authorization: `Bearer ${authToken}`,
    }),
    makeRequest('GET', '/quotations/helpers/clients', null, {
      Authorization: `Bearer ${authToken}`,
    }),
    makeRequest('GET', '/quotations/helpers/company', null, {
      Authorization: `Bearer ${authToken}`,
    }),
  ]);

  if (
    shippingLines.status !== 200 ||
    clients.status !== 200 ||
    company.status !== 200
  ) {
    throw new Error('Failed to get helper data for creating quotation');
  }

  const createResponse = await makeRequest(
    'POST',
    '/quotations',
    {
      clientId: clients.body[0]._id,
      companyId: company.body._id,
      shippingLineId: shippingLines.body[0]._id,
      items: [
        {
          type: 'cargo',
          description: 'Test cargo item',
          price: 100,
          transitType: 'air',
        },
      ],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'draft',
    },
    {
      Authorization: `Bearer ${authToken}`,
    }
  );

  if (createResponse.status !== 201) {
    throw new Error(`Failed to create quotation: ${createResponse.status}`);
  }

  return createResponse.body.id;
}

// Update quotation
async function updateQuotation(id, updateData) {
  const response = await makeRequest('PUT', `/quotations/${id}`, updateData, {
    Authorization: `Bearer ${authToken}`,
  });
  return response;
}

async function runTests() {
  console.log(`${COLORS.blue}=== Quotation PUT Endpoint Test Suite ===${COLORS.reset}`);
  console.log(`API URL: ${API_URL}\n`);

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.log(`${COLORS.red}Cannot proceed without authentication${COLORS.reset}`);
    process.exit(1);
  }

  // Get or create a draft quotation
  console.log(`${COLORS.blue}Getting draft quotation for testing...${COLORS.reset}`);
  try {
    testQuotationId = await getDraftQuotation();
    console.log(`${COLORS.green}Using quotation ID: ${testQuotationId}${COLORS.reset}\n`);
  } catch (error) {
    console.log(`${COLORS.red}Failed to get/create quotation:${COLORS.reset} ${error.message}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // Helper function to extract ID from response (handles string, ObjectId, or populated object)
  const extractId = (value) => {
    if (!value) return value;
    if (typeof value === 'string') {
      // If it's a string, check if it contains ObjectId pattern and extract it
      const objectIdMatch = value.match(/ObjectId\('([^']+)'\)/);
      if (objectIdMatch) return objectIdMatch[1];
      return value;
    }
    // If it's an object, try to get _id
    if (value._id) {
      const id = value._id;
      return typeof id === 'string' ? id : (id.toString ? id.toString() : String(id));
    }
    // Try toString as last resort
    if (typeof value.toString === 'function') {
      const str = value.toString();
      const objectIdMatch = str.match(/ObjectId\('([^']+)'\)/);
      if (objectIdMatch) return objectIdMatch[1];
      return str;
    }
    return String(value);
  };

  // Test 1: Update notes
  const result1 = await test('Update quotation notes', async () => {
    const updateData = { notes: 'Updated notes from test script' };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    if (response.body.notes !== updateData.notes) {
      throw new Error(`Expected notes to be "${updateData.notes}", got "${response.body.notes}"`);
    }

    console.log(`\n    Updated notes: "${response.body.notes}"`);
  });
  result1 ? passed++ : failed++;

  // Test 2: Update items
  const result2 = await test('Update quotation items', async () => {
    const updateData = {
      items: [
        {
          type: 'cargo',
          description: 'Updated cargo item',
          price: 200,
          transitType: 'maritime',
        },
        {
          type: 'custom',
          description: 'Custom service item',
          price: 50,
        },
      ],
    };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    if (response.body.items.length !== 2) {
      throw new Error(`Expected 2 items, got ${response.body.items.length}`);
    }

    if (response.body.items[0].description !== 'Updated cargo item') {
      throw new Error('First item description not updated correctly');
    }

    console.log(`\n    Updated items count: ${response.body.items.length}`);
  });
  result2 ? passed++ : failed++;

  // Test 3: Update validUntil
  const result3 = await test('Update validUntil date', async () => {
    const newDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const updateData = { validUntil: newDate };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseDate = new Date(response.body.validUntil).toISOString();
    const expectedDate = new Date(newDate).toISOString();
    if (responseDate !== expectedDate) {
      throw new Error(`Expected validUntil to be ${expectedDate}, got ${responseDate}`);
    }

    console.log(`\n    Updated validUntil: ${response.body.validUntil}`);
  });
  result3 ? passed++ : failed++;

  // Test 4: Update clientId
  const result4 = await test('Update quotation clientId', async () => {
    // Get clients
    const clientsResponse = await makeRequest('GET', '/quotations/helpers/clients', null, {
      Authorization: `Bearer ${authToken}`,
    });

    if (clientsResponse.status !== 200 || !clientsResponse.body.length) {
      throw new Error('Failed to get clients for testing');
    }

    // Use a different client if available, otherwise use the same one
    const newClientId = clientsResponse.body.length > 1 
      ? clientsResponse.body[1]._id 
      : clientsResponse.body[0]._id;

    const updateData = { clientId: newClientId };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseClientId = extractId(response.body.clientId);
    
    if (responseClientId !== newClientId) {
      throw new Error(`Expected clientId to be ${newClientId}, got ${responseClientId}`);
    }

    console.log(`\n    Updated clientId: ${responseClientId}`);
  });
  result4 ? passed++ : failed++;

  // Test 5: Update shippingLineId
  const result5 = await test('Update quotation shippingLineId', async () => {
    // Get shipping lines
    const shippingLinesResponse = await makeRequest('GET', '/quotations/helpers/shipping-lines', null, {
      Authorization: `Bearer ${authToken}`,
    });

    if (shippingLinesResponse.status !== 200 || !shippingLinesResponse.body.length) {
      throw new Error('Failed to get shipping lines for testing');
    }

    // Use a different shipping line if available
    const newShippingLineId = shippingLinesResponse.body.length > 1 
      ? shippingLinesResponse.body[1]._id 
      : shippingLinesResponse.body[0]._id;

    const updateData = { shippingLineId: newShippingLineId };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseShippingLineId = extractId(response.body.shippingLineId);
    
    if (responseShippingLineId !== newShippingLineId) {
      throw new Error(`Expected shippingLineId to be ${newShippingLineId}, got ${responseShippingLineId}`);
    }

    console.log(`\n    Updated shippingLineId: ${responseShippingLineId}`);
  });
  result5 ? passed++ : failed++;

  // Test 6: Update agentId
  const result6 = await test('Update quotation agentId', async () => {
    // Get agents
    const agentsResponse = await makeRequest('GET', '/quotations/helpers/agents', null, {
      Authorization: `Bearer ${authToken}`,
    });

    if (agentsResponse.status !== 200 || !agentsResponse.body.length) {
      throw new Error('Failed to get agents for testing');
    }

    const newAgentId = agentsResponse.body[0]._id;
    const updateData = { agentId: newAgentId };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseAgentId = extractId(response.body.agentId);
    
    if (responseAgentId !== newAgentId) {
      throw new Error(`Expected agentId to be ${newAgentId}, got ${responseAgentId}`);
    }

    console.log(`\n    Updated agentId: ${responseAgentId}`);

    // Test clearing agentId (set to null)
    const clearData = { agentId: null };
    const clearResponse = await updateQuotation(testQuotationId, clearData);

    if (clearResponse.status !== 200) {
      throw new Error(`Expected 200 when clearing agentId, got ${clearResponse.status}`);
    }

    const clearedAgentId = extractId(clearResponse.body.agentId);
    
    if (clearedAgentId !== null && clearedAgentId !== undefined) {
      throw new Error(`Expected agentId to be cleared, got ${clearedAgentId}`);
    }

    console.log(`    Cleared agentId: ${clearedAgentId}`);
  });
  result6 ? passed++ : failed++;

  // Test 7: Update companyId (should remain same company)
  const result7 = await test('Update quotation companyId (same company)', async () => {
    // Get company
    const companyResponse = await makeRequest('GET', '/quotations/helpers/company', null, {
      Authorization: `Bearer ${authToken}`,
    });

    if (companyResponse.status !== 200) {
      throw new Error('Failed to get company for testing');
    }

    const companyId = companyResponse.body._id;
    const updateData = { companyId: companyId };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseCompanyId = extractId(response.body.companyId);
    
    if (responseCompanyId !== companyId) {
      throw new Error(`Expected companyId to be ${companyId}, got ${responseCompanyId}`);
    }

    console.log(`\n    Updated companyId: ${responseCompanyId}`);
  });
  result7 ? passed++ : failed++;

  // Test 8: Update summarize and verify total calculation
  const result8 = await test('Update summarize and calculate total', async () => {
    const updateData = { summarize: true };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    if (response.body.summarize !== true) {
      throw new Error('Expected summarize to be true');
    }

    const expectedTotal = response.body.items.reduce((sum, item) => sum + item.price, 0);
    if (response.body.total !== expectedTotal) {
      throw new Error(`Expected total to be ${expectedTotal}, got ${response.body.total}`);
    }

    console.log(`\n    Summarize: ${response.body.summarize}, Total: ${response.body.total}`);
  });
  result8 ? passed++ : failed++;

  // Test 9: Update status to sent (should trigger email)
  const result9 = await test('Update status to sent', async () => {
    const updateData = { status: 'sent' };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    if (response.body.status !== 'sent') {
      throw new Error(`Expected status to be "sent", got "${response.body.status}"`);
    }

    console.log(`\n    Status updated to: ${response.body.status}`);
    console.log(`    ${COLORS.yellow}Note: Email should have been sent to client${COLORS.reset}`);
  });
  result9 ? passed++ : failed++;

  // Test 10: Try to update non-draft quotation (should fail)
  const result10 = await test('Reject update of non-draft quotation', async () => {
    // Try to update the quotation that's now "sent"
    const updateData = { notes: 'This should fail' };
    const response = await updateQuotation(testQuotationId, updateData);

    if (response.status === 200) {
      throw new Error('Expected 400 error when updating non-draft quotation');
    }

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    console.log(`\n    Correctly rejected update with status: ${response.status}`);
  });
  result10 ? passed++ : failed++;

  // Test 11: Update with invalid clientId (should fail)
  const result11 = await test('Reject update with invalid clientId', async () => {
    // Create a new draft quotation for this test
    const shippingLines = await makeRequest('GET', '/quotations/helpers/shipping-lines', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const clients = await makeRequest('GET', '/quotations/helpers/clients', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const company = await makeRequest('GET', '/quotations/helpers/company', null, {
      Authorization: `Bearer ${authToken}`,
    });

    const createResponse = await makeRequest(
      'POST',
      '/quotations',
      {
        clientId: clients.body[0]._id,
        companyId: company.body._id,
        shippingLineId: shippingLines.body[0]._id,
        items: [{ type: 'cargo', description: 'Test', price: 100, transitType: 'air' }],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
      },
      {
        Authorization: `Bearer ${authToken}`,
      }
    );

    if (createResponse.status !== 201) {
      throw new Error('Failed to create test quotation');
    }

    const testId = createResponse.body.id;
    const updateData = { clientId: 'invalid-id-format' };
    const response = await updateQuotation(testId, updateData);

    if (response.status === 200) {
      throw new Error('Expected 400 error for invalid clientId');
    }

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    console.log(`\n    Correctly rejected invalid clientId with status: ${response.status}`);
  });
  result11 ? passed++ : failed++;

  // Test 12: Update with empty items array (should fail)
  const result12 = await test('Reject update with empty items array', async () => {
    const shippingLines = await makeRequest('GET', '/quotations/helpers/shipping-lines', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const clients = await makeRequest('GET', '/quotations/helpers/clients', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const company = await makeRequest('GET', '/quotations/helpers/company', null, {
      Authorization: `Bearer ${authToken}`,
    });

    const createResponse = await makeRequest(
      'POST',
      '/quotations',
      {
        clientId: clients.body[0]._id,
        companyId: company.body._id,
        shippingLineId: shippingLines.body[0]._id,
        items: [{ type: 'cargo', description: 'Test', price: 100, transitType: 'air' }],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
      },
      {
        Authorization: `Bearer ${authToken}`,
      }
    );

    if (createResponse.status !== 201) {
      throw new Error('Failed to create test quotation');
    }

    const testId = createResponse.body.id;
    const updateData = { items: [] };
    const response = await updateQuotation(testId, updateData);

    if (response.status === 200) {
      throw new Error('Expected 400 error for empty items array');
    }

    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    console.log(`\n    Correctly rejected empty items array with status: ${response.status}`);
  });
  result12 ? passed++ : failed++;

  // Test 13: Update non-existent quotation (should fail)
  const result13 = await test('Reject update of non-existent quotation', async () => {
    const fakeId = '507f1f77bcf86cd799439999';
    const updateData = { notes: 'This should fail' };
    const response = await updateQuotation(fakeId, updateData);

    if (response.status === 200) {
      throw new Error('Expected 404 error for non-existent quotation');
    }

    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    console.log(`\n    Correctly returned 404 for non-existent quotation`);
  });
  result13 ? passed++ : failed++;

  // Test 14: Update all fields together
  const result14 = await test('Update all fields together', async () => {
    // Create a fresh draft quotation for comprehensive test
    const shippingLines = await makeRequest('GET', '/quotations/helpers/shipping-lines', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const clients = await makeRequest('GET', '/quotations/helpers/clients', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const company = await makeRequest('GET', '/quotations/helpers/company', null, {
      Authorization: `Bearer ${authToken}`,
    });
    const agents = await makeRequest('GET', '/quotations/helpers/agents', null, {
      Authorization: `Bearer ${authToken}`,
    });

    const createResponse = await makeRequest(
      'POST',
      '/quotations',
      {
        clientId: clients.body[0]._id,
        companyId: company.body._id,
        shippingLineId: shippingLines.body[0]._id,
        items: [{ type: 'cargo', description: 'Initial item', price: 100, transitType: 'air' }],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'draft',
      },
      {
        Authorization: `Bearer ${authToken}`,
      }
    );

    if (createResponse.status !== 201) {
      throw new Error('Failed to create test quotation');
    }

    const testId = createResponse.body.id;
    const newValidUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const updateData = {
      clientId: clients.body.length > 1 ? clients.body[1]._id : clients.body[0]._id,
      shippingLineId: shippingLines.body.length > 1 ? shippingLines.body[1]._id : shippingLines.body[0]._id,
      agentId: agents.body.length > 0 ? agents.body[0]._id : null,
      items: [
        {
          type: 'cargo',
          description: 'Updated cargo item 1',
          price: 150,
          transitType: 'maritime',
        },
        {
          type: 'custom',
          description: 'Updated custom item',
          price: 75,
        },
      ],
      notes: 'Comprehensive update test notes',
      validUntil: newValidUntil,
      summarize: true,
    };

    const response = await updateQuotation(testId, updateData);

    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
    }

    const responseClientId = extractId(response.body.clientId);
    const responseShippingLineId = extractId(response.body.shippingLineId);
    const responseAgentId = extractId(response.body.agentId);
    
    // Verify all fields were updated
    if (responseClientId !== updateData.clientId) {
      throw new Error(`clientId not updated correctly, expected ${updateData.clientId}, got ${responseClientId}`);
    }
    if (responseShippingLineId !== updateData.shippingLineId) {
      throw new Error(`shippingLineId not updated correctly, expected ${updateData.shippingLineId}, got ${responseShippingLineId}`);
    }
    if (updateData.agentId && responseAgentId !== updateData.agentId) {
      throw new Error(`agentId not updated correctly, expected ${updateData.agentId}, got ${responseAgentId}`);
    }
    if (!updateData.agentId && responseAgentId !== null && responseAgentId !== undefined) {
      throw new Error(`agentId should be null/undefined, got ${responseAgentId}`);
    }
    if (response.body.items.length !== 2) {
      throw new Error(`items not updated correctly`);
    }
    if (response.body.notes !== updateData.notes) {
      throw new Error(`notes not updated correctly`);
    }
    if (new Date(response.body.validUntil).toISOString() !== new Date(newValidUntil).toISOString()) {
      throw new Error(`validUntil not updated correctly`);
    }
    if (response.body.summarize !== true) {
      throw new Error(`summarize not updated correctly`);
    }
    const expectedTotal = 150 + 75;
    if (response.body.total !== expectedTotal) {
      throw new Error(`total not calculated correctly, expected ${expectedTotal}, got ${response.body.total}`);
    }

    console.log(`\n    All fields updated successfully:`);
    console.log(`      - clientId: ${responseClientId}`);
    console.log(`      - shippingLineId: ${responseShippingLineId}`);
    console.log(`      - agentId: ${responseAgentId}`);
    console.log(`      - items: ${response.body.items.length} items`);
    console.log(`      - notes: "${response.body.notes}"`);
    console.log(`      - validUntil: ${response.body.validUntil}`);
    console.log(`      - summarize: ${response.body.summarize}`);
    console.log(`      - total: ${response.body.total}`);
  });
  result14 ? passed++ : failed++;

  // Summary
  console.log(`\n${COLORS.blue}=== Test Summary ===${COLORS.reset}`);
  console.log(`${COLORS.green}Passed: ${passed}${COLORS.reset}`);
  console.log(`${COLORS.red}Failed: ${failed}${COLORS.reset}`);
  console.log(`Total: ${passed + failed}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${COLORS.red}Fatal error:${COLORS.reset}`, error);
  process.exit(1);
});

