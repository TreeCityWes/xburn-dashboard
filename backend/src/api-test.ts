import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'API server is running correctly'
  });
  console.log('Health check endpoint accessed at', new Date().toISOString());
});

// Start server
app.listen(PORT, () => {
  console.log(`API test server running on http://localhost:${PORT}`);
  console.log('Try accessing the health endpoint at http://localhost:3000/health');
}); 