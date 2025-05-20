import express, { Request, Response } from 'express';
import cors from 'cors';
import { query } from './db';
import config from './config';

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Indexer status
app.get('/status', async (req: Request, res: Response) => {
  try {
    // Get last indexed block
    const lastBlockResult = await query(
      'SELECT MAX(block_number) as last_block, MAX(block_timestamp) as last_timestamp FROM burn_events WHERE chain_id = $1',
      [1]
    );
    
    // Get total events indexed
    const eventCountResult = await query(
      'SELECT COUNT(*) as event_count FROM burn_events WHERE chain_id = $1',
      [1]
    );
    
    // Get total positions
    const positionCountResult = await query(
      'SELECT COUNT(*) as position_count FROM burn_positions WHERE chain_id = $1',
      [1]
    );
    
    res.json({
      status: 'running',
      chain_id: 1,
      last_indexed_block: lastBlockResult.rows[0]?.last_block || 0,
      last_indexed_timestamp: lastBlockResult.rows[0]?.last_timestamp || null,
      total_events: eventCountResult.rows[0]?.event_count || 0,
      total_positions: positionCountResult.rows[0]?.position_count || 0,
      uptime: process.uptime() // Server uptime in seconds
    });
  } catch (error) {
    console.error('Error fetching indexer status:', error);
    res.status(500).json({ error: 'Failed to fetch indexer status' });
  }
});

// Get all analytics metrics
app.get('/analytics', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT metric_name, metric_value, last_updated FROM analytics ORDER BY metric_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get a specific metric
app.get('/analytics/:metricName', async (req: Request, res: Response) => {
  try {
    const { metricName } = req.params;
    const result = await query(
      'SELECT metric_name, metric_value, last_updated FROM analytics WHERE metric_name = $1',
      [metricName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Metric not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching metric:', error);
    res.status(500).json({ error: 'Failed to fetch metric' });
  }
});

// Get recent burn events
app.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '100', 10);
    const offset = parseInt(req.query.offset as string || '0', 10);
    
    const result = await query(
      'SELECT * FROM burn_events WHERE chain_id = $1 ORDER BY block_timestamp DESC LIMIT $2 OFFSET $3',
      [1, limit, offset]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Start API server
export function startApiServer() {
  return new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      console.log(`API server running on port ${PORT}`);
      resolve();
    });
  });
} 