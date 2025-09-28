#!/bin/bash

# MCP Database Setup Script
# This script sets up PostgreSQL database for payment tracking

echo "  Setting up MCP PostgreSQL Database"
echo "======================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo " PostgreSQL is not installed. Please install it first:"
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "   Docker: docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres"
    exit 1
fi

# Default database settings
DB_NAME=${DB_NAME:-"mcp_payments"}
DB_USER=${DB_USER:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

echo " Database Configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Create database if it doesn't exist
echo " Creating database '$DB_NAME'..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null

if [ $? -eq 0 ]; then
    echo " Database '$DB_NAME' created successfully"
else
    echo "ℹ  Database '$DB_NAME' already exists or creation failed"
fi

# Run schema
echo " Setting up database schema..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f src/database/schema.sql

if [ $? -eq 0 ]; then
    echo " Database schema setup completed"
else
    echo " Database schema setup failed"
    exit 1
fi

# Test connection
echo " Testing database connection..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 'Database connection successful!' as status;" > /dev/null

if [ $? -eq 0 ]; then
    echo " Database connection test passed"
else
    echo " Database connection test failed"
    exit 1
fi

echo ""
echo " Database setup completed successfully!"
echo ""
echo " Environment variables for your .env file:"
echo "DB_HOST=$DB_HOST"
echo "DB_PORT=$DB_PORT"
echo "DB_NAME=$DB_NAME"
echo "DB_USER=$DB_USER"
echo "DB_PASSWORD=your_postgres_password"
echo ""
echo " You can now start the MCP server with payment tracking enabled!"
