#!/bin/bash
set -e

echo "Building frontend..."
vite build

echo "Building backend (web + worker)..."
esbuild server/index.ts server/worker.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "Build complete!"
echo "- Frontend: dist/public"
echo "- Backend (web): dist/index.js"
echo "- Backend (worker): dist/worker.js"
