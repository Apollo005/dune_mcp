import { getDBConnection } from '../database/connection';
import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';

export interface PaymentRecord {
  id?: number;
  signature: string;
  network: string;
  amount: bigint;
  asset: string;
  senderAddress: string;
  receiverAddress: string;
  apiEndpoint: string;
  blockTime?: Date;
  firstUsedAt: Date;
  usageCount: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface PaymentValidationResult {
  isValid: boolean;
  isFirstUse: boolean;
  error?: string;
  paymentRecord?: PaymentRecord;
}

export class PaymentTracker {
  private solanaConnection: Connection;

  constructor() {
    this.solanaConnection = new Connection(config.solana.rpcUrl);
  }

  /**
   * Validate a payment signature and check if it's been used before
   */
  async validatePayment(
    signature: string,
    expectedAmount: bigint,
    expectedAsset: string,
    apiEndpoint: string,
    clientIP?: string,
    userAgent?: string
  ): Promise<PaymentValidationResult> {
    try {
      // Step 1: Check if signature has been used before
      const existingRecord = await this.getPaymentRecord(signature);
      
      if (existingRecord) {
        // Signature already used - increment usage count for monitoring
        await this.incrementUsageCount(signature);
        
        return {
          isValid: false,
          isFirstUse: false,
          error: 'Payment signature already used (replay attack prevented)',
          paymentRecord: existingRecord
        };
      }

      // Step 2: Validate transaction on blockchain
      const transactionInfo = await this.validateOnBlockchain(signature);
      
      if (!transactionInfo.isValid) {
        return {
          isValid: false,
          isFirstUse: true,
          error: transactionInfo.error
        };
      }

      // Step 3: Verify payment details match requirements
      const verification = this.verifyPaymentDetails(
        transactionInfo,
        expectedAmount,
        expectedAsset
      );

      if (!verification.isValid) {
        return {
          isValid: false,
          isFirstUse: true,
          error: verification.error
        };
      }

      // Step 4: Record the payment as used
      const paymentRecord = await this.recordPayment({
        signature,
        network: 'solana',
        amount: transactionInfo.amount || 0n,
        asset: transactionInfo.asset || 'SOL',
        senderAddress: transactionInfo.senderAddress || '',
        receiverAddress: transactionInfo.receiverAddress || '',
        apiEndpoint,
        blockTime: transactionInfo.blockTime,
        firstUsedAt: new Date(),
        usageCount: 1,
        ipAddress: clientIP,
        userAgent
      });

      return {
        isValid: true,
        isFirstUse: true,
        paymentRecord
      };

    } catch (error: any) {
      console.error('Payment validation error:', error);
      return {
        isValid: false,
        isFirstUse: false,
        error: `Payment validation failed: ${error.message}`
      };
    }
  }

