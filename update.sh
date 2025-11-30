#!/bin/bash
# Update script for Namma Mart Panel
# This script handles updating the application from Git and restarting the server

echo "Starting update process for Namma Mart Panel..."

# Function to get current branch
get_current_branch() {
    git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"
}

# Function to restart server
restart_server() {
    echo "Checking for running server processes..."

    # Find and kill existing node processes running server.js
    NODE_PIDS=$(pgrep -f "node.*server.js" || true)
    if [ ! -z "$NODE_PIDS" ]; then
        echo "Stopping existing server processes: $NODE_PIDS"
        kill $NODE_PIDS 2>/dev/null || true
        sleep 2
    fi

    # Start the server in background
    echo "Starting server..."
    nohup node server.js > server.log 2>&1 &
    SERVER_PID=$!
    echo "Server started with PID: $SERVER_PID"
    echo "Server output will be logged to server.log"
}

# Check if it's a Git repository
if [ -d ".git" ]; then
    echo "Git repository detected. Checking for updates..."

    # Get current branch
    BRANCH=$(get_current_branch)
    echo "Current branch: $BRANCH"

    # Fetch latest changes
    echo "Fetching latest changes..."
    git fetch origin
    if [ $? -ne 0 ]; then
        echo "Error: Failed to fetch from remote repository."
        exit 1
    fi

    # Check if there are updates
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/$BRANCH 2>/dev/null || git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

    if [ "$LOCAL" = "$REMOTE" ]; then
        echo "No updates available. Application is up to date."
        exit 0
    fi

    echo "Updates found. Pulling latest changes..."
    git pull origin $BRANCH
    if [ $? -ne 0 ]; then
        echo "Error: Failed to pull updates from remote repository."
        exit 1
    fi

    echo "Update successful."

    # Check if package.json exists and run npm install
    if [ -f "package.json" ]; then
        echo "Installing/updating dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            echo "Warning: Failed to install dependencies. Please run 'npm install' manually."
        fi
    fi

    # Restart the server
    restart_server

    echo "Update completed successfully!"
    echo "Application has been updated and restarted."

else
    echo "This directory is not a Git repository."
    echo ""
    echo "To enable automatic updates, follow these setup steps:"
    echo ""
    echo "1. Initialize Git repository (if not already done):"
    echo "   git init"
    echo ""
    echo "2. Add your Git repository as remote origin:"
    echo "   git remote add origin https://github.com/noxzplayz/Namma-mart-extensive-manager.git"
    echo ""
    echo "3. Pull the initial code:"
    echo "   git pull origin main"
    echo "   (Use 'master' if your default branch is master)"
    echo ""
    echo "4. Make sure the update.sh script is executable:"
    echo "   chmod +x update.sh"
    echo ""
    echo "5. Test the update process:"
    echo "   ./update.sh"
    echo ""
    echo "Note: The application will automatically restart after updates."
    echo "Make sure no critical operations are running during the update."
fi
