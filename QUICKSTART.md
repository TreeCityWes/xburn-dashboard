# XEN Burn Analytics Dashboard - Quickstart Guide

This is a condensed guide for quickly setting up the XEN Burn Analytics Dashboard.

## 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/your-username/xburn-dashboard.git
cd xburn-dashboard

# Install dependencies
cd backend
npm install
```

## 2. Database Setup

```bash
# Option 1: Docker (recommended)
docker-compose up -d postgres

# Option 2: Local PostgreSQL
psql -U postgres -c "CREATE DATABASE xen_burn_analytics;"
psql -U postgres -d xen_burn_analytics -f backend/schema.sql
```

## 3. Configuration

Create a `.env` file in the backend directory:

```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=xen_burn_analytics

BASE_RPC_URL=https://mainnet.base.org
START_BLOCK_BASE=7000000

XEN_CONTRACT_ADDRESS_BASE=0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5
XBURN_MINTER_CONTRACT_ADDRESS_BASE=0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A
XBURN_NFT_CONTRACT_ADDRESS_BASE=0x305C60D2fEf49FADfEe67EC530DE98f67bac861D

INDEXER_INTERVAL_MS=15000
ANALYTICS_UPDATE_INTERVAL_MS=300000
API_PORT=3000
```

## 4. Build & Run

```bash
# Build the application
npm run build

# Start the indexer
npm start
```

## 5. Visualization

```bash
# Start Metabase
docker-compose up -d metabase

# Access Metabase
# Open http://localhost:3030 in your browser
```

## 6. API Endpoints

The API will be available at http://localhost:3000

- `GET /health` - Health check
- `GET /status` - Indexer status
- `GET /analytics` - All metrics
- `GET /analytics/:metricName` - Specific metric
- `GET /events` - Recent burn events
- `GET /positions` - Burn positions

## 7. Verify Installation

```bash
# Test the installation
npm test
```

For more detailed instructions, see the full [README.md](README.md).

For Metabase dashboard setup, see [METABASE_SETUP.md](METABASE_SETUP.md). 