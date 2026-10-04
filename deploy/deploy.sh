#!/usr/bin/env bash
# Runs on the host, from the repository checkout: renders .env from Secrets Manager, pulls the API image and restarts the stack.
#
# First deploy:
#   API_DOMAIN=api.example.com \
#   API_IMAGE=<account>.dkr.ecr.us-east-1.amazonaws.com/chatquiry-prod-api:<tag> \
#   GUARDRAIL_ID=<id> GUARDRAIL_VERSION=<version> \
#   ./deploy/deploy.sh
#
# Later, values left out keep what the previous deploy wrote: a release passes only API_IMAGE,
# and running it bare reloads the secrets after one changes.
set -euo pipefail
cd "$(dirname "$0")"

previous() {
  if [ -f .env ]; then sed -n "s/^$1=//p" .env; fi
}

API_DOMAIN="${API_DOMAIN:-$(previous API_DOMAIN)}"
API_IMAGE="${API_IMAGE:-$(previous API_IMAGE)}"
GUARDRAIL_ID="${GUARDRAIL_ID:-$(previous GUARDRAIL_ID)}"
GUARDRAIL_VERSION="${GUARDRAIL_VERSION:-$(previous GUARDRAIL_VERSION)}"
CUSTOMER_ASSERTION_PUBLIC_KEY="${CUSTOMER_ASSERTION_PUBLIC_KEY:-$(previous CUSTOMER_ASSERTION_PUBLIC_KEY)}"
: "${API_DOMAIN:?API_DOMAIN is required on the first deploy}"
: "${API_IMAGE:?API_IMAGE is required on the first deploy}"
REGION="${AWS_REGION:-us-east-1}"
PREFIX="${SECRET_PREFIX:-chatquiry/prod}"

secret() {
  aws secretsmanager get-secret-value --region "$REGION" --secret-id "$PREFIX/$1" --query SecretString --output text
}

umask 077
cat > .env <<EOF
API_DOMAIN=$API_DOMAIN
API_IMAGE=$API_IMAGE
AWS_REGION=$REGION
GUARDRAIL_ID=$GUARDRAIL_ID
GUARDRAIL_VERSION=${GUARDRAIL_VERSION:-DRAFT}
CUSTOMER_ASSERTION_PUBLIC_KEY=$CUSTOMER_ASSERTION_PUBLIC_KEY
POSTGRES_PASSWORD=$(secret postgres-password)
JWT_SECRET=$(secret jwt-secret)
SEED_PASSWORD=$(secret seed-password)
TYPESAFE_API_KEY=$(secret typesafe-api-key)
EOF

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${API_IMAGE%%/*}"
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
docker compose -f compose.prod.yaml ps
