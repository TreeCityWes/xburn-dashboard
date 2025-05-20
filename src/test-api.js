const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Sample analytics data
const analyticsData = [
  { metric_name: 'total_xen_burned', metric_value: 1000000, last_updated: new Date() },
  { metric_name: 'total_burn_positions', metric_value: 100, last_updated: new Date() },
  { metric_name: 'daily_xen_burn_volume', metric_value: 50000, last_updated: new Date() },
  { metric_name: 'claim_rate_percentage', metric_value: 75.5, last_updated: new Date() },
  { metric_name: 'avg_lock_period_days', metric_value: 45, last_updated: new Date() },
  { metric_name: 'unique_users', metric_value: 50, last_updated: new Date() }
];

// Sample burn events data
const burnEvents = [
  {
    id: 1,
    chain_id: 1,
    transaction_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    block_number: 12345678,
    block_timestamp: new Date(),
    user_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    xen_amount_direct: '800000',
    xen_amount_accumulated: '200000',
    contract_address: '0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A',
    event_type: 'XENBurned',
    created_at: new Date()
  }
];

// Sample burn positions data
const burnPositions = [
  {
    id: 1,
    chain_id: 1,
    nft_id: '123',
    user_address: '0xabcdef1234567890abcdef1234567890abcdef12',
    xen_burned_total: '1000000',
    lock_period_days: 30,
    maturity_timestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    mint_transaction_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    mint_block_timestamp: new Date(),
    status: 'locked',
    amplifier_at_burn: '10000',
    xburn_reward_potential: '500000',
    created_at: new Date(),
    updated_at: new Date()
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Indexer status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    chain_id: 1,
    last_indexed_block: 12345678,
    last_indexed_timestamp: new Date().toISOString(),
    total_events: burnEvents.length,
    total_positions: burnPositions.length,
    uptime: process.uptime()
  });
});

// Get all analytics
app.get('/analytics', (req, res) => {
  res.json(analyticsData);
});

// Get a specific metric
app.get('/analytics/:metricName', (req, res) => {
  const { metricName } = req.params;
  const metric = analyticsData.find(m => m.metric_name === metricName);
  
  if (!metric) {
    return res.status(404).json({ error: 'Metric not found' });
  }
  
  res.json(metric);
});

// Get burn events
app.get('/events', (req, res) => {
  res.json(burnEvents);
});

// Get burn positions
app.get('/positions', (req, res) => {
  res.json(burnPositions);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Test API server running on port ${PORT}`);
  console.log(`Try accessing http://localhost:${PORT}/health to test the API`);
}); 