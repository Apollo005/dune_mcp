const { paymentMiddleware } = require("x402-express");
import { config } from '../config';

// Type definitions
type SolanaAddress = string;

// Create x402 payment middleware configuration
export function createX402Middleware() {
  const facilitatorUrl = config.x402.facilitatorUrl;
  const payTo = config.x402.payToAddress as SolanaAddress;

  if (!facilitatorUrl || !payTo) {
    console.warn("x402 middleware disabled: Missing FACILITATOR_URL or ADDRESS environment variables");
    console.warn(`facilitatorUrl: ${facilitatorUrl}, payTo: ${payTo}`);
    // Return a pass-through middleware if x402 is not configured
    return (req: any, res: any, next: any) => next();
  }

  // Check if we should use mock facilitator for testing
  const useMockFacilitator = process.env.USE_MOCK_FACILITATOR === 'true' || facilitatorUrl.includes('localhost');
  const actualFacilitatorUrl = useMockFacilitator ? 'http://localhost:4402' : facilitatorUrl;

  // Define payment routes and their costs
  const paymentConfig = {
    // Execute any query with USDC
    "POST /api/query": {
      price: `$${config.payment.amountUsdc}`,
      network: "solana" as const,
    },
    // Execute saved query by ID with USDC
    "POST /api/saved/*/execute": {
      price: `$${config.payment.amountUsdc}`,
      network: "solana" as const,
    },
    // Execute catalog query with USDC
    "POST /api/catalog/*/execute": {
      price: `$${config.payment.amountUsdc}`,
      network: "solana" as const,
    },
    // SOL payment endpoints
    "POST /api/query/sol": {
      price: {
        amount: (config.payment.amountSol * 1e9).toString(), // Convert to lamports
        asset: "native", // Native SOL
      },
      network: "solana" as const,
    },
    "POST /api/saved/*/execute/sol": {
      price: {
        amount: (config.payment.amountSol * 1e9).toString(), // Convert to lamports
        asset: "native", // Native SOL
      },
      network: "solana" as const,
    },
    "POST /api/catalog/*/execute/sol": {
      price: {
        amount: (config.payment.amountSol * 1e9).toString(), // Convert to lamports
        asset: "native", // Native SOL
      },
      network: "solana" as const,
    },
  };

  console.log(`x402 middleware configured for Solana payments to: ${payTo}`);
  console.log(`USDC Payment: $${config.payment.amountUsdc} USDC`);
  console.log(`SOL Payment: ${config.payment.amountSol} SOL`);
  console.log(`Sender (for testing): ${config.solana.senderAddress}`);
  console.log(`Receiver: ${config.solana.receiverAddress}`);
  console.log(`Facilitator URL: ${actualFacilitatorUrl}${useMockFacilitator ? ' (MOCK)' : ''}`);

  return paymentMiddleware(
    payTo,
    paymentConfig,
    {
      url: actualFacilitatorUrl,
    }
  );
}

// Fallback middleware for development/testing (no payment required)
export function noPaymentMiddleware() {
  return (req: any, res: any, next: any) => {
    console.log('Development mode: Skipping payment verification');
    next();
  };
}
