/**
 * Example client demonstrating x402 payment flow with the MCP Dune Solana API
 * 
 * This example shows how to:
 * 1. Make a request to a paid endpoint
 * 2. Handle the 402 payment required response
 * 3. Process payment on Solana
 * 4. Retry with payment proof
 */

const axios = require('axios');

class MCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Execute a SQL query with x402 payment handling
   */
  async executeQuery(sql, parameters = {}) {
    console.log('Executing query:', sql.substring(0, 100) + '...');

    try {
      // Step 1: Try to execute the query
      const response = await this.makeRequest('/api/query', {
        method: 'POST',
        data: { sql, parameters }
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 402) {
        // Step 2: Handle payment required
        console.log('Payment required');
        const paymentInfo = error.response.data.payment;
        
        console.log('Payment details:', {
          amount: paymentInfo.amount,
          currency: paymentInfo.currency,
          recipient: paymentInfo.recipient,
          expires_at: paymentInfo.expires_at
        });

        // Step 3: Simulate payment processing
        const transactionHash = await this.simulatePayment(paymentInfo);

        // Step 4: Retry with payment proof
        console.log('Retrying with payment proof...');
        const retryResponse = await this.makeRequest('/api/query', {
          method: 'POST',
          data: { sql, parameters },
          headers: {
            'X-Payment-Id': paymentInfo.id,
            'X-Payment-Proof': transactionHash
          }
        });

        return retryResponse.data;
      }

      throw error;
    }
  }

  /**
   * Simulate payment processing (in real implementation, use Solana SDK)
   */
  async simulatePayment(paymentInfo) {
    console.log('Simulating USDC payment on Solana...');
    console.log(`Send ${paymentInfo.amount} USDC to ${paymentInfo.recipient}`);
    
    // In a real implementation, you would:
    // 1. Connect to Solana wallet
    // 2. Create and send USDC transfer transaction
    // 3. Return the actual transaction hash
    
    // For demo purposes, return a mock transaction hash
    return 'mock_transaction_hash_' + Date.now();
  }

  /**
   * Make HTTP request
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    return axios({
      url,
      method: options.method || 'GET',
      data: options.data,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  /**
   * Get API information
   */
  async getInfo() {
    const response = await this.makeRequest('/api/info');
    return response.data;
  }

  /**
   * Get example queries
   */
  async getExamples() {
    const response = await this.makeRequest('/api/query/examples');
    return response.data;
  }

  /**
   * Validate a query
   */
  async validateQuery(sql) {
    const response = await this.makeRequest('/api/query/validate', {
      method: 'POST',
      data: { sql }
    });
    return response.data;
  }
}

// Example usage
async function main() {
  const client = new MCPClient();

  try {
    console.log('MCP Dune Solana API Client Demo\n');

    // 1. Get API information
    console.log('Getting API info...');
    const info = await client.getInfo();
    console.log('API Info:', info.data.name);
    console.log('Pricing:', info.data.pricing);
    console.log('');

    // 2. Get example queries
    console.log('Getting example queries...');
    const examples = await client.getExamples();
    console.log(`Found ${examples.data.length} example queries`);
    console.log('');

    // 3. Validate a query
    const testQuery = examples.data[0].sql;
    console.log('Validating query...');
    const validation = await client.validateQuery(testQuery);
    console.log('Validation result:', validation.data.valid);
    console.log('');

    // 4. Execute a query (demonstrates x402 payment flow)
    console.log('Executing paid query...');
    const result = await client.executeQuery(testQuery);
    console.log('Query result:', {
      execution_id: result.data.execution_id,
      state: result.data.state,
      row_count: result.data.result?.metadata?.total_row_count || 0
    });

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Run the demo
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MCPClient };
