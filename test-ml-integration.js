/**
 * Test ML Engine Integration
 * Tests the connection between Backend and ML Engine API
 */

const axios = require('axios');

const ML_ENGINE_URL = 'https://ml.aitrading.roilabs.com.br'; // Correct ML Engine URL
// For now: use Vercel URL (e.g., your-app-abc123.vercel.app)

async function testMLEngine() {
  console.log('🧪 Testing ML Engine Integration...');
  console.log(`🎯 Target URL: ${ML_ENGINE_URL}`);
  console.log('');

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${ML_ENGINE_URL}/health`, { timeout: 5000 });
    console.log('✅ Health Check:', healthResponse.data);
    console.log('');

    // Test 2: Market Analysis
    console.log('2️⃣ Testing Market Analysis...');
    const analysisData = {
      market_data: {
        symbol: 'WDO',
        price: 4580.25,
        volume: 150,
        bid: 4580.00,
        ask: 4580.50
      },
      tape_data: [
        { price: 4580.25, volume: 10, aggressor_side: 'buy', timestamp: new Date().toISOString() }
      ],
      order_flow: {
        bid_volume: 100,
        ask_volume: 80,
        imbalance_ratio: 0.25
      }
    };

    const analysisResponse = await axios.post(`${ML_ENGINE_URL}/v1/analyze`, analysisData, { timeout: 5000 });
    console.log('✅ Market Analysis:', analysisResponse.data);
    console.log('');

    // Test 3: System Status
    console.log('3️⃣ Testing System Status...');
    const statusResponse = await axios.get(`${ML_ENGINE_URL}/v1/status`, { timeout: 5000 });
    console.log('✅ System Status:', statusResponse.data);
    console.log('');

    console.log('🎉 All tests passed! ML Engine is ready for integration.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('');
    console.log('💡 Next steps:');
    console.log('1. Verify Vercel deployment is working');
    console.log('2. Update ML_ENGINE_URL with correct domain');
    console.log('3. Check DNS configuration if using custom domain');
  }
}

testMLEngine();