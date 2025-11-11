#!/bin/bash

# Start both web server and worker process for development
# This ensures scheduled posts get processed automatically

echo "🚀 Starting Picscripterai (Web + Worker)..."

npx concurrently --kill-others-on-fail \
  --names "WEB,WORKER" \
  --prefix-colors "cyan,magenta" \
  "NODE_ENV=development tsx server/index.ts" \
  "NODE_ENV=development tsx server/worker.ts"
