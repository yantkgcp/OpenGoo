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

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

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

# Stage 2: Serve the app with Nginx
FROM nginx:stable-alpine

# Set default port environment variable (Cloud Run defaults to 8080)
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT

# Copy the built SPA files to Nginx public folder
COPY --from=builder /app/packages/teacher-app/dist /usr/share/nginx/html

# Copy Nginx template configuration for dynamic port substitution on Cloud Run
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Expose port 8080
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
