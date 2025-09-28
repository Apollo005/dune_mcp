import { Pool } from 'pg';
import { config } from '../config';

// PostgreSQL connection pool
let pool: Pool | null = null;

export function getDBConnection(): Pool {
  if (!pool) {
    pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      max: 20, // Maximum number of connections
      idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
      connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });

    console.log('PostgreSQL connection pool initialized');
  }

  return pool;
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const pool = getDBConnection();
    const client = await pool.connect();
    
    // Simple query to test connection
    const result = await client.query('SELECT NOW() as current_time');
    client.release();
    
    console.log('Database health check passed:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Initialize database tables (run schema)
export async function initializeDatabase(): Promise<boolean> {
  try {
    const pool = getDBConnection();
    const client = await pool.connect();
    
    // Check if payment_signatures table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_signatures'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating database tables...');
      // You would run the schema.sql file here
      console.log('Please run the schema.sql file manually: psql -d mcp_payments -f src/database/schema.sql');
    } else {
      console.log('Database tables already exist');
    }
    
    client.release();
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('🔌 Database connection pool closed');
  }
}
