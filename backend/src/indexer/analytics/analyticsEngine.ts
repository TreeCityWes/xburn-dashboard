import { Pool } from 'pg';
import { format } from 'date-fns';

/**
 * AnalyticsEngine handles generating pre-computed analytics for the dashboard
 */
export class AnalyticsEngine {
  private db: Pool;
  
  /**
   * Create a new AnalyticsEngine instance
   * @param db Database pool
   */
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Schedule all analytics refreshes
   */
  scheduleRefreshes(): void {
    console.log('Scheduling analytics refreshes...');
    
    // Run immediately on startup
    this.refreshHourlyStats();
    this.refreshDailyStats();
    this.calculateAmplifierValue();
    
    // Schedule hourly refresh
    setInterval(() => this.refreshHourlyStats(), 60 * 60 * 1000); // Every hour
    
    // Schedule daily refresh at midnight
    this.scheduleDailyRefresh();
    
    console.log('Analytics refreshes scheduled');
  }
  
  /**
   * Schedule the daily refresh to run at midnight
   */
  private scheduleDailyRefresh(): void {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0, 0, 0
    );
    
    const timeUntilMidnight = nextMidnight.getTime() - now.getTime();
    
    setTimeout(() => {
      this.refreshDailyStats();
      this.calculateAmplifierValue();
      this.scheduleDailyRefresh(); // Schedule next day
    }, timeUntilMidnight);
    
    console.log(`Scheduled daily refresh at ${nextMidnight.toISOString()}`);
  }
  
  /**
   * Refresh daily analytics
   */
  async refreshDailyStats(): Promise<void> {
    console.log('Refreshing daily stats...');
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get active chains
      const chainsResult = await client.query('SELECT chain_id FROM chains');
      
      for (const row of chainsResult.rows) {
        const chainId = row.chain_id;
        
        // 1. Compute daily burn totals
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'daily_burn_total_' || $1, 
            COALESCE(SUM(COALESCE(xen_amount_direct, 0) + COALESCE(xen_amount_accumulated, 0)), 0),
            NOW()
          FROM burn_events
          WHERE chain_id = $1
            AND block_timestamp >= CURRENT_DATE
            AND block_timestamp < CURRENT_DATE + INTERVAL '1 day'
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
        
        // 2. Compute total burn amount
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'total_burn_' || $1, 
            COALESCE(SUM(COALESCE(xen_amount_direct, 0) + COALESCE(xen_amount_accumulated, 0)), 0),
            NOW()
          FROM burn_events
          WHERE chain_id = $1
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
        
        // 3. Compute unique burners
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'unique_burners_' || $1, 
            COUNT(DISTINCT user_address),
            NOW()
          FROM burn_events
          WHERE chain_id = $1
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
        
        // 4. Compute active burn positions
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'active_positions_' || $1, 
            COUNT(*),
            NOW()
          FROM burn_positions
          WHERE chain_id = $1
            AND status = 'locked'
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
        
        // 5. Compute claimable burn positions
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'claimable_positions_' || $1, 
            COUNT(*),
            NOW()
          FROM burn_positions
          WHERE chain_id = $1
            AND status = 'locked'
            AND maturity_timestamp <= NOW()
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
      }
      
      // 6. Update last refresh timestamp
      await client.query(`
        INSERT INTO analytics (metric_name, metric_value, last_updated)
        VALUES ('daily_stats_refresh', extract(epoch from now()), NOW())
        ON CONFLICT (metric_name) 
        DO UPDATE SET
          metric_value = EXCLUDED.metric_value,
          last_updated = EXCLUDED.last_updated
      `);
      
      await client.query('COMMIT');
      console.log('Daily stats refreshed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error refreshing daily stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Refresh hourly analytics
   */
  async refreshHourlyStats(): Promise<void> {
    console.log('Refreshing hourly stats...');
    
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get active chains
      const chainsResult = await client.query('SELECT chain_id FROM chains');
      
      for (const row of chainsResult.rows) {
        const chainId = row.chain_id;
        
        // 1. Compute hourly burn totals for the last 24 hours
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'hourly_burn_total_' || $1, 
            COALESCE(SUM(COALESCE(xen_amount_direct, 0) + COALESCE(xen_amount_accumulated, 0)), 0),
            NOW()
          FROM burn_events
          WHERE chain_id = $1
            AND block_timestamp >= NOW() - INTERVAL '1 hour'
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
        
        // 2. Compute hourly transaction count
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          SELECT 
            'hourly_tx_count_' || $1, 
            COUNT(*),
            NOW()
          FROM burn_events
          WHERE chain_id = $1
            AND block_timestamp >= NOW() - INTERVAL '1 hour'
          ON CONFLICT (metric_name)
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chainId]);
      }
      
      // 3. Update last refresh timestamp
      await client.query(`
        INSERT INTO analytics (metric_name, metric_value, last_updated)
        VALUES ('hourly_stats_refresh', extract(epoch from now()), NOW())
        ON CONFLICT (metric_name) 
        DO UPDATE SET
          metric_value = EXCLUDED.metric_value,
          last_updated = EXCLUDED.last_updated
      `);
      
      await client.query('COMMIT');
      console.log('Hourly stats refreshed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error refreshing hourly stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }
  
  /**
   * Calculate the current amplifier value and store it
   */
  async calculateAmplifierValue(): Promise<void> {
    console.log('Calculating amplifier values...');
    
    const client = await this.db.connect();
    
    try {
      // Get active chains
      const chainsResult = await client.query(`
        SELECT chain_id, created_at FROM chains
      `);
      
      for (const chain of chainsResult.rows) {
        const launchTimestamp = new Date(chain.created_at).getTime() / 1000;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        
        // Calculate days active
        const daysActive = Math.floor((currentTimestamp - launchTimestamp) / (24 * 60 * 60));
        
        // Calculate amplifier (based on XEN tokenomics - AMP_START = 3000, AMP_END = 1)
        const amplifier = daysActive >= 3000 ? 1 : 3000 - daysActive;
        
        // Store the calculated value
        await client.query(`
          INSERT INTO analytics 
          (metric_name, metric_value, last_updated)
          VALUES 
            ('amplifier_value_' || $1, $2, NOW()),
            ('days_active_' || $1, $3, NOW())
          ON CONFLICT (metric_name) 
          DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            last_updated = EXCLUDED.last_updated
        `, [chain.chain_id, amplifier, daysActive]);
      }
      
      console.log('Amplifier values calculated successfully');
    } catch (error) {
      console.error(`Error calculating amplifier values: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }
} 