# XEN Burn Analytics Backend

This is the backend for the XEN Burn Analytics Dashboard, which tracks XEN token burns on the Base blockchain.

## Architecture

The system consists of several components:

- **Blockchain Indexer**: Listens for XEN burn events on the Base blockchain and stores them in PostgreSQL
- **Analytics Engine**: Processes raw event data into useful metrics and statistics
- **REST API**: Provides data access to the frontend dashboard

## Requirements

- Node.js 16+
- PostgreSQL 14+
- An RPC endpoint for the Base blockchain (e.g., from Alchemy, Infura, or your own node)

## Setup

1. Clone the repository
2. Copy the example environment file and configure it:

```bash
cp env.example .env
```

3. Edit the `.env` file with your database credentials and Base RPC URL
4. Install dependencies:

```bash
npm install
```

5. Build the TypeScript code:

```bash
npm run build
```

6. Start the indexer and API server:

```bash
npm start
```

## Environment Variables

- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5432)
- `DB_NAME`: Database name (default: xen_burn_analytics)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_SSL`: Whether to use SSL for database connection (true/false)
- `BASE_RPC_URL`: RPC URL for the Base blockchain
- `START_BLOCK_BASE`: Starting block for the indexer (default: 7300000)
- `API_PORT`: Port for the API server (default: 3000)

## Docker

You can also run the backend using Docker:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- XEN Burn Analytics Indexer & API
- Metabase for analytics dashboards

## API Endpoints

- `GET /health`: Check API status
- `GET /api/chains`: List configured chains and their status
- `GET /api/burns/recent`: Get recent burn transactions
- `GET /api/burns/address/:address`: Get burns by wallet address
- `GET /api/positions`: Get all burn positions (NFTs)
- `GET /api/positions/address/:address`: Get burn positions by wallet address
- `GET /api/analytics/:metricName`: Get analytics metrics

## Development

To run in development mode with auto-reload:

```bash
npm run dev
```

## License

This project is proprietary software. 