import config from './config';
import { query } from './db'; // Removed default pool import as query is named export
import { ethers, Contract, Log, Interface } from 'ethers';
import { scheduleAnalyticsUpdates } from './analytics';
import { startApiServer } from './api';

import XENCryptoABIJson from './contracts/XENCrypto.json';
import XBurnMinterABIJson from './contracts/XBurnMinter.json';
import XBurnNFTABIJson from './contracts/XBurnNFT.json';

// Cast ABIs to a type ethers can work with directly for events (any for simplicity here)
const XENCryptoABI = XENCryptoABIJson as any;
const XBurnMinterABI = XBurnMinterABIJson as any;
const XBurnNFTABI = XBurnNFTABIJson as any;

// Create interfaces for type safety with event parsing
const xenCryptoInterface = new Interface(XENCryptoABI);
const xburnMinterInterface = new Interface(XBurnMinterABI);
const xburnNftInterface = new Interface(XBurnNFTABI);

// Event topics for filtering if needed
const EVENT_SIGNATURES = {
  XENBurned: xburnMinterInterface.getEvent('XENBurned'),
  BurnNFTMinted: xburnMinterInterface.getEvent('BurnNFTMinted'),
  XBURNClaimed: xburnMinterInterface.getEvent('XBURNClaimed'),
  XBURNBurned: xburnMinterInterface.getEvent('XBURNBurned'),
  EmergencyEnd: xburnMinterInterface.getEvent('EmergencyEnd'),
  LockClaimed: xburnNftInterface.getEvent('LockClaimed'),
  LockBurned: xburnNftInterface.getEvent('LockBurned')
};

