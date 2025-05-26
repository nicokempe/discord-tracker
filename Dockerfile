# Build stage
FROM node:24-alpine AS build
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Run stage
FROM node:24-alpine
WORKDIR /usr/src/app
ENV TZ=Europe/Berlin
COPY --from=build /usr/src/app/dist ./dist
COPY package*.json ./
COPY config/users.json ./config/
RUN npm install --only=production
CMD ["node", "dist/Bot.js"]
