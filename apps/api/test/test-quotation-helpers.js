#!/usr/bin/env node

/**
 * Test script for Quotation Helper Endpoints
 * 
 * Verifies that helper endpoints return the correct fields:
 * - /quotations/helpers/shipping-lines -> _id, name
 * - /quotations/helpers/agents -> _id, name
 * - /quotations/helpers/company -> All profile information
 * - /quotations/helpers/clients -> _id, clientName
 * 
 * Usage:
 *   node test-quotation-helpers.js [API_URL]
 * 
 * Example:
 *   node test-quotation-helpers.js http://localhost:3000
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

// Get helper endpoint
async function getHelper(endpoint) {
  const response = await makeRequest('GET', endpoint, null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

async function runTests() {
  console.log(`${COLORS.blue}=== Quotation Helper Endpoints Test Suite ===${COLORS.reset}`);
  console.log(`API URL: ${API_URL}\n`);

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.log(`${COLORS.red}Cannot proceed without authentication${COLORS.reset}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Shipping Lines Helper
  const result1 = await test('/quotations/helpers/shipping-lines - Returns _id and name', async () => {
    const data = await getHelper('/quotations/helpers/shipping-lines');
    
    if (!Array.isArray(data)) {
      throw new Error('Response should be an array');
    }

    if (data.length > 0) {
      data.forEach((item, index) => {
        if (!item._id) {
          throw new Error(`Item at index ${index} missing _id field`);
        }
        if (typeof item._id !== 'string') {
          throw new Error(`Item at index ${index} _id should be a string, got ${typeof item._id}`);
        }
        if (!item.name) {
          throw new Error(`Item at index ${index} missing name field`);
        }
        if (typeof item.name !== 'string') {
          throw new Error(`Item at index ${index} name should be a string, got ${typeof item.name}`);
        }
        
        // Check for unexpected fields
        const expectedFields = ['_id', 'name'];
        const actualFields = Object.keys(item);
        const unexpectedFields = actualFields.filter(f => !expectedFields.includes(f));
        if (unexpectedFields.length > 0) {
          console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} Item at index ${index} has unexpected fields: ${unexpectedFields.join(', ')}`);
        }
      });
      console.log(`\n    Found ${data.length} shipping lines`);
      console.log(`    Sample: ${JSON.stringify(data[0], null, 2)}`);
    } else {
      console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} No shipping lines found`);
    }
  });
  result1 ? passed++ : failed++;

  // Test 2: Agents Helper
  const result2 = await test('/quotations/helpers/agents - Returns _id and name', async () => {
    const data = await getHelper('/quotations/helpers/agents');
    
    if (!Array.isArray(data)) {
      throw new Error('Response should be an array');
    }

    if (data.length > 0) {
      data.forEach((item, index) => {
        if (!item._id) {
          throw new Error(`Item at index ${index} missing _id field`);
        }
        if (typeof item._id !== 'string') {
          throw new Error(`Item at index ${index} _id should be a string, got ${typeof item._id}`);
        }
        if (!item.name) {
          throw new Error(`Item at index ${index} missing name field`);
        }
        if (typeof item.name !== 'string') {
          throw new Error(`Item at index ${index} name should be a string, got ${typeof item.name}`);
        }
        
        // Check for unexpected fields
        const expectedFields = ['_id', 'name'];
        const actualFields = Object.keys(item);
        const unexpectedFields = actualFields.filter(f => !expectedFields.includes(f));
        if (unexpectedFields.length > 0) {
          console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} Item at index ${index} has unexpected fields: ${unexpectedFields.join(', ')}`);
        }
      });
      console.log(`\n    Found ${data.length} agents`);
      console.log(`    Sample: ${JSON.stringify(data[0], null, 2)}`);
    } else {
      console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} No agents found`);
    }
  });
  result2 ? passed++ : failed++;

  // Test 3: Company Helper
  const result3 = await test('/quotations/helpers/company - Returns all profile information', async () => {
    const data = await getHelper('/quotations/helpers/company');
    
    if (!data || typeof data !== 'object') {
      throw new Error('Response should be an object');
    }

    // Required fields
    const requiredFields = ['_id', 'name', 'isActive', 'createdAt'];
    requiredFields.forEach(field => {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    });

    // Check _id is string
    if (typeof data._id !== 'string') {
      throw new Error(`_id should be a string, got ${typeof data._id}`);
    }

    // Check name is string
    if (typeof data.name !== 'string') {
      throw new Error(`name should be a string, got ${typeof data.name}`);
    }

    // Check isActive is boolean
    if (typeof data.isActive !== 'boolean') {
      throw new Error(`isActive should be a boolean, got ${typeof data.isActive}`);
    }

    // Optional fields that should be present if they exist
    const optionalFields = ['description', 'taxId', 'email', 'phone', 'address', 'updatedAt'];
    const presentFields = Object.keys(data);
    const expectedAllFields = [...requiredFields, ...optionalFields];
    
    console.log(`\n    Company profile fields: ${presentFields.join(', ')}`);
    console.log(`    Sample: ${JSON.stringify(data, null, 2)}`);
    
    // Check if address is an object if present
    if (data.address && typeof data.address !== 'object') {
      throw new Error('address should be an object if present');
    }
  });
  result3 ? passed++ : failed++;

  // Test 4: Clients Helper
  const result4 = await test('/quotations/helpers/clients - Returns _id and clientName', async () => {
    const data = await getHelper('/quotations/helpers/clients');
    
    if (!Array.isArray(data)) {
      throw new Error('Response should be an array');
    }

    if (data.length > 0) {
      data.forEach((item, index) => {
        if (!item._id) {
          throw new Error(`Item at index ${index} missing _id field`);
        }
        if (typeof item._id !== 'string') {
          throw new Error(`Item at index ${index} _id should be a string, got ${typeof item._id}`);
        }
        if (!item.clientName) {
          throw new Error(`Item at index ${index} missing clientName field`);
        }
        if (typeof item.clientName !== 'string') {
          throw new Error(`Item at index ${index} clientName should be a string, got ${typeof item.clientName}`);
        }
        
        // Check for unexpected fields
        const expectedFields = ['_id', 'clientName'];
        const actualFields = Object.keys(item);
        const unexpectedFields = actualFields.filter(f => !expectedFields.includes(f));
        if (unexpectedFields.length > 0) {
          console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} Item at index ${index} has unexpected fields: ${unexpectedFields.join(', ')}`);
        }
      });
      console.log(`\n    Found ${data.length} clients`);
      console.log(`    Sample: ${JSON.stringify(data[0], null, 2)}`);
    } else {
      console.log(`\n    ${COLORS.yellow}Warning:${COLORS.reset} No clients found`);
    }
  });
  result4 ? passed++ : failed++;

  // Test 5: Verify endpoints require authentication
  const result5 = await test('Endpoints require authentication', async () => {
    try {
      await makeRequest('GET', '/quotations/helpers/shipping-lines');
      throw new Error('Expected 401 Unauthorized when not authenticated');
    } catch (error) {
      // This might not work as expected, let's try a different approach
      const response = await makeRequest('GET', '/quotations/helpers/shipping-lines');
      if (response.status !== 401 && response.status !== 403) {
        throw new Error(`Expected 401/403, got ${response.status}`);
      }
    }
  });
  result5 ? passed++ : failed++;

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

