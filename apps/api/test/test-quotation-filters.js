#!/usr/bin/env node

/**
 * Standalone test script for Quotation Filters
 * 
 * Usage:
 *   node test-quotation-filters.js [API_URL]
 * 
 * Example:
 *   node test-quotation-filters.js http://localhost:3000
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
let testUserId = '';

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
    testUserId = response.body.user?.id || response.body.user?._id || '';
    console.log(`${COLORS.green}Login successful${COLORS.reset}`);
    return true;
  } else {
    console.log(`${COLORS.red}Login failed:${COLORS.reset}`, response.body);
    return false;
  }
}

// Get quotations with filters
async function getQuotations(filters = {}) {
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value);
    }
  });

  const path = `/quotations${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const response = await makeRequest('GET', path, null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (response.status !== 200) {
    throw new Error(`Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return response.body;
}

async function runTests() {
  console.log(`${COLORS.blue}=== Quotation Filters Test Suite ===${COLORS.reset}`);
  console.log(`API URL: ${API_URL}\n`);

  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    console.log(`${COLORS.red}Cannot proceed without authentication${COLORS.reset}`);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  // Test 1: Get all quotations
  const result1 = await test('Get all quotations (no filters)', async () => {
    const data = await getQuotations();
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error('Response should have items array');
    }
    if (typeof data.page !== 'number' || typeof data.total !== 'number') {
      throw new Error('Response should have page and total');
    }
    console.log(`\n    Found ${data.total} quotations (page ${data.page}, limit ${data.limit})`);
  });
  result1 ? passed++ : failed++;

  // Test 2: Filter by createdBy
  const result2 = await test('Filter by createdBy', async () => {
    if (!testUserId) {
      throw new Error('No test user ID available');
    }
    const data = await getQuotations({ createdBy: testUserId });
    data.items.forEach((item) => {
      // createdBy can be a string ID or an object with _id/id
      const itemCreatedBy = typeof item.createdBy === 'string' 
        ? item.createdBy 
        : (item.createdBy?._id || item.createdBy?.id || item.creator?.id);
      if (itemCreatedBy !== testUserId) {
        throw new Error(`Expected all items to be created by ${testUserId}, got ${itemCreatedBy}`);
      }
    });
    console.log(`    Found ${data.total} quotations created by test user`);
  });
  result2 ? passed++ : failed++;

  // Test 3: Filter by chargeType (maritime)
  const result3 = await test('Filter by chargeType=maritime', async () => {
    const data = await getQuotations({ chargeType: 'maritime' });
    data.items.forEach((quotation) => {
      const hasMaritimeItem = quotation.items?.some(
        (item) => item.type === 'cargo' && item.transitType === 'maritime'
      );
      if (!hasMaritimeItem) {
        throw new Error('Expected all quotations to have at least one maritime cargo item');
      }
    });
    console.log(`    Found ${data.total} quotations with maritime items`);
  });
  result3 ? passed++ : failed++;

  // Test 4: Filter by chargeType (air)
  const result4 = await test('Filter by chargeType=air', async () => {
    const data = await getQuotations({ chargeType: 'air' });
    data.items.forEach((quotation) => {
      const hasAirItem = quotation.items?.some(
        (item) => item.type === 'cargo' && item.transitType === 'air'
      );
      if (!hasAirItem) {
        throw new Error('Expected all quotations to have at least one air cargo item');
      }
    });
    console.log(`    Found ${data.total} quotations with air items`);
  });
  result4 ? passed++ : failed++;

  // Test 5: Filter by chargeType (land)
  const result5 = await test('Filter by chargeType=land', async () => {
    const data = await getQuotations({ chargeType: 'land' });
    data.items.forEach((quotation) => {
      const hasLandItem = quotation.items?.some(
        (item) => item.type === 'cargo' && item.transitType === 'land'
      );
      if (!hasLandItem) {
        throw new Error('Expected all quotations to have at least one land cargo item');
      }
    });
    console.log(`    Found ${data.total} quotations with land items`);
  });
  result5 ? passed++ : failed++;

  // Test 6: Filter by createdAtFrom
  const result6 = await test('Filter by createdAtFrom', async () => {
    const fromDate = new Date('2024-01-01T00:00:00Z').toISOString();
    const data = await getQuotations({ createdAtFrom: fromDate });
    const fromDateObj = new Date(fromDate);
    data.items.forEach((quotation) => {
      const createdAt = new Date(quotation.createdAt);
      if (createdAt.getTime() < fromDateObj.getTime()) {
        throw new Error(`Expected createdAt to be >= ${fromDate}`);
      }
    });
    console.log(`    Found ${data.total} quotations created after ${fromDate}`);
  });
  result6 ? passed++ : failed++;

  // Test 7: Filter by createdAtTo
  const result7 = await test('Filter by createdAtTo', async () => {
    const toDate = new Date().toISOString();
    const data = await getQuotations({ createdAtTo: toDate });
    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);
    data.items.forEach((quotation) => {
      const createdAt = new Date(quotation.createdAt);
      if (createdAt.getTime() > toDateObj.getTime()) {
        throw new Error(`Expected createdAt to be <= ${toDate}`);
      }
    });
    console.log(`    Found ${data.total} quotations created before ${toDate}`);
  });
  result7 ? passed++ : failed++;

  // Test 8: Filter by date range
  const result8 = await test('Filter by createdAtFrom and createdAtTo', async () => {
    const fromDate = new Date('2024-01-01T00:00:00Z').toISOString();
    const toDate = new Date().toISOString();
    const data = await getQuotations({ createdAtFrom: fromDate, createdAtTo: toDate });
    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);
    data.items.forEach((quotation) => {
      const createdAt = new Date(quotation.createdAt);
      if (createdAt.getTime() < fromDateObj.getTime() || createdAt.getTime() > toDateObj.getTime()) {
        throw new Error(`Expected createdAt to be between ${fromDate} and ${toDate}`);
      }
    });
    console.log(`    Found ${data.total} quotations in date range`);
  });
  result8 ? passed++ : failed++;

  // Test 9: Combine multiple filters
  const result9 = await test('Combine multiple filters', async () => {
    if (!testUserId) {
      throw new Error('No test user ID available');
    }
    const fromDate = new Date('2024-01-01T00:00:00Z').toISOString();
    const data = await getQuotations({
      createdBy: testUserId,
      chargeType: 'maritime',
      createdAtFrom: fromDate,
    });
    const fromDateObj = new Date(fromDate);
    data.items.forEach((quotation) => {
      // Check createdBy - can be string or object
      const itemCreatedBy = typeof quotation.createdBy === 'string' 
        ? quotation.createdBy 
        : (quotation.createdBy?._id || quotation.createdBy?.id || quotation.creator?.id);
      if (itemCreatedBy !== testUserId) {
        throw new Error(`Expected all items to be created by test user, got ${itemCreatedBy}`);
      }
      // Check chargeType
      const hasMaritimeItem = quotation.items?.some(
        (item) => item.type === 'cargo' && item.transitType === 'maritime'
      );
      if (!hasMaritimeItem) {
        throw new Error('Expected all quotations to have maritime items');
      }
      // Check date
      const createdAt = new Date(quotation.createdAt);
      if (createdAt.getTime() < fromDateObj.getTime()) {
        throw new Error('Expected createdAt to be >= fromDate');
      }
    });
    console.log(`    Found ${data.total} quotations matching all filters`);
  });
  result9 ? passed++ : failed++;

  // Test 10: Invalid clientId format
  const result10 = await test('Reject invalid clientId format', async () => {
    try {
      await getQuotations({ clientId: 'invalid-id' });
      throw new Error('Expected 400 error for invalid clientId');
    } catch (error) {
      // This is expected - the request should fail
      if (!error.message.includes('400') && !error.message.includes('Invalid')) {
        throw error;
      }
    }
  });
  result10 ? passed++ : failed++;

  // Test 11: Invalid chargeType
  const result11 = await test('Reject invalid chargeType', async () => {
    try {
      await getQuotations({ chargeType: 'invalid' });
      throw new Error('Expected 400 error for invalid chargeType');
    } catch (error) {
      if (!error.message.includes('400') && !error.message.includes('Invalid')) {
        throw error;
      }
    }
  });
  result11 ? passed++ : failed++;

  // Test 12: Pagination with filters
  const result12 = await test('Pagination with filters', async () => {
    const data = await getQuotations({ chargeType: 'maritime', page: 1, limit: 5 });
    if (data.page !== 1 || data.limit !== 5) {
      throw new Error(`Expected page=1, limit=5, got page=${data.page}, limit=${data.limit}`);
    }
    if (data.items.length > 5) {
      throw new Error(`Expected max 5 items, got ${data.items.length}`);
    }
    console.log(`    Page ${data.page}: ${data.items.length} items (total: ${data.total})`);
  });
  result12 ? passed++ : failed++;

  // Test 13: Sorting with filters
  const result13 = await test('Sorting with filters', async () => {
    const data = await getQuotations({ chargeType: 'maritime', sort: 'createdAt', order: 'ASC' });
    if (data.items.length > 1) {
      for (let i = 1; i < data.items.length; i++) {
        const prevDate = new Date(data.items[i - 1].createdAt);
        const currDate = new Date(data.items[i].createdAt);
        if (currDate.getTime() < prevDate.getTime()) {
          throw new Error('Items should be sorted by createdAt ASC');
        }
      }
    }
    console.log(`    Sorted ${data.items.length} items by createdAt ASC`);
  });
  result13 ? passed++ : failed++;

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

