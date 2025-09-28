import React, { useState, useEffect } from 'react'
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onPaymentSuccess: (signature: string) => void
  amount: number
  receiverAddress: string
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  onPaymentSuccess,
  amount,
  receiverAddress
}) => {
  const { publicKey, sendTransaction } = useSolanaWallet()
  const { connection } = useConnection()
  const [step, setStep] = useState<'confirm' | 'signing' | 'success' | 'error'>('confirm')
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      setStep('confirm')
      setError(null)
      setSignature(null)
      setBalance(null)
      // Fetch balance when modal opens
      if (publicKey) {
        fetchBalance()
      }
    }
  }, [isOpen, publicKey])

  const fetchBalance = async () => {
    if (!publicKey || !connection) return
    try {
      console.log('PaymentModal: Fetching balance using wallet connection...')
      const balance = await connection.getBalance(publicKey)
      const balanceSOL = balance / LAMPORTS_PER_SOL
      console.log('PaymentModal: Wallet balance:', balanceSOL, 'SOL')
      setBalance(balanceSOL)
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      setBalance(null) // Don't set to 0, just null if fetch fails
    }
  }

  const handlePayment = async () => {
    if (!publicKey || !sendTransaction) {
      setError('Wallet not connected')
      return
    }

    setStep('signing')
    setError(null)

    try {
      console.log('Creating payment transaction...')
      console.log('From:', publicKey.toString())
      console.log('To:', receiverAddress)
      console.log('Amount:', amount, 'SOL')

      // Simple transfer - no rent exemption needed for basic transfers
      const transferAmount = amount // Just the payment amount
      
      console.log('Transfer amount:', transferAmount, 'SOL')
      console.log('Creating transfer transaction...')

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(receiverAddress),
        lamports: Math.floor(transferAmount * LAMPORTS_PER_SOL),
      })

      // Create transaction
      const transaction = new Transaction().add(transferInstruction)

      console.log('Transaction created, sending...')
      console.log('Transaction details:', {
        from: publicKey.toString(),
        to: receiverAddress,
        amount: transferAmount,
        lamports: Math.floor(transferAmount * LAMPORTS_PER_SOL)
      })

      // Use wallet adapter's sendTransaction
      const signature = await sendTransaction(transaction, connection)
      console.log('Transaction sent successfully, signature:', signature)

      setSignature(signature)
      setStep('success')
      
      // Proceed immediately after sending transaction - backend will verify
      console.log('Transaction sent, proceeding with query execution...')
      onPaymentSuccess(signature)
      onClose()

    } catch (err: any) {
      console.error('Payment error:', err)
      let errorMessage = err.message || 'Payment failed'
      
      // Provide more specific error messages
      if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance. Please get more SOL from the faucet.'
      } else if (errorMessage.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled by user.'
      } else if (errorMessage.includes('Transaction simulation failed')) {
        errorMessage = 'Transaction simulation failed. Please check your balance and try again.'
      }
      
      setError(errorMessage)
      setStep('error')
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <span className="text-primary-600 font-bold text-sm">$</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Payment Required</h3>
              <p className="text-sm text-gray-500">Complete payment to execute query</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Amount</span>
                  <span className="font-semibold text-gray-900">{amount} SOL</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">From</span>
                  <span className="font-mono text-sm text-gray-900">
                    {publicKey ? formatAddress(publicKey.toString()) : 'Not connected'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Your Balance</span>
                  <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-gray-900">
                          {balance !== null ? `${balance.toFixed(6)} SOL` : 'Unknown'}
                        </span>
                    <button
                      onClick={fetchBalance}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">To</span>
                  <span className="font-mono text-sm text-gray-900">
                    {formatAddress(receiverAddress)}
                  </span>
                </div>
              </div>

              {balance !== null && balance < (amount + 0.001) && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-red-600 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm text-red-800 font-medium">
                        Insufficient Balance!
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        You have {balance.toFixed(6)} SOL but need {(amount + 0.001).toFixed(6)} SOL 
                        ({amount} SOL + 0.001 SOL for fees). 
                        <a 
                          href="https://faucet.solana.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline ml-1"
                        >
                          Get free SOL from the faucet
                        </a>
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        💡 Make sure your Phantom wallet is set to <strong>Devnet</strong> (not Mainnet)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {balance !== null && balance === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-yellow-600 mt-0.5"></span>
                    <div>
                      <p className="text-sm text-yellow-800 font-medium">
                        No Devnet SOL Found
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your wallet has 0 SOL on Devnet. 
                        <a 
                          href="https://faucet.solana.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline ml-1"
                        >
                          Get free test SOL here
                        </a>
                      </p>
                      <p className="text-xs text-yellow-600 mt-2">
                        💡 Make sure to select <strong>Devnet</strong> on the faucet page
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 mt-0.5">ℹ️</span>
                  <div>
                    <p className="text-sm text-blue-800">
                      This payment is required to access the MCP API. The transaction will be verified on-chain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayment}
                  disabled={!publicKey || (balance !== null && balance < (amount + 0.001))}
                  className="flex-1 btn-primary"
                >
                  {balance !== null && balance < (amount + 0.001) ? 'Insufficient Balance' : `Pay ${amount} SOL`}
                </button>
              </div>
            </div>
          )}

          {step === 'signing' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment</h4>
              <p className="text-gray-500">Please sign the transaction in your wallet...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-2xl">✓</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Sent!</h4>
              <p className="text-gray-500 mb-4">Transaction sent to Solana network</p>
              {signature && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">Transaction Signature:</p>
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {signature}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-2xl">✗</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h4>
              <p className="text-gray-500 mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 btn-primary"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
