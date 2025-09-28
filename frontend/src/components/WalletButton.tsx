import React, { useState, useRef, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export const WalletButton: React.FC = () => {
  const { connected, publicKey, disconnect, balance } = useWallet()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="flex items-center gap-3">
      {connected && publicKey ? (
        <div className="flex items-center gap-3">
          {/* SOL Balance */}
          {balance !== null && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm font-medium text-blue-800">
                {balance.toFixed(6)} SOL
              </span>
            </div>
          )}
          
          {/* Wallet Address with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium text-green-800">
                {formatAddress(publicKey)}
              </span>
              <span className="text-green-600">▼</span>
            </button>
            
            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    disconnect()
                    setShowDropdown(false)
                  }}
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <WalletMultiButton className="btn-solana flex items-center gap-2">
          Connect Wallet
        </WalletMultiButton>
      )}
    </div>
  )
}
