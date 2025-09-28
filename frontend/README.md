# MCP Dashboard

A professional frontend dashboard for testing the Monetized Content Provider (MCP) API with Solana payments.

## Features

- 🔗 **Wallet Integration**: Connect with Phantom wallet
- 💰 **Payment Flow**: Secure Solana transaction signing
- 📝 **SQL Editor**: Syntax-highlighted query editor with examples
- 📊 **Data Visualization**: Professional data table with export capabilities
- 🎨 **Modern UI**: Clean, responsive design with Tailwind CSS
- ⚡ **Real-time**: Live query execution and results

## Quick Start

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Dashboard**
   - Navigate to `http://localhost:3000`
   - Connect your Phantom wallet
   - Start querying!

## Usage

1. **Connect Wallet**: Click "Connect Wallet" and approve in Phantom
2. **Write Query**: Use the SQL editor with syntax highlighting
3. **Execute**: Click "Execute Query" or press Ctrl/Cmd + Enter
4. **Pay**: If payment required, sign the transaction in your wallet
5. **View Results**: See data in the professional table with export options

## Example Queries

- `SELECT * FROM cex_evms.addresses LIMIT 10`
- `SELECT * FROM solana.blocks TABLESAMPLE SYSTEM (100) LIMIT 10`
- `SELECT issuer, address, ticker FROM dune.hildobby.dataset_bitcoin_etf_addresses LIMIT 10`

## Payment

- **Amount**: 0.0001 SOL per query
- **Network**: Solana Devnet
- **Security**: Replay protection via PostgreSQL

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Solana Web3.js** for blockchain integration
- **Phantom Wallet** for payments
- **Axios** for API calls

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## API Integration

The dashboard connects to your MCP API server running on `http://localhost:3333`. Make sure your backend server is running before using the dashboard.