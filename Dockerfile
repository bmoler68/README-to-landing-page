FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /action

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY templates/ ./templates/

ENTRYPOINT ["node", "/action/src/index.js"]
