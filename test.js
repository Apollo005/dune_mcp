/**
 * Quick test script to verify the MCP API functionality
 * Run: node test.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function runTests() {
  console.log(' Testing MCP Dune Solana API\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/api/health`);
    console.log(' Health check passed:', healthResponse.data.data.status);

    // Test 2: API info
    console.log('\n2. Testing API info...');
    const infoResponse = await axios.get(`${API_BASE}/api/info`);
    console.log(' API info retrieved:', infoResponse.data.data.name);
    console.log('   Pricing:', infoResponse.data.data.pricing.query_execution);

    // Test 3: Examples
    console.log('\n3. Testing examples endpoint...');
    const examplesResponse = await axios.get(`${API_BASE}/api/examples`);
    console.log(' Examples retrieved:', examplesResponse.data.data.length, 'examples');

    // Test 4: Query validation
    console.log('\n4. Testing query validation...');
    const validQuery = "SELECT * FROM solana.transactions LIMIT 5";
    const validationResponse = await axios.post(`${API_BASE}/api/validate`, {
      sql: validQuery
    });
    console.log(' Valid Solana query accepted:', validationResponse.data.data.valid);

    // Test 5: Invalid query validation
    console.log('\n5. Testing invalid query validation...');
    const invalidQuery = "SELECT * FROM ethereum.transactions LIMIT 5";
    const invalidValidationResponse = await axios.post(`${API_BASE}/api/validate`, {
      sql: invalidQuery
    });
    console.log(' Invalid query rejected:', !invalidValidationResponse.data.data.valid);

    // Test 6: x402 payment flow
    console.log('\n6. Testing x402 payment flow...');
    try {
      await axios.post(`${API_BASE}/api/query`, {
        sql: validQuery
      });
      console.log(' Expected 402 payment required response');
    } catch (error) {
      if (error.response?.status === 402) {
        console.log(' 402 Payment Required response received');
        console.log('   Payment details:', {
          amount: error.response.data.payment.amount,
          currency: error.response.data.payment.currency,
          chain: error.response.data.payment.chain
        });
      } else {
        console.log(' Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    console.log('\n All tests passed!');
    console.log('\nAPI is ready to use. Check README.md for usage examples.');

  } catch (error) {
    console.error(' Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/api/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const isRunning = await checkServer();
  
  if (!isRunning) {
    console.log(' Server is not running on http://localhost:3000');
    console.log('Start the server with: npm start or npm run dev');
    process.exit(1);
  }

  await runTests();
}

main().catch(console.error);
