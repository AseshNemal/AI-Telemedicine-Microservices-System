FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 5001

USER node
CMD ["npm", "start"]
