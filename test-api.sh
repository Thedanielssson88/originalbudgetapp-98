#!/bin/bash

echo "Testing Balance type budget post creation..."

# Create a test balance post
RESPONSE=$(curl -s -X POST http://localhost:5000/api/budget-posts \
  -H "Content-Type: application/json" \
  -d '{
    "monthKey": "2025-01",
    "type": "Balance",
    "accountUserBalance": 12345,
    "accountBalance": 67890,
    "amount": 0,
    "description": "Test Balance"
  }')

echo "Response: $RESPONSE"

# Check if fields exist
if echo "$RESPONSE" | grep -q "accountUserBalance"; then
  echo "✓ accountUserBalance field saved"
else
  echo "✗ accountUserBalance field missing"
fi

if echo "$RESPONSE" | grep -q "accountBalance"; then
  echo "✓ accountBalance field saved"
else
  echo "✗ accountBalance field missing"
fi