// Process event logs based on their type
async function processEventLog(log: Log, provider: ethers.JsonRpcProvider) {
  try {
    const block = await provider.getBlock(log.blockNumber);
    if (!block) {
      console.error(`Failed to get block details for block ${log.blockNumber}, tx ${log.transactionHash}`);
      return;
    }

    // XBurnMinter events
    if (log.address.toLowerCase() === config.xburnMinterContractAddressBase?.toLowerCase()) {
      const parsedLog = xburnMinterInterface.parseLog(log);
      if (!parsedLog) return;

      switch (parsedLog.name) {
        case 'XENBurned': {
          const { user, amount } = parsedLog.args;
          console.log(`[Historical XENBurned] User ${user}, Amount ${amount.toString()}, Tx: ${log.transactionHash}`);
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                (amount * BigInt(80)) / BigInt(100), // direct_burn_part
                (amount * BigInt(20)) / BigInt(100), // accumulated_part
                log.address,
                'XENBurned'
            ]
          );
          break;
        }
        case 'BurnNFTMinted': {
          const { user, tokenId, xenAmount, termDays } = parsedLog.args;
          console.log(`[Historical BurnNFTMinted] User ${user}, TokenID ${tokenId.toString()}, XEN Amount ${xenAmount.toString()}, Term ${termDays.toString()} days, Tx: ${log.transactionHash}`);
          
          // Similar logic as in the event listener, but for historical events
          let amplifierAtBurn = BigInt(0);
          let rewardPotential = BigInt(0);
          
          const xburnNftContract = new Contract(config.xburnNftContractAddressBase!, XBurnNFTABI, provider);
          try {
            const lockDetails = await xburnNftContract.getLockDetails(tokenId, { blockTag: log.blockNumber });
            amplifierAtBurn = lockDetails.ampSnapshot;
            rewardPotential = lockDetails.rewardAmount;
          } catch (e) {
            console.error(`[Historical BurnNFTMinted] Error fetching lock details for token ${tokenId} at block ${log.blockNumber}:`, e);
          }

          const maturityTimestamp = new Date((block.timestamp + Number(termDays) * 24 * 60 * 60) * 1000);

          await query(
            'INSERT INTO burn_positions (chain_id, nft_id, user_address, xen_burned_total, lock_period_days, maturity_timestamp, mint_transaction_hash, mint_block_timestamp, status, amplifier_at_burn, xburn_reward_potential) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (chain_id, nft_id) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                tokenId.toString(),
                user,
                xenAmount.toString(),
                Number(termDays),
                maturityTimestamp,
                log.transactionHash,
                new Date(block.timestamp * 1000),
                'locked',
                amplifierAtBurn.toString(),
                rewardPotential.toString()
            ]
          );
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                xenAmount,
                BigInt(0),
                log.address,
                'BurnNFTMinted',
                JSON.stringify({ tokenId: tokenId.toString(), termDays: termDays.toString(), fetchedAmp: amplifierAtBurn.toString(), fetchedReward: rewardPotential.toString() })
            ]
          );
          break;
        }
        case 'XBURNClaimed': {
          const { user, baseAmount, bonusAmount } = parsedLog.args;
          console.log(`[Historical XBURNClaimed] User ${user}, Base ${baseAmount.toString()}, Bonus ${bonusAmount.toString()}, Tx: ${log.transactionHash}`);
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                baseAmount + bonusAmount,
                BigInt(0),
                log.address,
                'XBURNClaimed',
                JSON.stringify({ baseAmount: baseAmount.toString(), bonusAmount: bonusAmount.toString() })
            ]
          );
          break;
        }
        case 'XBURNBurned': {
          const { user, amount } = parsedLog.args;
          console.log(`[Historical XBURNBurned] User ${user}, Amount ${amount.toString()}, Tx: ${log.transactionHash}`);
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Chain ID for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                amount,
                BigInt(0),
                log.address,
                'XBURNBurned',
                JSON.stringify({ amountBurned: amount.toString() })
            ]
          );
          break;
        }
        case 'EmergencyEnd': {
          const { user, baseAmount } = parsedLog.args;
          console.log(`[Historical EmergencyEnd] User ${user}, Base Amount ${baseAmount.toString()}, Tx: ${log.transactionHash}`);
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Chain ID for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                baseAmount,
                BigInt(0),
                log.address,
                'EmergencyEnd',
                JSON.stringify({ baseAmount: baseAmount.toString() })
            ]
          );
          break;
        }
      }
    }
    
    // XBurnNFT events
    else if (log.address.toLowerCase() === config.xburnNftContractAddressBase?.toLowerCase()) {
      const parsedLog = xburnNftInterface.parseLog(log);
      if (!parsedLog) return;

      switch (parsedLog.name) {
        case 'LockClaimed': {
          const { tokenId } = parsedLog.args;
          console.log(`[Historical LockClaimed] TokenID ${tokenId.toString()}, Tx: ${log.transactionHash}`);
          
          // For historical LockClaimed events, also need to examine the transaction for related events
          let finalStatus = 'claimed_unknown_type';
          let finalClaimedAmount = BigInt(0);
          
          try {
            const receipt = await provider.getTransactionReceipt(log.transactionHash);
            if (receipt && receipt.logs) {
              let ownerAtBlock: string | null = null;
              const xburnNftContract = new Contract(config.xburnNftContractAddressBase!, XBurnNFTABI, provider);
              
              try {
                ownerAtBlock = await xburnNftContract.ownerOf(tokenId, { blockTag: log.blockNumber });
              } catch (ownerError) {
                console.warn(`[Historical LockClaimed] Could not determine owner of tokenId ${tokenId} at block ${log.blockNumber}`);
              }
              
              for (const txLog of receipt.logs) {
                if (txLog.address.toLowerCase() === config.xburnMinterContractAddressBase?.toLowerCase()) {
                  try {
                    const parsedTxLog = xburnMinterInterface.parseLog(txLog);
                    
                    if (parsedTxLog && parsedTxLog.name === 'XBURNClaimed') {
                      const baseAmount = parsedTxLog.args.baseAmount as bigint;
                      const bonusAmount = parsedTxLog.args.bonusAmount as bigint;
                      finalClaimedAmount = baseAmount + bonusAmount;
                      finalStatus = 'claimed';
                      break;
                    } else if (parsedTxLog && parsedTxLog.name === 'EmergencyEnd') {
                      const emergencyUser = parsedTxLog.args.user as string;
                      if (ownerAtBlock && emergencyUser.toLowerCase() === ownerAtBlock.toLowerCase()) {
                        finalClaimedAmount = parsedTxLog.args.baseAmount as bigint;
                        finalStatus = 'emergency_withdrawn';
                        break;
                      } else if (!ownerAtBlock && finalStatus !== 'claimed') {
                        finalClaimedAmount = parsedTxLog.args.baseAmount as bigint;
                        finalStatus = 'emergency_withdrawn_owner_unverified';
                      }
                    }
                  } catch (parseError) {
                    // Not an event we are interested in
                  }
                }
              }
            }
          } catch (receiptError) {
            console.error(`[Historical LockClaimed] Error processing receipt for TokenID ${tokenId.toString()}, Tx: ${log.transactionHash}:`, receiptError);
          }
          
          await query(
            'UPDATE burn_positions SET status = $1, claimed_transaction_hash = $2, claimed_block_timestamp = $3, claimed_xburn_amount = $4 WHERE chain_id = $5 AND nft_id = $6',
            [
                finalStatus,
                log.transactionHash,
                new Date(block.timestamp * 1000),
                finalClaimedAmount.toString(),
                1, // Assuming chain_id 1 for Base
                tokenId.toString()
            ]
          );
          break;
        }
        case 'LockBurned': {
          const { tokenId } = parsedLog.args;
          console.log(`[Historical LockBurned] TokenID ${tokenId.toString()}, Tx: ${log.transactionHash}`);
          
          await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Chain ID for Base
                log.transactionHash,
                log.blockNumber,
                new Date(block.timestamp * 1000),
                null,
                log.address,
                'LockBurned',
                JSON.stringify({ tokenId: tokenId.toString() })
            ]
          );
          break;
        }
      }
    }
  } catch (error) {
    console.error(`Error processing historical event log (${log.transactionHash}):`, error);
  }
}

