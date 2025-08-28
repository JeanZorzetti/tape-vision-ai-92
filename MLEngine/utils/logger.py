"""
Logging utilities for ML Engine
Structured logging with performance monitoring
"""
import logging
import logging.handlers
import sys
import os
import json
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

from config import get_settings

settings = get_settings()


class MLEngineFormatter(logging.Formatter):
    """Custom formatter for ML Engine logs"""
    
    def format(self, record):
        # Add timestamp and service info
        record.service = "ml-engine"
        record.timestamp = datetime.now().isoformat()
        
        # Add context if available
        if hasattr(record, 'pattern'):
            record.context = f"pattern:{record.pattern}"
        elif hasattr(record, 'signal'):
            record.context = f"signal:{record.signal}"
        else:
            record.context = "general"
        
        return super().format(record)


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "ml-engine",
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add custom fields
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 'filename',
                          'module', 'lineno', 'funcName', 'created', 'msecs', 'relativeCreated',
                          'thread', 'threadName', 'processName', 'process', 'getMessage']:
                log_entry[key] = value
        
        return json.dumps(log_entry)


class PerformanceLogger:
    """Logger for performance metrics"""
    
    def __init__(self):
        self.metrics = {}
        self.logger = get_logger("performance")
    
    def log_latency(self, operation: str, latency_ms: float, context: Dict[str, Any] = None):
        """Log operation latency"""
        self.logger.info(
            f"Operation latency: {operation} took {latency_ms:.2f}ms",
            extra={
                'operation': operation,
                'latency_ms': latency_ms,
                'context': context or {}
            }
        )
    
    def log_throughput(self, operation: str, count: int, duration_ms: float):
        """Log operation throughput"""
        throughput = count / (duration_ms / 1000.0) if duration_ms > 0 else 0
        self.logger.info(
            f"Throughput: {operation} processed {count} items in {duration_ms:.2f}ms ({throughput:.2f}/sec)",
            extra={
                'operation': operation,
                'count': count,
                'duration_ms': duration_ms,
                'throughput': throughput
            }
        )
    
    def log_signal_generation(self, signal: str, confidence: float, latency_ms: float, pattern: str):
        """Log signal generation metrics"""
        self.logger.info(
            f"Signal generated: {signal} ({confidence:.3f}) in {latency_ms:.2f}ms",
            extra={
                'signal': signal,
                'confidence': confidence,
                'latency_ms': latency_ms,
                'pattern': pattern,
                'operation': 'signal_generation'
            }
        )
    
    def log_pattern_detection(self, patterns_found: int, total_patterns: int, latency_ms: float):
        """Log pattern detection metrics"""
        detection_rate = patterns_found / total_patterns if total_patterns > 0 else 0
        self.logger.info(
            f"Pattern detection: {patterns_found}/{total_patterns} patterns detected in {latency_ms:.2f}ms",
            extra={
                'patterns_found': patterns_found,
                'total_patterns': total_patterns,
                'detection_rate': detection_rate,
                'latency_ms': latency_ms,
                'operation': 'pattern_detection'
            }
        )
    
    def log_model_performance(self, model_name: str, accuracy: float, prediction_time_ms: float):
        """Log ML model performance"""
        self.logger.info(
            f"Model performance: {model_name} accuracy={accuracy:.3f} prediction_time={prediction_time_ms:.2f}ms",
            extra={
                'model_name': model_name,
                'accuracy': accuracy,
                'prediction_time_ms': prediction_time_ms,
                'operation': 'model_prediction'
            }
        )


