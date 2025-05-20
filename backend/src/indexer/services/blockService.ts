import { ethers } from 'ethers';
import { Pool } from 'pg';
import { ChainConfig } from '../config/chains';

/**
 * Service for retrieving and caching block information
 */
export class BlockService {
  private db: Pool;
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private blockCache: Map<string, number> = new Map(); // Cache format: 'chainId:blockNumber' -> timestamp
  
  /**
   * Create a new BlockService instance
   * @param db Database pool
   */
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Initialize providers for all chains
   * @param chainConfigs Array of chain configurations
   */
  initializeProviders(chainConfigs: ChainConfig[]): void {
    for (const config of chainConfigs) {
      if (config.enabled) {
        this.providers.set(
          config.chainId,
          new ethers.JsonRpcProvider(config.rpcUrl)
        );
      }
    }
  }
  
  /**
   * Get the timestamp for a specific block
   * @param chainId Chain ID
   * @param blockNumber Block number
   * @returns Unix timestamp in seconds
   */
  async getBlockTimestamp(chainId: number, blockNumber: number): Promise<number> {
    // Check cache first
    const cacheKey = `${chainId}:${blockNumber}`;
    
    if (this.blockCache.has(cacheKey)) {
      return this.blockCache.get(cacheKey)!;
    }
    
    // Check database
    try {
      const result = await this.db.query(
        `SELECT block_timestamp FROM block_timestamps WHERE chain_id = $1 AND block_number = $2`,
        [chainId, blockNumber]
      );
      
      if (result.rows.length > 0) {
        const timestamp = Math.floor(new Date(result.rows[0].block_timestamp).getTime() / 1000);
        this.blockCache.set(cacheKey, timestamp);
        return timestamp;
      }
    } catch (error) {
      console.warn(`Error querying block timestamp from database: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue to fetch from RPC
    }
    
    // Fetch from RPC
    try {
      const provider = this.getProvider(chainId);
      const block = await provider.getBlock(blockNumber);
      
      if (!block) {
        throw new Error(`Block ${blockNumber} not found on chain ${chainId}`);
      }
      
      const timestamp = Number(block.timestamp);
      
      // Store in database
      try {
        await this.db.query(
          `INSERT INTO block_timestamps (chain_id, block_number, block_timestamp)
           VALUES ($1, $2, to_timestamp($3))
           ON CONFLICT (chain_id, block_number) DO NOTHING`,
          [chainId, blockNumber, timestamp]
        );
      } catch (dbError) {
        console.warn(`Error storing block timestamp: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
      // Update cache
      this.blockCache.set(cacheKey, timestamp);
      
      return timestamp;
    } catch (error) {
      console.error(`Error fetching block ${blockNumber} on chain ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Failed to get block timestamp for block ${blockNumber} on chain ${chainId}`);
    }
  }
  
  /**
   * Get a provider for a specific chain
   * @param chainId Chain ID
   * @returns JsonRpcProvider instance
   */
  private getProvider(chainId: number): ethers.JsonRpcProvider {
    const provider = this.providers.get(chainId);
    
    if (!provider) {
      throw new Error(`No provider configured for chain ${chainId}`);
    }
    
    return provider;
  }
} 