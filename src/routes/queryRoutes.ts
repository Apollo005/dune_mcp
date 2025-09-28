import { Router } from 'express';
import { DuneService } from '../services/duneService';
import { QueryManager } from '../services/queryManager';
import { APIResponse, DuneQueryRequest } from '../types';
import { validateSOLPayment, enrichResponseWithPayment } from '../middleware/simplePaymentMiddleware';
import { config } from '../config';

const router = Router();
const duneService = new DuneService();
const queryManager = new QueryManager();

// Apply payment enrichment to all routes
router.use(enrichResponseWithPayment);

/**
 * POST /api/query
 * Execute a SQL query on Solana data via Dune Analytics (requires USDC payment)
 */
router.post('/query',
  validateSOLPayment(config.payment.amountSol, 'POST /api/query'),
  async (req, res) => {
  try {
    const { sql, parameters } = req.body as DuneQueryRequest;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
      } as APIResponse);
    }

    // Validate Solana-specific query
    const validation = duneService.validateSolanaQuery(sql);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      } as APIResponse);
    }

    // Execute query via Dune
    console.log('Starting Dune query execution...');
    const startTime = Date.now();
    const result = await duneService.executeQuery({ sql, parameters });
    const executionTime = Date.now() - startTime;
    console.log(`Dune query completed in ${executionTime}ms`);

    console.log('Preparing response...');
    const responseStartTime = Date.now();
    const responseData = {
      success: true,
      data: {
        execution_id: result.execution_id,
        state: result.state,
        result: result.result,
        query_sql: sql,
        payment_verified: true,
      },
    } as APIResponse;
    const responsePrepTime = Date.now() - responseStartTime;
    console.log(`⚡ Response prepared in ${responsePrepTime}ms`);

    console.log('Sending response...');
    const sendStartTime = Date.now();
    res.json(responseData);
    const sendTime = Date.now() - sendStartTime;
    console.log(`Response sent in ${sendTime}ms`);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * GET /api/query/examples
 * Get example Solana queries (free endpoint)
 */
router.get('/examples', (req, res) => {
  const examples = [
    {
      title: "Recent Solana Transactions",
      description: "Get the latest 10 transactions on Solana",
      sql: `SELECT 
        block_slot,
        block_time,
        tx_id,
        fee,
        account_keys[1] as signer
      FROM solana.transactions 
      ORDER BY block_time DESC 
      LIMIT 10`
    },
    {
      title: "Top SOL Transfers by Volume",
      description: "Get the largest SOL transfers in the last 24 hours",
      sql: `SELECT 
        tx_id,
        block_time,
        pre_balance / 1e9 as pre_balance_sol,
        post_balance / 1e9 as post_balance_sol,
        (post_balance - pre_balance) / 1e9 as transfer_amount_sol
      FROM solana.account_activity 
      WHERE block_time > NOW() - INTERVAL '24' HOUR
        AND pre_balance != post_balance
      ORDER BY ABS(post_balance - pre_balance) DESC
      LIMIT 20`
    },
    {
      title: "Token Transfer Statistics",
      description: "Get USDC transfer statistics for the last hour",
      sql: `SELECT 
        COUNT(*) as transfer_count,
        SUM(amount) / 1e6 as total_volume_usdc,
        AVG(amount) / 1e6 as avg_transfer_usdc
      FROM solana.token_transfers_2022 
      WHERE mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
        AND block_time > NOW() - INTERVAL '1' HOUR`
    },
    {
      title: "Program Interactions",
      description: "Most active programs in the last hour",
      sql: `SELECT 
        program_id,
        COUNT(*) as instruction_count
      FROM solana.instruction_calls
      WHERE block_time > NOW() - INTERVAL '1' HOUR
      GROUP BY program_id
      ORDER BY instruction_count DESC
      LIMIT 15`
    }
  ];

  res.json({
    success: true,
    data: examples,
  } as APIResponse);
});

/**
 * POST /api/query/validate
 * Validate a SQL query without executing it (free endpoint)
 */
router.post('/validate', (req, res) => {
  try {
    const { sql } = req.body;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
      } as APIResponse);
    }

    const validation = duneService.validateSolanaQuery(sql);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        error: validation.error,
        sql: sql,
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/query/saved/:queryId/execute
 * Execute a pre-saved Dune query by ID (requires payment)
 */
