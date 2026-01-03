#!/bin/bash

# Friend Service API Test Script
# Usage: ./test_api.sh <username> <password>

BASE_URL="https://api.chatify.asia"
USERNAME=$1
PASSWORD=$2

echo "=========================================="
echo "🔐 Friend Service API Test Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 0: Login
echo -e "${YELLOW}[0] Login${NC}"
echo "Username: $USERNAME"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")

echo "Response: $LOGIN_RESPONSE"

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Login failed! Check username/password${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Token received${NC}"
echo ""

# Step 1: Get User ID
echo -e "${YELLOW}[1] Getting User ID${NC}"
USER_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/users/profile" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $USER_RESPONSE"
USER_ID=$(echo $USER_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}❌ Failed to get user ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ User ID: $USER_ID${NC}"
echo ""

# Step 2: Get Friends List
echo -e "${YELLOW}[2] Getting Friends List${NC}"
FRIENDS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/friends" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $FRIENDS_RESPONSE"
FRIEND_COUNT=$(echo $FRIENDS_RESPONSE | grep -o '"id"' | wc -l)
echo -e "${GREEN}✅ You have $FRIEND_COUNT friend(s)${NC}"
echo ""

# Step 3: Get Received Requests
echo -e "${YELLOW}[3] Getting Received Friend Requests${NC}"
RECEIVED_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/friends/requests/received" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $RECEIVED_RESPONSE"
echo -e "${GREEN}✅ Received requests fetched${NC}"
echo ""

# Step 4: Get Sent Requests
echo -e "${YELLOW}[4] Getting Sent Friend Requests${NC}"
SENT_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/friends/requests/sent" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $SENT_RESPONSE"
echo -e "${GREEN}✅ Sent requests fetched${NC}"
echo ""

# Step 5: Get Blocked Users
echo -e "${YELLOW}[5] Getting Blocked Users${NC}"
BLOCKED_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/friends/blocked" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $BLOCKED_RESPONSE"
echo -e "${GREEN}✅ Blocked users fetched${NC}"
echo ""

# Step 6: Get Recommendations
echo -e "${YELLOW}[6] Getting Friend Recommendations${NC}"
RECOMMENDATIONS=$(curl -s -X GET "${BASE_URL}/api/friends/recommendations" \
  -H "Authorization: Bearer ${TOKEN}")

echo "Response: $RECOMMENDATIONS"
echo -e "${GREEN}✅ Recommendations fetched${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}🎉 Test completed!${NC}"
echo "=========================================="
echo ""
echo "💡 To send a friend request, use this command:"
echo "curl -X POST \"${BASE_URL}/api/friends/request\" \\"
echo "  -H \"Authorization: Bearer ${TOKEN}\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"receiverId\":\"TARGET_USER_ID\",\"message\":\"Hi!\"}'"
echo ""

