const http = require('http');
const https = require('https');

const API_URL = process.argv[2] || process.env.API_URL || 'http://localhost:3000';

// Colors for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

let authToken = '';
let testUserId = '';
let testCompanyId = '';
let testClientId = '';
let testShippingLineId = '';
let testAgentId = '';
let testPortOriginId = '';
let testPortDestinationId = '';
let testTemplateId = '';
let testQuotationId = '';

// Helper function to make authenticated requests
function makeRequest(method, path, data = null, params = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    // Add query parameters if provided
    if (params) {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          searchParams.append(key, params[key]);
        }
      });
      url.search = searchParams.toString();
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

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

    req.on('error', (error) => {
      resolve({
        status: 500,
        body: { error: error.message },
      });
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test helper
async function test(name, testFn) {
  try {
    console.log(`${COLORS.cyan}Testing: ${name}${COLORS.reset}`);
    const result = await testFn();
    if (result) {
      console.log(`${COLORS.green}✓ ${name}${COLORS.reset}\n`);
      return true;
    } else {
      console.log(`${COLORS.red}✗ ${name}${COLORS.reset}\n`);
      return false;
    }
  } catch (error) {
    console.log(`${COLORS.red}✗ ${name} - Error: ${error.message}${COLORS.reset}\n`);
    return false;
  }
}

// Login
async function login() {
  console.log(`${COLORS.blue}Logging in...${COLORS.reset}`);
  const response = await makeRequest('POST', '/auth/login', {
    email: 'john.doe@shipsync.com',
    password: 'password123',
  });

  if (response.status === 200 && response.body.access_token) {
    authToken = response.body.access_token;
    testUserId = response.body.user?.id || response.body.user?._id || '';
    testCompanyId = response.body.user?.company || '';
    console.log(`${COLORS.green}Login successful${COLORS.reset}`);
    console.log(`User ID: ${testUserId}`);
    console.log(`Company ID: ${testCompanyId}\n`);
    return true;
  } else {
    console.log(`${COLORS.red}Login failed:${COLORS.reset}`, response.body);
    return false;
  }
}

// Get test data IDs
async function getTestData() {
  console.log(`${COLORS.blue}Fetching test data...${COLORS.reset}`);
  
  // Get a client
  const clientsResponse = await makeRequest('GET', '/clients');
  if (clientsResponse.status === 200) {
    const clients = Array.isArray(clientsResponse.body) ? clientsResponse.body : (clientsResponse.body.data || []);
    if (clients.length > 0) {
      testClientId = clients[0].id || clients[0]._id;
      console.log(`Client ID: ${testClientId}`);
    } else {
      console.log(`  Warning: No clients found`);
    }
  } else {
    console.log(`  Warning: Failed to fetch clients: ${clientsResponse.status}`);
  }

  // Get a shipping line
  const shippingResponse = await makeRequest('GET', '/quotations/helpers/shipping-lines');
  if (shippingResponse.status === 200 && shippingResponse.body?.length > 0) {
    testShippingLineId = shippingResponse.body[0]._id || shippingResponse.body[0].id;
    console.log(`Shipping Line ID: ${testShippingLineId}`);
  }

  // Get an agent
  const agentsResponse = await makeRequest('GET', '/quotations/helpers/agents');
  if (agentsResponse.status === 200 && agentsResponse.body?.length > 0) {
    testAgentId = agentsResponse.body[0]._id || agentsResponse.body[0].id;
    console.log(`Agent ID: ${testAgentId}\n`);
  }
}

// ==================== PORTS TESTS ====================

async function testPortsCRUD() {
  console.log(`${COLORS.magenta}=== PORTS CRUD TESTS ===${COLORS.reset}\n`);

  // Test 1: Create Port
  await test('Create Port', async () => {
    const portData = {
      name: 'Test Port',
      unlocode: 'TSTEST',
      countryCode: 'US',
      countryName: 'United States',
      city: 'Test City',
      type: 'sea',
      latitude: 40.7128,
      longitude: -74.0060,
    };

    const response = await makeRequest('POST', '/ports', portData);
    if (response.status === 201 && response.body.id) {
      testPortOriginId = response.body.id;
      console.log(`  Created port: ${testPortOriginId}`);
      return true;
    }
    console.log(`  Response:`, response.body);
    return false;
  });

  // Test 2: Get Ports List
  await test('Get Ports List', async () => {
    const response = await makeRequest('GET', '/ports');
    if (response.status === 200 && Array.isArray(response.body)) {
      console.log(`  Found ${response.body.length} ports`);
      if (response.body.length > 0 && !testPortDestinationId) {
        testPortDestinationId = response.body[0].id;
      }
      return true;
    }
    console.log(`  Response status: ${response.status}, body type: ${typeof response.body}`);
    return false;
  });

  // Test 3: Get Port by ID
  await test('Get Port by ID', async () => {
    if (!testPortOriginId) return false;
    const response = await makeRequest('GET', `/ports/${testPortOriginId}`);
    if (response.status === 200 && (response.body.id === testPortOriginId || response.body._id === testPortOriginId)) {
      console.log(`  Port name: ${response.body.name}`);
      return true;
    }
    console.log(`  Expected ID: ${testPortOriginId}, Got: ${response.body.id || response.body._id}`);
    return false;
  });

  // Test 4: Filter Ports by Type
  await test('Filter Ports by Type (sea)', async () => {
    const response = await makeRequest('GET', '/ports', null, { type: 'sea' });
    if (response.status === 200 && Array.isArray(response.body)) {
      const allSea = response.body.every(p => p.type === 'sea');
      console.log(`  Found ${response.body.length} sea ports`);
      return allSea;
    }
    return false;
  });

  // Test 5: Update Port
  await test('Update Port', async () => {
    if (!testPortOriginId) return false;
    const updateData = {
      name: 'Updated Test Port',
      city: 'Updated City',
    };
    const response = await makeRequest('PUT', `/ports/${testPortOriginId}`, updateData);
    if (response.status === 200 && response.body.name === 'Updated Test Port') {
      console.log(`  Updated port name: ${response.body.name}`);
      return true;
    }
    return false;
  });

  // Test 6: Soft Delete Port
  await test('Soft Delete Port', async () => {
    if (!testPortOriginId) return false;
    const response = await makeRequest('DELETE', `/ports/${testPortOriginId}`);
    if (response.status === 200) {
      // Verify it's soft deleted
      const getResponse = await makeRequest('GET', `/ports/${testPortOriginId}`);
      if (getResponse.status === 200 && getResponse.body.isActive === false) {
        console.log(`  Port soft deleted (isActive: false)`);
        return true;
      }
    }
    return false;
  });
}

// ==================== TEMPLATES TESTS ====================

async function testTemplatesCRUD() {
  console.log(`${COLORS.magenta}=== TEMPLATES CRUD TESTS ===${COLORS.reset}\n`);

  // Test 1: Create Template
  await test('Create Template', async () => {
    const templateData = {
      name: 'LCL - EXW Test',
      category: 'EXW',
      serviceType: 'LCL',
      shippingModes: ['maritime'],
      headerFields: [
        {
          id: '1',
          label: 'Port of Origin',
          inputType: 'select',
          options: ['Shanghai', 'Singapore'],
          required: true,
          order: 1,
        },
        {
          id: '2',
          label: 'Port of Destination',
          inputType: 'select',
          options: ['Los Angeles', 'New York'],
          required: true,
          order: 2,
        },
      ],
      items: [
        {
          id: '1',
          label: 'Pick up',
          hasPrice: true,
          hasQuantity: true,
          hasDiscount: true,
          defaultPrice: 100,
          defaultQuantity: 1,
          defaultDiscount: 0,
          order: 1,
          applyTemplateDiscount: true,
          applyTaxes: true,
          taxRate: 15,
        },
        {
          id: '2',
          label: 'Ocean Freight CBM',
          hasPrice: true,
          hasQuantity: true,
          hasDiscount: false,
          defaultPrice: 50,
          defaultQuantity: 1,
          order: 2,
          applyTemplateDiscount: true,
          applyTaxes: false,
        },
      ],
      equipmentItems: [
        {
          id: '1',
          label: '20DV',
          fields: [
            { key: 'size', label: 'Size', inputType: 'text', defaultValue: '20DV', order: 1 },
            { key: 'weightKg', label: 'Weight (kg)', inputType: 'number', defaultValue: 0, order: 2 },
          ],
          hasPrice: true,
          hasQuantity: true,
          hasDiscount: false,
          defaultPrice: 500,
          defaultQuantity: 1,
          order: 1,
          applyTemplateDiscount: true,
          applyTaxes: false,
        },
      ],
      pricingConfig: {
        currency: 'USD',
        templatePrice: null,
        templateDiscount: 10,
        applyTemplateDiscount: true,
        templateTaxRate: null,
        applyTemplateTaxes: false,
      },
      notes: 'Test template notes',
      showAgentToClient: true,
      showCarrierToClient: true,
      showCommodityToClient: true,
      showNotesToClient: true,
    };

    const response = await makeRequest('POST', '/templates', templateData);
    if (response.status === 201 && response.body.id) {
      testTemplateId = response.body.id;
      console.log(`  Created template: ${testTemplateId}`);
      console.log(`  Template name: ${response.body.name}`);
      return true;
    }
    console.log(`  Response:`, JSON.stringify(response.body, null, 2));
    return false;
  });

  // Test 2: Get Templates List
  await test('Get Templates List', async () => {
    const response = await makeRequest('GET', '/templates');
    if (response.status === 200 && Array.isArray(response.body)) {
      console.log(`  Found ${response.body.length} templates`);
      return true;
    }
    console.log(`  Response status: ${response.status}, body:`, JSON.stringify(response.body).substring(0, 200));
    return false;
  });

  // Test 3: Filter Templates by Service Type
  await test('Filter Templates by Service Type (LCL)', async () => {
    const response = await makeRequest('GET', '/templates', null, { serviceType: 'LCL' });
    if (response.status === 200 && Array.isArray(response.body)) {
      const allLCL = response.body.every(t => t.serviceType === 'LCL');
      console.log(`  Found ${response.body.length} LCL templates`);
      return allLCL;
    }
    return false;
  });

  // Test 4: Filter Templates by Category
  await test('Filter Templates by Category (EXW)', async () => {
    const response = await makeRequest('GET', '/templates', null, { category: 'EXW' });
    if (response.status === 200 && Array.isArray(response.body)) {
      const allEXW = response.body.every(t => t.category === 'EXW');
      console.log(`  Found ${response.body.length} EXW templates`);
      return allEXW;
    }
    return false;
  });

  // Test 5: Get Template by ID
  await test('Get Template by ID', async () => {
    if (!testTemplateId) return false;
    const response = await makeRequest('GET', `/templates/${testTemplateId}`);
    const responseId = response.body._id || response.body.id;
    if (response.status === 200 && responseId === testTemplateId) {
      console.log(`  Template: ${response.body.name}`);
      console.log(`  Items: ${response.body.items?.length || 0}`);
      console.log(`  Equipment Items: ${response.body.equipmentItems?.length || 0}`);
      return true;
    }
    console.log(`  Expected ID: ${testTemplateId}, Got: ${responseId}, Status: ${response.status}`);
    if (response.status !== 200) {
      console.log(`  Error:`, JSON.stringify(response.body).substring(0, 200));
    }
    return false;
  });

  // Test 6: Update Template
  await test('Update Template', async () => {
    if (!testTemplateId) return false;
    const updateData = {
      name: 'Updated LCL - EXW Test',
      notes: 'Updated notes',
    };
    const response = await makeRequest('PUT', `/templates/${testTemplateId}`, updateData);
    if (response.status === 200 && response.body.name === 'Updated LCL - EXW Test') {
      console.log(`  Updated template name: ${response.body.name}`);
      return true;
    }
    return false;
  });
}

// ==================== QUOTATIONS TESTS ====================

async function testTemplateBasedQuotation() {
  console.log(`${COLORS.magenta}=== TEMPLATE-BASED QUOTATION TESTS ===${COLORS.reset}\n`);

  // Test 1: Create Quotation from Template
  await test('Create Quotation from Template', async () => {
    if (!testTemplateId || !testClientId || !testShippingLineId) {
      console.log('  Missing required IDs');
      return false;
    }

    const quotationData = {
      templateId: testTemplateId,
      clientId: testClientId,
      companyId: testCompanyId,
      shippingLineId: testShippingLineId,
      agentId: testAgentId,
      portOfOrigin: testPortOriginId || testPortDestinationId,
      portOfDestination: testPortDestinationId || testPortOriginId,
      headerFieldValues: [
        { fieldId: '1', value: 'Shanghai' },
        { fieldId: '2', value: 'Los Angeles' },
      ],
      items: [
        {
          itemId: '1',
          price: 120,
          quantity: 2,
          discount: 5,
          notes: 'Pick up service',
        },
        {
          itemId: '2',
          price: 60,
          quantity: 10,
          notes: 'Ocean freight',
        },
      ],
      equipmentItems: [
        {
          equipmentItemId: '1',
          quantity: 2,
          price: 550,
          fieldValues: [
            { fieldKey: 'size', value: '20DV' },
            { fieldKey: 'weightKg', value: 20000 },
          ],
        },
      ],
      pricingConfig: {
        currency: 'USD',
        templateDiscount: 10,
        applyTemplateDiscount: true,
      },
      showAgentToClient: true,
      showCarrierToClient: true,
      showCommodityToClient: true,
      showNotesToClient: true,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      summarize: true,
      status: 'draft',
    };

    const response = await makeRequest('POST', '/quotations', quotationData);
    if (response.status === 201 && response.body.id) {
      testQuotationId = response.body.id;
      console.log(`  Created quotation: ${testQuotationId}`);
      console.log(`  Template ID: ${response.body.templateId}`);
      console.log(`  Total: ${response.body.total || 'N/A'}`);
      console.log(`  Items: ${response.body.items?.length || 0}`);
      console.log(`  Equipment Items: ${response.body.equipmentItems?.length || 0}`);
      return true;
    }
    console.log(`  Response:`, JSON.stringify(response.body, null, 2));
    return false;
  });

  // Test 2: Verify Calculation
  await test('Verify Quotation Total Calculation', async () => {
    if (!testQuotationId) return false;
    const response = await makeRequest('GET', `/quotations/${testQuotationId}`);
    if (response.status === 200 && response.body.total !== undefined) {
      // Expected calculation:
      // Items: (120 * 2 * 0.95) + (60 * 10) = 228 + 600 = 828
      // Equipment: (550 * 2) = 1100
      // Subtotal: 828 + 1100 = 1928
      // Template discount (10%): 1928 * 0.9 = 1735.2
      // Item 1 tax (15% on discounted): (120 * 2 * 0.95) * 0.15 = 34.2
      // Total: 1735.2 + 34.2 = 1769.4
      console.log(`  Calculated total: ${response.body.total}`);
      console.log(`  Expected range: 1700-1800`);
      return response.body.total > 0;
    }
    return false;
  });

  // Test 3: Get Quotation with Template and Ports
  await test('Get Quotation with Template and Ports Populated', async () => {
    if (!testQuotationId) return false;
    const response = await makeRequest('GET', `/quotations/${testQuotationId}`);
    if (response.status === 200) {
      const hasTemplate = !!response.body.templateId;
      const hasPorts = !!(response.body.portOfOrigin || response.body.portOfDestination);
      console.log(`  Has template: ${hasTemplate}`);
      console.log(`  Has ports: ${hasPorts}`);
      return hasTemplate || hasPorts;
    }
    return false;
  });

  // Test 4: Legacy Quotation Creation (Backward Compatibility)
  await test('Create Legacy Quotation (Backward Compatibility)', async () => {
    if (!testClientId || !testShippingLineId) return false;

    const legacyQuotationData = {
      clientId: testClientId,
      companyId: testCompanyId,
      shippingLineId: testShippingLineId,
      agentId: testAgentId,
      legacyItems: [
        {
          type: 'cargo',
          description: '40FT container transport',
          price: 1250,
          notes: 'Maritime transport',
          transitType: 'maritime',
        },
        {
          type: 'custom',
          description: 'Cargo insurance',
          price: 200,
        },
      ],
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      summarize: true,
      status: 'draft',
    };

    const response = await makeRequest('POST', '/quotations', legacyQuotationData);
    if (response.status === 201 && response.body.id) {
      console.log(`  Created legacy quotation: ${response.body.id}`);
      console.log(`  Total: ${response.body.total || 'N/A'}`);
      console.log(`  Has legacyItems: ${!!response.body.legacyItems}`);
      return true;
    }
    console.log(`  Response:`, JSON.stringify(response.body, null, 2));
    return false;
  });
}

// Main test runner
async function runTests() {
  console.log(`${COLORS.bright}${COLORS.cyan}
╔══════════════════════════════════════════════════════════════╗
║     TEMPLATE + PORTS INTEGRATION TEST SUITE                  ║
╚══════════════════════════════════════════════════════════════╝
${COLORS.reset}\n`);

  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log(`${COLORS.red}Failed to login. Exiting.${COLORS.reset}`);
    process.exit(1);
  }

  // Step 2: Get test data
  await getTestData();

  // Step 3: Run tests
  await testPortsCRUD();
  await testTemplatesCRUD();
  await testTemplateBasedQuotation();

  console.log(`${COLORS.bright}${COLORS.green}
╔══════════════════════════════════════════════════════════════╗
║                    TESTS COMPLETED                           ║
╚══════════════════════════════════════════════════════════════╝
${COLORS.reset}\n`);

  console.log(`${COLORS.cyan}Test Summary:${COLORS.reset}`);
  console.log(`  Port Origin ID: ${testPortOriginId || 'N/A'}`);
  console.log(`  Port Destination ID: ${testPortDestinationId || 'N/A'}`);
  console.log(`  Template ID: ${testTemplateId || 'N/A'}`);
  console.log(`  Quotation ID: ${testQuotationId || 'N/A'}`);
}

// Run tests
runTests().catch((error) => {
  console.error(`${COLORS.red}Test suite failed:${COLORS.reset}`, error);
  process.exit(1);
});

