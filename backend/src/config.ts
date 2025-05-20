import dotenv from 'dotenv';

// Load .env file from the backend directory (where package.json is)
// Assumes the script is run from the 'backend' directory context
// or that the .env file is discoverable from the execution context.
dotenv.config();

export interface AppConfig {
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  baseRpcUrl: string;
  indexerIntervalMs: number;
  analyticsUpdateIntervalMs: number;
  startBlockBase: number;
  xenContractAddressBase?: string;
  xburnMinterContractAddressBase?: string;
  xburnNftContractAddressBase?: string;
}

const getConfig = (): AppConfig => {
  return {
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || '5432', 10),
    dbUser: process.env.DB_USER || 'your_db_user',
    dbPassword: process.env.DB_PASSWORD || 'your_db_password',
    dbName: process.env.DB_NAME || 'xen_burn_analytics',
    baseRpcUrl: process.env.BASE_RPC_URL || '',
    indexerIntervalMs: parseInt(process.env.INDEXER_INTERVAL_MS || '300000', 10),
    analyticsUpdateIntervalMs: parseInt(process.env.ANALYTICS_UPDATE_INTERVAL_MS || '300000', 10),
    startBlockBase: parseInt(process.env.START_BLOCK_BASE || '0', 10),
    xenContractAddressBase: process.env.XEN_CONTRACT_ADDRESS_BASE,
    xburnMinterContractAddressBase: process.env.XBURN_MINTER_CONTRACT_ADDRESS_BASE,
    xburnNftContractAddressBase: process.env.XBURN_NFT_CONTRACT_ADDRESS_BASE,
  };
};

const config = getConfig();

export default config; 