# MCP Dune Solana API

A monetized content provider (MCP) API server that enables SQL queries on Solana blockchain data via Dune Analytics, with integrated x402 payment standard using Solana USDC.

## Features

- **SQL Query Execution**: Execute custom SQL queries on Solana blockchain data
- **x402 Payment Integration**: HTTP 402 payment standard with Solana USDC
- **Security**: Query validation and rate limiting
- **Dune Analytics Integration**: Powered by Dune's comprehensive blockchain data
- **TypeScript**: Full type safety and modern development experience

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Dune Analytics API key
- Solana wallet for receiving payments

### Installation

1. Clone and install dependencies:
```bash
git clone <repository-url>
cd mcp-dune-solana-api
npm install
```

2. Configure environment variables:
```bash
cp env.example .env
```

Edit `.env` with your configuration:
```env
DUNE_API_KEY=your_dune_api_key_here
SOLANA_WALLET_ADDRESS=your_solana_wallet_address_here
PAYMENT_AMOUNT_USDC=0.01
PORT=3000
```

3. Build and run:
```bash
npm run build
npm start

# Or for development:
npm run dev
```

## API Endpoints

### Free Endpoints

- `GET /` - API information
- `GET /api/health` - Health check
- `GET /api/info` - Detailed API information and pricing
- `GET /api/examples` - Example Solana SQL queries
- `POST /api/validate` - Validate SQL queries without execution
- `GET /api/query/saved/:queryId/latest` - Get latest results from saved query

### Paid Endpoints (requires x402 payment)

- `POST /api/query` - Execute custom SQL query on Solana data
- `POST /api/query/saved/:queryId/execute` - Execute a pre-saved Dune query by ID

## Usage Examples

### 1. Get API Information
```bash
curl http://localhost:3000/api/info
```

### 2. Validate a Query (Free)
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT * FROM solana.transactions LIMIT 10"
  }'
```

### 3. Execute Query with Payment

#### Step 1: Initial request (receives 402 payment required)
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "SELECT block_slot, block_time, tx_id FROM solana.transactions ORDER BY block_time DESC LIMIT 5"
  }'
```

Response (HTTP 402):
```json
{
  "error": "Payment required to access this resource",
  "payment": {
    "id": "payment-uuid-here",
    "amount": "0.01",
    "currency": "USDC",
    "recipient": "your-solana-wallet-address",
    "chain": "solana",
    "expires_at": "2024-01-01T12:00:00.000Z",
    "instructions": "Send 0.01 USDC to the recipient address..."
  }
}
```

#### Step 2: Send USDC payment on Solana
Use your preferred Solana wallet or SDK to send the exact amount of USDC to the specified recipient address.

#### Step 3: Retry request with payment proof
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -H "X-Payment-Id: payment-uuid-here" \
  -H "X-Payment-Proof: transaction-hash-here" \
  -d '{
    "sql": "SELECT block_slot, block_time, tx_id FROM solana.transactions ORDER BY block_time DESC LIMIT 5"
  }'
```

## Example Solana Queries

### Recent Transactions
```sql
SELECT 
  block_slot,
  block_time,
  tx_id,
  fee,
  account_keys[1] as signer
FROM solana.transactions 
ORDER BY block_time DESC 
LIMIT 10
```

### USDC Transfer Statistics
```sql
SELECT 
  COUNT(*) as transfer_count,
  SUM(amount) / 1e6 as total_volume_usdc,
  AVG(amount) / 1e6 as avg_transfer_usdc
FROM solana.token_transfers_2022 
WHERE mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
  AND block_time > NOW() - INTERVAL '1' HOUR
```

### Top SOL Transfers
```sql
SELECT 
  tx_id,
  block_time,
  pre_balance / 1e9 as pre_balance_sol,
  post_balance / 1e9 as post_balance_sol,
  (post_balance - pre_balance) / 1e9 as transfer_amount_sol
FROM solana.account_activity 
WHERE block_time > NOW() - INTERVAL '24' HOUR
  AND pre_balance != post_balance
ORDER BY ABS(post_balance - pre_balance) DESC
LIMIT 20
```

## x402 Payment Flow

The API implements the x402 standard for micropayments:

1. **Initial Request**: Client makes a request to a paid endpoint
2. **402 Response**: Server responds with HTTP 402 and payment details
3. **Payment**: Client sends USDC on Solana to the specified address
4. **Retry**: Client retries the request with payment proof headers
5. **Verification**: Server verifies the payment on-chain
6. **Success**: Query is executed and results returned

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DUNE_API_KEY` | Dune Analytics API key | Required |
| `SOLANA_WALLET_ADDRESS` | Your Solana wallet address for receiving payments | Required |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.mainnet-beta.solana.com` |
| `USDC_MINT_ADDRESS` | USDC token mint address | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| `PAYMENT_AMOUNT_USDC` | Payment amount per query | `0.01` |
| `PAYMENT_TIMEOUT_SECONDS` | Payment timeout in seconds | `300` |
| `PORT` | Server port | `3000` |

## Security Features

- Input validation and SQL injection prevention
- Query validation (Solana-only, SELECT-only)
- Payment verification on Solana blockchain
- Rate limiting and timeout handling
- Secure headers with Helmet.js

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests

### Project Structure

```
src/
├── config/          # Configuration management
├── middleware/      # x402 payment middleware
├── routes/          # API route handlers
├── services/        # Business logic (Dune, Payment)
├── types/           # TypeScript type definitions
└── server.ts        # Main server file
```

## Support

For issues and questions:
1. Check the `/api/info` endpoint for current configuration
2. Validate queries using `/api/query/validate`
3. Use `/api/query/examples` for working query examples

## License

MIT License
