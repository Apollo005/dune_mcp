import { Request, Response, NextFunction } from 'express';
import { PaymentTracker } from '../services/paymentTracker';
import { config } from '../config';

interface PaymentRequest extends Request {
  payment?: {
    signature: string;
    network: string;
    amount: string;
    isVerified: boolean;
  };
}

const paymentTracker = new PaymentTracker();

/**
 * Middleware to validate payment signatures and prevent replay attacks
 */
export function validatePaymentMiddleware(requiredAmountSOL: number, endpoint: string) {
  return async (req: PaymentRequest, res: Response, next: NextFunction) => {
    try {
      // In development mode, skip payment validation
      if (config.nodeEnv === 'development') {
        console.log('Development mode: Skipping payment verification');
        req.payment = {
          signature: 'dev-mode',
          network: 'solana',
          amount: '0',
          isVerified: true
        };
        return next();
      }

      // Extract payment details from headers
      const signature = req.headers['x-payment-signature'] as string;
      const network = req.headers['x-payment-network'] as string;
      const amount = req.headers['x-payment-amount'] as string;
      
      // Get client details for tracking
      const clientIP = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      if (!signature || !network || !amount) {
        return res.status(402).json({
          success: false,
          error: 'Payment Required',
          code: 402,
          message: 'Missing payment headers',
          required_headers: {
            'X-Payment-Signature': 'Transaction signature from wallet',
            'X-Payment-Network': 'solana',
            'X-Payment-Amount': 'Amount in lamports'
          },
          payment_details: {
            amount_sol: requiredAmountSOL,
            amount_lamports: requiredAmountSOL * 1e9,
            receiver_address: config.solana.receiverAddress,
            network: 'solana'
          }
        });
      }

      // Validate the payment
      const expectedAmount = BigInt(Math.floor(requiredAmountSOL * 1e9)); // Convert SOL to lamports
      const validationResult = await paymentTracker.validatePayment(
        signature,
        expectedAmount,
        'native', // SOL
        endpoint,
        clientIP,
        userAgent
      );

      if (!validationResult.isValid) {
        const statusCode = validationResult.isFirstUse ? 400 : 409; // 409 for replay attacks
        
        return res.status(statusCode).json({
          success: false,
          error: validationResult.error,
          code: statusCode,
          is_replay_attack: !validationResult.isFirstUse,
          payment_details: validationResult.paymentRecord ? {
            first_used_at: validationResult.paymentRecord.firstUsedAt,
            usage_count: validationResult.paymentRecord.usageCount,
            original_endpoint: validationResult.paymentRecord.apiEndpoint
          } : undefined
        });
      }

      // Payment is valid and first-time use
      req.payment = {
        signature,
        network,
        amount,
        isVerified: true
      };

      console.log(`Payment verified: ${signature.substring(0, 20)}... for ${endpoint}`);
      next();

    } catch (error: any) {
      console.error('Payment validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Payment validation failed',
        message: error.message
      });
    }
  };
}

/**
 * Middleware for endpoints that require USDC payment
 */
export function validateUSDCPayment(requiredAmountUSDC: number, endpoint: string) {
  return async (req: PaymentRequest, res: Response, next: NextFunction) => {
    // For now, redirect to SOL payment (USDC implementation would be similar)
    const solEquivalent = requiredAmountUSDC * 0.01; // Rough conversion for demo
    return validatePaymentMiddleware(solEquivalent, endpoint)(req, res, next);
  };
}

/**
 * Express middleware to add payment info to response
 */
export function enrichResponseWithPayment(req: PaymentRequest, res: Response, next: NextFunction) {
  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json method to add payment info
  res.json = function(data: any) {
    if (req.payment && data && typeof data === 'object' && data.data) {
      data.data.payment_verified = req.payment.isVerified;
      if (req.payment.signature !== 'dev-mode') {
        data.data.payment_signature = req.payment.signature;
        data.data.payment_network = req.payment.network;
      }
    }
    return originalJson(data);
  };
  
  next();
}
