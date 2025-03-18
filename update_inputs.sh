#!/bin/bash
# Update Input elements to be touch-friendly

FILE="client/src/pages/Customers.tsx"

# Pattern to match Input elements that don't have className specified
PATTERN1='<Input placeholder="([^"]+)" \{...field\} \/>'
REPLACEMENT1='<Input placeholder="\1" className="h-12 text-base" {...field} \/>'

# Execute the replacement
sed -i "s/${PATTERN1}/${REPLACEMENT1}/g" ${FILE}

echo "Updated Input elements to be touch-friendly"