// Process historical events in batches
async function fetchHistoricalEvents(
  provider: ethers.JsonRpcProvider,
  contractAddress: string,
  eventInterface: Interface,
  fromBlock: number,
  toBlock: number,
  batchSize: number = 2000
) {
  console.log(`Fetching historical events for contract ${contractAddress} from block ${fromBlock} to ${toBlock}`);
  
  // Process in batches to avoid RPC limitations
  for (let startBlock = fromBlock; startBlock <= toBlock; startBlock += batchSize) {
    const endBlock = Math.min(startBlock + batchSize - 1, toBlock);
    console.log(`Processing batch from block ${startBlock} to ${endBlock}...`);
    
    try {
      // Get all logs for the contract in this block range
      const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: startBlock,
        toBlock: endBlock
      });
      
      console.log(`Found ${logs.length} logs in block range ${startBlock}-${endBlock}`);
      
      // Process each log
      for (const log of logs) {
        await processEventLog(log, provider);
      }
    } catch (error) {
      console.error(`Error fetching logs for block range ${startBlock}-${endBlock}:`, error);
      // If the batch fails, try with a smaller batch size
      if (batchSize > 100) {
        console.log(`Retrying with smaller batch size...`);
        await fetchHistoricalEvents(provider, contractAddress, eventInterface, startBlock, endBlock, Math.floor(batchSize / 2));
      } else {
        console.error(`Failed to fetch logs even with minimum batch size for block range ${startBlock}-${endBlock}`);
      }
    }
  }
}

