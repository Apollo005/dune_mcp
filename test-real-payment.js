#!/usr/bin/env node

const axios = require('axios');
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const SENDER = 'HKc1p8QY1XquJXEkQ5Qep9CqU3nnpTa7A9YA32jTfWA5';
const RECEIVER = 'FwJ3yH7AxZjxveFmbK74ZdLp6EaaLLoRffhiKVP3VX98';
const MCP_SERVER = 'http://localhost:3333';

console.log(' Real Payment Testing Assistant');
console.log('================================');
console.log();

async function checkBalances() {
  console.log(' Checking current balances...');
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const sender = new PublicKey(SENDER);
    const receiver = new PublicKey(RECEIVER);
    
    const [senderBal, receiverBal] = await Promise.all([
      connection.getBalance(sender),
      connection.getBalance(receiver)
    ]);
    
    console.log(`Sender (Your Wallet):   ${(senderBal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log(`Receiver (Test Wallet): ${(receiverBal / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    console.log();
    
    return { senderBal, receiverBal };
  } catch (error) {
    console.log(' Error checking balances:', error.message);
  }
}

async function testAPIWithoutPayment() {
  console.log(' Testing API without payment (development mode)...');
  try {
    const response = await axios.post(`${MCP_SERVER}/api/catalog/recent_addresses/execute/sol`, {}, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(' API works without payment');
    console.log(` Payment type: ${response.data.data?.payment_type || 'none'}`);
    console.log(` Data rows: ${response.data.data?.result?.rows?.length || 0}`);
    console.log();
    
    return true;
  } catch (error) {
    console.log(' API test failed:', error.message);
    return false;
  }
}

async function testAPIWithRealSignature(signature) {
  console.log(` Testing API with real transaction signature: ${signature.substring(0, 20)}...`);
  try {
    const response = await axios.post(`${MCP_SERVER}/api/catalog/recent_addresses/execute/sol`, {}, {
      headers: {
        'Content-Type': 'application/json',
        'X-Payment-Signature': signature,
        'X-Payment-Network': 'solana',
        'X-Payment-Amount': '1000000'
      }
    });
    
    console.log(' API request with payment signature successful');
    console.log(` Payment verified: ${response.data.data?.payment_verified || false}`);
    console.log(` Payment type: ${response.data.data?.payment_type || 'none'}`);
    console.log(` Data rows: ${response.data.data?.result?.rows?.length || 0}`);
    console.log();
    
    return true;
  } catch (error) {
    console.log(' API request with signature failed:', error.message);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || 'Unknown'}`);
    }
    return false;
  }
}

async function validateTransaction(signature) {
  console.log(` Validating transaction on Solana blockchain...`);
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const txInfo = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    });
    
    if (txInfo) {
      console.log(' Transaction found on blockchain');
      console.log(` Block Time: ${new Date(txInfo.blockTime * 1000).toISOString()}`);
      console.log(` Fee: ${txInfo.meta.fee / LAMPORTS_PER_SOL} SOL`);
      console.log(` Slot: ${txInfo.slot}`);
      
      // Check if it's a transfer to our receiver
      const postBalances = txInfo.meta.postBalances;
      const preBalances = txInfo.meta.preBalances;
      const accounts = txInfo.transaction.message.accountKeys.map(key => key.toString());
      
      const receiverIndex = accounts.indexOf(RECEIVER);
      if (receiverIndex !== -1) {
        const balanceChange = postBalances[receiverIndex] - preBalances[receiverIndex];
        console.log(` Receiver balance change: +${balanceChange / LAMPORTS_PER_SOL} SOL`);
      }
      
      console.log(`Solana Explorer: https://explorer.solana.com/tx/${signature}`);
      console.log();
      
      return true;
    } else {
      console.log(' Transaction not found on blockchain');
      return false;
    }
  } catch (error) {
    console.log(' Error validating transaction:', error.message);
    return false;
  }
}

async function runRealPaymentTest() {
  console.log(' Starting real payment testing sequence...');
  console.log();
  
  // Step 1: Check balances
  const initialBalances = await checkBalances();
  
  // Step 2: Test API without payment
  const apiWorks = await testAPIWithoutPayment();
  if (!apiWorks) {
    console.log(' API is not responding. Make sure the server is running:');
    console.log('   npm run dev');
    return;
  }
  
  // Step 3: Instructions for real payment
  console.log(' REAL PAYMENT INSTRUCTIONS:');
  console.log('============================');
  console.log('1. Open Phantom Wallet');
  console.log('2. Click "Send"');
  console.log(`3. Recipient: ${RECEIVER}`);
  console.log('4. Amount: 0.001 SOL');
  console.log('5. Confirm transaction');
  console.log('6. COPY the transaction signature');
  console.log('7. Run this script again with signature:');
  console.log(`   node test-real-payment.js YOUR_SIGNATURE_HERE`);
  console.log();
  console.log('  This will use real SOL from your wallet!');
  console.log(' Cost: ~0.001 SOL + fees (~$0.20 total)');
  console.log();
  
  const signature = process.argv[2];
  if (signature) {
    console.log(` Testing with provided signature: ${signature}`);
    console.log();
    
    // Validate the transaction
    const isValid = await validateTransaction(signature);
    if (isValid) {
      // Test API with real signature
      await testAPIWithRealSignature(signature);
      
      // Check balances after
      console.log(' Checking balances after transaction...');
      await checkBalances();
    }
  }
  
  console.log(' Test completed!');
}

// Run the test
runRealPaymentTest().catch(console.error);
