# Email Verification Testing Guide

## Quick Test Steps

### Step 1: Start Your Services

1. **Start PostgreSQL Database**
   ```bash
   # If using Docker
   docker-compose up -d postgres-db
   
   # Or start your local PostgreSQL service
   ```

2. **Start Auth Service**
   ```bash
   cd d:\DoAnTotNghiep\auth-service
   mvn clean spring-boot:run
   ```
   
   Wait until you see: `Started AuthServiceApplication`

3. **Start Angular Frontend** (in another terminal)
   ```bash
   cd d:\DoAnTotNghiep\frontend  # or wherever your Angular app is
   npm start
   # or: ng serve
   ```

---

### Step 2: Register a New User

**Method 1: Using Postman/Insomnia**

```http
POST http://localhost:8081/api/auth/register
Content-Type: application/json

{
  "username": "testuser123",
  "email": "your-real-email@gmail.com",
  "password": "Test123!@#",
  "displayName": "Test User"
}
```

**Method 2: Using curl**
```bash
curl -X POST http://localhost:8081/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "email": "your-real-email@gmail.com",
    "password": "Test123!@#",
    "displayName": "Test User"
  }'
```

**Expected Response:**
```json
{
  "userId": "some-uuid-here"
}
```

**Check Console - You Should See:**
```
📧 Generating verification email for: testuser123
   Verification link: http://localhost:8081/api/auth/verify?token=xxx-xxx-xxx
✅ Verification email sent successfully to: your-real-email@gmail.com
```

---

### Step 3: Check Your Email

1. Open your email inbox (check spam folder too!)
2. You should see an email with subject: **"Chatify - Email Verification"**
3. The email should contain a link like:
   ```
   http://localhost:8081/api/auth/verify?token=xxx-xxx-xxx-xxx
   ```

---

### Step 4: Click the Verification Link

**What Should Happen:**

1. **Browser redirects to backend**: `http://localhost:8081/api/auth/verify?token=xxx`
2. **Backend processes verification** (check console logs)
3. **Browser automatically redirects to**: `http://localhost:3000/login?verified=true`

**Console Logs You Should See:**
```
🔗 Verification request received with token: xxx-xxx-xxx
🔍 Verifying email with token: xxx-xxx-xxx
👤 Found user: testuser123 (Current active status: false)
✅ User verified and saved successfully: testuser123 (New active status: true)
✅ Email verified successfully. Redirecting to: http://localhost:3000/login?verified=true
```

---

### Step 5: Verify in Database

Connect to your PostgreSQL database and run:

```sql
SELECT 
    username,
    email,
    is_active,
    verification_token
FROM users
WHERE username = 'testuser123';
```

**Expected Result:**
| username | email | is_active | verification_token |
|----------|-------|-----------|-------------------|
| testuser123 | your-email@gmail.com | **true** | **NULL** |

---

### Step 6: Try to Login

**Method 1: Using Postman**
```http
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{
  "username": "testuser123",
  "password": "Test123!@#"
}
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "some-uuid",
  "fullName": "Test User",
  "username": "testuser123",
  "email": "your-real-email@gmail.com"
}
```

✅ **SUCCESS!** User can now login after email verification.

---

## Test Scenarios

### Scenario 1: Valid Token ✅
- **Action:** Click verification link from email
- **Expected:** Redirect to `http://localhost:3000/login?verified=true`
- **Database:** `is_active=true`, `verification_token=NULL`

### Scenario 2: Invalid Token ❌
- **Action:** Manually change token in URL: `http://localhost:8081/api/auth/verify?token=invalid-token`
- **Expected:** Redirect to `http://localhost:3000/login?error=verification_failed`
- **Console:** `❌ Invalid verification token: invalid-token`

### Scenario 3: Already Verified ⚠️
- **Action:** Click the same verification link twice
- **Expected:** Redirect to `http://localhost:3000/login?error=verification_failed`
- **Console:** `⚠️ Email already verified for user: testuser123`

### Scenario 4: Login Before Verification ❌
- **Action:** Try to login before clicking verification link
- **Expected Response:**
  ```json
  {
    "error": "Please verify your email before logging in"
  }
  ```

### Scenario 5: Resend Verification Email 📧
```http
POST http://localhost:8081/api/auth/resend-verification
Content-Type: application/json

{
  "email": "your-email@gmail.com"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Verification email resent successfully"
}
```

---

## Troubleshooting

### Problem: Email not received

**Possible Causes:**
1. Email in spam folder
2. Gmail SMTP not configured
3. Environment variables not set

**Solutions:**
```bash
# Check environment variables
echo $MAIL_USERNAME
echo $MAIL_PASSWORD

# Or set them:
export MAIL_USERNAME=your-email@gmail.com
export MAIL_PASSWORD=your-app-password
```

