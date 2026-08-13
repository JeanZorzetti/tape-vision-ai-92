#!/bin/bash

# 🚀 AI Trading API - Production Deployment Script
# This script provides multiple deployment options for the ML Engine API

set -e

echo "🚀 AI Trading API - Production Deployment"
echo "=========================================="
echo ""

# Check if we're in the MLEngine directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Please run this script from the MLEngine directory"
    exit 1
fi

echo "🔍 Available deployment options:"
echo "1. Railway (Recommended - Free tier available)"
echo "2. Render (Free tier available)"
echo "3. Fly.io (Free tier available)"
echo "4. Docker Compose (Local/VPS)"
echo ""

read -p "Choose deployment option (1-4): " choice

case $choice in
    1)
        echo "🚄 Deploying to Railway..."
        echo ""
        echo "📋 Manual steps required:"
        echo "1. Go to https://railway.app"
        echo "2. Login with GitHub"
        echo "3. Create new project from GitHub repo"
        echo "4. Select this repository"
        echo "5. Set root directory to: MLEngine"
        echo "6. Railway will auto-detect Dockerfile.prod"
        echo "7. Add custom domain: apitapevision.roilabs.com.br"
        echo ""
        echo "✅ Configuration files ready:"
        echo "   - railway.json (Railway configuration)"
        echo "   - Dockerfile.prod (Production Docker image)"
        echo ""
        echo "🔗 After deployment, your API will be available at:"
        echo "   https://apitapevision.roilabs.com.br/v1/docs"
        ;;
    2)
        echo "🎨 Deploying to Render..."
        echo ""
        echo "📋 Manual steps required:"
        echo "1. Go to https://render.com"
        echo "2. Login with GitHub"
        echo "3. Create new Web Service"
        echo "4. Connect this GitHub repository"
        echo "5. Set root directory to: MLEngine"
        echo "6. Render will use render.yaml configuration"
        echo "7. Custom domain will be auto-configured"
        echo ""
        echo "✅ Configuration files ready:"
        echo "   - render.yaml (Render configuration)"
        echo "   - Dockerfile.prod (Production Docker image)"
        echo ""
        echo "🔗 After deployment, your API will be available at:"
        echo "   https://apitapevision.roilabs.com.br/v1/docs"
        ;;
    3)
        echo "✈️ Deploying to Fly.io..."
        echo ""
        if ! command -v flyctl &> /dev/null; then
            echo "📦 Installing Fly CLI..."
            curl -L https://fly.io/install.sh | sh
            export FLYCTL_INSTALL="/home/$USER/.fly"
            export PATH="$FLYCTL_INSTALL/bin:$PATH"
        fi
        
        echo "🔑 Please login to Fly.io..."
        flyctl auth login
        
        echo "🚀 Launching application..."
        flyctl launch --dockerfile Dockerfile.prod --no-deploy
        
        echo "🔧 Setting environment variables..."
        flyctl secrets set ENVIRONMENT=production CONFIDENCE_THRESHOLD=0.90
        
        echo "🚀 Deploying..."
        flyctl deploy
        
        echo "✅ Deployment complete!"
        echo "🔗 Your API is available at: https://ai-trading-api.fly.dev/v1/docs"
        ;;
    4)
        echo "🐳 Starting with Docker Compose..."
        
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ Docker Compose not found. Please install Docker first."
            exit 1
        fi
        
        echo "🚀 Building and starting services..."
        docker-compose -f docker-compose.prod.yml up -d --build
        
        echo "✅ Services started!"
        echo "🔗 API available at: http://localhost:8001/v1/docs"
        echo "🏥 Health check: http://localhost:8001/health"
        
        echo ""
        echo "📊 To check status:"
        echo "   docker-compose -f docker-compose.prod.yml ps"
        echo ""
        echo "📜 To view logs:"
        echo "   docker-compose -f docker-compose.prod.yml logs -f"
        ;;
    *)
        echo "❌ Invalid option. Please choose 1-4."
        exit 1
        ;;
esac

echo ""
echo "🎯 Next steps for custom domain (apitapevision.roilabs.com.br):"
echo "1. Configure DNS A record pointing to your server IP"
echo "2. Set up SSL certificate (Let's Encrypt or Cloudflare)"
echo "3. Update nginx.conf with your SSL certificates"
echo ""
echo "📚 For detailed instructions, see DEPLOY.md"
echo ""
echo "✅ Deployment script completed!"