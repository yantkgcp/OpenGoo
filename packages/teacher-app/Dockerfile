# Stage 1: Build the React SPA
FROM node:20-alpine AS builder
WORKDIR /app

# Accept Firebase config as build arguments to bake them into the client bundle at compile-time
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIRESTORE_DATABASE_ID

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
ENV VITE_FIRESTORE_DATABASE_ID=$VITE_FIRESTORE_DATABASE_ID

# Copy workspaces manifests
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/teacher-app/package*.json ./packages/teacher-app/

# Install workspace dependencies
RUN npm install

# Copy the source code
COPY packages/core ./packages/core
COPY packages/teacher-app ./packages/teacher-app

# Build the teacher application
RUN npm run build:teacher

# Stage 2: Serve the app with Node.js Express server (Identity Bridge)
FROM node:20-alpine
WORKDIR /app
ENV PORT=8080

# Create minimal package.json to specify type module
RUN echo '{"type":"module"}' > package.json

# Install server production-dependencies
RUN npm install express@4 firebase-admin




# Copy compiled static SPA files and server code
COPY --from=builder /app/packages/teacher-app/dist ./dist
COPY packages/teacher-app/server.js ./server.js

EXPOSE 8080
CMD ["node", "server.js"]
