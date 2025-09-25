#!/bin/bash

# Test script for n8n webhook
# Run this after activating your n8n workflow

echo "Testing n8n webhook with sample chat payload..."

curl -X POST "https://blusolutions.app.n8n.cloud/webhook-test/59ea52a7-cd19-4c8a-a432-3dd0b872cb03" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer webhook-token-here" \
  -d '{
    "messages": [
      {
        "role": "user", 
        "content": "Hello, I need help with salmon farming operations"
      }
    ],
    "botId": "30000000-0000-0000-0000-000000000001",
    "tenantId": "20000000-0000-0000-0000-000000000001",
    "user": {
      "id": "test-user-id",
      "email": "andres@earlyshift.ai"
    }
  }' \
  | jq '.'

echo ""
echo "If you see a 404 error, make sure to:"
echo "1. Click 'Execute workflow' in n8n"
echo "2. Toggle the workflow to 'Active'"
echo "3. Try again"
