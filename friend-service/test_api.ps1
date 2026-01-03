# Friend Service API Test Script (PowerShell)
# Usage: .\test_api.ps1 -Username "your_username" -Password "your_password"

param(
    [Parameter(Mandatory=$true)]
    [string]$Username,
    [Parameter(Mandatory=$true)]
    [string]$Password
)

$BASE_URL = "https://api.chatify.asia"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🔐 Friend Service API Test Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Step 0: Login
Write-Host "[0] Login" -ForegroundColor Yellow
Write-Host "Username: $Username"

$loginBody = @{
    username = $Username
    password = $Password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody

    Write-Host "✅ Login successful!" -ForegroundColor Green
    $TOKEN = $loginResponse.token
    Write-Host "Token: ${TOKEN.Substring(0,20)}..." -ForegroundColor Gray
}
catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 1: Get User Profile
Write-Host "[1] Getting User Profile" -ForegroundColor Yellow

try {
    $userResponse = Invoke-RestMethod -Uri "$BASE_URL/api/users/profile" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $USER_ID = $userResponse.id
    Write-Host "✅ User ID: $USER_ID" -ForegroundColor Green
    Write-Host "Username: $($userResponse.username)" -ForegroundColor Gray
    Write-Host "Full Name: $($userResponse.fullName)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ Failed to get user profile: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Get Friends List
Write-Host "[2] Getting Friends List" -ForegroundColor Yellow

try {
    $friendsResponse = Invoke-RestMethod -Uri "$BASE_URL/api/friends" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $FRIEND_COUNT = $friendsResponse.Count
    Write-Host "✅ You have $FRIEND_COUNT friend(s)" -ForegroundColor Green

    if ($FRIEND_COUNT -gt 0) {
        Write-Host ""
        foreach ($friend in $friendsResponse) {
            Write-Host "  • $($friend.friendFullName) (@$($friend.friendUsername))" -ForegroundColor Cyan
        }
    }
}
catch {
    Write-Host "❌ Failed to get friends: $_" -ForegroundColor Red
}

Write-Host ""

# Step 3: Get Received Friend Requests
Write-Host "[3] Getting Received Friend Requests" -ForegroundColor Yellow

try {
    $receivedResponse = Invoke-RestMethod -Uri "$BASE_URL/api/friends/requests/received" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $RECEIVED_COUNT = $receivedResponse.Count
    Write-Host "✅ You have $RECEIVED_COUNT received request(s)" -ForegroundColor Green

    if ($RECEIVED_COUNT -gt 0) {
        Write-Host ""
        foreach ($req in $receivedResponse) {
            Write-Host "  • From: $($req.senderId)" -ForegroundColor Cyan
            Write-Host "    Request ID: $($req.id)" -ForegroundColor Gray
            Write-Host "    Message: $($req.message)" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "❌ Failed to get received requests: $_" -ForegroundColor Red
}

Write-Host ""

# Step 4: Get Sent Friend Requests
Write-Host "[4] Getting Sent Friend Requests" -ForegroundColor Yellow

try {
    $sentResponse = Invoke-RestMethod -Uri "$BASE_URL/api/friends/requests/sent" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $SENT_COUNT = $sentResponse.Count
    Write-Host "✅ You have sent $SENT_COUNT request(s)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get sent requests: $_" -ForegroundColor Red
}

Write-Host ""

# Step 5: Get Blocked Users
Write-Host "[5] Getting Blocked Users" -ForegroundColor Yellow

try {
    $blockedResponse = Invoke-RestMethod -Uri "$BASE_URL/api/friends/blocked" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $BLOCKED_COUNT = $blockedResponse.Count
    Write-Host "✅ You have blocked $BLOCKED_COUNT user(s)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to get blocked users: $_" -ForegroundColor Red
}

Write-Host ""

# Step 6: Get Recommendations
Write-Host "[6] Getting Friend Recommendations" -ForegroundColor Yellow

try {
    $recommendationsResponse = Invoke-RestMethod -Uri "$BASE_URL/api/friends/recommendations" `
        -Method Get `
        -Headers @{Authorization = "Bearer $TOKEN"}

    $REC_COUNT = $recommendationsResponse.Count
    Write-Host "✅ Found $REC_COUNT recommendation(s)" -ForegroundColor Green

    if ($REC_COUNT -gt 0) {
        Write-Host ""
        foreach ($rec in $recommendationsResponse) {
            Write-Host "  • $($rec.user.fullName) (@$($rec.user.username))" -ForegroundColor Cyan
            Write-Host "    Reason: $($rec.reason)" -ForegroundColor Gray
        }
    }
}
catch {
    Write-Host "❌ Failed to get recommendations: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎉 Test completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "1. Send friend request:" -ForegroundColor Gray
Write-Host "   curl -X POST `"${BASE_URL}/api/friends/request`" -H `"Authorization: Bearer ${TOKEN}`" -H `"Content-Type: application/json`" -d '{\"receiverId\":\"TARGET_ID\",\"message\":\"Hi!\"}'"
Write-Host ""
Write-Host "2. Accept request:" -ForegroundColor Gray
Write-Host "   curl -X PUT `"${BASE_URL}/api/friends/requests/{REQUEST_ID}/accept`" -H `"Authorization: Bearer ${TOKEN}`""
Write-Host ""

