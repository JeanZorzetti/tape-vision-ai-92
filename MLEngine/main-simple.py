"""
ML Engine - Simple FastAPI Server
Simplified version for testing the hybrid system
"""
import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="Trading ML Engine",
    description="Machine Learning engine for trading signal generation",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ml-engine",
        "version": "1.0.0"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Trading ML Engine API",
        "docs": "/docs",
        "health": "/health"
    }

@app.post("/api/v1/analyze_market_data")
async def analyze_market_data(data: dict):
    """
    Simplified market analysis endpoint
    Returns a mock signal for testing
    """
    try:
        # Mock analysis response for testing
        return {
            "signal": "BUY",
            "confidence": 0.85,
            "reasoning": "Mock ML analysis - bullish pattern detected",
            "stop_loss": data.get("market_data", {}).get("price", 4580) - 1.5,
            "target": data.get("market_data", {}).get("price", 4580) + 2.0,
            "risk_reward": 1.33,
            "pattern_matched": "mock_pattern",
            "timestamp": "2025-01-01T10:00:00Z",
            "metadata": {
                "mock_mode": True,
                "ml_engine_status": "running"
            }
        }
    except Exception as e:
        logger.error(f"Error in analysis: {e}")
        return {
            "signal": "HOLD",
            "confidence": 0.0,
            "reasoning": f"Error: {str(e)}",
            "stop_loss": 0,
            "target": 0,
            "risk_reward": 0,
            "pattern_matched": "error"
        }

@app.get("/api/v1/model_status")
async def get_model_status():
    """Get model status"""
    return {
        "timestamp": "2025-01-01T10:00:00Z",
        "models": {
            "pattern_detector": "mock_loaded",
            "signal_generator": "mock_loaded",
        },
        "configuration": {
            "confidence_threshold": 0.90,
            "model_version": "mock_v1.0.0",
        },
        "performance": {
            "uptime": "running",
            "requests_processed": 0,
        }
    }

if __name__ == "__main__":
    logger.info("🚀 Starting ML Engine...")
    uvicorn.run(
        "main-simple:app",
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )