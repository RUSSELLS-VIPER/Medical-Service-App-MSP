#!/bin/bash
set -euo pipefail

rm -rf ./.amplify-hosting

mkdir -p ./.amplify-hosting/compute/default
mkdir -p ./.amplify-hosting/static

# Runtime application files for compute
cp index.js ./.amplify-hosting/compute/default/index.js
cp package.json ./.amplify-hosting/compute/default/package.json
cp package-lock.json ./.amplify-hosting/compute/default/package-lock.json
cp -r app ./.amplify-hosting/compute/default/app
cp -r views ./.amplify-hosting/compute/default/views
cp -r public ./.amplify-hosting/compute/default/public
cp -r node_modules ./.amplify-hosting/compute/default/node_modules

# Static assets served directly by Amplify edge
cp -r public/* ./.amplify-hosting/static/ 2>/dev/null || true

cp deploy-manifest.json ./.amplify-hosting/deploy-manifest.json
