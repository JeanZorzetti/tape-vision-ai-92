#!/usr/bin/env python3
"""
🧪 AI Trading API - Test Script
Tests all API endpoints to ensure they work correctly before production deployment.
"""

import requests
import json
import time
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8001"
# For production testing, change to: BASE_URL = "https://aitradingapi.roilabs.com.br"

def test_endpoint(method: str, endpoint: str, data: Dict[Any, Any] = None) -> Dict[str, Any]:
    """Test a single API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        start_time = time.time()
        
        if method.upper() == "GET":
            response = requests.get(url, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            return {"error": f"Unsupported method: {method}"}
        
        response_time = round((time.time() - start_time) * 1000, 2)
        
        return {
            "status_code": response.status_code,
            "response_time_ms": response_time,
            "success": response.status_code == 200,
            "data": response.json() if response.status_code == 200 else response.text
        }
    except requests.exceptions.RequestException as e:
        return {"error": str(e), "success": False}

def run_tests():
    """Run comprehensive API tests"""
    print("🧪 AI Trading API - Test Suite")
    print("=" * 50)
    print()
    
    tests = [
        {
            "name": "🏥 Health Check",
            "method": "GET",
            "endpoint": "/health"
        },
        {
            "name": "🏠 Root Endpoint",
            "method": "GET", 
            "endpoint": "/"
        },
        {
            "name": "📊 System Status",
            "method": "GET",
            "endpoint": "/v1/status"
        },
        {
            "name": "🤖 Model Information",
            "method": "GET",
            "endpoint": "/v1/models"
        },
        {
            "name": "🎯 Market Analysis",
            "method": "POST",
            "endpoint": "/v1/analyze",
            "data": {
                "market_data": {
                    "symbol": "WDO",
                    "price": 4580.25,
                    "volume": 150,
                    "bid": 4580.00,
                    "ask": 4580.50
                },
                "tape_data": [
                    {"price": 4580.25, "volume": 10, "side": "buy"},
                    {"price": 4580.00, "volume": 5, "side": "sell"}
                ],
                "order_flow": {
                    "bid_volume": 100,
                    "ask_volume": 80
                }
            }
        },
        {
            "name": "🔍 Pattern Detection",
            "method": "POST",
            "endpoint": "/v1/patterns",
            "data": {
                "market_data": {
                    "symbol": "WDO",
                    "price": 4580.25,
                    "volume": 200
                }
            }
        }
    ]
    
    results = []
    
    for test in tests:
        print(f"Testing {test['name']}...")
        
        result = test_endpoint(
            test["method"],
            test["endpoint"],
            test.get("data")
        )
        
        result["test_name"] = test["name"]
        result["endpoint"] = test["endpoint"]
        results.append(result)
        
        if result.get("success"):
            print(f"✅ {test['name']}: {result['response_time_ms']}ms")
        else:
            print(f"❌ {test['name']}: {result.get('error', 'Failed')}")
        
        time.sleep(0.1)  # Small delay between tests
    
    print()
    print("📊 Test Summary")
    print("-" * 30)
    
    successful = sum(1 for r in results if r.get("success"))
    total = len(results)
    
    print(f"✅ Successful: {successful}/{total}")
    print(f"❌ Failed: {total - successful}/{total}")
    
    if successful == total:
        print("🎉 All tests passed! API is ready for production.")
    else:
        print("⚠️  Some tests failed. Please check the API before deploying.")
    
    # Show detailed results for failed tests
    failed_tests = [r for r in results if not r.get("success")]
    if failed_tests:
        print()
        print("❌ Failed Test Details:")
        for test in failed_tests:
            print(f"  - {test['test_name']}: {test.get('error', 'Unknown error')}")
    
    return successful == total

if __name__ == "__main__":
    print("🚀 Starting API tests...")
    print(f"🎯 Target: {BASE_URL}")
    print()
    
    # Test if API is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API is running, starting comprehensive tests...")
            print()
            success = run_tests()
            exit(0 if success else 1)
        else:
            print(f"❌ API returned status code: {response.status_code}")
            exit(1)
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to API: {e}")
        print()
        print("💡 To start the API locally:")
        print("   cd MLEngine")
        print("   python main.py")
        print()
        print("💡 Or use Docker:")
        print("   docker-compose -f docker-compose.prod.yml up")
        exit(1)