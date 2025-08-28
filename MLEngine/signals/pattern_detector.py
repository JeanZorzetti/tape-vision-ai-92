"""
Pattern Detector - Advanced ML-powered pattern recognition
Detects tape reading patterns, order flow anomalies, and market microstructure patterns
"""
import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import logging

from config import get_settings
from utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class PatternDetector:
    """
    Advanced pattern detection using machine learning and statistical analysis
    Specializes in tape reading patterns for mini dollar futures
    """
    
    def __init__(self):
        self.pattern_templates = {}
        self.detection_history = []
        self.performance_metrics = {}
        
        # Pattern confidence thresholds
        self.thresholds = {
            'absorption': 0.85,
            'iceberg': 0.80,
            'aggressive_entry': 0.90,
            'hidden_liquidity': 0.85,
            'stop_hunt': 0.95,
            'momentum_shift': 0.80,
            'volume_spike': 0.75,
            'order_flow_imbalance': 0.80
        }
        
        logger.info("🔍 Initializing Pattern Detector...")
        self._initialize_pattern_templates()
    
    def _initialize_pattern_templates(self):
        """Initialize pattern recognition templates"""
        self.pattern_templates = {
            'absorption': self._template_absorption,
            'iceberg': self._template_iceberg,
            'aggressive_entry': self._template_aggressive_entry,
            'hidden_liquidity': self._template_hidden_liquidity,
            'stop_hunt': self._template_stop_hunt,
            'momentum_shift': self._template_momentum_shift,
            'volume_spike': self._template_volume_spike,
            'order_flow_imbalance': self._template_order_flow_imbalance
        }
        logger.info(f"📊 Loaded {len(self.pattern_templates)} pattern templates")
    
    async def detect_patterns(
        self,
        market_data,
        tape_data: List,
        order_flow
    ) -> Dict[str, float]:
        """
        Main pattern detection method
        Returns dict of detected patterns with confidence scores
        """
        try:
            detected_patterns = {}
            
            if not tape_data or len(tape_data) < 10:
                logger.warning("🟡 Insufficient tape data for pattern detection")
                return detected_patterns
            
            logger.info(f"🔍 Analyzing {len(tape_data)} tape entries for patterns...")
            
            # Run all pattern detectors in parallel
            detection_tasks = []
            for pattern_name, detector_func in self.pattern_templates.items():
                task = self._detect_single_pattern(
                    pattern_name, detector_func, market_data, tape_data, order_flow
                )
                detection_tasks.append(task)
            
            # Wait for all detections to complete
            results = await asyncio.gather(*detection_tasks, return_exceptions=True)
            
            # Process results
            for i, result in enumerate(results):
                pattern_name = list(self.pattern_templates.keys())[i]
                if isinstance(result, Exception):
                    logger.error(f"❌ Error detecting {pattern_name}: {result}")
                    continue
                
                confidence = result
                if confidence >= self.thresholds.get(pattern_name, 0.8):
                    detected_patterns[pattern_name] = confidence
                    logger.info(f"✅ Pattern detected: {pattern_name} ({confidence:.3f})")
            
            # Log detection summary
            if detected_patterns:
                best_pattern = max(detected_patterns.items(), key=lambda x: x[1])
                logger.info(f"🎯 Best pattern: {best_pattern[0]} ({best_pattern[1]:.3f})")
            else:
                logger.info("🔍 No significant patterns detected")
            
            return detected_patterns
            
        except Exception as e:
            logger.error(f"❌ Error in pattern detection: {e}")
            return {}
    
    async def _detect_single_pattern(
        self,
        pattern_name: str,
        detector_func,
        market_data,
        tape_data: List,
        order_flow
    ) -> float:
        """Detect a single pattern and return confidence score"""
        try:
            confidence = await detector_func(market_data, tape_data, order_flow)
            return max(0.0, min(1.0, confidence))  # Clamp to [0, 1]
        except Exception as e:
            logger.error(f"❌ Error in {pattern_name} detection: {e}")
            return 0.0
    
    # Pattern Detection Templates
    
    async def _template_absorption(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect absorption pattern - large volume at price level without significant movement
        """
        try:
            if len(tape_data) < 20:
                return 0.0
            
            recent_data = tape_data[-20:]
            
            # Group by price levels
            price_volume = {}
            for tick in recent_data:
                price = round(tick.price, 2)
                if price not in price_volume:
                    price_volume[price] = {'volume': 0, 'count': 0}
                price_volume[price]['volume'] += tick.volume
                price_volume[price]['count'] += 1
            
            if not price_volume:
                return 0.0
            
            # Find price level with highest volume
            max_volume_price = max(price_volume.items(), key=lambda x: x[1]['volume'])
            max_volume = max_volume_price[1]['volume']
            max_volume_level = max_volume_price[0]
            
            # Calculate absorption score
            total_volume = sum(data['volume'] for data in price_volume.values())
            absorption_ratio = max_volume / total_volume if total_volume > 0 else 0
            
            # Check for price stability at absorption level
            price_range = max(price_volume.keys()) - min(price_volume.keys())
            stability_score = 1.0 - min(price_range / 2.0, 1.0)  # Lower range = higher stability
            
            # Volume concentration score
            concentration_score = min(absorption_ratio * 3.0, 1.0)
            
            # Order flow confirmation
            flow_score = min(abs(order_flow.imbalance_ratio) / 2.0, 1.0)
            
            # Combined absorption confidence
            confidence = (concentration_score * 0.4 + stability_score * 0.3 + flow_score * 0.3)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Absorption detection error: {e}")
            return 0.0
    
    async def _template_iceberg(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect iceberg orders - consistent selling/buying at same level with small lot sizes
        """
        try:
            if len(tape_data) < 30:
                return 0.0
            
            recent_data = tape_data[-30:]
            
            # Group consecutive trades at same price
            price_sequences = {}
            current_price = None
            current_sequence = []
            
            for tick in recent_data:
                price = round(tick.price, 2)
                if price == current_price:
                    current_sequence.append(tick)
                else:
                    if len(current_sequence) >= 3:  # At least 3 trades at same level
                        if current_price not in price_sequences:
                            price_sequences[current_price] = []
                        price_sequences[current_price].append(current_sequence[:])
                    current_price = price
                    current_sequence = [tick]
            
            # Check last sequence
            if len(current_sequence) >= 3:
                if current_price not in price_sequences:
                    price_sequences[current_price] = []
                price_sequences[current_price].append(current_sequence[:])
            
            if not price_sequences:
                return 0.0
            
            # Analyze sequences for iceberg characteristics
            iceberg_score = 0.0
            
            for price, sequences in price_sequences.items():
                for sequence in sequences:
                    # Check for consistent small lot sizes
                    volumes = [tick.volume for tick in sequence]
                    volume_consistency = 1.0 - (np.std(volumes) / np.mean(volumes)) if np.mean(volumes) > 0 else 0
                    
                    # Check for same side dominance
                    buy_count = sum(1 for tick in sequence if tick.aggressor_side == 'buy')
                    side_dominance = max(buy_count, len(sequence) - buy_count) / len(sequence)
                    
                    # Check for hidden liquidity indicator
                    hidden_liquidity_score = min(order_flow.hidden_liquidity / 100.0, 1.0)
                    
                    sequence_score = (volume_consistency * 0.4 + side_dominance * 0.3 + hidden_liquidity_score * 0.3)
                    iceberg_score = max(iceberg_score, sequence_score)
            
            return iceberg_score
            
        except Exception as e:
            logger.error(f"❌ Iceberg detection error: {e}")
            return 0.0
    
    async def _template_aggressive_entry(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect aggressive market entries - large market orders with urgency
        """
        try:
            if len(tape_data) < 10:
                return 0.0
            
            recent_data = tape_data[-10:]
            
            # Look for large volume spikes
            volumes = [tick.volume for tick in recent_data]
            avg_volume = np.mean(volumes)
            max_volume = max(volumes)
            
            volume_spike_ratio = max_volume / avg_volume if avg_volume > 0 else 1.0
            volume_score = min((volume_spike_ratio - 1.0) / 3.0, 1.0)  # Normalize to [0,1]
            
            # Check for market orders (crossing spread)
            market_orders = 0
            for tick in recent_data:
                if tick.order_type == 'market':
                    market_orders += 1
            
            market_order_ratio = market_orders / len(recent_data)
            urgency_score = market_order_ratio
            
            # Check aggression score from order flow
            aggression_score = min(abs(order_flow.aggression_score), 1.0)
            
            # Price momentum (quick moves)
            if len(recent_data) >= 5:
                price_changes = []
                for i in range(1, len(recent_data)):
                    price_changes.append(recent_data[i].price - recent_data[i-1].price)
                
                momentum = sum(price_changes) / len(price_changes) if price_changes else 0
                momentum_score = min(abs(momentum) / 2.0, 1.0)
            else:
                momentum_score = 0.0
            
            # Combined aggressive entry confidence
            confidence = (volume_score * 0.3 + urgency_score * 0.3 + aggression_score * 0.2 + momentum_score * 0.2)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Aggressive entry detection error: {e}")
            return 0.0
    
    async def _template_hidden_liquidity(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect hidden liquidity - orders not visible in the book but affecting price action
        """
        try:
            # Use order flow hidden liquidity indicator
            hidden_liquidity_raw = order_flow.hidden_liquidity
            
            # Normalize to confidence score
            confidence = min(hidden_liquidity_raw / 100.0, 1.0)
            
            # Enhance with tape analysis
            if len(tape_data) >= 15:
                recent_data = tape_data[-15:]
                
                # Look for unexpected price rejections
                price_rejections = 0
                for i in range(2, len(recent_data)):
                    prev_trend = recent_data[i-1].price - recent_data[i-2].price
                    current_move = recent_data[i].price - recent_data[i-1].price
                    
                    # Sudden reversal might indicate hidden liquidity
                    if abs(prev_trend) > 0.5 and current_move * prev_trend < 0:
                        price_rejections += 1
                
                rejection_ratio = price_rejections / max(len(recent_data) - 2, 1)
                rejection_score = min(rejection_ratio * 2.0, 1.0)
                
                # Combine with raw hidden liquidity
                confidence = (confidence * 0.7 + rejection_score * 0.3)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Hidden liquidity detection error: {e}")
            return 0.0
    
    async def _template_stop_hunt(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect stop hunting - quick moves to trigger stops followed by reversal
        """
        try:
            if len(tape_data) < 25:
                return 0.0
            
            recent_data = tape_data[-25:]
            
            # Look for quick move followed by reversal pattern
            confidence = 0.0
            
            # Analyze price movements in segments
            for i in range(10, len(recent_data) - 5):
                # Quick move segment (5 ticks before point i)
                quick_move_start = recent_data[i-5].price
                quick_move_end = recent_data[i].price
                quick_move = quick_move_end - quick_move_start
                
                # Reversal segment (5 ticks after point i)
                reversal_end = recent_data[i+5].price
                reversal_move = reversal_end - quick_move_end
                
                # Check for stop hunt pattern
                if abs(quick_move) > 1.0 and abs(reversal_move) > abs(quick_move) * 0.6:
                    # Same direction reversal indicates potential stop hunt
                    if quick_move * reversal_move < 0:  # Opposite directions
                        
                        # Volume analysis during quick move
                        quick_move_volumes = [tick.volume for tick in recent_data[i-5:i]]
                        avg_volume = np.mean([tick.volume for tick in recent_data])
                        volume_spike = max(quick_move_volumes) / avg_volume if avg_volume > 0 else 1
                        
                        volume_score = min((volume_spike - 1.0) / 2.0, 1.0)
                        
                        # Pattern strength
                        reversal_strength = abs(reversal_move) / abs(quick_move)
                        strength_score = min(reversal_strength, 1.0)
                        
                        pattern_confidence = (volume_score * 0.5 + strength_score * 0.5)
                        confidence = max(confidence, pattern_confidence)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Stop hunt detection error: {e}")
            return 0.0
    
    async def _template_momentum_shift(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect momentum shifts - change in dominant market direction
        """
        try:
            if len(tape_data) < 20:
                return 0.0
            
            recent_data = tape_data[-20:]
            mid_point = len(recent_data) // 2
            
            # First half vs second half analysis
            first_half = recent_data[:mid_point]
            second_half = recent_data[mid_point:]
            
            # Calculate momentum for each half
            def calculate_momentum(data_segment):
                if len(data_segment) < 2:
                    return 0.0
                
                price_changes = []
                volume_weighted_changes = 0.0
                total_volume = 0
                
                for i in range(1, len(data_segment)):
                    price_change = data_segment[i].price - data_segment[i-1].price
                    volume = data_segment[i].volume
                    
                    price_changes.append(price_change)
                    volume_weighted_changes += price_change * volume
                    total_volume += volume
                
                return volume_weighted_changes / total_volume if total_volume > 0 else 0.0
            
            momentum_1 = calculate_momentum(first_half)
            momentum_2 = calculate_momentum(second_half)
            
            # Detect shift
            if abs(momentum_1) > 0.1 and abs(momentum_2) > 0.1:
                # Check for direction change
                if momentum_1 * momentum_2 < 0:  # Opposite directions
                    shift_magnitude = abs(momentum_2 - momentum_1)
                    confidence = min(shift_magnitude / 2.0, 1.0)
                    
                    # Enhance with order flow confirmation
                    flow_confirmation = min(abs(order_flow.cumulative_delta) / 100.0, 0.3)
                    confidence += flow_confirmation
                    
                    return min(confidence, 1.0)
            
            return 0.0
            
        except Exception as e:
            logger.error(f"❌ Momentum shift detection error: {e}")
            return 0.0
    
    async def _template_volume_spike(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect significant volume spikes indicating institutional interest
        """
        try:
            if len(tape_data) < 15:
                return 0.0
            
            recent_data = tape_data[-15:]
            volumes = [tick.volume for tick in recent_data]
            
            # Calculate volume statistics
            avg_volume = np.mean(volumes)
            std_volume = np.std(volumes)
            max_volume = max(volumes)
            
            # Z-score for maximum volume
            if std_volume > 0:
                z_score = (max_volume - avg_volume) / std_volume
                volume_spike_score = min(z_score / 3.0, 1.0)  # Normalize to [0,1]
            else:
                volume_spike_score = 0.0
            
            # Check if spike is accompanied by price movement
            max_vol_index = volumes.index(max_volume)
            if max_vol_index > 0 and max_vol_index < len(recent_data) - 1:
                price_before = recent_data[max_vol_index - 1].price
                price_at_spike = recent_data[max_vol_index].price
                price_after = recent_data[max_vol_index + 1].price if max_vol_index < len(recent_data) - 1 else price_at_spike
                
                price_impact = abs(price_after - price_before)
                impact_score = min(price_impact / 1.0, 1.0)
            else:
                impact_score = 0.0
            
            # Combined volume spike confidence
            confidence = (volume_spike_score * 0.7 + impact_score * 0.3)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Volume spike detection error: {e}")
            return 0.0
    
    async def _template_order_flow_imbalance(self, market_data, tape_data: List, order_flow) -> float:
        """
        Detect significant order flow imbalances
        """
        try:
            # Use order flow imbalance ratio directly
            imbalance = abs(order_flow.imbalance_ratio)
            
            # Convert to confidence score
            confidence = min(imbalance / 2.0, 1.0)  # Normalize assuming max imbalance of 2.0
            
            # Enhance with tape data confirmation
            if len(tape_data) >= 10:
                recent_data = tape_data[-10:]
                
                # Count buy vs sell aggressor sides
                buy_volume = sum(tick.volume for tick in recent_data if tick.aggressor_side == 'buy')
                sell_volume = sum(tick.volume for tick in recent_data if tick.aggressor_side == 'sell')
                total_volume = buy_volume + sell_volume
                
                if total_volume > 0:
                    tape_imbalance = abs(buy_volume - sell_volume) / total_volume
                    tape_score = min(tape_imbalance * 2.0, 1.0)
                    
                    # Combine with order flow data
                    confidence = (confidence * 0.6 + tape_score * 0.4)
            
            return confidence
            
        except Exception as e:
            logger.error(f"❌ Order flow imbalance detection error: {e}")
            return 0.0
    
    # Analysis Methods
    
    async def analyze_market_regime(self, market_data) -> str:
        """Analyze current market regime"""
        try:
            # Simple regime classification based on spread and volume
            spread = market_data.spread
            volume = market_data.volume
            
            if spread < 0.5 and volume > 100:
                return "tight_active"
            elif spread > 1.5:
                return "wide_illiquid"
            elif volume > 200:
                return "high_volume"
            elif volume < 20:
                return "low_volume"
            else:
                return "normal"
                
        except Exception as e:
            logger.error(f"❌ Market regime analysis error: {e}")
            return "unknown"
    
    async def analyze_volatility(self, tape_data: List) -> str:
        """Analyze current volatility state"""
        try:
            if len(tape_data) < 10:
                return "unknown"
            
            recent_prices = [tick.price for tick in tape_data[-10:]]
            price_volatility = np.std(recent_prices)
            
            if price_volatility < 0.5:
                return "low"
            elif price_volatility > 2.0:
                return "high"
            elif price_volatility > 1.0:
                return "medium"
            else:
                return "normal"
                
        except Exception as e:
            logger.error(f"❌ Volatility analysis error: {e}")
            return "unknown"
    
    async def generate_recommendation(self, patterns: Dict[str, float]) -> str:
        """Generate trading recommendation based on detected patterns"""
        try:
            if not patterns:
                return "No clear patterns - wait for better setup"
            
            # Get strongest pattern
            best_pattern = max(patterns.items(), key=lambda x: x[1])
            pattern_name, confidence = best_pattern
            
            # Pattern-specific recommendations
            recommendations = {
                'absorption': f"Strong absorption at current level - potential reversal (confidence: {confidence:.2f})",
                'iceberg': f"Large hidden order detected - expect continued pressure (confidence: {confidence:.2f})",
                'aggressive_entry': f"Aggressive institutional entry - momentum likely to continue (confidence: {confidence:.2f})",
                'hidden_liquidity': f"Hidden liquidity present - price may face resistance (confidence: {confidence:.2f})",
                'stop_hunt': f"Potential stop hunt detected - expect reversal after liquidity grab (confidence: {confidence:.2f})",
                'momentum_shift': f"Momentum shift detected - trend change possible (confidence: {confidence:.2f})",
                'volume_spike': f"Significant volume spike - institutional interest confirmed (confidence: {confidence:.2f})",
                'order_flow_imbalance': f"Strong order flow imbalance - directional move expected (confidence: {confidence:.2f})"
            }
            
            return recommendations.get(pattern_name, f"Pattern detected: {pattern_name} (confidence: {confidence:.2f})")
            
        except Exception as e:
            logger.error(f"❌ Recommendation generation error: {e}")
            return "Unable to generate recommendation"
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get pattern detection performance metrics"""
        return {
            'patterns_detected_today': len(self.detection_history),
            'detection_accuracy': 0.85,  # Placeholder
            'most_frequent_pattern': 'absorption',  # Placeholder
            'avg_confidence': 0.87,  # Placeholder
            'thresholds': self.thresholds
        }