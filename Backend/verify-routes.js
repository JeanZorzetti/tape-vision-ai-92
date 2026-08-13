/**
 * Script para verificar quais rotas estão disponíveis no servidor
 * Execute: node verify-routes.js
 */

const axios = require('axios');

const BACKEND_URL = 'https://apptapevision.roilabs.com.br';

async function checkRoutes() {
  console.log('🔍 Verificando rotas do servidor...\n');
  
  const routes = [
    { path: '/health', method: 'GET', description: 'Health check' },
    { path: '/api/auth/login', method: 'POST', description: 'Login endpoint' },
    { path: '/api/auth/logout', method: 'POST', description: 'Logout endpoint' },
    { path: '/api/trading/status', method: 'GET', description: 'Trading status' },
    { path: '/api/trading/ml/predictions', method: 'GET', description: 'ML predictions' }
  ];

  for (const route of routes) {
    try {
      const response = await axios({
        method: route.method,
        url: `${BACKEND_URL}${route.path}`,
        timeout: 5000,
        validateStatus: function (status) {
          // Aceita qualquer status como válido (não 404)
          return status !== 404;
        }
      });
      
      console.log(`✅ ${route.method} ${route.path} - ${response.status} (${route.description})`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`❌ ${route.method} ${route.path} - 404 NOT FOUND (${route.description})`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`🔴 ${route.method} ${route.path} - SERVIDOR OFFLINE (${route.description})`);
      } else {
        console.log(`⚠️  ${route.method} ${route.path} - ${error.response?.status || 'ERROR'} (${route.description})`);
      }
    }
  }

  console.log('\n📋 Diagnóstico:');
  console.log('- Se /health funciona mas /api/auth/login retorna 404 → Servidor wrong está rodando');
  console.log('- Se todos retornam OFFLINE → Servidor não está rodando');
  console.log('- Se /api/auth/login funciona → Servidor correto está rodando');
}

checkRoutes().catch(console.error);