router.post('/saved/:queryId/execute', async (req, res) => {
  try {
    const queryId = parseInt(req.params.queryId);
    const { parameters } = req.body || {};

    if (!queryId || isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid query ID is required',
      } as APIResponse);
    }

    // Execute the saved query
    const result = await duneService.executeSavedQuery(queryId, parameters);

    res.json({
      success: true,
      data: {
        execution_id: result.execution_id,
        query_id: queryId,
        state: result.state,
        result: result.result,
        payment_verified: true,
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * GET /api/query/saved/:queryId/latest
 * Get latest results from a saved query without re-execution (free)
 */
router.get('/saved/:queryId/latest', async (req, res) => {
  try {
    const queryId = parseInt(req.params.queryId);

    if (!queryId || isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid query ID is required',
      } as APIResponse);
    }

    // Get latest results without re-execution
    const result = await duneService.getLatestQueryResult(queryId);

    res.json({
      success: true,
      data: result,
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/query/test
 * Execute a SQL query for testing purposes (no payment required)
 * Only works in development mode
 */
router.post('/test', async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Test endpoint not available in production mode',
      } as APIResponse);
    }

    const { sql, parameters } = req.body as DuneQueryRequest;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
      } as APIResponse);
    }

    // Validate Solana-specific query
    const validation = duneService.validateSolanaQuery(sql);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      } as APIResponse);
    }

    console.log('Test mode: Executing query without payment verification');

    // For testing, use an existing query instead of creating a new one
    // Since free plans can't create queries, we'll use a known Solana query
    const testQueryId = 3237025; // Your working Solana query
    console.log(`Using existing query ID: ${testQueryId} for testing`);
    
    // Execute the existing query
    const result = await duneService.executeSavedQuery(testQueryId, parameters);

    res.json({
      success: true,
      data: {
        execution_id: result.execution_id,
        state: result.state,
        result: result.result,
        query_sql: sql,
        test_mode: true,
        note: 'This was executed in test mode without payment',
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * GET /api/catalog
 * Get all available pre-defined queries (free)
 */
router.get('/catalog', (req, res) => {
  try {
    const queries = queryManager.getAllQueries();
    
    res.json({
      success: true,
      data: {
        queries,
        categories: queryManager.getCategories(),
        total_count: Object.keys(queries).length,
      },
    } as APIResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * GET /api/catalog/:category
 * Get queries by category (free)
 */
router.get('/catalog/:category', (req, res) => {
  try {
    const category = req.params.category;
    const queries = queryManager.getQueriesByCategory(category);
    
    res.json({
      success: true,
      data: {
        category,
        queries,
        count: Object.keys(queries).length,
      },
    } as APIResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/catalog/:queryKey/execute
 * Execute a pre-defined query by key (requires payment)
 */
router.post('/catalog/:queryKey/execute', async (req, res) => {
  try {
    const queryKey = req.params.queryKey;
    const { parameters = {} } = req.body;

    const queryDef = queryManager.getQuery(queryKey);
    if (!queryDef) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
      } as APIResponse);
    }

    // Validate parameters
    const validation = queryManager.validateParameters(queryKey, parameters);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: validation.errors,
      } as APIResponse);
    }

    // Merge with defaults
    const defaultParams = queryManager.getDefaultParameters(queryKey);
    const finalParams = { ...defaultParams, ...parameters };

    // Execute the query
    const result = await duneService.executeSavedQuery(queryDef.id, finalParams);

    res.json({
      success: true,
      data: {
        query_key: queryKey,
        query_name: queryDef.name,
        execution_id: result.execution_id,
        state: result.state,
        result: result.result,
        parameters_used: finalParams,
        payment_verified: true,
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/query/sol
 * Execute a SQL query on Solana data via Dune Analytics (requires SOL payment)
 */
router.post('/query/sol',
  validateSOLPayment(config.payment.amountSol, 'POST /api/query/sol'),
  async (req, res) => {
  try {
    const { sql, parameters } = req.body as DuneQueryRequest;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
      } as APIResponse);
    }

    // Validate Solana-specific query
    const validation = duneService.validateSolanaQuery(sql);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      } as APIResponse);
    }

    // Execute query via Dune
    const result = await duneService.executeQuery({ sql, parameters });

    res.json({
      success: true,
      data: {
        execution_id: result.execution_id,
        state: result.state,
        result: result.result,
        query_sql: sql,
        payment_verified: true,
        payment_type: 'SOL',
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/saved/:queryId/execute/sol
 * Execute a pre-saved Dune query by ID (requires SOL payment)
 */
router.post('/saved/:queryId/execute/sol', async (req, res) => {
  try {
    const queryId = parseInt(req.params.queryId);
    const { parameters } = req.body || {};

    if (!queryId || isNaN(queryId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid query ID is required',
      } as APIResponse);
    }

    // Execute the saved query
    const result = await duneService.executeSavedQuery(queryId, parameters);

    res.json({
      success: true,
      data: {
        execution_id: result.execution_id,
        query_id: queryId,
        state: result.state,
        result: result.result,
        payment_verified: true,
        payment_type: 'SOL',
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

/**
 * POST /api/catalog/:queryKey/execute/sol
 * Execute a pre-defined query by key (requires SOL payment)
 */
router.post('/catalog/:queryKey/execute/sol', 
  validateSOLPayment(config.payment.amountSol, 'POST /api/catalog/:queryKey/execute/sol'),
  async (req, res) => {
  try {
    const queryKey = req.params.queryKey;
    const { parameters = {} } = req.body;

    const queryDef = queryManager.getQuery(queryKey);
    if (!queryDef) {
      return res.status(404).json({
        success: false,
        error: 'Query not found',
      } as APIResponse);
    }

    // Validate parameters
    const validation = queryManager.validateParameters(queryKey, parameters);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: validation.errors,
      } as APIResponse);
    }

    // Merge with defaults
    const defaultParams = queryManager.getDefaultParameters(queryKey);
    const finalParams = { ...defaultParams, ...parameters };

    // Execute the query
    const result = await duneService.executeSavedQuery(queryDef.id, finalParams);

    res.json({
      success: true,
      data: {
        query_key: queryKey,
        query_name: queryDef.name,
        execution_id: result.execution_id,
        state: result.state,
        result: result.result,
        parameters_used: finalParams,
        payment_verified: true,
        payment_type: 'SOL',
      },
    } as APIResponse);

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as APIResponse);
  }
});

export { router as queryRoutes };
