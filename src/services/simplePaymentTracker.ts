import { getDBConnection } from '../database/connection';

export class SimplePaymentTracker {
  async isSignatureUsed(signature: string): Promise<boolean> {
    try {
      const pool = getDBConnection();
      const res = await pool.query(
        'SELECT id FROM payment_signatures WHERE signature = $1',
        [signature]
      );
      return res.rows.length > 0;
    } catch (error) {
      console.error('Error checking signature:', error);
      return false; // Allow in case of DB issues
    }
  }

  async recordPayment(
    signature: string,
    amount: number,
    currency: string,
    ipAddress: string,
    userAgent: string,
    endpointPath: string
  ): Promise<void> {
    try {
      const pool = getDBConnection();
      await pool.query(
        'INSERT INTO payment_signatures (signature, network, amount, asset, sender_address, receiver_address, api_endpoint, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [signature, 'solana', Math.floor(amount * 1e9), currency, 'HKc1p8QY1XquJXEkQ5Qep9CqU3nnpTa7A9YA32jTfWA5', 'FwJ3yH7AxZjxveFmbK74ZdLp6EaaLLoRffhiKVP3VX98', endpointPath, ipAddress, userAgent]
      );
      console.log(`Payment recorded: ${signature.substring(0, 20)}... | ${amount} ${currency} | ${endpointPath}`);
    } catch (error) {
      console.error('Error recording payment:', error);
      // Don't throw - let the request proceed even if DB recording fails
    }
  }

  async recordReplayAttempt(
    signature: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const pool = getDBConnection();
      await pool.query(
        'UPDATE payment_signatures SET usage_count = usage_count + 1 WHERE signature = $1',
        [signature]
      );
      console.log(`Replay attempt blocked: ${signature.substring(0, 20)}... from ${ipAddress}`);
    } catch (error) {
      console.error('Error recording replay attempt:', error);
    }
  }
}
