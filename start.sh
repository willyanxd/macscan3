#!/bin/bash

# MAC Scanner Application Startup Script
# This script installs dependencies and starts both backend and frontend services

set -e

echo "🚀 Starting MAC Scanner Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_success "npm $(npm -v) detected"

# Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Create data directory for SQLite database
print_status "Creating data directory..."
mkdir -p data
print_success "Data directory created"

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs
print_success "Logs directory created"

# Function to cleanup background processes
cleanup() {
    print_warning "Shutting down services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_status "Backend service stopped"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_status "Frontend service stopped"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Get network interface IP
get_local_ip() {
    # Try different methods to get local IP
    if command -v ip &> /dev/null; then
        ip route get 1.1.1.1 | grep -oP 'src \K\S+' 2>/dev/null || echo "localhost"
    elif command -v ifconfig &> /dev/null; then
        ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1 || echo "localhost"
    else
        echo "localhost"
    fi
}

LOCAL_IP=$(get_local_ip)
print_status "Detected local IP: $LOCAL_IP"

# Start backend service
print_status "Starting backend service..."
export NODE_ENV=production
export PORT=3001
export HOST=0.0.0.0

# Start backend in background
node backend/server.js > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend is running
if kill -0 $BACKEND_PID 2>/dev/null; then
    print_success "Backend service started (PID: $BACKEND_PID)"
else
    print_error "Failed to start backend service"
    cat logs/backend.log
    exit 1
fi

# Start frontend service
print_status "Starting frontend service..."
export VITE_API_URL="http://$LOCAL_IP:3001/api"
export VITE_WS_URL="ws://$LOCAL_IP:3001"

# Build frontend for production
print_status "Building frontend..."
if npm run build; then
    print_success "Frontend built successfully"
else
    print_error "Failed to build frontend"
    cleanup
    exit 1
fi

# Start frontend preview server
npm run preview -- --host 0.0.0.0 --port 3000 > logs/frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 3

# Check if frontend is running
if kill -0 $FRONTEND_PID 2>/dev/null; then
    print_success "Frontend service started (PID: $FRONTEND_PID)"
else
    print_error "Failed to start frontend service"
    cat logs/frontend.log
    cleanup
    exit 1
fi

# Display startup information
echo ""
echo "🎉 MAC Scanner Application Started Successfully!"
echo ""
echo "📊 Services:"
echo "   Backend API: http://$LOCAL_IP:3001"
echo "   Frontend:    http://$LOCAL_IP:3000"
echo ""
echo "🌐 Access from other machines:"
echo "   Frontend:    http://$LOCAL_IP:3000"
echo "   API:         http://$LOCAL_IP:3001/api"
echo ""
echo "📁 Important directories:"
echo "   Database:    ./data/mac_scanner.db"
echo "   Logs:        ./logs/"
echo ""
echo "🔧 Process IDs:"
echo "   Backend:     $BACKEND_PID"
echo "   Frontend:    $FRONTEND_PID"
echo ""
echo "💡 Tips:"
echo "   - Access the web interface at http://$LOCAL_IP:3000"
echo "   - Check logs in ./logs/ directory if you encounter issues"
echo "   - Press Ctrl+C to stop all services"
echo ""
print_success "Application is ready for use!"

# Keep script running and monitor processes
while true; do
    # Check if backend is still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        print_error "Backend service stopped unexpectedly"
        print_status "Backend log:"
        tail -n 20 logs/backend.log
        cleanup
        exit 1
    fi
    
    # Check if frontend is still running
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        print_error "Frontend service stopped unexpectedly"
        print_status "Frontend log:"
        tail -n 20 logs/frontend.log
        cleanup
        exit 1
    fi
    
    sleep 10
done