# Build stage
FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Run stage
FROM node:22-alpine
WORKDIR /usr/src/app
ENV TZ=Europe/Berlin
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./
RUN npm install --only=production
CMD ["node", "dist/Bot.js"]