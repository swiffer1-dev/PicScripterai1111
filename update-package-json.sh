#!/bin/bash
# Script to add db:generate and db:migrate scripts to package.json
# Run this to complete the setup

echo "This will add the following scripts to package.json:"
echo ""
echo '  "db:generate": "drizzle-kit generate",'
echo '  "db:migrate": "drizzle-kit migrate"'
echo ""
echo "Please add these manually to the scripts section in package.json"
echo ""
echo "Alternatively, use npx commands directly:"
echo "  npx drizzle-kit generate"
echo "  npx drizzle-kit migrate"
