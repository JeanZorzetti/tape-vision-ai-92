# Lightweight Dockerfile for Tape Vision AI Trading Backend
FROM node:18-alpine

# Install system dependencies and dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Create minimal package.json with only essential dependencies
RUN echo '{ \
  "name": "tape-vision-trading-backend", \
  "version": "1.0.0", \
  "main": "server-minimal.js", \
  "scripts": { \
    "start": "node server-minimal.js" \
  }, \
  "dependencies": { \
    "express": "^4.21.2", \
    "cors": "^2.8.5", \
    "dotenv": "^16.6.1" \
  } \
}' > package.json

# Install only minimal dependencies
RUN npm install --only=production && npm cache clean --force

# Copy the minimal server (JavaScript version)
COPY server-minimal.js ./

# Copy environment file
COPY .env.example ./.env

# Create logs directory
RUN mkdir -p logs

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { \
    if (res.statusCode === 200) { process.exit(0) } else { process.exit(1) } \
  }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]