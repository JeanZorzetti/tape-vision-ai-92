// Vercel serverless entrypoint. The platform imports this module and calls the
// exported handler per request — the Express app is already one.
module.exports = require('../src/server-production');
