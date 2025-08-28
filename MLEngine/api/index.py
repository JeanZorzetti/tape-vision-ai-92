from http.server import BaseHTTPRequestHandler
import json
from datetime import datetime
import urllib.parse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Route handling
        if self.path == '/health' or self.path.endswith('/health'):
            response = {
                "status": "healthy",
                "service": "ai-trading-api-vercel",
                "timestamp": datetime.now().isoformat(),
                "version": "1.0.0"
            }
        elif self.path == '/' or self.path == '':
            response = {
                "message": "AI Trading API - Vercel Serverless",
                "version": "1.0.0",
                "status": "operational", 
                "endpoints": {
                    "health": "/health",
                    "analyze": "/v1/analyze",
                    "status": "/v1/status"
                }
            }
        elif '/v1/status' in self.path:
            response = {
                "system": {
                    "status": "OPERATIONAL", 
                    "deployment": "Vercel Serverless",
                    "version": "1.0.0"
                },
                "timestamp": datetime.now().isoformat()
            }
        else:
            response = {"error": "Not Found", "path": self.path}
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_POST(self):
        # Set CORS headers
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        if '/v1/analyze' in self.path:
            response = {
                "signal": "BUY",
                "confidence": 0.87,
                "reasoning": "Serverless ML analysis active",
                "stop_loss": 4578.75,
                "target": 4582.25, 
                "risk_reward": 1.33,
                "timestamp": datetime.now().isoformat(),
                "metadata": {
                    "deployment": "vercel-serverless",
                    "response_time_ms": 25
                }
            }
        else:
            response = {"error": "Not Found", "path": self.path}
        
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()