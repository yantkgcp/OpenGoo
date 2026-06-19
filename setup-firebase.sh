#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}     OpenGoo! Firebase Setup & Rules Deployer       ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect environment configuration file
ENV_FILE=""
if [ -f ".env.production" ]; then
    ENV_FILE=".env.production"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

# Parse GCP configs from env file if present
GCP_PROJECT_ID=""
GCP_REGION=""

if [ -n "$ENV_FILE" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        line=$(echo "$line" | xargs)
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue
        
        if [[ "$line" =~ ^GCP_PROJECT_ID= ]]; then
            GCP_PROJECT_ID=$(echo "$line" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        elif [[ "$line" =~ ^GCP_REGION= ]]; then
            GCP_REGION=$(echo "$line" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        fi
    done < "$ENV_FILE"
fi

if [ -z "$GCP_PROJECT_ID" ]; then
    echo -e "${RED}Error: GCP_PROJECT_ID is not defined in your environment or .env file.${NC}"
    echo "Please define GCP_PROJECT_ID in your .env file to specify the target GCP project."
    exit 1
fi

if [ -z "$GCP_REGION" ]; then
    echo -e "${RED}Error: GCP_REGION is not defined in your environment or .env file.${NC}"
    echo "Please define GCP_REGION in your .env file to specify the target deployment region."
    exit 1
fi

PROJECT_ID="$GCP_PROJECT_ID"
REGION="$GCP_REGION"
APP_NICKNAME="opengoo-web-app"
RULES_FILE="firestore.rules"

echo -e "Project ID: ${GREEN}${PROJECT_ID}${NC}"
echo -e "Region:     ${GREEN}${REGION}${NC}"

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: 'gcloud' Command Line Interface is not installed.${NC}"
    exit 1
fi

# 2. Check if user is authenticated with gcloud
ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${RED}Error: No active Google Cloud account found. Run: gcloud auth login${NC}"
    exit 1
fi
echo -e "Authenticated as: ${GREEN}${ACTIVE_ACCOUNT}${NC}"

# 3. Ensure required Google Cloud APIs are enabled
echo -e "\n${YELLOW}1. Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    firebase.googleapis.com \
    firestore.googleapis.com \
    firebaserules.googleapis.com \
    --project="$PROJECT_ID"
echo -e "${GREEN}✓ APIs enabled successfully!${NC}"

# 4. Check if Firebase is active on the project
echo -e "\n${YELLOW}2. Ensuring Firebase is active on GCP Project...${NC}"
gcloud alpha firebase projects add-firebase "$PROJECT_ID" 2>/dev/null || echo "Firebase is already initialized on project."

# 5. Create a Firebase Web App if it doesn't exist
echo -e "\n${YELLOW}3. Registering Web Application with Firebase...${NC}"
APP_ID=$(gcloud alpha firebase web-apps list --project="$PROJECT_ID" --format="value(appId)" --filter="displayName:$APP_NICKNAME" 2>/dev/null || true)

if [ -z "$APP_ID" ]; then
    echo "Creating a new Web App named '$APP_NICKNAME'..."
    gcloud alpha firebase web-apps create "$APP_NICKNAME" --project="$PROJECT_ID"
    APP_ID=$(gcloud alpha firebase web-apps list --project="$PROJECT_ID" --format="value(appId)" --filter="displayName:$APP_NICKNAME")
fi
echo -e "${GREEN}✓ Web App registered. App ID: ${APP_ID}${NC}"

# 6. Fetch the Client API Credentials & SDK Configurations
echo -e "\n${YELLOW}4. Extracting client configuration keys...${NC}"
CONFIG_JSON=$(gcloud alpha firebase web-apps get-config "$APP_ID" --project="$PROJECT_ID" --format="json")

API_KEY=$(echo "$CONFIG_JSON" | grep -o '"apiKey": "[^"]*' | grep -o '[^"]*$')
AUTH_DOMAIN=$(echo "$CONFIG_JSON" | grep -o '"authDomain": "[^"]*' | grep -o '[^"]*$')
STORAGE_BUCKET=$(echo "$CONFIG_JSON" | grep -o '"storageBucket": "[^"]*' | grep -o '[^"]*$')
MESSAGING_SENDER_ID=$(echo "$CONFIG_JSON" | grep -o '"messagingSenderId": "[^"]*' | grep -o '[^"]*' | tail -n1)
APP_ID_VAL=$(echo "$CONFIG_JSON" | grep -o '"appId": "[^"]*' | grep -o '[^"]*$')

# 7. Write/Update the local .env configuration file
echo -e "\n${YELLOW}5. Updating local .env configuration...${NC}"
cat <<EOF > .env
# GCP Deployment Configurations
GCP_PROJECT_ID=$PROJECT_ID
GCP_SERVICE_NAME=opengoo
GCP_REGION=$REGION

# Firebase Client API Credentials (Auto-Generated)
VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=$APP_ID_VAL
EOF
echo -e "${GREEN}✓ Local .env configuration updated successfully!${NC}"

# 8. Deploy Firestore Security Rules
if [ -f "$RULES_FILE" ]; then
    echo -e "\n${YELLOW}6. Deploying Firestore Security Rules ($RULES_FILE)...${NC}"
    if [ ! -f "firebase.json" ]; then
        echo '{"firestore": {"rules": "firestore.rules"}}' > firebase.json
    fi
    npx firebase-tools deploy --only firestore:rules --project="$PROJECT_ID" --non-interactive
    echo -e "${GREEN}✓ Security rules deployed successfully!${NC}"
else
    echo -e "\n${RED}⚠️ Rules file '$RULES_FILE' not found. Skipping rules deployment.${NC}"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 Firebase Setup Automation Completed Successfully!${NC}"
echo -e "${GREEN}====================================================${NC}\n"
