# Chatify - New Features Implementation Guide

This document outlines the **3 major features** that have been implemented in the Chatify application: Email Verification, User Profile Management, and Avatar Upload.

---

## 📋 Table of Contents

1. [Feature 1: Email Verification](#feature-1-email-verification)
2. [Feature 2: User Profile Management](#feature-2-user-profile-management)
3. [Feature 3: Avatar Upload with Media Service](#feature-3-avatar-upload-with-media-service)
4. [Configuration Guide](#configuration-guide)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Testing Guide](#testing-guide)

---

## Feature 1: Email Verification

### Overview
Users must verify their email address before they can log in to the application. Upon registration, an email with a verification link is sent to the user's email address.

### Backend Implementation

#### 1. Dependencies Added (`auth-service/pom.xml`)
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

#### 2. Database Schema Updates (`User.java`)
New fields added to the User entity:
- `email` (String, unique) - User's email address
- `isActive` (Boolean) - Email verification status
- `verificationToken` (String) - Unique token for email verification

#### 3. Email Configuration (`application.yaml`)
```yaml
spring:
  mail:
    host: smtp.gmail.com
    port: 587
    username: ${MAIL_USERNAME}
    password: ${MAIL_PASSWORD}
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true

app:
  verification-url: ${APP_BASE_URL}/verify
```

#### 4. Services Created
- **EmailService**: Handles sending verification and welcome emails
- **AuthService**: Updated to generate tokens and send verification emails

#### 5. Endpoints
- `GET /api/auth/verify?token={token}` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email

### Frontend Implementation

#### 1. Registration Flow
- Email field is now **required** during registration
- After successful registration, user sees a message to check their email

#### 2. Verification Flow
- User clicks the verification link in their email
- Redirected to `/verify?token=...`
- Token is automatically processed
- Success message displayed, user can now log in

#### 3. Login Protection
- Users with unverified emails cannot log in
- Clear error message: "Please verify your email before logging in"

---

## Feature 2: User Profile Management

### Overview
Users can view and edit their profile information including display name, phone number, and bio.

### Backend Implementation

#### 1. Database Schema Updates (`User.java`)
New fields added:
- `phone` (String) - Phone number
- `bio` (String, max 500 chars) - User biography
- `avatarUrl` (String) - Profile picture URL

#### 2. DTOs Created
- **UpdateProfileRequest**: Request body for profile updates
  - `fullName` (optional)
  - `phone` (optional)
  - `bio` (optional, max 500 chars)
  - `avatarUrl` (optional)

- **UserProfileResponse**: Complete user profile information
  - `id`, `username`, `fullName`, `email`
  - `phone`, `bio`, `avatarUrl`, `isActive`

#### 3. Endpoints Added (`UserController`)
- `GET /api/users/profile` - Get current user's profile
- `PUT /api/users/profile` - Update current user's profile
- `GET /api/users/{id}/profile` - Get any user's public profile

### Frontend Implementation

#### 1. Profile Page Component (`profile.ts`, `profile.html`, `profile.scss`)
A beautiful, modern profile page with:
- Avatar display with upload overlay
- Editable fields: Display Name, Phone, Bio
- Read-only fields: Username, Email (with verification badge)
- Edit mode toggle
- Save/Cancel buttons
- Real-time character counter for bio

#### 2. Services Created
- **UserService**: Handles profile CRUD operations
- **MediaService**: Handles file uploads

#### 3. Navigation
- Profile button added to chat sidebar
- Direct navigation: `/profile`
- Back button to return to chat

#### 4. UI Features
- Gradient background design
- Smooth animations and transitions
- Responsive layout (mobile & desktop)
- Loading states and error handling
- Success/error message notifications

---

## Feature 3: Avatar Upload with Media Service

### Overview
Users can upload a profile picture that integrates with the existing Media Service and MinIO storage.

### Backend Implementation

#### 1. Media Service Integration
The existing `media-service` already supports file uploads:
- Endpoint: `POST /api/v1/media/upload`
- Supports: Images, Videos, Files
- Storage: MinIO object storage
- Returns: Public URL for the uploaded file

#### 2. Avatar Update Flow
1. User selects an image file
2. File is uploaded to Media Service
3. Media Service stores in MinIO
4. Public URL is returned
5. Avatar URL is updated in User entity
6. Avatar reflects globally in the app

### Frontend Implementation

#### 1. File Upload Component
In the Profile page:
```typescript
onAvatarFileSelected(event: any): void {
  const file: File = event.target.files?.[0];
  
  // Validate file type (images only)
  // Validate file size (max 5MB)
  // Upload to Media Service
  // Update user profile with new avatar URL
}
```

#### 2. Avatar Display
- Shows current avatar or placeholder with initials
- Hover effect reveals "Change" overlay
- Click to open file picker
- Loading indicator during upload
- Auto-save after successful upload

#### 3. Validation
- File type: Images only (image/*)
- File size: Maximum 5MB
- Error messages for validation failures

#### 4. Global Avatar Updates
- Avatar URL stored in User entity
- Included in UserResponse and UserProfileResponse
- Displayed in:
  - Profile page
  - Chat sidebar (future enhancement)
  - Chat messages (future enhancement)
  - Call modal

---

## Configuration Guide

### 1. Gmail SMTP Setup

To enable email verification, you need to configure Gmail SMTP:

#### Step 1: Enable 2-Step Verification
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification

#### Step 2: Generate App Password
1. In Security settings, go to "App passwords"
2. Select "Mail" and "Other (Custom name)"
3. Name it "Chatify"
4. Copy the generated 16-character password

#### Step 3: Update Environment Variables
In `docker-compose.yml`:
```yaml
auth-service:
  environment:
    MAIL_USERNAME: your-email@gmail.com
    MAIL_PASSWORD: your-16-char-app-password
    APP_BASE_URL: https://api.chatify.asia
```

### 2. Frontend Configuration

Update `chat-client/src/environments/environment.ts`:
```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.chatify.asia',
  wsUrl: 'wss://api.chatify.asia/ws'
};
```

### 3. Database Migration

The User table will be automatically updated with new columns when you start the auth-service (thanks to `ddl-auto: update`):
- `email` VARCHAR(255) UNIQUE
- `is_active` BOOLEAN DEFAULT FALSE
- `verification_token` VARCHAR(255)
- `phone` VARCHAR(15)
- `bio` VARCHAR(500)
- `avatar_url` VARCHAR(255)

---

## API Endpoints Reference

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "password": "password123",
  "fullName": "John Doe",
  "email": "john@example.com"
}

Response: 200 OK
{
  "userId": "uuid-string"
}
```

#### Verify Email
```http
GET /api/auth/verify?token={verification-token}

Response: 200 OK
{
  "success": true,
  "message": "Email verified successfully! You can now login."
}
```

#### Resend Verification Email
```http
POST /api/auth/resend-verification
Content-Type: application/json

{
  "email": "john@example.com"
}

Response: 200 OK
{
  "success": true,
  "message": "Verification email resent successfully"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "password123"
}

Response: 200 OK
{
  "token": "jwt-token-here",
  "userId": "uuid",
  "fullName": "John Doe",
  "username": "johndoe",
  "email": "john@example.com"
}
```

### Profile Endpoints

#### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer {jwt-token}

Response: 200 OK
{
  "id": "uuid",
  "username": "johndoe",
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "bio": "Software developer",
  "avatarUrl": "https://minio-url/avatar.jpg",
  "isActive": true
}
```

#### Update Profile
```http
PUT /api/users/profile
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "fullName": "John Smith",
  "phone": "+1234567890",
  "bio": "Senior Software Engineer",
  "avatarUrl": "https://new-avatar-url.jpg"
}

Response: 200 OK
{
  "id": "uuid",
  "username": "johndoe",
  "fullName": "John Smith",
  // ... updated fields
}
```

#### Get User Profile by ID
```http
GET /api/users/{userId}/profile

Response: 200 OK
{
  "id": "uuid",
  "username": "johndoe",
  "fullName": "John Doe",
  "phone": "+1234567890",
  "bio": "Software developer",
  "avatarUrl": "https://avatar-url.jpg"
}
```

### Media Upload Endpoint

#### Upload File
```http
POST /api/v1/media/upload
Content-Type: multipart/form-data

file: [binary-file-data]
uploaderId: "user-uuid" (optional)

Response: 200 OK
{
  "url": "https://minio-url/filename.jpg",
  "type": "image/jpeg",
  "fileName": "original-name.jpg"
}
```

---

## Testing Guide

### 1. Email Verification Testing

#### Test Registration
1. Navigate to the registration page
2. Fill in all fields including email
3. Submit the form
4. Check your email inbox for verification email
5. Click the verification link
6. Verify you're redirected and see success message

#### Test Login Protection
1. Try to log in with unverified account
2. Should see error: "Please verify your email before logging in"
3. After verification, login should succeed

#### Test Resend Email (Optional Feature)
1. Create an endpoint to trigger resend
2. Call with user's email
3. Verify new email is received

### 2. Profile Management Testing

#### Test View Profile
1. Log in to the application
2. Click the profile button in chat sidebar
3. Verify all profile information is displayed correctly
4. Check that email shows "Verified" badge

#### Test Edit Profile
1. Click "Edit Profile" button
2. Update display name, phone, and bio
3. Click "Save Changes"
4. Verify success message appears
5. Refresh page and confirm changes persisted

#### Test Validation
1. Try entering bio longer than 500 characters
2. Verify character counter updates
3. Check validation messages appear correctly

### 3. Avatar Upload Testing

#### Test Avatar Upload
1. Go to profile page
2. Click on avatar/placeholder
3. Select an image file (< 5MB)
4. Verify upload progress indicator
5. Confirm avatar updates immediately
6. Refresh page and verify avatar persists

#### Test File Validation
1. Try uploading a non-image file
2. Should see error: "Please select a valid image file"
3. Try uploading file > 5MB
4. Should see error: "Image size must be less than 5MB"

#### Test Avatar Display
1. Upload an avatar
2. Navigate to chat page
3. Check if avatar appears in relevant places
4. Verify avatar URL in profile response

### 4. Integration Testing

#### Full User Journey
1. **Register**: Create new account with email
2. **Verify**: Click email verification link
3. **Login**: Log in with verified account
4. **Profile**: Navigate to profile page
5. **Avatar**: Upload profile picture
6. **Update**: Edit profile information
7. **Chat**: Return to chat and verify everything works
8. **Persistence**: Log out and log back in, verify all data persists

---

## Security Considerations

### 1. Email Verification
- Tokens are UUIDs (randomly generated)
- Tokens are single-use (cleared after verification)
- No expiration time currently (consider adding in production)

### 2. Profile Updates
- Users can only update their own profile
- JWT authentication required for all profile endpoints
- Input validation on all fields

### 3. File Uploads
- File type validation (images only for avatars)
- File size limits (5MB for avatars)
- Files stored in MinIO (isolated from application server)
- Public URLs generated for access

---

## Future Enhancements

### Potential Improvements
1. **Email Templates**: Use HTML email templates with branding
2. **Token Expiration**: Add 24-hour expiration for verification tokens
3. **Password Reset**: Email-based password reset flow
4. **Profile Privacy**: Public vs private profile settings
5. **Avatar Cropping**: Client-side image cropping before upload
6. **Multiple Avatars**: Allow users to have an avatar gallery
7. **Profile Completion**: Show profile completion percentage
8. **Social Links**: Add social media profile links

---

## Troubleshooting

### Email Not Sending
- Check Gmail SMTP credentials
- Verify 2-Step Verification is enabled
- Confirm App Password is correct (16 characters, no spaces)
- Check if port 587 is not blocked by firewall
- Review auth-service logs for email errors

### Avatar Not Uploading
- Verify MinIO service is running
- Check media-service logs
- Confirm file size < 5MB
- Ensure file is an image type
- Verify network connectivity to media-service

### Profile Not Updating
- Check JWT token is valid
- Verify user is authenticated
- Review validation error messages
- Check network console for API errors
- Verify database connectivity

---

## Architecture Diagram

```
┌─────────────────┐
│   Angular UI    │
│  (Chat Client)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │
│   (Port 8080)   │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬──────────────┐
    ▼         ▼            ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐
│  Auth  │ │  Chat  │ │  Media   │ │  Notify  │
│Service │ │Service │ │ Service  │ │ Service  │
│ :8081  │ │ :8082  │ │  :8083   │ │  :8084   │
└───┬────┘ └───┬────┘ └────┬─────┘ └────┬─────┘
    │          │           │            │
    ▼          ▼           ▼            ▼
┌─────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐
│PostgreSQL│ │ MongoDB │ │ MinIO  │ │  Redis  │
│ (Auth)  │ │ (Chat)  │ │(Storage)│ │(Session)│
└─────────┘ └─────────┘ └────────┘ └─────────┘
```

---

## Conclusion

All three features have been successfully implemented and integrated into the Chatify application:

✅ **Email Verification**: Users must verify their email before logging in  
✅ **User Profile Management**: Users can view and edit their profile information  
✅ **Avatar Upload**: Users can upload profile pictures via Media Service  

The implementation follows best practices for microservices architecture, maintains consistency between frontend and backend, and provides a great user experience with modern UI/UX design.

For any questions or issues, please refer to the logs of individual services or contact the development team.

**Happy Chatting! 🚀**

