#!/bin/bash
# Master build script that runs all build steps in sequence

echo "=== Starting production build process ==="
echo "This script will build the application in multiple steps to avoid timeout issues."
echo ""

# Run each build step
./build-step1.sh
echo ""
./build-step2.sh
echo ""
./build-step3.sh
echo ""
./build-step4.sh
echo ""
./build-step5.sh
echo ""
./build-step6.sh

echo ""
echo "=== Production Build Complete ==="
echo "You can now deploy your application to Replit using the Deployment button."
echo "Your application will be available at: https://amphoreus.replit.app"