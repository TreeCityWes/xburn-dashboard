import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';

/**
 * Function to handle API route with an async handler
 */
function asyncRoute(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Start the API server
 * @param db Database pool
 * @param port Port number to listen on
 */
export function startApiServer(db: Pool, port: number = 3000): void {
  const app = express();
  
  // Enable CORS
  app.use(cors());
  
  // Parse JSON body
  app.use(express.json());
  
  // Basic logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // API endpoints
  
  // Get chain status
  app.get('/api/chains', asyncRoute(async (req, res) => {
    const result = await db.query(`
      SELECT 
        chain_id, chain_name, 
        last_indexed_block, 
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_update
      FROM chains
    `);
    
    res.json(result.rows);
  }));
  
  // Get recent burns
  app.get('/api/burns/recent', asyncRoute(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;
    
    const whereClause = chainId ? 'WHERE chain_id = $3' : '';
    const params = chainId ? [limit, offset, chainId] : [limit, offset];
    
    const result = await db.query(
      `SELECT 
        transaction_hash, 
        chain_id,
        block_number,
        to_char(block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as block_timestamp,
        user_address,
        xen_amount_direct,
        xen_amount_accumulated,
        contract_address,
        event_type,
        nft_id
       FROM burn_events
       ${whereClause}
       ORDER BY block_timestamp DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    
    res.json(result.rows);
  }));
  
  // Get burns by address
  app.get('/api/burns/address/:address', asyncRoute(async (req, res) => {
    const address = req.params.address.toLowerCase();
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await db.query(
      `SELECT 
        transaction_hash, 
        chain_id,
        block_number,
        to_char(block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as block_timestamp,
        user_address,
        xen_amount_direct,
        xen_amount_accumulated,
        contract_address,
        event_type,
        nft_id
       FROM burn_events
       WHERE user_address = $1
       ORDER BY block_timestamp DESC
       LIMIT $2 OFFSET $3`,
      [address, limit, offset]
    );
    
    res.json(result.rows);
  }));
  
  // Get burn positions
  app.get('/api/positions', asyncRoute(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;
    const status = req.query.status as string || null;
    
    let whereClause = '';
    const params: any[] = [limit, offset];
    let paramIndex = 3;
    
    if (chainId) {
      whereClause += 'WHERE chain_id = $' + paramIndex;
      params.push(chainId);
      paramIndex++;
    }
    
    if (status) {
      whereClause += whereClause ? ' AND ' : 'WHERE ';
      whereClause += 'status = $' + paramIndex;
      params.push(status as any);
    }
    
    const result = await db.query(
      `SELECT 
        chain_id,
        nft_id,
        user_address,
        xen_burned_total,
        lock_period_days,
        to_char(maturity_timestamp, 'YYYY-MM-DD HH24:MI:SS') as maturity_timestamp,
        mint_transaction_hash,
        to_char(mint_block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as mint_block_timestamp,
        status,
        amplifier_at_burn,
        xburn_reward_potential,
        claimed_transaction_hash,
        to_char(claimed_block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as claimed_block_timestamp,
        claimed_xburn_amount
       FROM burn_positions
       ${whereClause}
       ORDER BY mint_block_timestamp DESC
       LIMIT $1 OFFSET $2`,
      params
    );
    
    res.json(result.rows);
  }));
  
  // Get positions by address
  app.get('/api/positions/address/:address', asyncRoute(async (req, res) => {
    const address = req.params.address.toLowerCase();
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string || null;
    
    let whereClause = 'WHERE user_address = $1';
    const params: any[] = [address, limit, offset];
    
    if (status) {
      whereClause += ' AND status = $4';
      params.push(status as any);
    }
    
    const result = await db.query(
      `SELECT 
        chain_id,
        nft_id,
        user_address,
        xen_burned_total,
        lock_period_days,
        to_char(maturity_timestamp, 'YYYY-MM-DD HH24:MI:SS') as maturity_timestamp,
        mint_transaction_hash,
        to_char(mint_block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as mint_block_timestamp,
        status,
        amplifier_at_burn,
        xburn_reward_potential,
        claimed_transaction_hash,
        to_char(claimed_block_timestamp, 'YYYY-MM-DD HH24:MI:SS') as claimed_block_timestamp,
        claimed_xburn_amount
       FROM burn_positions
       ${whereClause}
       ORDER BY mint_block_timestamp DESC
       LIMIT $2 OFFSET $3`,
      params
    );
    
    res.json(result.rows);
  }));
  
  // Get analytics by metric
  app.get('/api/analytics/:metricName', asyncRoute(async (req, res) => {
    const metricName = req.params.metricName;
    const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;
    
    let query = 'SELECT metric_name, metric_value, to_char(last_updated, \'YYYY-MM-DD HH24:MI:SS\') as last_updated FROM analytics';
    let params: any[] = [];
    
    if (metricName === 'all') {
      if (chainId) {
        query += ' WHERE metric_name LIKE $1';
        params.push(`%_${chainId}`);
      }
    } else if (chainId) {
      query += ' WHERE metric_name = $1';
      params.push(`${metricName}_${chainId}`);
    } else {
      query += ' WHERE metric_name = $1';
      params.push(metricName);
    }
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metric not found' });
    }
    
    if (metricName === 'all') {
      res.json(result.rows);
    } else {
      res.json(result.rows[0]);
    }
  }));
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`API server running on port ${port}`);
  });
} 