**Get Gmail App Password:**
1. Go to: https://myaccount.google.com/apppasswords
2. Select "Mail" and "Other (Custom name)"
3. Copy the 16-character password
4. Use this as `MAIL_PASSWORD`

---

### Problem: Database not updating

**Check Transaction Logs:**
```sql
-- Check if savepoint/rollback happened
SHOW transaction_isolation;

-- Check database locks
SELECT * FROM pg_locks WHERE NOT granted;
```

**Force Manual Update (for testing):**
```sql
-- Check current state
SELECT username, is_active, verification_token FROM users WHERE username = 'testuser123';

-- Manual update
UPDATE users SET is_active = true, verification_token = null WHERE username = 'testuser123';

-- Verify
SELECT username, is_active, verification_token FROM users WHERE username = 'testuser123';
```

---

### Problem: Whitelabel Error Page

**Check:**
1. Frontend is running on port 3000
2. Frontend has `/login` route
3. Check `application.yaml`:
   ```yaml
   app:
     frontend-url: http://localhost:3000
   ```

**Test Redirect Manually:**
```bash
curl -I http://localhost:8081/api/auth/verify?token=xxx-xxx-xxx
```

**Expected Response:**
```
HTTP/1.1 302 Found
Location: http://localhost:3000/login?verified=true
```

---

### Problem: Token Not Found

**Check Database:**
```sql
-- List all tokens
SELECT username, email, verification_token FROM users WHERE verification_token IS NOT NULL;

-- Find user by email
SELECT * FROM users WHERE email = 'your-email@gmail.com';
```

---

## Complete Test Checklist

- [ ] PostgreSQL database is running
- [ ] Auth service is running (`mvn spring-boot:run`)
- [ ] Angular frontend is running (`ng serve`)
- [ ] Environment variables are set (MAIL_USERNAME, MAIL_PASSWORD, JWT_SECRET)
- [ ] Register new user via API
- [ ] Email received with verification link
- [ ] Console shows verification link URL
- [ ] Click verification link in email
- [ ] Browser redirects to frontend (`/login?verified=true`)
- [ ] Database shows `is_active=true` and `verification_token=NULL`
- [ ] User can login successfully
- [ ] Welcome email is sent

---

## Expected Console Output (Full Flow)

```
# Registration
📧 Generating verification email for: testuser123
   Verification link: http://localhost:8081/api/auth/verify?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890
✅ Verification email sent successfully to: test@example.com

# Verification (when user clicks link)
🔗 Verification request received with token: a1b2c3d4-e5f6-7890-abcd-ef1234567890
🔍 Verifying email with token: a1b2c3d4-e5f6-7890-abcd-ef1234567890
👤 Found user: testuser123 (Current active status: false)
✅ User verified and saved successfully: testuser123 (New active status: true)
✅ Email verified successfully. Redirecting to: http://localhost:3000/login?verified=true

# Welcome Email
✅ Welcome email sent to: test@example.com
```

---

## Quick Debug Commands

```bash
# Check if auth-service is running
netstat -ano | findstr :8081

# Check if frontend is running
netstat -ano | findstr :3000

# Test backend endpoint
curl http://localhost:8081/api/auth/verify?token=test

# Check PostgreSQL connection
psql -U postgres -d authdb -c "SELECT COUNT(*) FROM users;"

# View application logs
tail -f auth-service.log

# Check environment variables (Windows)
echo %MAIL_USERNAME%
echo %MAIL_PASSWORD%
echo %JWT_SECRET%

# Check environment variables (Linux/Mac)
echo $MAIL_USERNAME
echo $MAIL_PASSWORD
echo $JWT_SECRET
```

---

## Success Criteria ✅

All of the following should be true:

1. ✅ User registers successfully
2. ✅ Verification email is sent and received
3. ✅ Email contains correct backend URL (`http://localhost:8081/api/auth/verify?token=...`)
4. ✅ Clicking link redirects to frontend with `?verified=true`
5. ✅ Database shows `is_active=true` and `verification_token=NULL`
6. ✅ User can login successfully after verification
7. ✅ User cannot login before verification
8. ✅ Invalid token redirects to frontend with `?error=verification_failed`
9. ✅ Console logs show complete flow with emojis
10. ✅ Welcome email is sent after successful verification

---

## Need Help?

If you're still having issues:

1. Check console logs in detail
2. Use SQL script: `verify_database.sql`
3. Read: `EMAIL_VERIFICATION_FIX_SUMMARY.md`
4. Enable Spring Boot debug logging:
   ```yaml
   logging:
     level:
       org.springframework.transaction: DEBUG
       org.hibernate.SQL: DEBUG
   ```
