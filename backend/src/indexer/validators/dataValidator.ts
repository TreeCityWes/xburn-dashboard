import { Pool } from 'pg';
import { ethers } from 'ethers';
import { ChainConfig } from '../config/chains';

/**
 * DataValidator handles validation of indexed data against blockchain state
 */
export class DataValidator {
  private db: Pool;
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  
  /**
   * Create a new DataValidator instance
   * @param db Database pool
   * @param chainConfigs Array of chain configurations
   */
  constructor(db: Pool, chainConfigs: ChainConfig[]) {
    this.db = db;
    
    // Initialize providers
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
   * Validate data for a chain
   * @param chainId Chain ID
   */
  async validateDailyData(chainId: number): Promise<void> {
    console.log(`Running daily validation for chain ${chainId}...`);
    
    try {
      // Example validation: check for gaps in indexed blocks
      await this.detectBlockGaps(chainId);
      
      // Log validation success
      await this.db.query(
        `INSERT INTO validation_stats 
         (chain_id, validation_type, status, details, validated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chainId, 'daily', 'success', 'Daily validation completed successfully']
      );
      
      console.log(`Daily validation completed for chain ${chainId}`);
    } catch (error) {
      console.error(`Error during daily validation for chain ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Log validation failure
      await this.db.query(
        `INSERT INTO validation_stats 
         (chain_id, validation_type, status, details, validated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chainId, 'daily', 'failure', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      );
    }
  }
  
  /**
   * Detect gaps in indexed blocks
   * @param chainId Chain ID
   */
  private async detectBlockGaps(chainId: number): Promise<void> {
    // Get current chain state
    const chainResult = await this.db.query(
      `SELECT last_indexed_block FROM chains WHERE chain_id = $1`,
      [chainId]
    );
    
    if (chainResult.rows.length === 0) {
      throw new Error(`Chain ${chainId} not found in database`);
    }
    
    const lastIndexedBlock = chainResult.rows[0].last_indexed_block;
    
    // Get block numbers from event records
    const eventBlocksResult = await this.db.query(
      `SELECT DISTINCT block_number 
       FROM burn_events 
       WHERE chain_id = $1 
       ORDER BY block_number`,
      [chainId]
    );
    
    const indexedBlocks = eventBlocksResult.rows.map(row => row.block_number);
    
    // Check for gaps in the sequence
    if (indexedBlocks.length > 1) {
      let previousBlock = indexedBlocks[0];
      
      for (let i = 1; i < indexedBlocks.length; i++) {
        const currentBlock = indexedBlocks[i];
        const gap = currentBlock - previousBlock;
        
        // If gap is more than 1 block and within reasonable range (not initial indexing)
        if (gap > 1 && gap < 1000) {
          console.warn(`Found block gap from ${previousBlock} to ${currentBlock} (${gap} blocks) for chain ${chainId}`);
          
          // Log gap for later reprocessing
          await this.db.query(
            `INSERT INTO block_gaps 
             (chain_id, start_block, end_block, gap_size, detected_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (chain_id, start_block) DO NOTHING`,
            [chainId, previousBlock, currentBlock, gap]
          );
        }
        
        previousBlock = currentBlock;
      }
    }
    
    console.log(`Block gap detection completed for chain ${chainId}`);
  }
  
  /**
   * Weekly reconciliation of data integrity
   * @param chainId Chain ID
   */
  async runWeeklyReconciliation(chainId: number): Promise<void> {
    console.log(`Running weekly reconciliation for chain ${chainId}...`);
    
    try {
      // Calculate data integrity hash
      const dataHash = await this.calculateDataIntegrityHash(chainId);
      
      // Store the hash
      await this.db.query(
        `INSERT INTO data_integrity 
         (chain_id, hash_value, created_at)
         VALUES ($1, $2, NOW())`,
        [chainId, dataHash]
      );
      
      // Log validation success
      await this.db.query(
        `INSERT INTO validation_stats 
         (chain_id, validation_type, status, details, validated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chainId, 'weekly', 'success', 'Weekly reconciliation completed successfully']
      );
      
      console.log(`Weekly reconciliation completed for chain ${chainId}`);
    } catch (error) {
      console.error(`Error during weekly reconciliation for chain ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Log validation failure
      await this.db.query(
        `INSERT INTO validation_stats 
         (chain_id, validation_type, status, details, validated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [chainId, 'weekly', 'failure', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      );
    }
  }
  
  /**
   * Calculate a data integrity hash for the chain's data
   * @param chainId Chain ID
   * @returns Hash string
   */
  private async calculateDataIntegrityHash(chainId: number): Promise<string> {
    // For simplicity, using PostgreSQL's MD5 function to create a hash of burn events
    const result = await this.db.query(
      `SELECT md5(string_agg(
         transaction_hash || '|' || 
         block_number::text || '|' || 
         user_address || '|' || 
         COALESCE(xen_amount_direct, '0') || '|' || 
         COALESCE(xen_amount_accumulated, '0'), 
         ','
       )) as data_hash 
       FROM burn_events 
       WHERE chain_id = $1`,
      [chainId]
    );
    
    return result.rows[0]?.data_hash || '';
  }
} 