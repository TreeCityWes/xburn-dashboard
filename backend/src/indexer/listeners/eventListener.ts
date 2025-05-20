import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { ChainConfig } from '../config/chains';
import XENCryptoABI from '../../contracts/XENCrypto.json';
import XBurnMinterABI from '../../contracts/XBurnMinter.json';
import XBurnNFTABI from '../../contracts/XBurnNFT.json';

// Define interface for the events to have proper typing
interface EventWithArgs extends ethers.Log {
  args: Array<any>;
}

/**
 * EventListener class that connects to blockchain nodes and listens for relevant events
 */
export class EventListener extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private xenContract: ethers.Contract;
  private xburnMinterContract: ethers.Contract;
  private xburnNftContract: ethers.Contract;
  private lastProcessedBlock: number;
  public chainConfig: ChainConfig;
  private isProcessing: boolean = false;
  
  /**
   * Create a new EventListener instance
   * @param chainConfig Configuration for the chain to listen to
   * @param startBlock Optional override for the starting block
   */
  constructor(chainConfig: ChainConfig, startBlock?: number) {
    super();
    this.chainConfig = chainConfig;
    
    // Initialize provider and contracts
    this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    
    this.xenContract = new ethers.Contract(
      chainConfig.xenContractAddress,
      XENCryptoABI,
      this.provider
    );
    
    this.xburnMinterContract = new ethers.Contract(
      chainConfig.xburnMinterAddress,
      XBurnMinterABI,
      this.provider
    );
    
    this.xburnNftContract = new ethers.Contract(
      chainConfig.xburnNftAddress,
      XBurnNFTABI,
      this.provider
    );
    
    this.lastProcessedBlock = startBlock || chainConfig.startBlock;
  }
  
  /**
   * Start listening for events with the provided interval
   * @param interval Time in ms between batch processing
   */
  async startListening(interval: number = 60000): Promise<void> {
    console.log(`Starting event listener for chain ${this.chainConfig.name} (${this.chainConfig.chainId})`);
    console.log(`Starting from block ${this.lastProcessedBlock}`);
    
    // Initial processing
    await this.processEvents();
    
    // Set up recurring interval
    setInterval(() => this.processEvents(), interval);
    
    // Set up new block listener for real-time events
    this.provider.on('block', (blockNumber: number) => {
      // Only process very recent blocks immediately
      if (blockNumber > this.lastProcessedBlock + 5) {
        this.processLatestBlock(blockNumber);
      }
    });
    
    console.log(`Event listener started for chain ${this.chainConfig.name}`);
  }
  
  /**
   * Process batches of events from last processed block
   */
  private async processEvents(): Promise<void> {
    if (this.isProcessing) {
      console.log(`Already processing events for chain ${this.chainConfig.chainId}, skipping...`);
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(
        currentBlock - 5, // Leave a small buffer for reorgs
        fromBlock + this.chainConfig.blocksPerBatch - 1
      );
      
      if (fromBlock > toBlock) {
        console.log(`No new blocks to process for chain ${this.chainConfig.chainId}`);
        this.isProcessing = false;
        return;
      }
      
      console.log(`Processing blocks ${fromBlock} to ${toBlock} for chain ${this.chainConfig.chainId}`);
      
      // Process events in parallel
      await Promise.all([
        this.processBurnEvents(fromBlock, toBlock),
        this.processXenBurnedEvents(fromBlock, toBlock),
        this.processBurnNFTMintedEvents(fromBlock, toBlock),
        this.processXburnClaimedEvents(fromBlock, toBlock)
      ]);
      
      // Update last processed block
      this.lastProcessedBlock = toBlock;
      this.emit('blockProcessed', { chainId: this.chainConfig.chainId, blockNumber: toBlock });
      
      console.log(`Processed blocks ${fromBlock} to ${toBlock} for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emit('error', { chainId: this.chainConfig.chainId, error });
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process a single latest block for real-time updates
   * @param blockNumber Block number to process
   */
  private async processLatestBlock(blockNumber: number): Promise<void> {
    try {
      // Process only the specific block for real-time updates
      await Promise.all([
        this.processBurnEvents(blockNumber, blockNumber),
        this.processXenBurnedEvents(blockNumber, blockNumber),
        this.processBurnNFTMintedEvents(blockNumber, blockNumber),
        this.processXburnClaimedEvents(blockNumber, blockNumber)
      ]);
      
      console.log(`Processed latest block ${blockNumber} for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing latest block ${blockNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process XEN transfer events to address(0) as burns
   * @param fromBlock Start block
   * @param toBlock End block
   */
  private async processBurnEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      // Use Transfer event to 0x0000000000000000000000000000000000000000 address for burns
      const burnFilter = this.xenContract.filters.Transfer(null, ethers.ZeroAddress);
      const events = await this.xenContract.queryFilter(burnFilter, fromBlock, toBlock);
      
      for (const event of events) {
        // Get transaction timestamp from the block
        const block = await event.getBlock();
        const typedEvent = event as EventWithArgs;
        
        this.emit('burnEvent', {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
          from: typedEvent.args[0], // from address
          value: typedEvent.args[2].toString(), // amount
          chainId: this.chainConfig.chainId
        });
      }
      
      console.log(`Processed ${events.length} burn events for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing burn events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process XENBurned events from XBurnMinter contract
   * @param fromBlock Start block
   * @param toBlock End block
   */
  private async processXenBurnedEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      const burnFilter = this.xburnMinterContract.filters.XENBurned();
      const events = await this.xburnMinterContract.queryFilter(burnFilter, fromBlock, toBlock);
      
      for (const event of events) {
        // Get transaction timestamp from the block
        const block = await event.getBlock();
        const typedEvent = event as EventWithArgs;
        
        this.emit('xenBurnedEvent', {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
          user: typedEvent.args[0], // user address
          amount: typedEvent.args[1].toString(), // amount
          chainId: this.chainConfig.chainId
        });
      }
      
      console.log(`Processed ${events.length} XENBurned events for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing XENBurned events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process BurnNFTMinted events from XBurnMinter contract
   * @param fromBlock Start block
   * @param toBlock End block
   */
  private async processBurnNFTMintedEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      const mintFilter = this.xburnMinterContract.filters.BurnNFTMinted();
      const events = await this.xburnMinterContract.queryFilter(mintFilter, fromBlock, toBlock);
      
      for (const event of events) {
        // Get transaction timestamp from the block
        const block = await event.getBlock();
        const typedEvent = event as EventWithArgs;
        
        this.emit('burnNftMintedEvent', {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
          user: typedEvent.args[0], // user address
          tokenId: typedEvent.args[1].toString(), // tokenId
          xenAmount: typedEvent.args[2].toString(), // xenAmount
          termDays: typedEvent.args[3].toString(), // termDays
          chainId: this.chainConfig.chainId
        });
      }
      
      console.log(`Processed ${events.length} BurnNFTMinted events for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing BurnNFTMinted events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Process XBURNClaimed events from XBurnMinter contract
   * @param fromBlock Start block
   * @param toBlock End block
   */
  private async processXburnClaimedEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      const claimFilter = this.xburnMinterContract.filters.XBURNClaimed();
      const events = await this.xburnMinterContract.queryFilter(claimFilter, fromBlock, toBlock);
      
      for (const event of events) {
        // Get transaction timestamp from the block
        const block = await event.getBlock();
        const typedEvent = event as EventWithArgs;
        
        this.emit('xburnClaimedEvent', {
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
          user: typedEvent.args[0], // user address
          baseAmount: typedEvent.args[1].toString(), // baseAmount
          bonusAmount: typedEvent.args[2].toString(), // bonusAmount
          chainId: this.chainConfig.chainId
        });
      }
      
      console.log(`Processed ${events.length} XBURNClaimed events for chain ${this.chainConfig.chainId}`);
    } catch (error) {
      console.error(`Error processing XBURNClaimed events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 