async function processHistoricalEvents(provider: ethers.JsonRpcProvider) {
  if (!config.startBlockBase) {
    console.log('No start block number configured. Skipping historical event processing.');
    return;
  }
  
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Number(config.startBlockBase);
  
  // Store the last processed block in the database
  try {
    const lastProcessedBlock = await query('SELECT MAX(block_number) as last_block FROM burn_events WHERE chain_id = $1', [1]);
    const dbLastBlock = lastProcessedBlock.rows[0]?.last_block ? Number(lastProcessedBlock.rows[0].last_block) : null;
    
    // If we have already processed blocks, start from the last one
    const effectiveStartBlock = dbLastBlock ? dbLastBlock + 1 : startBlock;
    
    if (effectiveStartBlock >= currentBlock) {
      console.log(`Already processed events up to current block ${currentBlock}. No historical processing needed.`);
      return;
    }
    
    console.log(`Starting historical event processing from block ${effectiveStartBlock} to ${currentBlock}`);
    
    // Process events for XBurnMinter
    if (config.xburnMinterContractAddressBase) {
      await fetchHistoricalEvents(
        provider,
        config.xburnMinterContractAddressBase,
        xburnMinterInterface,
        effectiveStartBlock,
        currentBlock
      );
    }
    
    // Process events for XBurnNFT
    if (config.xburnNftContractAddressBase) {
      await fetchHistoricalEvents(
        provider,
        config.xburnNftContractAddressBase,
        xburnNftInterface,
        effectiveStartBlock,
        currentBlock
      );
    }
    
    console.log(`Historical event processing complete. Processed blocks ${effectiveStartBlock} to ${currentBlock}`);
  } catch (error) {
    console.error('Error processing historical events:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting XEN Burn Indexer...');
  console.log('Configuration:', config);

  try {
    const dbTest = await query('SELECT NOW()');
    console.log('Database connection successful:', dbTest.rows[0]);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  if (!config.baseRpcUrl || !config.xenContractAddressBase || !config.xburnMinterContractAddressBase || !config.xburnNftContractAddressBase) {
    console.error('RPC URL or critical contract addresses are not configured. Exiting.');
    process.exit(1);
  }

  const baseProvider = new ethers.JsonRpcProvider(config.baseRpcUrl);

  try {
    const network = await baseProvider.getNetwork();
    console.log(`Connected to Base network: ${network.name} (Chain ID: ${network.chainId})`);
  } catch (error) {
    console.error('Failed to connect to Base provider:', error);
    process.exit(1);
  }

  // Process historical events before setting up listeners
  try {
    await processHistoricalEvents(baseProvider);
  } catch (error) {
    console.error('Error during historical event processing:', error);
    // Continue with real-time indexing even if historical processing fails
  }

  const xenContract = new Contract(config.xenContractAddressBase, XENCryptoABI, baseProvider);
  const xburnMinterContract = new Contract(config.xburnMinterContractAddressBase, XBurnMinterABI, baseProvider);
  const xburnNftContract = new Contract(config.xburnNftContractAddressBase, XBurnNFTABI, baseProvider);

  console.log('Listening for events...');

  // --- XENCrypto (XEN Token) Event Listener ---
  // Listening for Transfer events to the zero address, which indicates a burn by the Minter
  xenContract.on('Transfer', async (from: string, to: string, value: bigint, event: Log) => {
    if (to === ethers.ZeroAddress) { // This is how ERC20 _burn typically emits
        // We need to ensure this burn originated from our XBurnMinter contract's direct burn call
        // The XBurnMinter calls XEN.burn() which results in Transfer(fromMinter, zeroAddress, amount)
        // However, XBurnMinter also emits its own XENBurned event which is more specific.
        // This Transfer event might be too generic. Let's rely on XBurnMinter's `XENBurned` event for now for direct XEN burns by the minter.
        // If we need to track *any* XEN burn to address(0), this listener would be useful, but might capture non-XBurnMinter burns.
        // For now, let's log it but prioritize XBurnMinter's specific event for data integrity.
        console.log(`XEN Transfer (burn to zero addr): From ${from}, To ${to}, Value ${value.toString()}, Tx: ${event.transactionHash}`);
        // Potentially, if from === xburnMinterContract.address, then it's the minter burning the 80%.
    }
  });

  // --- XBurnMinter Event Listeners ---
  xburnMinterContract.on('XENBurned', async (user: string, amount: bigint, event: Log) => {
    console.log(`XBurnMinter XENBurned: User ${user}, Amount ${amount.toString()}, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) return;
    // xen_amount_direct for this event would be (amount * 80) / 100
    // xen_amount_accumulated would be (amount * 20) / 100
    // This event seems to represent the TOTAL XEN handled by the minter for a user's burnXEN call.
    try {
        await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base (TODO: make dynamic if multi-chain)
                event.transactionHash,
                event.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                (amount * BigInt(80)) / BigInt(100), // direct_burn_part
                (amount * BigInt(20)) / BigInt(100), // accumulated_part
                await xburnMinterContract.getAddress(),
                'XENBurned'
            ]
        );
    } catch (e) {
        console.error('Error inserting XENBurned event:', e);
    }
  });

  xburnMinterContract.on('BurnNFTMinted', async (user: string, tokenId: bigint, xenAmount: bigint, termDays: bigint, event: Log) => {
    console.log(`XBurnMinter BurnNFTMinted: User ${user}, TokenID ${tokenId.toString()}, XEN Amount ${xenAmount.toString()}, Term ${termDays.toString()} days, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) {
        console.error(`[BurnNFTMinted] Failed to get block details for block ${event.blockNumber}, tx ${event.transactionHash}`);
        return;
    }

    let amplifierAtBurn = BigInt(0);
    let rewardPotential = BigInt(0);

    try {
        // Call getLockDetails at the specific block of the event to get ampSnapshot
        const lockDetails = await xburnNftContract.getLockDetails(tokenId, { blockTag: event.blockNumber });
        amplifierAtBurn = lockDetails.ampSnapshot; // This is a BigNumber (ethers v5) or BigInt (ethers v6)
        rewardPotential = lockDetails.rewardAmount;
        console.log(`[BurnNFTMinted] Fetched lock details for token ${tokenId}: ampSnapshot=${amplifierAtBurn.toString()}, rewardAmount=${rewardPotential.toString()}`);
    } catch (e) {
        console.error(`[BurnNFTMinted] Error fetching lock details for token ${tokenId} at block ${event.blockNumber}, tx ${event.transactionHash}:`, e);
        // Continue with placeholder or decide if this is a critical failure
    }

    const maturityTimestamp = new Date((block.timestamp + Number(termDays) * 24 * 60 * 60) * 1000);

    try {
        await query(
            'INSERT INTO burn_positions (chain_id, nft_id, user_address, xen_burned_total, lock_period_days, maturity_timestamp, mint_transaction_hash, mint_block_timestamp, status, amplifier_at_burn, xburn_reward_potential) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (chain_id, nft_id) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                tokenId.toString(),
                user,
                xenAmount.toString(),
                Number(termDays),
                maturityTimestamp,
                event.transactionHash,
                new Date(block.timestamp * 1000),
                'locked',
                amplifierAtBurn.toString(), // Storing as string, NUMERIC in DB
                rewardPotential.toString()  // Storing as string, NUMERIC in DB
            ]
        );
         // Also record this as a specific type of burn_event
        await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                event.transactionHash,
                event.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                xenAmount, // For this event, xenAmount is the total that went into this NFT
                BigInt(0), // Not split in this specific event context, the XENBurned event covers the split
                await xburnMinterContract.getAddress(),
                'BurnNFTMinted',
                JSON.stringify({ tokenId: tokenId.toString(), termDays: termDays.toString(), fetchedAmp: amplifierAtBurn.toString(), fetchedReward: rewardPotential.toString() })
            ]
        );
    } catch (e) {
        console.error(`[BurnNFTMinted] Error inserting BurnNFTMinted event / position for tx ${event.transactionHash}:`, e);
    }
  });

  xburnMinterContract.on('XBURNClaimed', async (user: string, baseAmount: bigint, bonusAmount: bigint, event: Log) => {
    console.log(`XBurnMinter XBURNClaimed: User ${user}, Base ${baseAmount.toString()}, Bonus ${bonusAmount.toString()}, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) return;

    // Need tokenId to update burn_positions. This event doesn't have it.
    // The XBurnNFT.LockClaimed event has tokenId.
    // This XBURNClaimed from Minter is good for overall analytics but not for updating a specific NFT position directly without tokenId.

    try {
        await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Assuming chain_id 1 for Base
                event.transactionHash,
                event.blockNumber,
                new Date(block.timestamp * 1000),
                user,
                baseAmount + bonusAmount, // total xburn claimed
                BigInt(0), // N/A for this event parameter, it is not XEN
                await xburnMinterContract.getAddress(),
                'XBURNClaimed',
                JSON.stringify({ baseAmount: baseAmount.toString(), bonusAmount: bonusAmount.toString() })
            ]
        );
        // To update burn_positions, we need to identify the NFT. This requires listening to XBurnNFT.LockClaimed.
    } catch (e) {
        console.error('Error inserting XBURNClaimed event:', e);
    }
  });

  xburnMinterContract.on('XBURNBurned', async (user: string, amount: bigint, event: Log) => {
    console.log(`[XBurnMinter XBURNBurned] User: ${user}, Amount: ${amount.toString()}, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) {
        console.error(`[XBURNBurned] Failed to get block details for block ${event.blockNumber}, tx ${event.transactionHash}`);
        return;
    }

    try {
        await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, xen_amount_direct, xen_amount_accumulated, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Chain ID for Base
                event.transactionHash,
                event.blockNumber,
                new Date(block.timestamp * 1000),
                user, // Address of the user/contract that burned XBURN
                amount, // Storing the burned XBURN amount here; direct/accumulated distinction isn't for XBURN
                BigInt(0), // Not applicable for XBURN burned
                await xburnMinterContract.getAddress(),
                'XBURNBurned',
                JSON.stringify({ amountBurned: amount.toString() })
            ]
        );
        // TODO: Consider updating an aggregate analytics table for total XBURN burned
    } catch (e) {
        console.error(`[XBURNBurned] Error inserting XBURNBurned event for tx ${event.transactionHash}:`, e);
    }
  });

  // --- XBurnNFT Event Listeners ---
  xburnNftContract.on('LockClaimed', async (tokenId: bigint, event: Log) => {
    console.log(`[XBurnNFT LockClaimed] TokenID ${tokenId.toString()}, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) {
        console.error(`[LockClaimed] Failed to get block details for block ${event.blockNumber}, tx ${event.transactionHash}`);
        return;
    }

    let finalStatus = 'claimed_unknown_type'; // Default status if no specific event is found
    let finalClaimedAmount = BigInt(0);

    try {
        const receipt = await event.getTransactionReceipt();
        if (receipt && receipt.logs) {
            let ownerAtBlock: string | null = null;
            try {
                ownerAtBlock = await xburnNftContract.ownerOf(tokenId, { blockTag: event.blockNumber });
            } catch (ownerError) {
                console.warn(`[LockClaimed] Could not determine owner of tokenId ${tokenId} at block ${event.blockNumber} for tx ${event.transactionHash}. Will proceed without owner check for EmergencyEnd.`);
            }

            for (const log of receipt.logs) {
                if (log.address.toLowerCase() === config.xburnMinterContractAddressBase?.toLowerCase()) {
                    try {
                        const parsedLog = xburnMinterInterface.parseLog({ topics: log.topics as string[], data: log.data });
                        
                        if (parsedLog && parsedLog.name === 'XBURNClaimed') {
                            const baseAmount = parsedLog.args.baseAmount as bigint;
                            const bonusAmount = parsedLog.args.bonusAmount as bigint;
                            finalClaimedAmount = baseAmount + bonusAmount;
                            finalStatus = 'claimed';
                            console.log(`[LockClaimed] Found XBURNClaimed event in same tx: TokenID ${tokenId.toString()}, User ${parsedLog.args.user}, TotalClaimed ${finalClaimedAmount.toString()}`);
                            break; // Prioritize XBURNClaimed
                        } else if (parsedLog && parsedLog.name === 'EmergencyEnd') {
                            // Check if this EmergencyEnd pertains to the owner of this specific tokenId
                            const emergencyUser = parsedLog.args.user as string;
                            if (ownerAtBlock && emergencyUser.toLowerCase() === ownerAtBlock.toLowerCase()) {
                                finalClaimedAmount = parsedLog.args.baseAmount as bigint;
                                finalStatus = 'emergency_withdrawn';
                                console.log(`[LockClaimed] Found matching EmergencyEnd event in same tx: TokenID ${tokenId.toString()}, User ${emergencyUser}, BaseReturned ${finalClaimedAmount.toString()}`);
                                break; // Found relevant EmergencyEnd
                            } else if (!ownerAtBlock) {
                                // If owner couldn't be determined, we might have to assume this is the one if no XBURNClaimed is found.
                                // This is less precise. For now, let it be processed if no XBURNClaimed is found later.
                                console.warn(`[LockClaimed] Found EmergencyEnd for user ${emergencyUser} but couldn't verify owner of tokenId ${tokenId}.`);
                                // To be safe, only set if no XBURNClaimed is found. XBURNClaimed is more specific for non-emergency.
                                if (finalStatus !== 'claimed') { // only overwrite if not already a confirmed regular claim
                                   finalClaimedAmount = parsedLog.args.baseAmount as bigint;
                                   finalStatus = 'emergency_withdrawn_owner_unverified'; // A distinct status
                                }
                            }
                        }
                    } catch (parseError) {
                        // Not an event we are interested in from the minter, or not parseable, ignore
                    }
                }
            }
        }

        if (finalStatus === 'claimed_unknown_type') {
            console.warn(`[LockClaimed] Did not find a matching XBURNClaimed or verified EmergencyEnd event in tx ${event.transactionHash} for TokenID ${tokenId.toString()}. Status: ${finalStatus}, Amount: ${finalClaimedAmount}`);
        }

    } catch (receiptError) {
        console.error(`[LockClaimed] Error processing transaction receipt for TokenID ${tokenId.toString()}, Tx: ${event.transactionHash}:`, receiptError);
    }

    try {
        await query(
            'UPDATE burn_positions SET status = $1, claimed_transaction_hash = $2, claimed_block_timestamp = $3, claimed_xburn_amount = $4 WHERE chain_id = $5 AND nft_id = $6',
            [
                finalStatus,
                event.transactionHash,
                new Date(block.timestamp * 1000),
                finalClaimedAmount.toString(),
                1, // Assuming chain_id 1 for Base
                tokenId.toString()
            ]
        );
    } catch (e) {
        console.error(`[LockClaimed] Error updating burn_position for TokenID ${tokenId.toString()}, Tx: ${event.transactionHash}:`, e);
    }
  });

  xburnNftContract.on('LockBurned', async (tokenId: bigint, event: Log) => {
    console.log(`[XBurnNFT LockBurned] TokenID ${tokenId.toString()}, Tx: ${event.transactionHash}`);
    const block = await baseProvider.getBlock(event.blockNumber);
    if (!block) {
        console.error(`[LockBurned] Failed to get block details for block ${event.blockNumber}, tx ${event.transactionHash}`);
        return;
    }

    // This event confirms the NFT is destroyed. Usually follows a claim or emergency withdrawal.
    // The status in `burn_positions` should already be 'claimed' (or a future 'emergency_withdrawn').
    // We can log this to burn_events for completeness.
    try {
        await query(
            'INSERT INTO burn_events (chain_id, transaction_hash, block_number, block_timestamp, user_address, contract_address, event_type, raw_log) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (transaction_hash, event_type) DO NOTHING',
            [
                1, // Chain ID for Base
                event.transactionHash,
                event.blockNumber,
                new Date(block.timestamp * 1000),
                null, // User address is not directly in this event, and owner might be complex if transferred then burned by contract
                await xburnNftContract.getAddress(),
                'LockBurned',
                JSON.stringify({ tokenId: tokenId.toString() })
            ]
        );
        // Optionally, we could verify and update the status in burn_positions if it isn't already terminal.
        // For instance, if somehow a lock was burned without being claimed (e.g. admin function), this could set status to 'nft_burned'.
        // await query('UPDATE burn_positions SET status = $1 WHERE chain_id = $2 AND nft_id = $3 AND status NOT IN (\'claimed\', \'emergency_withdrawn\')', ['nft_burned', 1, tokenId.toString()]);
    } catch (e) {
        console.error(`[LockBurned] Error inserting LockBurned event for tx ${event.transactionHash}:`, e);
    }
  });

  // Initialize analytics update scheduler
  const analyticsInterval = scheduleAnalyticsUpdates(config.analyticsUpdateIntervalMs || 5 * 60 * 1000);
  
  // Start API server
  try {
    await startApiServer();
    console.log('API server started successfully');
  } catch (error) {
    console.error('Failed to start API server:', error);
    // Continue without API server
  }
  
  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('Shutting down indexer...');
    clearInterval(analyticsInterval);
    
    // Clean up event listeners
    xenContract.removeAllListeners();
    xburnMinterContract.removeAllListeners();
    xburnNftContract.removeAllListeners();
    
    console.log('Indexer shutdown complete');
    process.exit(0);
  };
  
  // Handle termination signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Indexer setup complete. Listening for new events every ${config.indexerIntervalMs / 1000} seconds.`);
  // The listeners above will handle new events. No explicit setInterval loop needed for ethers.js v6 event listeners.
}

main().catch((error) => {
  console.error('Unhandled error in main function:', error);
  process.exit(1);
}); 