# Quick Setup Guide - New Features

This guide will help you quickly set up and run the new features in your Chatify application.

## Prerequisites

- Docker and Docker Compose installed
- Gmail account with 2-Step Verification enabled
- Node.js (for local Angular development)
- Maven (for local Spring Boot development)

---

## 🚀 Quick Start (Docker)

### 1. Configure Email Service

Edit `docker-compose.yml` and update the auth-service environment variables:

```yaml
auth-service:
  environment:
    # ... existing variables ...
    MAIL_USERNAME: your-email@gmail.com        # Your Gmail address
    MAIL_PASSWORD: your-16-char-app-password  # Gmail App Password (NOT your regular password)
    APP_BASE_URL: https://api.chatify.asia     # Your frontend URL
```

**How to get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification"
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Copy the 16-character password (no spaces)

### 2. Start All Services

```bash
# Build and start all services
docker-compose up --build -d

# Check if all services are running
docker-compose ps

# View logs
docker-compose logs -f auth-service
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:8080
- **Auth Service**: http://localhost:8081
- **Media Service**: http://localhost:8083
- **MinIO Console**: http://localhost:9001 (admin/admin)

---

## 📝 Testing the Features

### Feature 1: Email Verification

1. **Register a new account:**
   - Go to http://localhost:3000
   - Click "Đăng ký miễn phí"
   - Fill in all fields including email
   - Click "ĐĂNG KÝ NGAY"

2. **Check your email:**
   - Open your email inbox
   - Find the verification email from Chatify
   - Click the verification link

3. **Login:**
   - You'll be redirected back to the app
   - See success message
   - Login with your credentials

### Feature 2: User Profile Management

1. **Login to your account**

2. **Access Profile:**
   - Click the user icon (👤) in the top right of the chat sidebar
   - Or navigate to http://localhost:3000/profile

3. **Edit Profile:**
   - Click "Edit Profile" button
   - Update your display name, phone, or bio
   - Click "Save Changes"

4. **Verify Changes:**
   - Refresh the page
   - Confirm changes are saved

### Feature 3: Avatar Upload

1. **Go to Profile page**

2. **Upload Avatar:**
   - Hover over the avatar placeholder/image
   - Click when you see "Change" overlay
   - Select an image file (max 5MB)
   - Wait for upload to complete

3. **Verify Avatar:**
   - Avatar should update immediately
   - Refresh page to confirm it persists

---

## 🔧 Local Development Setup

### Backend (Auth Service)

```bash
cd auth-service

# Update application.yaml with local settings
# Make sure PostgreSQL is running

# Run the service
./mvnw spring-boot:run

# Or with Maven Wrapper
mvn spring-boot:run
```

### Frontend (Angular)

```bash
cd chat-client

# Install dependencies
npm install

# Update environment.ts with local API URL
# src/environments/environment.ts

# Run development server
npm start

# Open browser to http://localhost:4200
```

---

## 🗄️ Database Schema

The following tables/columns will be automatically created:

### Users Table (PostgreSQL - authdb)
```sql
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(20) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(50),
    email VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(36),
    phone VARCHAR(15),
    bio VARCHAR(500),
    avatar_url VARCHAR(255)
);
```

---

## 📧 Email Configuration Options

### Option 1: Gmail (Recommended for Testing)
```yaml
MAIL_USERNAME: your-email@gmail.com
MAIL_PASSWORD: your-app-password
```

### Option 2: Other SMTP Providers

**Outlook/Hotmail:**
```yaml
spring:
  mail:
    host: smtp-mail.outlook.com
    port: 587
```

**SendGrid:**
```yaml
spring:
  mail:
    host: smtp.sendgrid.net
    port: 587
    username: apikey
    password: your-sendgrid-api-key
```

---

## 🐛 Troubleshooting

### Email Not Sending

**Problem**: Verification emails are not being sent

**Solutions:**
1. Check Gmail App Password is correct (16 characters)
2. Verify 2-Step Verification is enabled on Gmail
3. Check auth-service logs: `docker-compose logs auth-service`
4. Test SMTP connection from inside container:
   ```bash
   docker exec -it auth-service bash
   telnet smtp.gmail.com 587
   ```

### Profile Not Loading

**Problem**: Profile page shows loading forever

**Solutions:**
1. Check if auth-service is running: `docker-compose ps`
2. Verify JWT token is valid (check browser console)
3. Check network tab for API errors
4. Clear browser cache and localStorage

### Avatar Upload Fails

**Problem**: Avatar upload shows error

**Solutions:**
1. Verify file is an image (jpg, png, gif, etc.)
2. Check file size is < 5MB
3. Verify media-service is running
4. Check MinIO is accessible: http://localhost:9001
5. View media-service logs: `docker-compose logs media-service`

---

## 🔄 Rebuilding Services

If you make code changes:

```bash
# Rebuild specific service
docker-compose up --build -d auth-service

# Rebuild all services
docker-compose up --build -d

# Restart a service
docker-compose restart auth-service

# Stop all services
docker-compose down

# Stop and remove volumes (CAUTION: deletes data)
docker-compose down -v
```

---

## 📊 Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service

# Last 100 lines
docker-compose logs --tail=100 auth-service
```

### Check Health

```bash
# Check if all containers are running
docker-compose ps

# Check resource usage
docker stats

# Enter container shell
docker exec -it auth-service bash
```

---

## 🎨 Customization

### Email Templates

Edit `auth-service/src/main/java/com/chatapp/auth_service/service/EmailService.java`:

```java
String emailBody = String.format(
    "Your custom email template here...\n" +
    "Username: %s\n" +
    "Link: %s",
    username,
    verificationLink
);
```

### Profile Page Styling

Edit `chat-client/src/app/pages/profile/profile.scss`:

```scss
.profile-container {
  // Change background gradient
  background: linear-gradient(135deg, #your-colors);
}
```

### Avatar Size Limits

Edit `chat-client/src/app/pages/profile/profile.ts`:

```typescript
// Change max file size (currently 5MB)
if (file.size > 10 * 1024 * 1024) { // 10MB
  this.errorMessage = 'Image size must be less than 10MB';
  return;
}
```

---

## 🔐 Security Notes

1. **Never commit** real email credentials to Git
2. Use **environment variables** for sensitive data
3. **App Passwords** are safer than regular passwords
4. Consider adding **token expiration** for verification tokens
5. Implement **rate limiting** on email sending endpoints

---

## 📚 Additional Resources

- [Spring Boot Mail Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/io.html#io.email)
- [Angular Reactive Forms](https://angular.io/guide/reactive-forms)
- [MinIO Documentation](https://docs.min.io/)
- [JWT Authentication](https://jwt.io/introduction)

---

## ✅ Checklist

Before going to production:

- [ ] Configure production email server
- [ ] Set up proper domain for verification URLs
- [ ] Add token expiration for security
- [ ] Implement rate limiting
- [ ] Add email template styling
- [ ] Test with multiple email providers
- [ ] Set up email monitoring/logging
- [ ] Configure CORS properly
- [ ] Add SSL/TLS certificates
- [ ] Set up backup for user data

---

## 🆘 Support

If you encounter issues:

1. Check the logs first
2. Review the API endpoints in FEATURES_IMPLEMENTATION.md
3. Verify all services are running
4. Check network connectivity
5. Review environment variables

---

**Happy Coding! 🚀**

