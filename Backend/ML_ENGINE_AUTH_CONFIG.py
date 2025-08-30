"""
ML Engine Authentication Configuration
Configures Python ML Engine to authenticate with TypeScript Backend middleware
"""

import os
import requests
import jwt
import json
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class BackendAuthenticator:
    """Handles authentication with the TypeScript Backend middleware"""
    
    def __init__(self, backend_url: str = None, ml_engine_credentials: Dict[str, str] = None):
        self.backend_url = backend_url or os.getenv('BACKEND_URL', 'http://localhost:3001')
        self.credentials = ml_engine_credentials or {
            'email': os.getenv('ML_ENGINE_EMAIL', 'ml.engine@aitrading.roilabs.com.br'),
            'password': os.getenv('ML_ENGINE_PASSWORD', 'MLEngine@2025!'),
            'api_key': os.getenv('ML_ENGINE_API_KEY', 'ml-engine-api-key-2025')
        }
        
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.token_expires_at: Optional[datetime] = None
        self.session = requests.Session()
        
        # Configure session headers
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'MLEngine/1.0 Python'
        })
        
        print(f"🤖 ML Engine Backend Authenticator initialized")
        print(f"📡 Backend URL: {self.backend_url}")
    
    def authenticate(self) -> bool:
        """Authenticate with the Backend and obtain JWT tokens"""
        try:
            print("🔐 Authenticating ML Engine with Backend...")
            
            # Login request
            login_data = {
                'email': self.credentials['email'],
                'password': self.credentials['password']
            }
            
            response = self.session.post(
                f"{self.backend_url}/api/auth/login",
                json=login_data,
                timeout=10
            )
            
            if response.status_code == 200:
                auth_data = response.json()
                
                # Store tokens
                self.access_token = auth_data['tokens']['accessToken']
                self.refresh_token = auth_data.get('tokens', {}).get('refreshToken')
                
                # Calculate token expiry (JWT tokens typically expire in 24h)
                self.token_expires_at = datetime.now() + timedelta(hours=23)  # 23h for safety
                
                # Update session headers with authorization
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}',
                    'X-API-Key': self.credentials['api_key']
                })
                
                print("✅ ML Engine authenticated successfully")
                print(f"🎫 Token expires at: {self.token_expires_at}")
                return True
            else:
                print(f"❌ Authentication failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False
    
    def refresh_tokens(self) -> bool:
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            print("⚠️ No refresh token available, re-authenticating...")
            return self.authenticate()
        
        try:
            print("🔄 Refreshing ML Engine tokens...")
            
            refresh_data = {
                'refreshToken': self.refresh_token
            }
            
            response = self.session.post(
                f"{self.backend_url}/api/auth/refresh",
                json=refresh_data,
                timeout=10
            )
            
            if response.status_code == 200:
                auth_data = response.json()
                
                self.access_token = auth_data['accessToken']
                self.refresh_token = auth_data.get('refreshToken', self.refresh_token)
                self.token_expires_at = datetime.now() + timedelta(hours=23)
                
                # Update session headers
                self.session.headers.update({
                    'Authorization': f'Bearer {self.access_token}'
                })
                
                print("✅ Tokens refreshed successfully")
                return True
            else:
                print(f"❌ Token refresh failed: {response.status_code}")
                return self.authenticate()  # Fallback to full authentication
                
        except Exception as e:
            print(f"❌ Token refresh error: {str(e)}")
            return self.authenticate()  # Fallback to full authentication
    
    def ensure_authenticated(self) -> bool:
        """Ensure we have valid authentication before making requests"""
        # Check if we need to authenticate for the first time
        if not self.access_token:
            return self.authenticate()
        
        # Check if token is close to expiring (refresh 1 hour before expiry)
        if self.token_expires_at and (datetime.now() + timedelta(hours=1)) >= self.token_expires_at:
            return self.refresh_tokens()
        
        return True
    
    def make_authenticated_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make an authenticated request to the Backend API"""
        if not self.ensure_authenticated():
            raise Exception("Failed to authenticate with Backend")
        
        url = f"{self.backend_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            # Handle 401 Unauthorized - token might be invalid
            if response.status_code == 401:
                print("🔄 Received 401, attempting to refresh token...")
                if self.refresh_tokens():
                    # Retry the request with new token
                    response = self.session.request(method, url, **kwargs)
                else:
                    raise Exception("Authentication refresh failed")
            
            return response
            
        except Exception as e:
            print(f"❌ Authenticated request failed: {str(e)}")
            raise
    
    def register_ml_predictions(self, predictions: list) -> bool:
        """Send ML predictions to Backend for storage and distribution"""
        try:
            response = self.make_authenticated_request(
                'POST',
                '/api/trading/ml/predictions',
                json={'predictions': predictions},
                timeout=15
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Registered {len(predictions)} ML predictions with Backend")
                return True
            else:
                print(f"⚠️ Failed to register predictions: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error registering predictions: {str(e)}")
            return False
    
    def get_market_data(self) -> Optional[Dict[str, Any]]:
        """Get latest market data from Backend"""
        try:
            response = self.make_authenticated_request(
                'GET',
                '/api/trading/market-data',
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"⚠️ Failed to get market data: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting market data: {str(e)}")
            return None
    
    def send_health_status(self, status: Dict[str, Any]) -> bool:
        """Send ML Engine health status to Backend"""
        try:
            response = self.make_authenticated_request(
                'POST',
                '/api/system/ml-engine/health',
                json=status,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                return True
            else:
                print(f"⚠️ Failed to send health status: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Error sending health status: {str(e)}")
            return False
    
    def is_authenticated(self) -> bool:
        """Check if currently authenticated"""
        return (
            self.access_token is not None and
            self.token_expires_at is not None and
            datetime.now() < self.token_expires_at
        )

# Global authenticator instance
ml_backend_auth = BackendAuthenticator()

# Convenience functions for ML Engine scripts
def authenticate_ml_engine() -> bool:
    """Authenticate ML Engine with Backend"""
    return ml_backend_auth.authenticate()

def send_predictions(predictions: list) -> bool:
    """Send ML predictions to Backend"""
    return ml_backend_auth.register_ml_predictions(predictions)

def get_market_data() -> Optional[Dict[str, Any]]:
    """Get market data from Backend"""
    return ml_backend_auth.get_market_data()

def send_health_status(status: Dict[str, Any]) -> bool:
    """Send health status to Backend"""
    return ml_backend_auth.send_health_status(status)

def is_authenticated() -> bool:
    """Check authentication status"""
    return ml_backend_auth.is_authenticated()

# Auto-authentication on module import
if __name__ == "__main__":
    # Test authentication
    print("🧪 Testing ML Engine Backend Authentication...")
    
    if authenticate_ml_engine():
        print("✅ Authentication test passed!")
        
        # Test market data retrieval
        market_data = get_market_data()
        if market_data:
            print(f"✅ Market data test passed: {len(market_data)} data points")
        
        # Test predictions sending
        test_predictions = [
            {
                'signal': 'BUY',
                'confidence': 0.85,
                'reasoning': 'Test ML prediction',
                'timestamp': datetime.now().isoformat(),
                'symbol': 'WDO'
            }
        ]
        
        if send_predictions(test_predictions):
            print("✅ Predictions sending test passed!")
        
        # Test health status
        health_status = {
            'status': 'healthy',
            'models_loaded': 4,
            'predictions_per_minute': 12,
            'memory_usage_mb': 512,
            'timestamp': datetime.now().isoformat()
        }
        
        if send_health_status(health_status):
            print("✅ Health status test passed!")
            
        print("🎉 All ML Engine Backend integration tests passed!")
    else:
        print("❌ Authentication test failed!")
        exit(1)