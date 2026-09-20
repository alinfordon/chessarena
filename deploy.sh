#!/bin/bash

# ============================================================
# Chess Arena - Deploy
# ============================================================

set -e

APP_DIR="/var/www/chess"
BRANCH="main"

NEXT_APP_NAME="chessarena"
NEXT_PORT=3022

SOCKET_APP_NAME="chessarena-socket"
SOCKET_PORT=3021

DOMAIN="chess.sgdev.ro"

echo "=========================================="
echo " Chess Arena Deploy"
echo "=========================================="

cd "$APP_DIR" || exit 1

echo "[1/9] Fixing permissions..."
sudo chown -R "$USER:$USER" "$APP_DIR"

echo "[2/9] Configuring Git..."
git config --global --add safe.directory "$APP_DIR"

echo "[3/9] Updating repository..."
git fetch --all
git reset --hard "origin/$BRANCH"

echo "[4/9] Installing dependencies..."
rm -rf .next
npm install

echo "[5/9] Building Next.js..."
npm run build

echo "[6/9] Stopping existing processes..."

sudo fuser -k "$NEXT_PORT/tcp" >/dev/null 2>&1 || true
sudo fuser -k "$SOCKET_PORT/tcp" >/dev/null 2>&1 || true

pm2 delete "$NEXT_APP_NAME" >/dev/null 2>&1 || true
pm2 delete "$SOCKET_APP_NAME" >/dev/null 2>&1 || true

echo "[7/9] Starting Next.js..."

PORT=$NEXT_PORT pm2 start npm \
    --name "$NEXT_APP_NAME" \
    -- start

echo "[8/9] Starting Socket.IO..."

if [ -f "server/socket-server.js" ]; then

    SOCKET_PORT=$SOCKET_PORT \
    PORT=$SOCKET_PORT \
    FRONTEND_URL="https://$DOMAIN" \
    NEXT_PUBLIC_APP_URL="https://$DOMAIN" \
    pm2 start server/socket-server.js \
        --name "$SOCKET_APP_NAME"

else

    echo ""
    echo "WARNING:"
    echo "server/socket-server.js does not exist."
    echo "Socket.IO was not started."
    echo ""

fi

echo "[9/9] Saving PM2..."

pm2 save

echo ""
echo "=========================================="
echo " DEPLOY COMPLETED"
echo "=========================================="

echo "Application: $APP_DIR"
echo "Domain:      https://$DOMAIN"
echo "Next.js:     127.0.0.1:$NEXT_PORT"
echo "Socket.IO:   127.0.0.1:$SOCKET_PORT"

echo ""
echo "PM2 status:"
pm2 status

echo "=========================================="