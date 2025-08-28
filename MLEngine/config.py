"""
Configuration management for ML Engine
Handles all environment variables and settings
"""

import os
from typing import Dict, Any, Optional
from pydantic import validator
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    """Main configuration class"""
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    DEBUG: bool = False
    WORKERS: int = 1
    
    # Backend TypeScript communication
    BACKEND_URL: str = "http://localhost:3001"
    BACKEND_API_KEY: str = ""
    
    # Model settings
    MODEL_VERSION: str = "v1.0.0"
    MODEL_PATH: str = "./models/saved"
    CONFIDENCE_THRESHOLD: float = 0.90
    MIN_PATTERN_CONFIDENCE: float = 0.85
    
    # Trading parameters
    TARGET_POINTS: float = 2.0
    STOP_LOSS_POINTS: float = 1.5
    DAILY_TARGET_POINTS: float = 3.0
    MAX_DAILY_LOSS: float = 2.0
    POSITION_SIZE: float = 1.0
    
    # ML Training settings
    TRAIN_TEST_SPLIT: float = 0.8
    VALIDATION_SPLIT: float = 0.1
    BATCH_SIZE: int = 64
    EPOCHS: int = 100
    LEARNING_RATE: float = 0.001
    EARLY_STOPPING_PATIENCE: int = 10
    
    # Data settings
    MAX_LOOKBACK_PERIODS: int = 200
    FEATURE_WINDOW: int = 50
    PATTERN_LOOKBACK: int = 100
    
    # Redis settings
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    CACHE_TTL: int = 300
    
    # MongoDB settings
    MONGO_URL: str = "mongodb://localhost:27017"
    MONGO_DB: str = "trading_ml"
    
    # PostgreSQL settings
    POSTGRES_URL: str = "postgresql://user:pass@localhost:5432/trading"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: str = "./logs/ml_engine.log"
    
    # Monitoring
    METRICS_PORT: int = 8002
    ENABLE_METRICS: bool = True
    
    # Feature engineering
    TECHNICAL_INDICATORS: Dict[str, Any] = {
        "rsi_period": 14,
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
        "bb_period": 20,
        "bb_std": 2.0,
        "volume_ma_period": 20
    }
    
    # Pattern detection settings
    PATTERN_TYPES: Dict[str, bool] = {
        "absorption": True,
        "iceberg": True,
        "stop_hunt": True,
        "false_breakout": True,
        "volume_spike": True,
        "order_flow_imbalance": True
    }
    
    # Risk management
    MAX_POSITIONS: int = 1
    MAX_DAILY_TRADES: int = 5
    RISK_FREE_RATE: float = 0.05
    SHARPE_TARGET: float = 2.0
    
    @validator("CONFIDENCE_THRESHOLD")
    def validate_confidence_threshold(cls, v):
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence threshold must be between 0 and 1")
        return v
    
    @validator("MODEL_PATH")
    def validate_model_path(cls, v):
        Path(v).mkdir(parents=True, exist_ok=True)
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

class ModelConfig:
    """ML Model specific configurations"""
    
    # Pattern Recognition Model
    PATTERN_MODEL = {
        "architecture": "lstm_cnn",
        "lstm_units": [128, 64, 32],
        "cnn_filters": [32, 64, 128],
        "dropout_rate": 0.3,
        "regularization": 0.001,
        "activation": "relu",
        "optimizer": "adam"
    }
    
    # Confidence Scoring Model
    CONFIDENCE_MODEL = {
        "architecture": "ensemble",
        "base_models": ["random_forest", "gradient_boost", "neural_net"],
        "rf_estimators": 200,
        "gb_estimators": 100,
        "nn_layers": [256, 128, 64],
        "voting": "soft"
    }
    
    # Signal Generation Model
    SIGNAL_MODEL = {
        "architecture": "transformer",
        "num_heads": 8,
        "num_layers": 6,
        "d_model": 512,
        "d_ff": 2048,
        "dropout": 0.1,
        "max_seq_length": 200
    }

class BacktestConfig:
    """Backtesting configuration"""
    
    START_CAPITAL: float = 100000.0
    COMMISSION: float = 2.5  # Per round trip
    SLIPPAGE: float = 0.25   # Points
    
    METRICS = [
        "total_return",
        "sharpe_ratio",
        "max_drawdown",
        "win_rate",
        "profit_factor",
        "expectancy",
        "avg_trade_duration",
        "total_trades"
    ]

# Global settings instance
settings = Settings()

def get_settings() -> Settings:
    """Get settings instance"""
    return settings

def get_model_config() -> Dict[str, Any]:
    """Get model configurations"""
    return {
        "pattern": ModelConfig.PATTERN_MODEL,
        "confidence": ModelConfig.CONFIDENCE_MODEL,
        "signal": ModelConfig.SIGNAL_MODEL
    }

def get_backtest_config() -> Dict[str, Any]:
    """Get backtesting configuration"""
    return {
        "start_capital": BacktestConfig.START_CAPITAL,
        "commission": BacktestConfig.COMMISSION,
        "slippage": BacktestConfig.SLIPPAGE,
        "metrics": BacktestConfig.METRICS
    }

def update_settings(**kwargs) -> None:
    """Update settings dynamically"""
    global settings
    for key, value in kwargs.items():
        if hasattr(settings, key):
            setattr(settings, key, value)

def validate_trading_session() -> bool:
    """Validate if trading session parameters are correct"""
    try:
        assert 0.0 < settings.CONFIDENCE_THRESHOLD <= 1.0
        assert settings.TARGET_POINTS > 0
        assert settings.STOP_LOSS_POINTS > 0
        assert settings.MAX_DAILY_LOSS > 0
        assert settings.DAILY_TARGET_POINTS > 0
        return True
    except AssertionError:
        return False

# Environment detection
def is_production() -> bool:
    """Check if running in production environment"""
    return os.getenv("ENV", "development").lower() == "production"

def is_development() -> bool:
    """Check if running in development environment"""
    return not is_production()

# Logging configuration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
        },
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "level": "INFO",
            "formatter": "standard",
            "stream": "ext://sys.stdout"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "level": "DEBUG",
            "formatter": "json",
            "filename": settings.LOG_FILE,
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5
        }
    },
    "loggers": {
        "": {
            "handlers": ["console", "file"],
            "level": settings.LOG_LEVEL,
            "propagate": False
        },
        "uvicorn.access": {
            "handlers": ["file"],
            "level": "INFO",
            "propagate": False
        }
    }
}