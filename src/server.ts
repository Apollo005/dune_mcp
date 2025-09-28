import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { queryRoutes } from './routes/queryRoutes';
import { healthRoutes } from './routes/healthRoutes';
import rpcRoutes from './routes/rpcRoutes';
import { createX402Middleware, noPaymentMiddleware } from './middleware/x402Proper';
import { checkDatabaseHealth, initializeDatabase, closeDatabaseConnection } from './database/connection';

// Function to verify RPC endpoint is working
async function verifyRpcEndpoint(rpcUrl: string) {
  try {
    console.log(`Verifying RPC endpoint: ${rpcUrl}`);
    
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth'
      })
    });
    
    const result = await response.json() as any;
    
    if (result.result === 'ok') {
      console.log(`RPC endpoint verified: ${rpcUrl}`);
    } else {
      console.warn(`RPC endpoint response unexpected:`, result);
    }
  } catch (error: any) {
    console.error(`RPC endpoint verification failed:`, error.message);
    console.error(`   URL: ${rpcUrl}`);
  }
}

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// x402 payment middleware - disabled due to external facilitator connection issues
// Using custom payment verification in route middleware instead
console.log('🔧 Using custom payment verification (x402-express disabled due to facilitator connection issues)');

// Routes
app.use('/api', healthRoutes);
app.use('/api', queryRoutes);
app.use('/api', rpcRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MCP Dune Solana API Server',
    version: '1.0.0',
    documentation: {
      endpoints: '/api/info',
      examples: '/api/query/examples',
      health: '/api/health',
    },
    payment: {
      standard: 'x402',
      currency: 'USDC',
      chain: 'Solana',
      amount: config.payment.amountUsdc,
    },
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/info',
      'GET /api/examples',
      'POST /api/validate',
      'POST /api/query',
      'POST /api/query/saved/:queryId/execute',
      'GET /api/query/saved/:queryId/latest',
      'POST /api/test',
    ],
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Check database connection
    console.log('Checking database connection...');
    const dbHealthy = await checkDatabaseHealth();
    
    if (dbHealthy) {
      await initializeDatabase();
    } else {
      console.warn('Database not available - running without payment tracking');
      console.warn('Install PostgreSQL and create database: createdb mcp_payments');
    }
  } catch (error) {
    console.warn('Database connection failed - continuing without payment tracking');
    console.warn('Error:', error);
  }
  
  return app.listen(config.port, () => {
    console.log(`MCP Dune Solana API Server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`USDC Payment: $${config.payment.amountUsdc} per query`);
    console.log(`SOL Payment: ${config.payment.amountSol} SOL per query`);
    console.log(`Solana RPC: ${config.solana.rpcUrl}`);
    console.log(`Dune API: ${config.dune.baseUrl}`);
    console.log(`Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
    
    // Verify RPC endpoint is working
    verifyRpcEndpoint(config.solana.rpcUrl);
    
    if (!config.dune.apiKey) {
      console.warn('Warning: DUNE_API_KEY not configured');
    }
    
    if (!config.solana.receiverAddress) {
      console.warn('Warning: SOLANA_RECEIVER not configured');
    }
    
    if (config.nodeEnv === 'development') {
      console.log('Development mode: Payment verification disabled');
    }
  });
}

// Start the server
let serverInstance: any = null;

startServer().then(server => {
  serverInstance = server;
  console.log('Server started successfully');
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await closeDatabaseConnection();
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  }
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await closeDatabaseConnection();
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  }
});

export default app;
