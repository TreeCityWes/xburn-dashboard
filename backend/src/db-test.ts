import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('Testing database connection...');
  console.log('DB Config:', {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    database: process.env.DB_NAME || 'xen_burn_analytics',
    // Mask password for security
    password: process.env.DB_PASSWORD ? '********' : 'not set'
  });

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'xen_burn_analytics',
    // Add a short connection timeout
    connectionTimeoutMillis: 5000
  });

  try {
    console.log('Attempting to connect to database...');
    const client = await pool.connect();
    console.log('Successfully connected to the database!');
    
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
    
    client.release();
    console.log('Connection released.');
  } catch (error) {
    console.error('Error connecting to database:', error);
  } finally {
    await pool.end();
    console.log('Pool ended.');
  }
}

testConnection().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 