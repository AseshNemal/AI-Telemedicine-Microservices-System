FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY uploads ./uploads
RUN mkdir -p /app/uploads/reports && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 5002

USER node
CMD ["npm", "start"]
