import { Pool } from 'pg';
import { EventListener } from '../listeners/eventListener';
import { EventProcessor } from '../processors/eventProcessor';
import { BlockService } from '../services/blockService';
import { ChainConfig, defaultChains } from '../config/chains';
import { DataValidator } from '../validators/dataValidator';

/**
 * ChainManager handles the initialization and coordination of blockchain indexing
 */
export class ChainManager {
  private db: Pool;
  private chainConfigs: Map<number, ChainConfig> = new Map();
  private eventListeners: Map<number, EventListener> = new Map();
  private eventProcessors: Map<number, EventProcessor> = new Map();
  private blockService: BlockService;
  private dataValidator: DataValidator | null = null;
  
  /**
   * Create a new ChainManager instance
   * @param db Database pool
   */
  constructor(db: Pool) {
    this.db = db;
    this.blockService = new BlockService(db);
  }
  
  /**
   * Initialize chain indexing
   */
  async initialize(): Promise<void> {
    try {
      // Load chain configurations from database
      const chains = await this.loadChainConfigurations();
      console.log(`Loaded ${chains.length} chain configurations`);
      
      // Initialize block service providers
      this.blockService.initializeProviders(chains);
      
      // Initialize data validator
      // Commented out until implemented
      // this.dataValidator = new DataValidator(this.db, chains);
      
      // Initialize listeners and processors for each chain
      for (const chain of chains) {
        if (chain.enabled) {
          await this.initializeChain(chain);
        } else {
          console.log(`Chain ${chain.name} (${chain.chainId}) is disabled, skipping initialization`);
        }
      }
      
      // Schedule validation tasks
      // Commented out until implemented
      // this.scheduleValidationTasks();
      
      console.log('Chain manager initialized successfully');
    } catch (error) {
      console.error(`Error initializing chain manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Load chain configurations from the database
   * @returns Array of chain configurations
   */
  private async loadChainConfigurations(): Promise<ChainConfig[]> {
    try {
      // Try to load from database
      const result = await this.db.query(
        `SELECT 
          chain_id, chain_name, rpc_url, 
          xen_contract_address, xburn_minter_contract_address, xburn_nft_contract_address,
          last_indexed_block
         FROM chains 
         WHERE chain_id IS NOT NULL`
      );
      
      // If no chains in database, use default configs
      if (result.rows.length === 0) {
        console.log('No chains found in database, using default configurations');
        
        // Insert default chains
        for (const chain of defaultChains) {
          await this.db.query(
            `INSERT INTO chains 
             (chain_id, chain_name, rpc_url, 
              xen_contract_address, xburn_minter_contract_address, xburn_nft_contract_address, 
              last_indexed_block, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             ON CONFLICT (chain_id) DO NOTHING`,
            [
              chain.chainId,
              chain.name,
              chain.rpcUrl,
              chain.xenContractAddress,
              chain.xburnMinterAddress,
              chain.xburnNftAddress,
              chain.startBlock
            ]
          );
        }
        
        // Return default chains
        return defaultChains;
      }
      
      // Map database results to ChainConfig objects
      const chains: ChainConfig[] = result.rows.map(row => ({
        chainId: row.chain_id,
        name: row.chain_name,
        rpcUrl: row.rpc_url,
        xenContractAddress: row.xen_contract_address,
        xburnMinterAddress: row.xburn_minter_contract_address,
        xburnNftAddress: row.xburn_nft_contract_address,
        startBlock: row.last_indexed_block || defaultChains[0].startBlock,
        blocksPerBatch: 2000, // Default value or could be stored in DB
        enabled: true // All chains from DB are considered enabled
      }));
      
      // Store in memory
      chains.forEach(chain => {
        this.chainConfigs.set(chain.chainId, chain);
      });
      
      return chains;
    } catch (error) {
      console.error(`Error loading chain configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fall back to default chains
      console.log('Falling back to default chain configurations');
      return defaultChains;
    }
  }
  
  /**
   * Initialize a single chain for indexing
   * @param config Chain configuration
   */
  private async initializeChain(config: ChainConfig): Promise<void> {
    try {
      console.log(`Initializing chain ${config.name} (${config.chainId})`);
      
      // Create event listener
      const eventListener = new EventListener(config);
      this.eventListeners.set(config.chainId, eventListener);
      
      // Create event processor
      const eventProcessor = new EventProcessor(this.db, eventListener, this.blockService);
      this.eventProcessors.set(config.chainId, eventProcessor);
      
      // Start listening with 5 minute interval
      await eventListener.startListening(5 * 60 * 1000);
      
      console.log(`Chain ${config.name} (${config.chainId}) initialized successfully`);
    } catch (error) {
      console.error(`Error initializing chain ${config.name} (${config.chainId}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Add a new chain to the system
   * @param config Chain configuration
   * @returns Success status
   */
  async addChain(config: ChainConfig): Promise<boolean> {
    try {
      // Validate configuration
      if (!config.chainId || !config.name || !config.rpcUrl || 
          !config.xenContractAddress || !config.xburnMinterAddress || !config.xburnNftAddress) {
        throw new Error('Invalid chain configuration');
      }
      
      // Add to database
      await this.db.query(
        `INSERT INTO chains 
         (chain_id, chain_name, rpc_url, 
          xen_contract_address, xburn_minter_contract_address, xburn_nft_contract_address, 
          last_indexed_block, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         ON CONFLICT (chain_id) 
         DO UPDATE SET 
           chain_name = $2,
           rpc_url = $3, 
           xen_contract_address = $4,
           xburn_minter_contract_address = $5,
           xburn_nft_contract_address = $6,
           last_indexed_block = $7,
           updated_at = NOW()`,
        [
          config.chainId,
          config.name,
          config.rpcUrl,
          config.xenContractAddress,
          config.xburnMinterAddress,
          config.xburnNftAddress,
          config.startBlock
        ]
      );
      
      // If enabled, initialize chain
      if (config.enabled) {
        this.chainConfigs.set(config.chainId, config);
        await this.initializeChain(config);
      }
      
      return true;
    } catch (error) {
      console.error(`Error adding chain ${config.name} (${config.chainId}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Disable a chain
   * @param chainId Chain ID to disable
   * @returns Success status
   */
  async disableChain(chainId: number): Promise<boolean> {
    try {
      // Update database
      await this.db.query(
        `UPDATE chains SET disabled = true, updated_at = NOW() WHERE chain_id = $1`,
        [chainId]
      );
      
      // Remove from active listeners
      const listener = this.eventListeners.get(chainId);
      if (listener) {
        // No built-in stop method, but we would implement one in a real system
        // For now we just remove it from the map
        this.eventListeners.delete(chainId);
        this.eventProcessors.delete(chainId);
      }
      
      // Update memory map
      const config = this.chainConfigs.get(chainId);
      if (config) {
        config.enabled = false;
        this.chainConfigs.set(chainId, config);
      }
      
      return true;
    } catch (error) {
      console.error(`Error disabling chain ${chainId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }
  
  /**
   * Schedule validation tasks
   */
  private scheduleValidationTasks(): void {
    if (!this.dataValidator) {
      console.log('Data validator not initialized, skipping validation tasks');
      return;
    }
    
    // This would be implemented in a real system using node-cron or similar
    console.log('Validation tasks would be scheduled here in a real implementation');
  }
} 