import { Pool } from 'pg';
import dotenv from 'dotenv';
import { ChainManager } from './indexer/managers/chainManager';
import { AnalyticsEngine } from './indexer/analytics/analyticsEngine';
import { startApiServer } from './api';

// Load environment variables
dotenv.config();

/**
 * Main application class for the XEN Burn Analytics system
 */
class XENBurnTracker {
  private db: Pool;
  private chainManager: ChainManager;
  private analyticsEngine: AnalyticsEngine;
  
  /**
   * Initialize the XEN Burn Analytics system
   */
  constructor() {
    console.log('Initializing XEN Burn Analytics...');
    
    // Initialize database connection
    this.db = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'xen_burn_analytics',
      user: process.env.DB_USER || 'xenuser',
      password: process.env.DB_PASSWORD || 'yourpassword',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000
    });
    
    // Initialize components
    this.chainManager = new ChainManager(this.db);
    this.analyticsEngine = new AnalyticsEngine(this.db);
  }
  
  /**
   * Start the application
   */
  async start(): Promise<void> {
    try {
      console.log('Starting XEN Burn Analytics...');
      
      // Test database connection
      await this.db.query('SELECT NOW()');
      console.log('Database connection established');
      
      // Initialize tables if they don't exist
      await this.initializeTables();
      
      // Initialize chain manager
      await this.chainManager.initialize();
      console.log('Chain manager initialized');
      
      // Schedule analytics refreshes
      this.analyticsEngine.scheduleRefreshes();
      console.log('Analytics refreshes scheduled');
      
      // Start API server
      const port = parseInt(process.env.API_PORT || '3000');
      startApiServer(this.db, port);
      console.log(`API server started on port ${port}`);
      
      console.log('XEN Burn Analytics is running');
    } catch (error) {
      console.error('Error starting XEN Burn Analytics:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  }
  
  /**
   * Initialize database tables if they don't exist
   */
  private async initializeTables(): Promise<void> {
    console.log('Initializing database tables...');
    
    try {
      // Check if analytics table exists
      const tableCheckResult = await this.db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'chains'
        ) as exists
      `);
      
      // If tables don't exist, run schema creation
      if (!tableCheckResult.rows[0].exists) {
        console.log('Tables not found, creating schema...');
        
        // Read schema file
        const fs = require('fs');
        const path = require('path');
        const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
        
        // Execute schema
        await this.db.query(schema);
        console.log('Schema created successfully');
      } else {
        console.log('Tables already exist, skipping schema creation');
      }
      
      // Add additional tables if needed for this implementation
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS block_timestamps (
          chain_id INTEGER NOT NULL,
          block_number BIGINT NOT NULL,
          block_timestamp TIMESTAMP NOT NULL,
          PRIMARY KEY (chain_id, block_number)
        );
        
        CREATE TABLE IF NOT EXISTS block_gaps (
          chain_id INTEGER NOT NULL,
          start_block BIGINT NOT NULL,
          end_block BIGINT NOT NULL,
          gap_size INTEGER NOT NULL,
          detected_at TIMESTAMP NOT NULL,
          processed BOOLEAN DEFAULT false,
          PRIMARY KEY (chain_id, start_block)
        );
        
        CREATE TABLE IF NOT EXISTS validation_stats (
          id SERIAL PRIMARY KEY,
          chain_id INTEGER NOT NULL,
          validation_type VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL,
          details TEXT,
          validated_at TIMESTAMP NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS data_integrity (
          id SERIAL PRIMARY KEY,
          chain_id INTEGER NOT NULL,
          hash_value TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL
        );
      `);
      
      console.log('Database tables initialized');
    } catch (error) {
      console.error('Error initializing tables:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}

// Start the application
const tracker = new XENBurnTracker();
tracker.start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 