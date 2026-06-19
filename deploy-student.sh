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
echo -e "${BLUE}    🎮 OpenGoo! Public Student Client Deployer       ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Detect environment configuration file
ENV_FILE=""
if [ -f ".env.production" ]; then
    ENV_FILE=".env.production"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

# Parse GCP Deployment configs from env file if present
GCP_PROJECT_ID=""
GCP_SERVICE_NAME="opengoo-student"
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

# STRICT CONSTRAINT VALIDATION
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
SERVICE_NAME="opengoo-student"
REGION="$GCP_REGION"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: 'gcloud' Command Line Interface is not installed.${NC}"
    echo "Please install the Google Cloud SDK before running this script:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 2. Check if user is authenticated with gcloud
echo -e "${YELLOW}Checking gcloud authentication status...${NC}"
ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${RED}Error: No active Google Cloud account found.${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi
echo -e "${GREEN}Authenticated as: ${ACTIVE_ACCOUNT}${NC}"

# 3. Configure the GCP project
echo -e "${YELLOW}Setting Google Cloud project to '${PROJECT_ID}'...${NC}"
gcloud config set project "${PROJECT_ID}"

# 4. Detect and process environment variables for Vite SPA baking
SUB_LIST="_IMAGE_TAG=${IMAGE_TAG}"

if [ -n "$ENV_FILE" ]; then
    echo -e "${GREEN}Detected local configuration file: ${ENV_FILE}${NC}"
    echo "Parsing VITE_ environment variables to bake into the Docker build stage..."
    
    # Read file line-by-line, discarding carriage returns, empty lines, and comments
    while IFS= read -r line || [ -n "$line" ]; do
        # Trim whitespace
        line=$(echo "$line" | xargs)
        # Skip empty lines or comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue
        
        # Check if the variable starts with VITE_
        if [[ "$line" =~ ^VITE_ ]]; then
            key=$(echo "$line" | cut -d'=' -f1 | xargs)
            # Retrieve value, strip enclosing quotes
            val=$(echo "$line" | cut -d'=' -f2- | xargs | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
            
            echo -e "  -> Found: ${BLUE}${key}${NC}=${YELLOW}********${NC}"
            SUB_LIST="${SUB_LIST},_${key}=${val}"
        fi
    done < "$ENV_FILE"
else
    echo -e "${YELLOW}No .env or .env.production file found.${NC}"
    echo "The build will proceed with default local configurations (BroadcastChannel fallback offline sync)."
fi

# 5. Build the Docker image using Google Cloud Build
echo -e "\n${YELLOW}Submitting build to Google Cloud Build (Student app)...${NC}"
echo -e "Image tag: ${BLUE}${IMAGE_TAG}${NC}"

gcloud builds submit --config=cloudbuild-student.yaml --substitutions="${SUB_LIST}" .

echo -e "${GREEN}✓ Cloud Build finished successfully!${NC}"

# 6. Deploy to Google Cloud Run with Public Access
echo -e "\n${YELLOW}Deploying container to Google Cloud Run...${NC}"
echo -e "Service: ${BLUE}${SERVICE_NAME}${NC} in region: ${BLUE}${REGION}${NC}"
echo -e "Security constraint: ${GREEN}Public Access Enabled (unauthenticated allowed)${NC}"

# Deploy with unauthenticated access enabled
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_TAG}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated

# 7. Retrieve Service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --platform managed --region "${REGION}" --format 'value(status.url)' 2>/dev/null || true)

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 Student Gamepad Deployment Successful!             ${NC}"
echo -e "====================================================${NC}"
if [ -n "$SERVICE_URL" ]; then
    echo -e "Your OpenGoo! Student Gamepad Client is now live at:"
    echo -e "${BLUE}${SERVICE_URL}${NC}"
else
    echo -e "Your service was deployed but we couldn't automatically query the URL."
    echo -e "Please check the Google Cloud Console for the Cloud Run link."
fi
echo -e "${GREEN}====================================================${NC}\n"
