#!/bin/bash
echo "Testing Directions2Music Client Server"

echo "Starting server in background..."
cd /c/_Samples/Directions2Music/MCP/client
npm start &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 3

echo "Testing health endpoint..."
curl -X GET "http://localhost:3001/health"

echo -e "\n\nTesting orchestration with dummy data..."
curl -X POST "http://localhost:3001/orchestrate" \
  -H "Content-Type: application/json" \
  -d '{
    "directions": [
      "Start at SP414, 84069, Roccadaspide, Salernes",
      "Go northwest on SP414",
      "Turn left on SS166"
    ],
    "dummyMode": true
  }'

echo -e "\n\nKilling server..."
kill $SERVER_PID

echo "Test complete!"