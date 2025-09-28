import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Dune Analytics
  dune: {
    apiKey: process.env.DUNE_API_KEY || '',
    baseUrl: process.env.DUNE_BASE_URL || 'https://api.dune.com',
  },

  // Solana
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://solana.drpc.org',
    senderAddress: process.env.SOLANA_SENDER || '',
    receiverAddress: process.env.SOLANA_RECEIVER || '',
    usdcMintAddress: process.env.USDC_MINT_ADDRESS || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },

  // Payment
  payment: {
    amountUsdc: parseFloat(process.env.PAYMENT_AMOUNT_USDC || '0.01'),
    amountSol: parseFloat(process.env.PAYMENT_AMOUNT_SOL || '0.0001'),
    timeoutSeconds: parseInt(process.env.PAYMENT_TIMEOUT_SECONDS || '300'),
  },

  // x402
  x402: {
    facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.x402.dev',
    payToAddress: process.env.ADDRESS || process.env.SOLANA_RECEIVER || '',
  },

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'mcp_payments',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
};

// Validation
if (!config.dune.apiKey) {
  console.warn('Warning: DUNE_API_KEY not set');
}

if (!config.solana.receiverAddress) {
  console.warn('Warning: SOLANA_RECEIVER not set');
}

if (!config.solana.senderAddress) {
  console.warn('Warning: SOLANA_SENDER not set (needed for testing)');
}
