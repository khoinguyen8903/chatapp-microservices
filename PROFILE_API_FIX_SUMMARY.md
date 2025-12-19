# Profile API Fix - Summary

## Problem
The frontend was getting a **404 Not Found** error when calling:
```
GET https://api.chatify.asia/api/users/profile
```

## Root Cause
1. The `auth-service` did not have a `UserController` to handle `/api/users/**` endpoints
2. The `/api/users/**` endpoints were not properly secured (they were set to `permitAll()` in SecurityConfig)

## Solution Implemented

### 1. ✅ Created `UserController.java`
**Location:** `auth-service/src/main/java/com/chatapp/auth_service/controller/UserController.java`

**Endpoints:**
- **`GET /api/users/profile`** - Get current authenticated user's profile
  - Returns: `UserProfileResponse` with id, username, fullName, email, phone, bio, avatarUrl, isActive
  - Security: Requires JWT authentication

- **`PUT /api/users/profile`** - Update current authenticated user's profile
  - Accepts: `UpdateProfileRequest` with fullName, phone, bio, avatarUrl
  - Returns: Updated `UserProfileResponse`
  - Security: Requires JWT authentication

- **`GET /api/users/{userId}/profile`** - Get any user's profile by ID
  - Returns: `UserProfileResponse` for the specified user
  - Security: Requires JWT authentication
  - Use case: For viewing other users' profiles

### 2. ✅ Updated `SecurityConfig.java`
**Location:** `auth-service/src/main/java/com/chatapp/auth_service/config/SecurityConfig.java`

**Changes:**
```java
// Before: All /api/users/** were public (permitAll)
.requestMatchers("/api/auth/**", "/api/users/**").permitAll()

// After: Granular security rules
.requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/verify", "/api/auth/resend-verification").permitAll()
.requestMatchers("/api/auth/users/**", "/api/auth/check/**").permitAll() // For internal services
.requestMatchers("/api/users/**").authenticated() // ✅ NOW SECURED
.requestMatchers("/api/auth/me").authenticated()
```

**Security Model:**
- ✅ Public (no auth required):
  - `/api/auth/register` - User registration
  - `/api/auth/login` - User login
  - `/api/auth/verify` - Email verification
  - `/api/auth/resend-verification` - Resend verification email
  - `/api/auth/users/{userId}` - Internal service calls (Chat Service uses this)
  - `/api/auth/check/{username}` - Check if username exists

- 🔒 Protected (JWT required):
  - `/api/users/profile` - Current user profile (GET/PUT)
  - `/api/users/{userId}/profile` - View other users' profiles
  - `/api/auth/me` - Current authenticated user info

### 3. ✅ API Gateway Configuration
**Location:** `api-gateway/src/main/resources/application.yaml`

**Status:** ✅ Already configured correctly (lines 41-47)
```yaml
- id: user-service
  uri: http://auth-service:8081
  predicates:
    - Path=/api/users/**
  filters:
    - AuthenticationFilter  # ✅ JWT validation happens here
    - DedupeResponseHeader=Access-Control-Allow-Origin Access-Control-Allow-Credentials, RETAIN_FIRST
```

### 4. ✅ Frontend Configuration
**Location:** `chat-client/src/app/auth.interceptor.ts`

**Status:** ✅ Already configured correctly
- The HTTP interceptor automatically adds `Authorization: Bearer {token}` header to all requests
- The `UserService` correctly calls `/api/users/profile`

## How It Works Now

### Request Flow:
1. **Frontend** (`profile.ts`) calls `userService.getCurrentUserProfile()`
2. **UserService** makes HTTP GET to `/api/users/profile` with Authorization header
3. **API Gateway** receives request:
   - Validates JWT token via `AuthenticationFilter`
   - Forwards to `auth-service:8081/api/users/profile`
4. **Auth Service**:
   - `JwtFilter` extracts user ID from token
   - `UserController.getCurrentUserProfile()` gets called
   - Retrieves user from database via `AuthService.getProfile(userId)`
   - Returns `UserProfileResponse` DTO
5. **Frontend** receives profile data and displays it

### Update Flow:
1. User clicks "Save" on profile page
2. Frontend sends `PUT /api/users/profile` with `UpdateProfileRequest`
3. Same authentication flow as above
4. `UserController.updateCurrentUserProfile()` calls `AuthService.updateProfile()`
5. Database is updated
6. Frontend receives updated profile

## Testing Checklist

### Backend:
- [ ] Restart `auth-service` to load the new `UserController`
- [ ] Test `GET /api/users/profile` with valid JWT token → should return 200 OK
- [ ] Test `GET /api/users/profile` without token → should return 401 Unauthorized
- [ ] Test `PUT /api/users/profile` with valid data → should return 200 OK with updated profile

### Frontend:
- [ ] Login to the application
- [ ] Navigate to Profile page
- [ ] Verify profile data loads (no more 404 error)
- [ ] Edit profile fields (fullName, phone, bio)
- [ ] Click Save
- [ ] Verify profile updates successfully
- [ ] Upload new avatar
- [ ] Verify avatar updates

## Notes

### Security Considerations:
1. ✅ All profile endpoints require JWT authentication
2. ✅ Users can only modify their own profile (userId extracted from JWT)
3. ✅ Input validation using `@Valid` annotation on DTOs
4. ✅ Field size limits enforced in `UpdateProfileRequest`

### Backward Compatibility:
1. ✅ Existing `/api/auth/me` endpoint still works
2. ✅ Existing `/api/auth/users/{userId}` endpoint still public (for Chat Service)
3. ✅ New `/api/users/**` endpoints don't conflict with existing routes

### Future Enhancements:
- Consider making `/api/users/{userId}/profile` return only public fields (hide email/phone)
- Add rate limiting for profile updates
- Add audit logging for profile changes
- Add profile picture validation and compression

## Deployment Steps

1. **Build auth-service:**
   ```bash
   cd auth-service
   mvn clean package -DskipTests
   ```

2. **Restart services using Docker Compose:**
   ```bash
   docker-compose down
   docker-compose up -d --build auth-service
   docker-compose up -d api-gateway
   ```

3. **Verify logs:**
   ```bash
   docker-compose logs -f auth-service
   ```

4. **Test the endpoint:**
   ```bash
   # Get JWT token by logging in first
   TOKEN="your-jwt-token"
   
   # Test GET profile
   curl -H "Authorization: Bearer $TOKEN" \
        https://api.chatify.asia/api/users/profile
   
   # Test PUT profile
   curl -X PUT \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"fullName":"New Name","bio":"Hello World"}' \
        https://api.chatify.asia/api/users/profile
   ```

## Files Modified/Created

### Created:
- ✅ `auth-service/src/main/java/com/chatapp/auth_service/controller/UserController.java` (NEW)

### Modified:
- ✅ `auth-service/src/main/java/com/chatapp/auth_service/config/SecurityConfig.java`

### Already Existed (No Changes Needed):
- ✅ `auth-service/src/main/java/com/chatapp/auth_service/dto/UpdateProfileRequest.java`
- ✅ `auth-service/src/main/java/com/chatapp/auth_service/dto/UserProfileResponse.java`
- ✅ `auth-service/src/main/java/com/chatapp/auth_service/service/AuthService.java`
- ✅ `api-gateway/src/main/resources/application.yaml`
- ✅ `chat-client/src/app/services/user.service.ts`
- ✅ `chat-client/src/app/auth.interceptor.ts`

---

**Status:** ✅ **Ready for Testing**

The 404 error should now be resolved. The `/api/users/profile` endpoint is now properly implemented and secured.
