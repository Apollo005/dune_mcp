#!/usr/bin/env node

const axios = require('axios');

const MCP_SERVER = 'http://localhost:3333';
const TEST_SIGNATURE = '3PY8iGUFmgZ7daPTaoGqny2fef83eiPT7dfcpkNCfTiorCJ5nJJZ7RRDnfHmJLiG4YtWs8PG45pt4q9vhQLZWLKX';

console.log('  Testing Replay Attack Protection');
console.log('===================================');
console.log();

async function testReplayProtection() {
  try {
    console.log(' Testing with signature:', TEST_SIGNATURE.substring(0, 20) + '...');
    console.log();

    // Test 1: First use (should work in dev mode, but tracked in production)
    console.log('1 First API call (should succeed):');
    try {
      const response1 = await axios.post(`${MCP_SERVER}/api/catalog/recent_addresses/execute/sol`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Signature': TEST_SIGNATURE,
          'X-Payment-Network': 'solana',
          'X-Payment-Amount': '100000'
        }
      });
      
      console.log('    Status:', response1.status);
      console.log('    Payment verified:', response1.data.data?.payment_verified);
      console.log('    Payment type:', response1.data.data?.payment_type);
      console.log('    Data rows:', response1.data.data?.result?.rows?.length || 0);
    } catch (error) {
      console.log('    Error:', error.response?.status, error.response?.data?.error || error.message);
    }

    console.log();

    // Test 2: Second use (should fail if database is connected)
    console.log('2 Second API call with SAME signature (should fail if DB connected):');
    try {
      const response2 = await axios.post(`${MCP_SERVER}/api/catalog/recent_addresses/execute/sol`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Signature': TEST_SIGNATURE,
          'X-Payment-Network': 'solana',
          'X-Payment-Amount': '100000'
        }
      });
      
      console.log('     Status:', response2.status, '(This suggests DB is not connected)');
      console.log('    Payment verified:', response2.data.data?.payment_verified);
      console.log('    Note: Without database, replay protection is disabled');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('    Status: 409 - Replay attack prevented!');
        console.log('     Error:', error.response.data.error);
        console.log('    Is replay attack:', error.response.data.is_replay_attack);
        console.log('    First used:', error.response.data.payment_details?.first_used_at);
        console.log('    Usage count:', error.response.data.payment_details?.usage_count);
      } else {
        console.log('    Unexpected error:', error.response?.status, error.response?.data?.error || error.message);
      }
    }

    console.log();

    // Test 3: Third use (should also fail)
    console.log('3 Third API call with SAME signature (should also fail):');
    try {
      const response3 = await axios.post(`${MCP_SERVER}/api/catalog/recent_addresses/execute/sol`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-Payment-Signature': TEST_SIGNATURE,
          'X-Payment-Network': 'solana',
          'X-Payment-Amount': '100000'
        }
      });
      
      console.log('     Status:', response3.status, '(Database protection disabled)');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('    Status: 409 - Replay attack prevented again!');
        console.log('     Error:', error.response.data.error);
        console.log('    Usage count should be higher:', error.response.data.payment_details?.usage_count);
      } else {
        console.log('    Error:', error.response?.status, error.response?.data?.error || error.message);
      }
    }

    console.log();
    console.log(' Test Results:');
    console.log('================');
    console.log(' If you see 409 errors: Replay protection is WORKING');
    console.log('  If all calls succeed: Database is not connected (dev mode)');
    console.log(' In production with database: First call succeeds, others fail with 409');
    console.log();
    console.log(' To enable full protection:');
    console.log('1. Install PostgreSQL: brew install postgresql');
    console.log('2. Run setup: ./setup-database.sh');
    console.log('3. Add DB_PASSWORD to your environment');
    console.log('4. Restart server');

  } catch (error) {
    console.log(' Test failed:', error.message);
  }
}

testReplayProtection();
