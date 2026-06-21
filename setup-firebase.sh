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

# 2. Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: 'jq' command line JSON processor is not installed.${NC}"
    echo "Please install jq to run this script (e.g. 'brew install jq' on macOS or 'sudo apt-get install jq' on Debian/Ubuntu)."
    exit 1
fi

# 3. Check if user is authenticated with gcloud
ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${RED}Error: No active Google Cloud account found. Run: gcloud auth login${NC}"
    exit 1
fi
echo -e "Authenticated as: ${GREEN}${ACTIVE_ACCOUNT}${NC}"

# 4. Ensure required Google Cloud APIs are enabled
echo -e "\n${YELLOW}1. Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    firebase.googleapis.com \
    firestore.googleapis.com \
    firebaserules.googleapis.com \
    cloudresourcemanager.googleapis.com \
    identitytoolkit.googleapis.com \
    --project="$PROJECT_ID"
echo -e "${GREEN}✓ APIs enabled successfully!${NC}"

# Get the access token for Firebase Management REST API calls
# Corporate/restrictive dev environments might enforce Certificate Based Access (CBA) on the gcloud token,
# which curl requests will reject. We try to use Application Default Credentials (ADC) as a fallback/preference.
ACCESS_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null || true)
if [ -z "$ACCESS_TOKEN" ]; then
    ACCESS_TOKEN=$(gcloud auth print-access-token 2>/dev/null || true)
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${RED}Error: Failed to obtain an access token. Please run 'gcloud auth login' or 'gcloud auth application-default login' first.${NC}"
    exit 1
fi


# 5. Auto-Initialize the Firestore Instance
echo -e "\n${YELLOW}2. Checking and auto-initializing Firestore instance...${NC}"
if ! gcloud firestore databases list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null | grep -q "(default)"; then
    echo "Creating default Firestore database in Native mode..."
    gcloud firestore databases create --location="$REGION" --project="$PROJECT_ID" --type=firestore-native
    echo -e "${GREEN}✓ Firestore default database created successfully!${NC}"
else
    echo -e "${GREEN}✓ Firestore default database already exists.${NC}"
fi

# 6. Check if Firebase is active on the project
echo -e "\n${YELLOW}3. Ensuring Firebase is active on GCP Project...${NC}"
ACTIVATE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}:addFirebase")

if echo "$ACTIVATE_RESPONSE" | grep -q "ALREADY_EXISTS" 2>/dev/null; then
    echo "Firebase is already initialized on project."
else
    echo "Firebase activation requested/completed."
fi

# 7. Create a Firebase Web App if it doesn't exist
echo -e "\n${YELLOW}4. Registering Web Application with Firebase...${NC}"
APP_ID=$(curl -s -X GET \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" | \
    jq -r ".apps[]? | select(.displayName == \"$APP_NICKNAME\") | .appId" 2>/dev/null || true)

if [ -z "$APP_ID" ] || [ "$APP_ID" = "null" ]; then
    echo "Creating a new Web App named '$APP_NICKNAME'..."
    CREATE_RESPONSE=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"displayName\": \"$APP_NICKNAME\"}" \
        "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps")
    
    echo "Waiting for Web App registration to complete..."
    for i in {1..10}; do
        sleep 2
        APP_ID=$(curl -s -X GET \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" | \
            jq -r ".apps[]? | select(.displayName == \"$APP_NICKNAME\") | .appId" 2>/dev/null || true)
        if [ -n "$APP_ID" ] && [ "$APP_ID" != "null" ]; then
            break
        fi
    done
fi

if [ -z "$APP_ID" ] || [ "$APP_ID" = "null" ]; then
    echo -e "${RED}Error: Failed to register or retrieve Web App ID.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Web App registered. App ID: ${APP_ID}${NC}"

# 8. Fetch the Client API Credentials & SDK Configurations
echo -e "\n${YELLOW}5. Extracting client configuration keys...${NC}"
CONFIG_JSON=$(curl -s -X GET \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps/${APP_ID}/config")

API_KEY=$(echo "$CONFIG_JSON" | jq -r '.apiKey // ""')
AUTH_DOMAIN=$(echo "$CONFIG_JSON" | jq -r '.authDomain // ""')
STORAGE_BUCKET=$(echo "$CONFIG_JSON" | jq -r '.storageBucket // ""')
MESSAGING_SENDER_ID=$(echo "$CONFIG_JSON" | jq -r '.messagingSenderId // ""')
APP_ID_VAL=$(echo "$CONFIG_JSON" | jq -r '.appId // ""')

# 9. Write/Update the local .env configuration file
echo -e "\n${YELLOW}6. Updating local .env configuration...${NC}"
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

# 10. Deploy Firestore Security Rules natively via REST API (decoupling from firebase-tools)
if [ -f "$RULES_FILE" ]; then
    echo -e "\n${YELLOW}7. Deploying Firestore Security Rules ($RULES_FILE) natively...${NC}"
    
    # 1. Create a ruleset payload
    jq -n --rawfile content "$RULES_FILE" '{source: {files: [{name: "firestore.rules", content: $content}]}}' > payload.json

    # 2. Upload ruleset
    echo "Uploading ruleset..."
    RULESET_RESPONSE=$(curl -s -X POST \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d @payload.json \
      "https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets")
    
    RULESET_NAME=$(echo "$RULESET_RESPONSE" | jq -r '.name')
    
    if [ -z "$RULESET_NAME" ] || [ "$RULESET_NAME" = "null" ]; then
        echo -e "${RED}Error uploading ruleset: $RULESET_RESPONSE${NC}"
        rm -f payload.json
        exit 1
    fi
    echo "Ruleset uploaded successfully: $RULESET_NAME"
    rm -f payload.json

    # 3. Release ruleset
    echo "Releasing ruleset for Cloud Firestore..."
    RELEASE_NAME="projects/${PROJECT_ID}/releases/cloud.firestore"
    
    # Try to PATCH first (updates an existing release)
    PATCH_RESPONSE=$(curl -s -X PATCH \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"release\": {\"name\": \"${RELEASE_NAME}\", \"rulesetName\": \"${RULESET_NAME}\"}, \"updateMask\": \"rulesetName\"}" \
      "https://firebaserules.googleapis.com/v1/${RELEASE_NAME}")


    # If the response contains NOT_FOUND (indicating the release doesn't exist yet), we do a POST
    if echo "$PATCH_RESPONSE" | grep -q "NOT_FOUND"; then
        echo "Release 'cloud.firestore' not found. Creating a new release..."
        POST_RESPONSE=$(curl -s -X POST \
          -H "Authorization: Bearer $ACCESS_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{\"name\": \"${RELEASE_NAME}\", \"rulesetName\": \"${RULESET_NAME}\"}" \
          "https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases")
        
        if echo "$POST_RESPONSE" | grep -q "error"; then
            echo -e "${RED}Error creating release: $POST_RESPONSE${NC}"
            exit 1
        fi
    elif echo "$PATCH_RESPONSE" | grep -q "error"; then
        echo -e "${RED}Error updating release: $PATCH_RESPONSE${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Security rules deployed successfully!${NC}"
else
    echo -e "\n${RED}⚠️ Rules file '$RULES_FILE' not found. Skipping rules deployment.${NC}"
fi

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 Firebase Setup Automation Completed Successfully!${NC}"
echo -e "${GREEN}====================================================${NC}\n"
