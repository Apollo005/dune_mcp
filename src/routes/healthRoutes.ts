import { Router } from 'express';
import { config } from '../config';
import { APIResponse } from '../types';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint (free)
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.nodeEnv,
    },
  } as APIResponse);
});

/**
 * GET /api/info
 * API information and pricing (free)
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MCP Dune Solana API',
      description: 'Execute SQL queries on Solana blockchain data via Dune Analytics',
      version: '1.0.0',
      pricing: {
        usdc_payment: `$${config.payment.amountUsdc} USDC per query`,
        sol_payment: `${config.payment.amountSol} SOL per query`,
        payment_methods: 'Solana USDC or Native SOL',
        payment_standard: 'x402',
      },
      endpoints: {
        'POST /api/query': 'Execute SQL query (USDC payment)',
        'POST /api/query/sol': 'Execute SQL query (SOL payment)',
        'GET /api/examples': 'Get example queries (free)',
        'POST /api/validate': 'Validate SQL query (free)',
        'GET /api/catalog': 'Get query catalog (free)',
        'POST /api/catalog/:key/execute': 'Execute catalog query (USDC)',
        'POST /api/catalog/:key/execute/sol': 'Execute catalog query (SOL)',
        'GET /api/health': 'Health check (free)',
        'GET /api/info': 'API information (free)',
      },
      solana: {
        network: 'mainnet-beta',
        usdc_mint: config.solana.usdcMintAddress,
        sender_address: config.solana.senderAddress,
        receiver_address: config.solana.receiverAddress,
      },
    },
  } as APIResponse);
});

export { router as healthRoutes };
