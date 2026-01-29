FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV DB_PATH=/data/lobster-trap.db
EXPOSE 3000
CMD ["node", "index.js"]
