# XEN Burn Analytics Dashboard

A comprehensive dashboard for tracking XEN token burns on the Base blockchain. This project provides detailed analytics on XEN burns, NFT positions, claims, and rewards.

## Features

- Real-time indexing of XEN burn events
- Historical event backfilling
- Analytics aggregation for burn metrics
- NFT position tracking with amplifier values
- Emergency withdrawal monitoring
- REST API for data access
- Metabase integration for visualization

## Prerequisites

- Node.js v16+ and npm
- PostgreSQL v12+
- Docker and Docker Compose (for Metabase)
- A Base network RPC endpoint (Infura, Alchemy, or other provider)

## Step-by-Step Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/xburn-dashboard.git
cd xburn-dashboard
```

### 2. Set Up the Backend

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the `backend` directory with the following contents:

```bash
# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=xen_burn_analytics

# Base RPC configuration - Use your own RPC URL
BASE_RPC_URL=https://mainnet.base.org
START_BLOCK_BASE=7000000

# Contract addresses on Base
XEN_CONTRACT_ADDRESS_BASE=0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5
XBURN_MINTER_CONTRACT_ADDRESS_BASE=0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A
XBURN_NFT_CONTRACT_ADDRESS_BASE=0x305C60D2fEf49FADfEe67EC530DE98f67bac861D

# Indexer settings
INDEXER_INTERVAL_MS=15000
ANALYTICS_UPDATE_INTERVAL_MS=300000
API_PORT=3000
```

Replace `your_db_user` and `your_db_password` with your PostgreSQL credentials. If you're using Docker for PostgreSQL, use the credentials from the docker-compose file.

### 4. Set Up the Database

#### Option A: Using Local PostgreSQL

If you have PostgreSQL installed locally:

1. Create the database:
```bash
psql -U postgres -c "CREATE DATABASE xen_burn_analytics;"
```

2. Initialize the schema:
```bash
psql -U postgres -d xen_burn_analytics -f backend/schema.sql
```

#### Option B: Using Docker

1. Start PostgreSQL using Docker Compose:
```bash
docker-compose up -d postgres
```

This will automatically initialize the database using the schema.sql file.

### 5. Build the Backend

```bash
cd backend
npm run build
```

### 6. Start the Indexer

```bash
npm start
```

You should see output indicating the indexer is connecting to the Base network and processing events.

### 7. Set Up Metabase for Visualization

1. Start Metabase using Docker Compose:
```bash
docker-compose up -d metabase
```

2. Open Metabase in your browser:
```
http://localhost:3030
```

3. Follow the setup wizard:
   - Create an admin account
   - Connect to your PostgreSQL database:
     - Database Type: PostgreSQL
     - Name: XEN Burn Analytics
     - Host: postgres (or localhost if using local PostgreSQL)
     - Port: 5432
     - Database Name: xen_burn_analytics
     - Username: your_db_user
     - Password: your_db_password

4. Create dashboards as outlined in the [METABASE_SETUP.md](METABASE_SETUP.md) file.

### 8. Access the API

The API will be available at:
```
http://localhost:3000
```

Available endpoints:
- `GET /health` - Basic health check
- `GET /status` - Indexer status
- `GET /analytics` - All analytics metrics
- `GET /analytics/:metricName` - Specific metric
- `GET /events` - Recent burn events
- `GET /positions` - Burn positions

## Development Mode

To run the indexer in development mode with hot reloading:

```bash
cd backend
npm run dev
```

## Testing

To verify the setup is working correctly:

```bash
cd backend
npm test
```

## Troubleshooting

### Database Connection Issues

If you're having trouble connecting to the database:

1. Verify PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Check the logs:
   ```bash
   docker logs xburn-postgres
   ```

3. Make sure your `.env` credentials match your PostgreSQL configuration.

### RPC Connection Issues

If the indexer can't connect to the Base network:

1. Verify your RPC URL is correct and has the necessary permissions
2. Check if the RPC provider is operational
3. Try using an alternative RPC endpoint

### Indexer Not Processing Events

If the indexer is running but not processing events:

1. Check if you've set the correct contract addresses in `.env`
2. Verify the `START_BLOCK_BASE` value (set it to a known block with events)
3. Check the indexer logs for any error messages

## Architecture

The project uses a 3-tier architecture:

1. **Backend** (Node.js/TypeScript)
   - Event indexing from blockchain
   - Data processing and storage
   - REST API for data access

2. **Database** (PostgreSQL)
   - Stores event data
   - Burns and position tracking
   - Analytics aggregations

3. **Visualization** (Metabase)
   - Data dashboards
   - Chart generation
   - KPI monitoring

## Monitoring and Maintenance

- The indexer logs provide detailed information about its operation
- Use the `/status` endpoint to check the indexer's health
- Metabase dashboards show the latest data and metrics

## Project Structure

```
xburn-dashboard/
├── backend/               # Backend indexer and API
│   ├── dist/              # Compiled JavaScript
│   │   ├── contracts/     # Contract ABIs
│   │   ├── indexer.ts     # Main indexer code
│   │   ├── analytics.ts   # Analytics aggregation
│   │   ├── api.ts         # REST API
│   │   ├── db.ts          # Database connection
│   │   └── config.ts      # Configuration
│   ├── schema.sql         # Database schema
│   └── package.json       # Dependencies
├── docker-compose.yml     # Docker configuration
├── METABASE_SETUP.md      # Metabase setup guide
└── README.md              # This file
```

## License

MIT 