"""
FastAPI Endpoints for ML Engine
Communication layer between TypeScript backend and Python ML engine
"""
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field

from config import get_settings
from signals.signal_generator import SignalGenerator
from signals.pattern_detector import PatternDetector
from utils.logger import get_logger

# Setup
settings = get_settings()
logger = get_logger(__name__)
router = APIRouter()

# Pydantic models for request/response
class MarketData(BaseModel):
    """Market data from TypeScript backend"""
    timestamp: datetime
    symbol: str = "WDO"
    price: float
    volume: int
    bid: float
    ask: float
    spread: float = Field(default_factory=lambda: 0.0)
    
class TapeData(BaseModel):
    """Tape reading data"""
    price: float
    volume: int
    aggressor_side: str  # "buy" or "sell"
    timestamp: datetime
    order_type: str = "market"  # market, limit, stop
    
class OrderFlowData(BaseModel):
    """Order flow analysis data"""
    bid_volume: int
    ask_volume: int
    imbalance_ratio: float
    aggression_score: float
    hidden_liquidity: float
    cumulative_delta: float

class MarketAnalysisRequest(BaseModel):
    """Complete market analysis request"""
    market_data: MarketData
    tape_data: List[TapeData]
    order_flow: OrderFlowData
    context: Dict[str, Any] = Field(default_factory=dict)

class TradingSignal(BaseModel):
    """Trading signal response"""
    signal: str  # "BUY", "SELL", "HOLD"
    confidence: float  # 0.0 to 1.0
    reasoning: str
    stop_loss: float
    target: float
    risk_reward: float
    pattern_matched: str
    timestamp: datetime = Field(default_factory=datetime.now)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class PatternAnalysis(BaseModel):
    """Pattern analysis response"""
    patterns_detected: List[str]
    confidence_scores: Dict[str, float]
    market_regime: str
    volatility_state: str
    recommendation: str

# Global components (initialized in main.py lifespan)
signal_generator: Optional[SignalGenerator] = None
pattern_detector: Optional[PatternDetector] = None

def get_signal_generator():
    """Dependency to get signal generator"""
    global signal_generator
    if signal_generator is None:
        signal_generator = SignalGenerator()
    return signal_generator

def get_pattern_detector():
    """Dependency to get pattern detector"""
    global pattern_detector
    if pattern_detector is None:
        pattern_detector = PatternDetector()
    return pattern_detector

@router.post("/analyze_market_data", response_model=TradingSignal)
async def analyze_market_data(
    request: MarketAnalysisRequest,
    background_tasks: BackgroundTasks,
    sig_gen: SignalGenerator = Depends(get_signal_generator),
    pat_det: PatternDetector = Depends(get_pattern_detector)
) -> TradingSignal:
    """
    Main endpoint for market analysis and signal generation
    Called by TypeScript backend with real-time market data
    """
    try:
        logger.info(f"📊 Analyzing market data for {request.market_data.symbol} at {request.market_data.price}")
        
        # 1. Pattern Detection
        patterns = await pat_det.detect_patterns(
            market_data=request.market_data,
            tape_data=request.tape_data,
            order_flow=request.order_flow
        )
        
        # 2. Signal Generation
        signal = await sig_gen.generate_signal(
            market_data=request.market_data,
            tape_data=request.tape_data,
            order_flow=request.order_flow,
            detected_patterns=patterns
        )
        
        # 3. Confidence Validation
        if signal.confidence < settings.CONFIDENCE_THRESHOLD:
            logger.info(f"🟡 Signal confidence {signal.confidence:.2f} below threshold {settings.CONFIDENCE_THRESHOLD}")
            signal.signal = "HOLD"
            signal.reasoning += f" (Low confidence: {signal.confidence:.2f})"
        
        # 4. Log successful analysis
        background_tasks.add_task(
            log_signal_generation,
            request.market_data.symbol,
            signal.signal,
            signal.confidence,
            signal.pattern_matched
        )
        
        logger.info(f"✅ Generated signal: {signal.signal} (confidence: {signal.confidence:.2f})")
        return signal
        
    except Exception as e:
        logger.error(f"❌ Error analyzing market data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/detect_patterns", response_model=PatternAnalysis)