def setup_logger() -> None:
    """Setup global logging configuration"""
    
    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    
    if settings.LOG_FORMAT == "json":
        console_formatter = JSONFormatter()
    else:
        console_formatter = MLEngineFormatter(
            '%(timestamp)s [%(levelname)s] %(name)s (%(context)s): %(message)s'
        )
    
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler
    file_handler = logging.handlers.RotatingFileHandler(
        filename=settings.LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    
    # Always use JSON for file logs
    file_formatter = JSONFormatter()
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # Error file handler
    error_handler = logging.handlers.RotatingFileHandler(
        filename=settings.LOG_FILE.replace('.log', '_errors.log'),
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)
    
    # Performance log handler
    perf_handler = logging.handlers.RotatingFileHandler(
        filename=settings.LOG_FILE.replace('.log', '_performance.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=3,
        encoding='utf-8'
    )
    perf_handler.setLevel(logging.INFO)
    perf_handler.setFormatter(file_formatter)
    
    # Add performance handler only to performance logger
    perf_logger = logging.getLogger("performance")
    perf_logger.addHandler(perf_handler)
    perf_logger.propagate = False  # Don't propagate to root logger
    
    # Suppress noisy third-party loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("tensorflow").setLevel(logging.WARNING)
    logging.getLogger("sklearn").setLevel(logging.WARNING)
    logging.getLogger("matplotlib").setLevel(logging.WARNING)
    
    logging.info("🚀 ML Engine logging system initialized")


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name"""
    return logging.getLogger(name)


class LogContext:
    """Context manager for adding structured context to logs"""
    
    def __init__(self, **context):
        self.context = context
        self.old_factory = logging.getLogRecordFactory()
    
    def __enter__(self):
        def record_factory(*args, **kwargs):
            record = self.old_factory(*args, **kwargs)
            for key, value in self.context.items():
                setattr(record, key, value)
            return record
        
        logging.setLogRecordFactory(record_factory)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        logging.setLogRecordFactory(self.old_factory)


class TimedLogger:
    """Context manager for timing operations and logging"""
    
    def __init__(self, logger: logging.Logger, operation: str, level: int = logging.INFO):
        self.logger = logger
        self.operation = operation
        self.level = level
        self.start_time = None
    
    def __enter__(self):
        self.start_time = datetime.now()
        self.logger.log(self.level, f"Starting {self.operation}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = (datetime.now() - self.start_time).total_seconds() * 1000
            
            if exc_type:
                self.logger.error(
                    f"Failed {self.operation} after {duration:.2f}ms: {exc_val}",
                    extra={'operation': self.operation, 'duration_ms': duration, 'success': False}
                )
            else:
                self.logger.log(
                    self.level,
                    f"Completed {self.operation} in {duration:.2f}ms",
                    extra={'operation': self.operation, 'duration_ms': duration, 'success': True}
                )


# Global performance logger instance
performance_logger = PerformanceLogger()


def log_signal_performance(signal: str, confidence: float, latency_ms: float, pattern: str):
    """Convenience function for logging signal generation performance"""
    performance_logger.log_signal_generation(signal, confidence, latency_ms, pattern)


def log_pattern_performance(patterns_found: int, total_patterns: int, latency_ms: float):
    """Convenience function for logging pattern detection performance"""
    performance_logger.log_pattern_detection(patterns_found, total_patterns, latency_ms)


def log_model_performance(model_name: str, accuracy: float, prediction_time_ms: float):
    """Convenience function for logging ML model performance"""
    performance_logger.log_model_performance(model_name, accuracy, prediction_time_ms)


# Decorators for automatic performance logging

def log_execution_time(operation_name: Optional[str] = None):
    """Decorator to automatically log function execution time"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            op_name = operation_name or f"{func.__module__}.{func.__name__}"
            logger = get_logger(func.__module__)
            
            with TimedLogger(logger, op_name):
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


def log_async_execution_time(operation_name: Optional[str] = None):
    """Decorator to automatically log async function execution time"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            op_name = operation_name or f"{func.__module__}.{func.__name__}"
            logger = get_logger(func.__module__)
            
            start_time = datetime.now()
            logger.info(f"Starting {op_name}")
            
            try:
                result = await func(*args, **kwargs)
                duration = (datetime.now() - start_time).total_seconds() * 1000
                logger.info(
                    f"Completed {op_name} in {duration:.2f}ms",
                    extra={'operation': op_name, 'duration_ms': duration, 'success': True}
                )
                return result
            except Exception as e:
                duration = (datetime.now() - start_time).total_seconds() * 1000
                logger.error(
                    f"Failed {op_name} after {duration:.2f}ms: {e}",
                    extra={'operation': op_name, 'duration_ms': duration, 'success': False}
                )
                raise
        
        return wrapper
    return decorator