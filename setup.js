const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create .env file
const envContent = `# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=xen_burn_analytics

# Base RPC configuration - Replace with your own RPC URL
BASE_RPC_URL=https://mainnet.base.org
START_BLOCK_BASE=7000000

# Contract addresses on Base
XEN_CONTRACT_ADDRESS_BASE=0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5
XBURN_MINTER_CONTRACT_ADDRESS_BASE=0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A
XBURN_NFT_CONTRACT_ADDRESS_BASE=0x305C60D2fEf49FADfEe67EC530DE98f67bac861D

# Indexer settings
INDEXER_INTERVAL_MS=15000
ANALYTICS_UPDATE_INTERVAL_MS=300000
API_PORT=3000`;

fs.writeFileSync(path.join(__dirname, '.env'), envContent);
console.log('Created .env file');

// Create dist directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
  console.log('Created dist directory');
}

// Run tsc to compile TypeScript
try {
  console.log('Building TypeScript files...');
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error.message);
}

console.log('\nSetup complete! You can now run the indexer with:');
console.log('node dist/indexer.js');
console.log('\nMake sure PostgreSQL is running with the correct credentials from .env'); 