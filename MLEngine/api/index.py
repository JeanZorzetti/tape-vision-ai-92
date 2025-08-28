"""
🚀 Vercel Entry Point - AI Trading API
Entry point optimized for Vercel serverless deployment
"""

import sys
import os

# Add the parent directory to the path so we can import from main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

# Vercel expects the app to be available as 'app'
# This is the entry point for Vercel
handler = app