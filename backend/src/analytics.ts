import { query } from './db';

/**
 * Aggregates burn data for analytics displays
 * Focuses on key metrics like total burned, claiming rates, etc.
 */
export async function updateAnalytics() {
  console.log('Updating analytics aggregations...');
  
  try {
    // Total XEN burned (direct + accumulated)
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('total_xen_burned', (
        SELECT COALESCE(SUM(xen_amount_direct + xen_amount_accumulated), 0)
        FROM burn_events
        WHERE event_type = 'XENBurned'
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Total burn positions created
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('total_burn_positions', (
        SELECT COUNT(*) 
        FROM burn_positions
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Total XBURN claimed
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('total_xburn_claimed', (
        SELECT COALESCE(SUM(CAST(claimed_xburn_amount AS NUMERIC)), 0)
        FROM burn_positions
        WHERE status = 'claimed'
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Total XBURN burned (reducing supply)
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('total_xburn_burned', (
        SELECT COALESCE(SUM(CAST(xen_amount_direct AS NUMERIC)), 0)
        FROM burn_events
        WHERE event_type = 'XBURNBurned'
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Claim rate (percentage of eligible positions claimed)
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('claim_rate_percentage', (
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE status IN ('claimed', 'emergency_withdrawn', 'emergency_withdrawn_owner_unverified')) * 100.0) / COUNT(*), 2)
          END
        FROM burn_positions
        WHERE maturity_timestamp < NOW()
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Average lock period in days
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('avg_lock_period_days', (
        SELECT COALESCE(AVG(lock_period_days), 0)
        FROM burn_positions
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Daily burn volume (last 24 hours)
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('daily_xen_burn_volume', (
        SELECT COALESCE(SUM(xen_amount_direct + xen_amount_accumulated), 0)
        FROM burn_events
        WHERE event_type = 'XENBurned'
        AND block_timestamp > NOW() - INTERVAL '24 hours'
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Emergency withdrawal rate
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('emergency_withdrawal_rate', (
        SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(*) FILTER (WHERE status LIKE 'emergency_withdrawn%') * 100.0) / COUNT(*), 2)
          END
        FROM burn_positions
        WHERE status IN ('claimed', 'emergency_withdrawn', 'emergency_withdrawn_owner_unverified')
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Total unique users
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('unique_users', (
        SELECT COUNT(DISTINCT user_address)
        FROM burn_positions
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    // Weekly active users (positions created in last 7 days)
    await query(`
      INSERT INTO analytics (metric_name, metric_value, last_updated)
      VALUES ('weekly_active_users', (
        SELECT COUNT(DISTINCT user_address)
        FROM burn_positions
        WHERE mint_block_timestamp > NOW() - INTERVAL '7 days'
      ), NOW())
      ON CONFLICT (metric_name)
      DO UPDATE SET metric_value = EXCLUDED.metric_value, last_updated = NOW()
    `);
    
    console.log('Analytics updated successfully');
  } catch (error) {
    console.error('Error updating analytics:', error);
    throw error;
  }
}

/**
 * Schedules regular analytics updates
 */
export function scheduleAnalyticsUpdates(intervalMs = 5 * 60 * 1000) { // Default: 5 minutes
  console.log(`Scheduling analytics updates every ${intervalMs / 1000} seconds`);
  
  // Run immediately once
  updateAnalytics().catch(err => {
    console.error('Initial analytics update failed:', err);
  });
  
  // Then schedule regular updates
  return setInterval(() => {
    updateAnalytics().catch(err => {
      console.error('Scheduled analytics update failed:', err);
    });
  }, intervalMs);
} 