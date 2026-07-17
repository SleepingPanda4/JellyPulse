FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/SleepingPanda4/JellyPulse"
LABEL org.opencontainers.image.description="JellyPulse monitoring and issue reporting for Jellyfin"
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
