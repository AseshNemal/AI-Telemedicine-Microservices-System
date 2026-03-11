FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
RUN mkdir -p /var/secrets/firebase && chown -R node:node /app /var/secrets/firebase

ENV NODE_ENV=production
ENV FIREBASE_SERVICE_ACCOUNT_PATH=/var/secrets/firebase/service-account.json
EXPOSE 5001

USER node
CMD ["npm", "start"]
