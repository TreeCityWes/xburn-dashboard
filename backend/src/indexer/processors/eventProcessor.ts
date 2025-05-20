import { Pool } from 'pg';
import { EventListener } from '../listeners/eventListener';
import { BlockService } from '../services/blockService';

/**
 * EventProcessor handles processing and storing blockchain events from the EventListener
 */
export class EventProcessor {
  private db: Pool;
  private eventListener: EventListener;
  private blockService: BlockService;
  
  /**
   * Create a new EventProcessor instance
   * @param db Database pool
   * @param eventListener EventListener instance
   * @param blockService BlockService instance
   */
  constructor(db: Pool, eventListener: EventListener, blockService: BlockService) {
    this.db = db;
    this.eventListener = eventListener;
    this.blockService = blockService;
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Set up event handlers for the event listener
   */
  private setupEventHandlers(): void {
    this.eventListener.on('burnEvent', this.handleBurnEvent.bind(this));
    this.eventListener.on('xenBurnedEvent', this.handleXenBurnedEvent.bind(this));
    this.eventListener.on('burnNftMintedEvent', this.handleBurnNftMintedEvent.bind(this));
    this.eventListener.on('xburnClaimedEvent', this.handleXburnClaimedEvent.bind(this));
    this.eventListener.on('blockProcessed', this.handleBlockProcessed.bind(this));
    this.eventListener.on('error', this.handleError.bind(this));
  }
  
  /**
   * Handle direct XEN burn events (transfers to address(0))
   * @param event Burn event data
   */
  private async handleBurnEvent(event: any): Promise<void> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Insert into burn_events table
        await client.query(
          `INSERT INTO burn_events 
           (chain_id, transaction_hash, block_number, block_timestamp, user_address, 
            xen_amount_direct, contract_address, event_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (transaction_hash, event_type) DO NOTHING`,
          [
            event.chainId,
            event.transactionHash,
            event.blockNumber,
            event.blockTimestamp,
            event.from.toLowerCase(),
            event.value,
            this.eventListener.chainConfig.xenContractAddress.toLowerCase(),
            'Transfer'
          ]
        );
        
        await client.query('COMMIT');
        console.log(`Processed direct burn transaction ${event.transactionHash}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error in handleBurnEvent transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error handling burn event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle XENBurned events from the XBurnMinter contract
   * @param event XENBurned event data
   */
  private async handleXenBurnedEvent(event: any): Promise<void> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Calculate split amounts (80% direct, 20% accumulated)
        const directAmount = BigInt(event.amount) * BigInt(80) / BigInt(100);
        const accumulatedAmount = BigInt(event.amount) - directAmount;
        
        // Insert into burn_events table
        await client.query(
          `INSERT INTO burn_events 
           (chain_id, transaction_hash, block_number, block_timestamp, user_address, 
            xen_amount_direct, xen_amount_accumulated, contract_address, event_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (transaction_hash, event_type) DO NOTHING`,
          [
            event.chainId,
            event.transactionHash,
            event.blockNumber,
            event.blockTimestamp,
            event.user.toLowerCase(),
            directAmount.toString(),
            accumulatedAmount.toString(),
            this.eventListener.chainConfig.xburnMinterAddress.toLowerCase(),
            'XENBurned'
          ]
        );
        
        await client.query('COMMIT');
        console.log(`Processed XENBurned event in transaction ${event.transactionHash}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error in handleXenBurnedEvent transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error handling XENBurned event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle BurnNFTMinted events from the XBurnMinter contract
   * @param event BurnNFTMinted event data
   */
  private async handleBurnNftMintedEvent(event: any): Promise<void> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Calculate maturity timestamp (current time + term days)
        const maturityTimestamp = new Date(
          event.blockTimestamp.getTime() + parseInt(event.termDays) * 24 * 60 * 60 * 1000
        );
        
        // Insert into burn_positions table
        await client.query(
          `INSERT INTO burn_positions 
           (chain_id, nft_id, user_address, xen_burned_total, 
            lock_period_days, maturity_timestamp, mint_transaction_hash, 
            mint_block_timestamp, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (chain_id, nft_id) 
           DO UPDATE SET 
             user_address = $3, 
             xen_burned_total = $4, 
             lock_period_days = $5, 
             maturity_timestamp = $6, 
             mint_transaction_hash = $7, 
             mint_block_timestamp = $8,
             updated_at = NOW()`,
          [
            event.chainId,
            event.tokenId,
            event.user.toLowerCase(),
            event.xenAmount,
            event.termDays,
            maturityTimestamp,
            event.transactionHash,
            event.blockTimestamp,
            'locked'
          ]
        );
        
        // Link burn event to NFT position if it exists
        await client.query(
          `UPDATE burn_events 
           SET nft_id = $1
           WHERE transaction_hash = $2 AND chain_id = $3 AND event_type = 'XENBurned'`,
          [
            event.tokenId,
            event.transactionHash,
            event.chainId
          ]
        );
        
        // Fetch amplifier value from event
        // For simplicity, using a placeholder value. In a real system, this would come from contract query
        const amplifierValue = 1000; // Placeholder value
        
        // Update amplifier value
        await client.query(
          `UPDATE burn_positions
           SET amplifier_at_burn = $1
           WHERE nft_id = $2 AND chain_id = $3`,
          [
            amplifierValue,
            event.tokenId,
            event.chainId
          ]
        );
        
        await client.query('COMMIT');
        console.log(`Processed BurnNFTMinted event for token ${event.tokenId} in transaction ${event.transactionHash}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error in handleBurnNftMintedEvent transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error handling BurnNFTMinted event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle XBURNClaimed events from the XBurnMinter contract
   * @param event XBURNClaimed event data
   */
  private async handleXburnClaimedEvent(event: any): Promise<void> {
    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');
        
        // Find the NFT position associated with this claim
        // For the real implementation, we would need to track the NFT ID from the transaction
        // Here we're using a simplified approach to find a matching position
        const result = await client.query(
          `SELECT nft_id FROM burn_positions 
           WHERE user_address = $1 AND chain_id = $2 AND status = 'locked'
           ORDER BY maturity_timestamp ASC LIMIT 1`,
          [event.user.toLowerCase(), event.chainId]
        );
        
        if (result.rows.length > 0) {
          const nftId = result.rows[0].nft_id;
          
          // Update burn position as claimed
          await client.query(
            `UPDATE burn_positions 
             SET status = 'claimed', 
                 claimed_transaction_hash = $1,
                 claimed_block_timestamp = $2,
                 claimed_xburn_amount = $3,
                 updated_at = NOW()
             WHERE nft_id = $4 AND chain_id = $5`,
            [
              event.transactionHash,
              event.blockTimestamp,
              (BigInt(event.baseAmount) + BigInt(event.bonusAmount)).toString(),
              nftId,
              event.chainId
            ]
          );
          
          console.log(`Updated position ${nftId} as claimed in transaction ${event.transactionHash}`);
        } else {
          console.warn(`Could not find matching NFT position for claim by ${event.user} in transaction ${event.transactionHash}`);
        }
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error in handleXburnClaimedEvent transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`Error handling XBURNClaimed event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle blockProcessed events from the EventListener
   * @param event Block processed event data
   */
  private async handleBlockProcessed(event: any): Promise<void> {
    try {
      // Update indexer state
      await this.db.query(
        `UPDATE chains 
         SET last_indexed_block = $1, updated_at = NOW()
         WHERE chain_id = $2`,
        [event.blockNumber, event.chainId]
      );
      
      console.log(`Updated indexer state for chain ${event.chainId} to block ${event.blockNumber}`);
    } catch (error) {
      console.error(`Error updating indexer state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Handle error events from the EventListener
   * @param event Error event data
   */
  private handleError(event: any): void {
    console.error(`Error in EventListener for chain ${event.chainId}: ${event.error instanceof Error ? event.error.message : 'Unknown error'}`);
    // Here you could implement additional error handling, like notifications or retries
  }
} 