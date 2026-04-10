FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY uploads ./uploads
RUN mkdir -p /app/uploads/reports /var/secrets/firebase && chown -R node:node /app /var/secrets/firebase

ENV NODE_ENV=production
ENV FIREBASE_SERVICE_ACCOUNT_PATH=/var/secrets/firebase/service-account.json
EXPOSE 5002

USER node
CMD ["npm", "start"]
