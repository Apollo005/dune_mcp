import { Request, Response, NextFunction } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { SimplePaymentTracker } from '../services/simplePaymentTracker';

const connection = new Connection(config.solana.rpcUrl, 'processed');
const paymentTracker = new SimplePaymentTracker();

// Simple middleware to validate SOL payments and prevent replay attacks
export function validateSOLPayment(expectedAmountSol: number, endpointPath: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip in development
    if (config.nodeEnv === 'development') {
      console.log('Development mode: Skipping payment verification');
      return next();
    }

    const signature = req.headers['x-payment-signature'] as string;

    if (!signature) {
      return res.status(402).json({
        error: 'Payment Required',
        code: 402,
        payment: {
          network: 'solana',
          receiver_address: config.solana.receiverAddress,
          amount_sol: expectedAmountSol.toString(),
          message: `Send ${expectedAmountSol} SOL to ${config.solana.receiverAddress}`,
          instructions: [
            `1. Send ${expectedAmountSol} SOL from your wallet to: ${config.solana.receiverAddress}`,
            `2. Copy the transaction signature`,
            `3. Include it in the 'X-Payment-Signature' header`,
            `4. Make your API request again`
          ]
        },
      });
    }

    try {
      // Check for replay attack
      const isUsed = await paymentTracker.isSignatureUsed(signature);
      if (isUsed) {
        await paymentTracker.recordReplayAttempt(signature, req.ip || 'unknown', req.headers['user-agent'] || 'unknown');
        return res.status(409).json({ 
          success: false, 
          error: 'Payment signature already used (replay attack prevented)',
          message: 'Each payment can only be used once. Please make a new payment.'
        });
      }

      // Verify the transaction exists and is valid
      // Use processed commitment for fastest verification (~1s)
      let transaction = null;
      let attempts = 0;
      const maxAttempts = 2; // Reduced retries for faster response
      
      while (!transaction && attempts < maxAttempts) {
        attempts++;
        console.log(`Transaction lookup attempt ${attempts}/${maxAttempts} (confirmed commitment)...`)
        
        // Try with 'confirmed' first for faster confirmation than finalized
        transaction = await connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });
        
        // If not found with 'confirmed', try with 'finalized' as fallback
        if (!transaction) {
          console.log('Transaction not found with confirmed commitment, trying finalized...')
          transaction = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'finalized',
          });
        }
        
        // If still not found, wait briefly and try again
        if (!transaction && attempts < maxAttempts) {
          console.log(`Transaction not found, waiting 1 second before retry ${attempts + 1}...`)
          await new Promise(resolve => setTimeout(resolve, 1000)); // Reduced wait time
        }
      }

      if (!transaction) {
        return res.status(400).json({ 
          success: false, 
          error: 'Transaction not found or not confirmed',
          message: 'Please wait for transaction confirmation or check the signature.'
        });
      }

      if (!transaction.meta || transaction.meta.err) {
        return res.status(400).json({ 
          success: false, 
          error: 'Transaction failed on blockchain',
          message: 'The provided transaction failed. Please make a successful payment.'
        });
      }

      // Simple verification - check if there was a SOL transfer to our receiver
      const receiverPublicKey = new PublicKey(config.solana.receiverAddress);
      const accounts = transaction.transaction.message.getAccountKeys();
      const accountKeys = accounts.staticAccountKeys;
      
      let receiverIndex = -1;
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys[i].equals(receiverPublicKey)) {
          receiverIndex = i;
          break;
        }
      }

      if (receiverIndex === -1) {
        return res.status(400).json({ 
          success: false, 
          error: 'Payment not sent to correct address',
          message: `Payment must be sent to: ${config.solana.receiverAddress}`
        });
      }

      // Check SOL balance change
      const preBalance = transaction.meta.preBalances[receiverIndex] || 0;
      const postBalance = transaction.meta.postBalances[receiverIndex] || 0;
      const solReceived = (postBalance - preBalance) / 1e9; // Convert lamports to SOL

      if (solReceived < expectedAmountSol) {
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient payment amount. Expected ${expectedAmountSol} SOL, received ${solReceived} SOL`,
          message: `Please send at least ${expectedAmountSol} SOL to complete the payment.`
        });
      }

      // Record the successful payment
      await paymentTracker.recordPayment(
        signature, 
        solReceived, 
        'SOL', 
        req.ip || 'unknown', 
        req.headers['user-agent'] || 'unknown', 
        endpointPath
      );

      // Attach payment info to response locals
      res.locals.paymentVerified = true;
      res.locals.paymentType = 'SOL';
      res.locals.paymentAmount = solReceived;
      res.locals.paymentSignature = signature;

      console.log(`Payment verified: ${signature.substring(0, 20)}... | ${solReceived} SOL | ${endpointPath}`);
      next();

    } catch (error: any) {
      console.error('Payment verification error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Payment verification failed', 
        message: 'Internal error verifying payment. Please try again.',
        details: config.nodeEnv === 'development' ? error.message : undefined
      });
    }
  };
}

// Middleware to enrich API response with payment details
export function enrichResponseWithPayment(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  res.json = function (body?: any) {
    if (body && typeof body === 'object' && res.locals.paymentVerified) {
      body.payment_info = {
        verified: true,
        type: res.locals.paymentType,
        amount: res.locals.paymentAmount,
        signature: res.locals.paymentSignature?.substring(0, 20) + '...',
        network: 'solana'
      };
    }
    return originalJson.call(this, body);
  };
  next();
}
