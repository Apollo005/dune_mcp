import { Router } from 'express';
import { config } from '../config';

const router = Router();

/**
 * POST /api/rpc
 * Proxy RPC calls to avoid CORS and rate limiting issues
 */
router.post('/rpc', async (req, res) => {
  try {
    const { method, params, id } = req.body;

    if (!method) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: id || null
      });
    }

    console.log(`RPC Proxy: ${method}`, params ? `with ${params.length} params` : '');

    // Forward the RPC call to the Solana RPC endpoint
    const rpcResponse = await fetch(config.solana.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: id || 1,
        method,
        params: params || []
      })
    });

    const response = await rpcResponse.json();
    res.json(response);
  } catch (error: any) {
    console.error('RPC Proxy Error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { 
        code: -32603, 
        message: 'Internal error',
        data: error.message 
      },
      id: req.body.id || null
    });
  }
});

export default router;
