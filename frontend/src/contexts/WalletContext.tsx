import React, { createContext, useContext } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider, useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

interface WalletContextType {
  connected: boolean
  publicKey: string | null
  balance: number | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  signTransaction: (transaction: any) => Promise<any>
  signAllTransactions: (transactions: any[]) => Promise<any[]>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const useWallet = () => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

const WalletContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { connected, publicKey, connect, disconnect, signTransaction, signAllTransactions } = useSolanaWallet()
  const { connection } = useConnection()
  const [balance, setBalance] = React.useState<number | null>(null)

  // Fetch balance when wallet connects - but only once to avoid rate limits
  React.useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey && connection) {
        try {
          console.log('Fetching balance using wallet adapter connection...')
          const balance = await connection.getBalance(publicKey)
          const balanceSOL = balance / 1e9
          console.log('Wallet balance:', balanceSOL, 'SOL')
          setBalance(balanceSOL)
        } catch (error) {
          console.error('Failed to fetch balance:', error)
          setBalance(null) // Don't set to 0, just null if fetch fails
        }
      } else {
        setBalance(null)
      }
    }

    fetchBalance()
  }, [connected, publicKey, connection])

  return (
    <WalletContext.Provider
      value={{
        connected,
        publicKey: publicKey?.toString() || null,
        balance,
        connect: connect || (() => Promise.resolve()),
        disconnect: disconnect || (() => Promise.resolve()),
        signTransaction: signTransaction || ((tx: any) => Promise.resolve(tx)),
        signAllTransactions: signAllTransactions || ((txs: any[]) => Promise.resolve(txs)),
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Configure the network - use Mainnet consistently
  const network = WalletAdapterNetwork.Mainnet
  // Use server RPC proxy instead of public RPC to avoid 403 errors
  const endpoint = 'http://localhost:3000/api/rpc'

  // Configure wallets
  const wallets = [new PhantomWalletAdapter()]

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
