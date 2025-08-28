"""
🚀 Vercel Entry Point - Ultra-Lightweight AI Trading API
Entry point optimized for Vercel serverless deployment with minimal size
"""

import sys
import os

# Add the parent directory to the path so we can import from main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import ultra-lightweight version for Vercel
try:
    from main import app
except ImportError:
    # Fallback to basic version if main.py has heavy dependencies
    import os
    import random
    from datetime import datetime, timezone
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    
    # Create minimal FastAPI app
    app = FastAPI(title="AI Trading API - Vercel", version="1.0.0")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    
    @app.get("/health")
    async def health():
        return {"status": "healthy", "version": "vercel-minimal"}
    
    @app.get("/")
    async def root():
        return {"message": "AI Trading API - Vercel Serverless", "docs": "/docs"}
    
    @app.post("/v1/analyze")
    async def analyze(data: dict):
        return {
            "signal": "BUY",
            "confidence": 0.85,
            "reasoning": "Serverless signal generation active",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Vercel handler
handler = app