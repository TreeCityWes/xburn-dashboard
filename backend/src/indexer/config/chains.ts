/**
 * Configuration types and settings for supported chains
 */

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  xenContractAddress: string;
  xburnMinterAddress: string;
  xburnNftAddress: string;
  startBlock: number;
  blocksPerBatch: number;
  enabled: boolean;
}

// Base chain configuration - will be loaded from DB in production
export const BASE_CHAIN: ChainConfig = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: process.env.BASE_RPC_URL || 'https://base.llamarpc.com',
  xenContractAddress: '0xffcbF84650cE02DaFE96926B37a0ac5E34932fa5',
  xburnMinterAddress: '0xe89AFDeFeBDba033f6e750615f0A0f1A37C78c4A',
  xburnNftAddress: '0x305C60D2fEf49FADfEe67EC530DE98f67bac861D',
  startBlock: parseInt(process.env.START_BLOCK_BASE || '7300000'),
  blocksPerBatch: 2000,
  enabled: true
};

// Export default chains list
export const defaultChains: ChainConfig[] = [BASE_CHAIN]; 