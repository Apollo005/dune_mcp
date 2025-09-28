import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from './components/WalletButton'
import { SqlEditor } from './components/SqlEditor'
import { DataTable } from './components/DataTable'
import { PaymentModal } from './components/PaymentModal'
import { apiService, QueryResponse } from './services/api'

const PAYMENT_AMOUNT = 0.0001
const RECEIVER_ADDRESS = 'FwJ3yH7AxZjxveFmbK74ZdLp6EaaLLoRffhiKVP3VX98'

export default function App() {
  const { connected, publicKey } = useSolanaWallet()
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingSql, setPendingSql] = useState<string>('')

  const handleExecuteQuery = async (sql: string) => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first')
      return
    }

    console.log('Executing query:', sql)
    console.log('Wallet connected:', connected, 'Public key:', publicKey)

    setLoading(true)
    setQueryResult(null)

    try {
      // First try without payment (in case it's a free query)
      const response = await apiService.executeQuery(sql)
      
      if (response.success) {
        setQueryResult(response)
        toast.success('Query executed successfully!')
      }
    } catch (error: any) {
      console.log('Query error:', error.message)
      if (error.message === 'PAYMENT_REQUIRED') {
        // Payment required - show payment modal
        console.log('Payment required, showing modal')
        setPendingSql(sql)
        setShowPaymentModal(true)
        toast('Payment required to execute query')
      } else {
        toast.error(error.message || 'Failed to execute query')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = async (signature: string) => {
    if (!pendingSql) return

    setLoading(true)
    try {
      const response = await apiService.executeQuery(pendingSql, signature)
      setQueryResult(response)
      toast.success('Query executed successfully after payment!')
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute query after payment')
    } finally {
      setLoading(false)
      setPendingSql('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">DB</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dune MCP v1.0</h1>
                <p className="text-sm text-gray-500">Solana</p>
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Connection Status */}
        {!connected && (
          <div className="mb-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-yellow-600">⚠️</div>
                <div>
                  <p className="text-sm text-yellow-800">
                    Connect your Phantom wallet to execute queries and make payments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SQL Editor */}
          <div>
            <SqlEditor
              onExecute={handleExecuteQuery}
              loading={loading}
            />
          </div>

          {/* Query Results */}
          <div>
            <DataTable
              data={queryResult?.data?.result?.rows || []}
              metadata={queryResult?.data?.result?.metadata}
              loading={loading}
            />
          </div>
        </div>

        {/* Payment Info */}
        {queryResult?.payment && (
          <div className="mt-8">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Transaction Signature</p>
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {queryResult.payment.signature}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className="font-semibold text-gray-900">{queryResult.payment.amount} SOL</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {queryResult.payment.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentSuccess={handlePaymentSuccess}
        amount={PAYMENT_AMOUNT}
        receiverAddress={RECEIVER_ADDRESS}
      />
    </div>
  )
}