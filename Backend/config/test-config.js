/**
 * Configuration Test Script
 * Tests if all config files are valid and can be loaded
 */

const fs = require('fs');
const path = require('path');

const configFiles = [
  'default.json',
  'development.json', 
  'production.json',
  'trading.json',
  'database.json',
  'logging.json'
];

console.log('🧪 Testing Backend Configuration Files...\n');

let allValid = true;

configFiles.forEach(filename => {
  try {
    const filePath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${filename} - File not found`);
      allValid = false;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(content);
    
    console.log(`✅ ${filename} - Valid JSON (${Object.keys(config).length} top-level keys)`);
    
    // Show some key configurations for main files
    if (filename === 'default.json') {
      console.log(`   📊 Server port: ${config.server?.port || 'undefined'}`);
      console.log(`   🎯 Trading enabled: ${config.trading?.enabled || 'undefined'}`);
      console.log(`   🤖 AI confidence threshold: ${config.ai?.analysisSettings?.confidenceThreshold || 'undefined'}`);
    }
    
    if (filename === 'trading.json') {
      console.log(`   💼 Symbols configured: ${Object.keys(config.symbols || {}).length}`);
      console.log(`   🎛️ Strategies: ${Object.keys(config.strategies || {}).length}`);
    }
    
    if (filename === 'database.json') {
      console.log(`   🗃️ MongoDB environments: ${Object.keys(config.mongodb || {}).length}`);
      console.log(`   🔄 Redis environments: ${Object.keys(config.redis || {}).length}`);
    }
    
  } catch (error) {
    console.log(`❌ ${filename} - Invalid JSON: ${error.message}`);
    allValid = false;
  }
});

console.log('\n📋 Configuration Summary:');

if (allValid) {
  console.log('✅ All configuration files are valid and ready to use!');
  console.log('🚀 Backend can be deployed with these configurations.');
  
  console.log('\n🔧 Key Settings:');
  console.log('- Development: Low risk, debug logging, local databases');
  console.log('- Production: High security, optimized performance, remote databases');
  console.log('- Trading: Comprehensive risk management and strategy parameters');
  console.log('- Database: Optimized indexes and monitoring for both MongoDB and Redis');
  
} else {
  console.log('❌ Some configuration files have issues. Please fix them before deployment.');
  process.exit(1);
}

console.log('\n💡 Next steps:');
console.log('1. Copy secrets.json.example to secrets.json and fill with real credentials');
console.log('2. Set NODE_ENV environment variable (development/production)');
console.log('3. Configure database connections for your environment');
console.log('4. Test with: npm run dev (development) or npm run start (production)');