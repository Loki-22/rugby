FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

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

# Start server
CMD ["npm", "start"]
