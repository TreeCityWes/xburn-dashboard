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