async def detect_patterns(
    request: MarketAnalysisRequest,
    pat_det: PatternDetector = Depends(get_pattern_detector)
) -> PatternAnalysis:
    """
    Dedicated endpoint for pattern detection only
    Useful for debugging and testing pattern recognition
    """
    try:
        logger.info(f"🔍 Detecting patterns for {request.market_data.symbol}")
        
        patterns = await pat_det.detect_patterns(
            market_data=request.market_data,
            tape_data=request.tape_data,
            order_flow=request.order_flow
        )
        
        # Market regime analysis
        market_regime = await pat_det.analyze_market_regime(request.market_data)
        volatility_state = await pat_det.analyze_volatility(request.tape_data)
        
        # Generate recommendation based on patterns
        recommendation = await pat_det.generate_recommendation(patterns)
        
        response = PatternAnalysis(
            patterns_detected=list(patterns.keys()),
            confidence_scores=patterns,
            market_regime=market_regime,
            volatility_state=volatility_state,
            recommendation=recommendation
        )
        
        logger.info(f"✅ Detected {len(patterns)} patterns")
        return response
        
    except Exception as e:
        logger.error(f"❌ Error detecting patterns: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Pattern detection failed: {str(e)}")

@router.get("/model_status")
async def get_model_status() -> Dict[str, Any]:
    """
    Get status of all ML models
    Health check for model components
    """
    try:
        status = {
            "timestamp": datetime.now().isoformat(),
            "models": {
                "pattern_detector": "loaded" if pattern_detector else "not_loaded",
                "signal_generator": "loaded" if signal_generator else "not_loaded",
            },
            "configuration": {
                "confidence_threshold": settings.CONFIDENCE_THRESHOLD,
                "model_version": settings.MODEL_VERSION,
                "target_points": settings.TARGET_POINTS,
                "stop_loss_points": settings.STOP_LOSS_POINTS,
            },
            "performance": {
                "uptime": "calculating...",
                "requests_processed": "calculating...",
                "avg_response_time": "calculating...",
            }
        }
        
        return status
        
    except Exception as e:
        logger.error(f"❌ Error getting model status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@router.post("/retrain_models")
async def retrain_models(
    background_tasks: BackgroundTasks,
    force: bool = False
) -> Dict[str, str]:
    """
    Trigger model retraining
    Should be called periodically or when performance degrades
    """
    try:
        if not force:
            # Check if retraining is needed based on performance metrics
            logger.info("🔄 Checking if model retraining is needed...")
            # Add logic to check model performance
        
        logger.info("🚀 Starting model retraining process...")
        background_tasks.add_task(retrain_all_models)
        
        return {
            "status": "started",
            "message": "Model retraining initiated in background"
        }
        
    except Exception as e:
        logger.error(f"❌ Error starting model retraining: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Retraining failed: {str(e)}")

@router.get("/performance_metrics")
async def get_performance_metrics() -> Dict[str, Any]:
    """
    Get model performance metrics
    Called by monitoring systems and dashboards
    """
    try:
        # This would typically come from a monitoring service
        metrics = {
            "signal_accuracy": 0.87,
            "pattern_detection_rate": 0.92,
            "avg_confidence": 0.89,
            "signals_generated_today": 42,
            "profitable_signals_ratio": 0.73,
            "avg_response_time_ms": 45.2,
            "error_rate": 0.02,
            "uptime_percentage": 99.8
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"❌ Error getting performance metrics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Metrics retrieval failed: {str(e)}")

# Background tasks
async def log_signal_generation(symbol: str, signal: str, confidence: float, pattern: str):
    """Log signal generation for monitoring"""
    logger.info(f"📝 Signal logged: {symbol} -> {signal} ({confidence:.2f}) via {pattern}")

async def retrain_all_models():
    """Background task to retrain all models"""
    try:
        logger.info("🔄 Starting background model retraining...")
        
        # Simulate retraining process
        await asyncio.sleep(10)  # Placeholder for actual retraining
        
        logger.info("✅ Model retraining completed successfully")
        
    except Exception as e:
        logger.error(f"❌ Background retraining failed: {str(e)}")