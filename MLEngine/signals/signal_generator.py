"""
Signal Generator - Main ML-powered trading signal generation
Combines pattern detection, confidence scoring, and market analysis
"""
import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging

from config import get_settings, get_model_config
from utils.logger import get_logger

# ML imports
try:
    import tensorflow as tf
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    import ta
except ImportError:
    logging.warning("Some ML libraries not installed. Install requirements.txt")

settings = get_settings()
model_config = get_model_config()
logger = get_logger(__name__)


class SignalGenerator:
    """
    Advanced ML-powered signal generation system
    Combines multiple models and analysis techniques
    """
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_columns = []
        self.model_weights = {
            'pattern_model': 0.4,
            'confidence_model': 0.3,
            'ensemble_model': 0.3
        }
        
        # Performance tracking
        self.signals_generated = 0
        self.successful_predictions = 0
        self.total_profit_points = 0.0
        
        logger.info("🤖 Initializing Signal Generator...")
    
    async def initialize(self) -> None:
        """Initialize and load all ML models"""
        try:
            logger.info("📚 Loading ML models...")
            
            # Load pre-trained models (would be actual saved models in production)
            await self._load_pattern_model()
            await self._load_confidence_model()
            await self._load_ensemble_model()
            await self._setup_feature_engineering()
            
            logger.info("✅ Signal Generator initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Signal Generator: {e}")
            raise
    
    async def generate_signal(
        self,
        market_data,
        tape_data: List,
        order_flow,
        detected_patterns: Dict[str, float]
    ) -> 'TradingSignal':
        """
        Generate trading signal using ML models and market analysis
        
        Args:
            market_data: Current market data
            tape_data: List of recent tape data
            order_flow: Order flow analysis data
            detected_patterns: Patterns detected with confidence scores
            
        Returns:
            TradingSignal with recommendation and confidence
        """
        try:
            logger.info(f"🎯 Generating signal for {market_data.symbol} at {market_data.price}")
            
            # 1. Feature Engineering
            features = await self._engineer_features(market_data, tape_data, order_flow)
            
            # 2. Model Predictions
            pattern_pred = await self._predict_pattern_model(features, detected_patterns)
            confidence_pred = await self._predict_confidence_model(features, detected_patterns)
            ensemble_pred = await self._predict_ensemble_model(features)
            
            # 3. Weighted Signal Combination
            final_signal, final_confidence = await self._combine_predictions(
                pattern_pred, confidence_pred, ensemble_pred
            )
            
            # 4. Risk Management Calculations
            stop_loss, target = await self._calculate_risk_reward(
                market_data.price, final_signal, final_confidence
            )
            
            # 5. Generate reasoning
            reasoning = await self._generate_reasoning(
                detected_patterns, final_signal, final_confidence
            )
            
            # 6. Create signal object
            from api.endpoints import TradingSignal  # Import here to avoid circular imports
            
            signal = TradingSignal(
                signal=final_signal,
                confidence=final_confidence,
                reasoning=reasoning,
                stop_loss=stop_loss,
                target=target,
                risk_reward=(target - market_data.price) / (market_data.price - stop_loss) if final_signal == "BUY" else (market_data.price - target) / (stop_loss - market_data.price),
                pattern_matched=max(detected_patterns.items(), key=lambda x: x[1])[0] if detected_patterns else "none",
                metadata={
                    'pattern_scores': detected_patterns,
                    'model_predictions': {
                        'pattern_model': pattern_pred,
                        'confidence_model': confidence_pred,
                        'ensemble_model': ensemble_pred
                    },
                    'features_used': len(features),
                    'market_regime': await self._detect_market_regime(tape_data),
                    'volatility_adjusted': True
                }
            )
            
            # 7. Update performance tracking
            self.signals_generated += 1
            
            logger.info(f"✅ Signal generated: {final_signal} (confidence: {final_confidence:.3f})")
            return signal
            
        except Exception as e:
            logger.error(f"❌ Error generating signal: {e}")
            # Return safe HOLD signal on error
            from api.endpoints import TradingSignal
            return TradingSignal(
                signal="HOLD",
                confidence=0.0,
                reasoning=f"Error in signal generation: {str(e)}",
                stop_loss=market_data.price,
                target=market_data.price,
                risk_reward=0.0,
                pattern_matched="error"
            )
    
    async def _engineer_features(self, market_data, tape_data: List, order_flow) -> np.ndarray:
        """Engineer features for ML models"""
        try:
            features = []
            
            # Price-based features
            features.extend([
                market_data.price,
                market_data.bid,
                market_data.ask,
                market_data.spread,
                market_data.volume
            ])
            
            # Tape reading features
            if tape_data:
                tape_df = pd.DataFrame([{
                    'price': t.price,
                    'volume': t.volume,
                    'aggressor_side': 1 if t.aggressor_side == 'buy' else -1,
                    'timestamp': t.timestamp
                } for t in tape_data[-50:]])  # Last 50 ticks
                
                # Volume-weighted features
                features.extend([
                    tape_df['volume'].sum(),
                    tape_df['volume'].mean(),
                    tape_df['volume'].std(),
                    (tape_df['aggressor_side'] * tape_df['volume']).sum(),  # Net aggressive volume
                    len(tape_df[tape_df['aggressor_side'] == 1]) / len(tape_df),  # Buy ratio
                ])
                
                # Price action features
                price_changes = tape_df['price'].diff().dropna()
                features.extend([
                    price_changes.mean(),
                    price_changes.std(),
                    len(price_changes[price_changes > 0]) / len(price_changes),  # Up tick ratio
                    tape_df['price'].iloc[-1] - tape_df['price'].iloc[0],  # Net price change
                ])
            else:
                # Fill with zeros if no tape data
                features.extend([0.0] * 9)
            
            # Order flow features
            features.extend([
                order_flow.bid_volume,
                order_flow.ask_volume,
                order_flow.imbalance_ratio,
                order_flow.aggression_score,
                order_flow.hidden_liquidity,
                order_flow.cumulative_delta
            ])
            
            # Technical indicators (if we have enough data)
            try:
                if len(tape_data) >= 20:
                    prices = [t.price for t in tape_data[-20:]]
                    volumes = [t.volume for t in tape_data[-20:]]
                    
                    # Simple moving averages
                    sma_5 = np.mean(prices[-5:])
                    sma_10 = np.mean(prices[-10:])
                    
                    # Volume indicators
                    vol_avg = np.mean(volumes)
                    vol_current = volumes[-1] if volumes else 0
                    
                    features.extend([
                        sma_5,
                        sma_10,
                        sma_5 - sma_10,  # Momentum
                        vol_current / vol_avg if vol_avg > 0 else 1.0,  # Volume ratio
                    ])
                else:
                    features.extend([0.0] * 4)
                    
            except:
                features.extend([0.0] * 4)
            
            # Time-based features
            now = datetime.now()
            features.extend([
                now.hour,
                now.minute,
                now.weekday(),
                1 if 9 <= now.hour < 16 else 0,  # Market hours
            ])
            
            return np.array(features, dtype=np.float32)
            
        except Exception as e:
            logger.error(f"❌ Error in feature engineering: {e}")
            # Return basic features on error
            return np.zeros(30, dtype=np.float32)
    
    async def _predict_pattern_model(self, features: np.ndarray, patterns: Dict[str, float]) -> Tuple[str, float]:
        """Predict using pattern recognition model"""
        try:
            # Weighted pattern scoring
            if not patterns:
                return "HOLD", 0.5
                
            # Get strongest pattern
            best_pattern = max(patterns.items(), key=lambda x: x[1])
            pattern_name, pattern_confidence = best_pattern
            
            # Pattern-specific logic
            if pattern_name == "absorption" and pattern_confidence > 0.85:
                return "BUY", pattern_confidence
            elif pattern_name == "iceberg" and pattern_confidence > 0.80:
                return "BUY", pattern_confidence
            elif pattern_name == "aggressive_sell" and pattern_confidence > 0.85:
                return "SELL", pattern_confidence
            elif pattern_name == "stop_hunt" and pattern_confidence > 0.90:
                return "BUY", pattern_confidence
            else:
                return "HOLD", pattern_confidence
                
        except Exception as e:
            logger.error(f"❌ Pattern model prediction error: {e}")
            return "HOLD", 0.0
    
    async def _predict_confidence_model(self, features: np.ndarray, patterns: Dict[str, float]) -> Tuple[str, float]:
        """Predict using confidence scoring model"""
        try:
            # Feature-based confidence assessment
            if len(features) < 10:
                return "HOLD", 0.0
            
            # Volume analysis
            volume_score = min(features[4] / 100, 1.0) if features[4] > 0 else 0.0
            
            # Spread analysis
            spread_score = max(0.0, 1.0 - (features[3] / 2.0)) if features[3] > 0 else 0.0
            
            # Order flow analysis
            if len(features) > 15:
                imbalance = abs(features[12]) if len(features) > 12 else 0.0
                aggression = features[13] if len(features) > 13 else 0.0
                
                flow_score = (imbalance + aggression) / 2.0
            else:
                flow_score = 0.0
            
            # Combined confidence
            overall_confidence = (volume_score * 0.3 + spread_score * 0.2 + flow_score * 0.5)
            
            # Signal determination
            if overall_confidence > 0.85:
                # Determine direction based on features
                if len(features) > 13 and features[13] > 0.7:  # High aggression
                    return "BUY", overall_confidence
                elif len(features) > 13 and features[13] < -0.7:
                    return "SELL", overall_confidence
                else:
                    return "HOLD", overall_confidence
            else:
                return "HOLD", overall_confidence
                
        except Exception as e:
            logger.error(f"❌ Confidence model prediction error: {e}")
            return "HOLD", 0.0
    
    async def _predict_ensemble_model(self, features: np.ndarray) -> Tuple[str, float]:
        """Predict using ensemble model"""
        try:
            # Simplified ensemble logic (in production, this would use trained models)
            if len(features) < 5:
                return "HOLD", 0.5
                
            # Price momentum
            price_momentum = features[0] - features[1] if len(features) > 1 else 0.0
            
            # Volume analysis
            volume_factor = min(features[4] / 50, 2.0) if features[4] > 0 else 1.0
            
            # Combined score
            ensemble_score = abs(price_momentum) * volume_factor / 10.0
            ensemble_score = min(ensemble_score, 1.0)
            
            if ensemble_score > 0.8:
                direction = "BUY" if price_momentum > 0 else "SELL"
                return direction, ensemble_score
            else:
                return "HOLD", ensemble_score
                
        except Exception as e:
            logger.error(f"❌ Ensemble model prediction error: {e}")
            return "HOLD", 0.0
    
    async def _combine_predictions(
        self, 
        pattern_pred: Tuple[str, float],
        confidence_pred: Tuple[str, float],
        ensemble_pred: Tuple[str, float]
    ) -> Tuple[str, float]:
        """Combine predictions from all models using weighted voting"""
        try:
            predictions = {
                'pattern': pattern_pred,
                'confidence': confidence_pred,
                'ensemble': ensemble_pred
            }
            
            # Weighted voting
            signal_votes = {'BUY': 0.0, 'SELL': 0.0, 'HOLD': 0.0}
            total_confidence = 0.0
            
            for model_name, (signal, conf) in predictions.items():
                weight = self.model_weights.get(f'{model_name}_model', 0.33)
                signal_votes[signal] += weight * conf
                total_confidence += weight * conf
            
            # Get winning signal
            winning_signal = max(signal_votes.items(), key=lambda x: x[1])
            final_signal = winning_signal[0]
            final_confidence = total_confidence / sum(self.model_weights.values())
            
            # Apply minimum confidence threshold
            if final_confidence < settings.MIN_PATTERN_CONFIDENCE:
                final_signal = "HOLD"
                final_confidence = max(final_confidence, 0.5)
            
            return final_signal, final_confidence
            
        except Exception as e:
            logger.error(f"❌ Error combining predictions: {e}")
            return "HOLD", 0.0
    
    async def _calculate_risk_reward(self, current_price: float, signal: str, confidence: float) -> Tuple[float, float]:
        """Calculate stop loss and target based on signal and confidence"""
        try:
            if signal == "HOLD":
                return current_price, current_price
            
            # Base risk/reward from settings
            base_stop = settings.STOP_LOSS_POINTS
            base_target = settings.TARGET_POINTS
            
            # Adjust based on confidence
            confidence_multiplier = min(confidence * 1.5, 2.0)
            adjusted_target = base_target * confidence_multiplier
            adjusted_stop = base_stop * (2.0 - confidence)  # Lower stop for higher confidence
            
            if signal == "BUY":
                stop_loss = current_price - adjusted_stop
                target = current_price + adjusted_target
            else:  # SELL
                stop_loss = current_price + adjusted_stop
                target = current_price - adjusted_target
            
            return round(stop_loss, 2), round(target, 2)
            
        except Exception as e:
            logger.error(f"❌ Error calculating risk/reward: {e}")
            return current_price, current_price
    
    async def _generate_reasoning(self, patterns: Dict[str, float], signal: str, confidence: float) -> str:
        """Generate human-readable reasoning for the signal"""
        try:
            reasoning_parts = []
            
            # Pattern-based reasoning
            if patterns:
                best_pattern = max(patterns.items(), key=lambda x: x[1])
                pattern_name, pattern_conf = best_pattern
                reasoning_parts.append(f"Primary pattern: {pattern_name} ({pattern_conf:.2f} confidence)")
            
            # Signal reasoning
            if signal == "BUY":
                reasoning_parts.append("Bullish signals detected with aggressive buying interest")
            elif signal == "SELL":
                reasoning_parts.append("Bearish signals detected with aggressive selling pressure")
            else:
                reasoning_parts.append("No clear directional bias - recommending wait")
            
            # Confidence reasoning
            if confidence > 0.9:
                reasoning_parts.append("Very high confidence signal")
            elif confidence > 0.8:
                reasoning_parts.append("High confidence signal")
            elif confidence > 0.7:
                reasoning_parts.append("Moderate confidence signal")
            else:
                reasoning_parts.append("Low confidence - proceed with caution")
            
            return ". ".join(reasoning_parts) + "."
            
        except Exception as e:
            logger.error(f"❌ Error generating reasoning: {e}")
            return f"Signal: {signal} with {confidence:.2f} confidence"
    
    async def _detect_market_regime(self, tape_data: List) -> str:
        """Detect current market regime"""
        try:
            if not tape_data or len(tape_data) < 10:
                return "unknown"
            
            # Analyze recent price action
            recent_prices = [t.price for t in tape_data[-20:]]
            price_volatility = np.std(recent_prices) if len(recent_prices) > 1 else 0
            
            # Volume analysis
            recent_volumes = [t.volume for t in tape_data[-20:]]
            avg_volume = np.mean(recent_volumes) if recent_volumes else 0
            
            # Classify regime
            if price_volatility < 0.5 and avg_volume < 50:
                return "quiet"
            elif price_volatility > 2.0 and avg_volume > 100:
                return "volatile"
            elif avg_volume > 150:
                return "active"
            else:
                return "normal"
                
        except Exception as e:
            logger.error(f"❌ Error detecting market regime: {e}")
            return "unknown"
    
    # Model loading methods (placeholders for production models)
    async def _load_pattern_model(self):
        """Load pattern recognition model"""
        # In production, this would load a saved TensorFlow/PyTorch model
        self.models['pattern'] = None
        logger.info("📊 Pattern model loaded (simulated)")
    
    async def _load_confidence_model(self):
        """Load confidence scoring model"""
        # In production, this would load saved scikit-learn models
        self.models['confidence'] = None
        logger.info("📊 Confidence model loaded (simulated)")
    
    async def _load_ensemble_model(self):
        """Load ensemble model"""
        # In production, this would load an ensemble of models
        self.models['ensemble'] = None
        logger.info("📊 Ensemble model loaded (simulated)")
    
    async def _setup_feature_engineering(self):
        """Setup feature engineering pipeline"""
        self.feature_columns = [
            'price', 'bid', 'ask', 'spread', 'volume',
            'tape_volume_sum', 'tape_volume_mean', 'tape_volume_std',
            'net_aggressive_volume', 'buy_ratio',
            'price_change_mean', 'price_change_std', 'uptick_ratio', 'net_price_change',
            'bid_volume', 'ask_volume', 'imbalance_ratio',
            'aggression_score', 'hidden_liquidity', 'cumulative_delta',
            'sma_5', 'sma_10', 'momentum', 'volume_ratio',
            'hour', 'minute', 'weekday', 'market_hours'
        ]
        logger.info(f"📊 Feature engineering setup with {len(self.feature_columns)} features")
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for monitoring"""
        return {
            'signals_generated': self.signals_generated,
            'success_rate': self.successful_predictions / max(self.signals_generated, 1),
            'total_profit_points': self.total_profit_points,
            'avg_confidence': 0.85,  # Placeholder
            'model_status': 'active',
            'last_signal_time': datetime.now().isoformat()
        }