  /**
   * Check if a payment signature exists in database
   */
  private async getPaymentRecord(signature: string): Promise<PaymentRecord | null> {
    const pool = getDBConnection();
    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT * FROM payment_signatures WHERE signature = $1',
        [signature]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        signature: row.signature,
        network: row.network,
        amount: BigInt(row.amount),
        asset: row.asset,
        senderAddress: row.sender_address,
        receiverAddress: row.receiver_address,
        apiEndpoint: row.api_endpoint,
        blockTime: row.block_time,
        firstUsedAt: row.first_used_at,
        usageCount: row.usage_count,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      };
    } finally {
      client.release();
    }
  }

  /**
   * Validate transaction exists and is confirmed on Solana blockchain
   */
  private async validateOnBlockchain(signature: string): Promise<{
    isValid: boolean;
    error?: string;
    amount?: bigint;
    asset?: string;
    senderAddress?: string;
    receiverAddress?: string;
    blockTime?: Date;
  }> {
    try {
      const txInfo = await this.solanaConnection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!txInfo) {
        return {
          isValid: false,
          error: 'Transaction not found on blockchain'
        };
      }

      if (!txInfo.meta || txInfo.meta.err) {
        return {
          isValid: false,
          error: 'Transaction failed on blockchain'
        };
      }

      // Extract payment details from transaction
      const accounts = txInfo.transaction.message.getAccountKeys().keySegments.flat().map((key: any) => key.toString());
      const preBalances = txInfo.meta.preBalances;
      const postBalances = txInfo.meta.postBalances;

      // Find the receiver in the accounts
      const receiverIndex = accounts.indexOf(config.solana.receiverAddress);
      if (receiverIndex === -1) {
        return {
          isValid: false,
          error: 'Payment not sent to expected receiver address'
        };
      }

      // Calculate the amount transferred to receiver
      const balanceChange = postBalances[receiverIndex] - preBalances[receiverIndex];
      if (balanceChange <= 0) {
        return {
          isValid: false,
          error: 'No positive balance change detected for receiver'
        };
      }

      // Find sender (account with negative balance change)
      let senderAddress = '';
      for (let i = 0; i < accounts.length; i++) {
        const change = postBalances[i] - preBalances[i];
        if (change < 0 && accounts[i] !== config.solana.receiverAddress) {
          senderAddress = accounts[i];
          break;
        }
      }

      return {
        isValid: true,
        amount: BigInt(balanceChange),
        asset: 'native', // SOL
        senderAddress,
        receiverAddress: config.solana.receiverAddress,
        blockTime: txInfo.blockTime ? new Date(txInfo.blockTime * 1000) : undefined
      };

    } catch (error: any) {
      return {
        isValid: false,
        error: `Blockchain validation failed: ${error.message}`
      };
    }
  }

  /**
   * Verify payment amount and asset match requirements
   */
  private verifyPaymentDetails(
    transactionInfo: any,
    expectedAmount: bigint,
    expectedAsset: string
  ): { isValid: boolean; error?: string } {
    
    if (transactionInfo.asset !== expectedAsset) {
      return {
        isValid: false,
        error: `Wrong asset type. Expected: ${expectedAsset}, Got: ${transactionInfo.asset}`
      };
    }

    if (transactionInfo.amount < expectedAmount) {
      return {
        isValid: false,
        error: `Insufficient payment amount. Expected: ${expectedAmount}, Got: ${transactionInfo.amount}`
      };
    }

    return { isValid: true };
  }

  /**
   * Record a validated payment in the database
   */
  private async recordPayment(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    const pool = getDBConnection();
    const client = await pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO payment_signatures (
          signature, network, amount, asset, sender_address, receiver_address,
          api_endpoint, block_time, first_used_at, usage_count, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        paymentRecord.signature,
        paymentRecord.network,
        paymentRecord.amount.toString(),
        paymentRecord.asset,
        paymentRecord.senderAddress,
        paymentRecord.receiverAddress,
        paymentRecord.apiEndpoint,
        paymentRecord.blockTime,
        paymentRecord.firstUsedAt,
        paymentRecord.usageCount,
        paymentRecord.ipAddress,
        paymentRecord.userAgent
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        signature: row.signature,
        network: row.network,
        amount: BigInt(row.amount),
        asset: row.asset,
        senderAddress: row.sender_address,
        receiverAddress: row.receiver_address,
        apiEndpoint: row.api_endpoint,
        blockTime: row.block_time,
        firstUsedAt: row.first_used_at,
        usageCount: row.usage_count,
        ipAddress: row.ip_address,
        userAgent: row.user_agent
      };
    } finally {
      client.release();
    }
  }

  /**
   * Increment usage count for monitoring replay attempts
   */
  private async incrementUsageCount(signature: string): Promise<void> {
    const pool = getDBConnection();
    const client = await pool.connect();

    try {
      await client.query(
        'UPDATE payment_signatures SET usage_count = usage_count + 1 WHERE signature = $1',
        [signature]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPayments: number;
    totalRevenue: bigint;
    replayAttempts: number;
    last24Hours: number;
  }> {
    const pool = getDBConnection();
    const client = await pool.connect();

    try {
      const [totalResult, replayResult, recentResult] = await Promise.all([
        client.query('SELECT COUNT(*) as count, SUM(amount::bigint) as revenue FROM payment_signatures'),
        client.query('SELECT COUNT(*) as count FROM payment_signatures WHERE usage_count > 1'),
        client.query('SELECT COUNT(*) as count FROM payment_signatures WHERE created_at > NOW() - INTERVAL \'24 hours\'')
      ]);

      return {
        totalPayments: parseInt(totalResult.rows[0].count),
        totalRevenue: BigInt(totalResult.rows[0].revenue || 0),
        replayAttempts: parseInt(replayResult.rows[0].count),
        last24Hours: parseInt(recentResult.rows[0].count)
      };
    } finally {
      client.release();
    }
  }
}
