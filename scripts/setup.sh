#!/bin/bash

# MCP Dune Solana API Setup Script
echo "Setting up MCP Dune Solana API..."

# Check Node.js version
echo "Checking Node.js version..."
node_version=$(node -v | cut -d'v' -f2)
required_version="18.0.0"

if [ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]; then
    echo "Node.js version $node_version is compatible"
else
    echo "Node.js version $node_version is not compatible. Please install Node.js 18 or higher."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp env.example .env
    echo "Please edit .env file with your configuration before starting the server"
else
    echo ".env file already exists"
fi

# Build the project
echo "Building TypeScript..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "Build successful"
else
    echo "Build failed"
    exit 1
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your Dune API key and Solana wallet address"
echo "2. Run 'npm start' to start the production server"
echo "3. Or run 'npm run dev' for development mode"
echo ""
echo "API will be available at: http://localhost:3000"
echo "API documentation: http://localhost:3000/api/info"
echo ""
echo "Required environment variables:"
echo "- DUNE_API_KEY: Your Dune Analytics API key"
echo "- SOLANA_WALLET_ADDRESS: Your Solana wallet address for receiving payments"
echo ""
echo "Optional environment variables:"
echo "- PAYMENT_AMOUNT_USDC: Payment amount per query (default: 0.01)"
echo "- PORT: Server port (default: 3000)"
echo ""
