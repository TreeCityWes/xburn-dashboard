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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start the server
app.listen(PORT, () => {
  console.log(`Test API server running on port ${PORT}`);
  console.log(`Try accessing http://localhost:${PORT}/health to test the API`);
}); 