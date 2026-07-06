FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies and fix vulnerabilities (including low-level)
RUN npm install && npm audit fix --force --audit-level=low

# Copy application files
COPY index.html ./
COPY app.js ./
COPY styles.css ./
COPY games.js ./
COPY server.js ./

# Expose ports
EXPOSE 3000

# Create data directory for database
RUN mkdir -p /data

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:3000/api/games >/dev/null 2>&1 || exit 1

# Start server
CMD ["npm", "start"]
