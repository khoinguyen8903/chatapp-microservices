# Quick Deployment Guide - Profile Feature

## 🚀 Deploy in 3 Steps

### Step 1: Rebuild and Restart Services (Required)
```powershell
# Navigate to project directory
cd D:\DoAnTotNghiep

# Stop all containers
docker-compose down

# Rebuild affected services
docker-compose build media-service api-gateway auth-service

# Start all services
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Step 2: Verify Configuration
```powershell
# Check media-service has the correct environment variable
docker exec media-service env | findstr MINIO_PUBLIC_URL
# Expected output: MINIO_PUBLIC_URL=https://api.chatify.asia

# Check media-service logs for any errors
docker logs media-service --tail 50
```

### Step 3: Test the Feature
1. Open https://chatify.asia in your browser
2. Login with your account
3. Navigate to Profile (click your avatar or settings)
4. Try uploading an avatar image
5. Verify the image displays correctly
6. **IMPORTANT:** Test on mobile device using 4G (not WiFi)

---

## ✅ Verification Checklist

### Desktop Browser Testing
- [ ] Profile page loads without errors
- [ ] Can see current profile information
- [ ] Can click "Edit Profile" button
- [ ] Can update full name, phone, bio
- [ ] Can upload avatar image
- [ ] Avatar displays after upload
- [ ] Changes persist after page refresh

### Mobile Device Testing (Critical!)
- [ ] Open https://chatify.asia on phone (use 4G, not WiFi)
- [ ] Login to account
- [ ] Navigate to profile page
- [ ] Avatar image loads (check for broken image icon)
- [ ] Can upload new avatar from phone camera/gallery
- [ ] New avatar displays correctly
- [ ] Avatar shows in chat sidebar/messages

---

## 🔍 Check Image URLs

### Using Browser DevTools:
1. Open profile page
2. Press F12 (Developer Tools)
3. Go to Network tab
4. Upload an avatar
5. Look at the upload response
6. **Verify the URL looks like:**
   ```
   ✅ GOOD: https://api.chatify.asia/chatapp-files/12345_avatar.jpg?X-Amz-Algorithm=...
   ❌ BAD:  http://minio:9000/chatapp-files/12345_avatar.jpg
   ❌ BAD:  http://localhost:9000/chatapp-files/12345_avatar.jpg
   ```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Cannot connect to MinIO"
**Fix:**
```powershell
# Restart MinIO container
docker-compose restart minio

# Wait 10 seconds, then restart media-service
docker-compose restart media-service
```

### Issue 2: Avatar shows 404 error
**Fix:**
```powershell
# Check if MINIO_PUBLIC_URL is set correctly
docker exec media-service env | findstr MINIO

# If not set, edit docker-compose.yml and restart
docker-compose down
docker-compose up -d
```

### Issue 3: "User not found" error
**Fix:**
```powershell
# Restart auth-service to load new endpoints
docker-compose restart auth-service

# Clear browser cache and login again
# OR use incognito mode
```

### Issue 4: CORS errors in browser console
**Fix:**
```powershell
# Restart API Gateway to load new routes
docker-compose restart api-gateway

# Clear browser cache
```

---

## 📱 MinIO Configuration (Optional)

If you need to set MinIO bucket to public (for non-presigned URLs):

### Option 1: Via MinIO Console
1. Open http://localhost:9001 (or your MinIO Console URL)
2. Login with credentials: minioadmin / minioadmin
3. Navigate to Buckets → `chatapp-files`
4. Go to "Access Policy"
5. Set to "Public" or add custom policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {"AWS": ["*"]},
         "Action": ["s3:GetObject"],
         "Resource": ["arn:aws:s3:::chatapp-files/*"]
       }
     ]
   }
   ```

### Option 2: Via MinIO Client (mc)
```bash
# Install mc (MinIO Client)
docker exec -it minio sh

# Configure mc
mc alias set myminio http://localhost:9000 minioadmin minioadmin

# Set bucket policy to public
mc anonymous set download myminio/chatapp-files
```

---

## 🔄 Rollback Plan

If something breaks, you can quickly rollback:

```powershell
# Option 1: Restart with previous configuration
docker-compose down
git checkout HEAD~1 docker-compose.yml
docker-compose up -d

# Option 2: Remove recent changes
git reset --hard HEAD~1
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 📊 Monitor Logs in Real-Time

```powershell
# Watch all services
docker-compose logs -f

# Watch specific service
docker-compose logs -f media-service

# Watch multiple services
docker-compose logs -f media-service api-gateway auth-service

# Filter for errors only
docker-compose logs -f | findstr "ERROR"
```

---

## 🎯 Success Indicators

You know it's working when you see:

### In Media Service Logs:
```
Generated presigned URL: https://api.chatify.asia/chatapp-files/uuid_filename.jpg?X-Amz-Algorithm=...
```

### In Browser Network Tab:
```json
{
  "url": "https://api.chatify.asia/chatapp-files/...",
  "type": "image/jpeg",
  "fileName": "avatar.jpg"
}
```

### In Profile Page:
```html
<img src="https://api.chatify.asia/chatapp-files/..." />
```

---

## 📞 Need Help?

### Check Documentation:
- Full documentation: `PROFILE_FEATURE_IMPLEMENTATION.md`
- Architecture details: See "Architecture Diagram" section
- API reference: See "API Endpoints Reference" section

### Debug Steps:
1. Check all services are running: `docker-compose ps`
2. Check logs for errors: `docker-compose logs -f`
3. Verify environment variables: `docker exec <service> env`
4. Test endpoints with Postman/curl
5. Check browser console for frontend errors

---

## 🎉 All Done!

Once verified:
- ✅ Profile feature is production-ready
- ✅ Images work on all devices
- ✅ URLs are publicly accessible
- ✅ Mobile users can upload/view avatars

**Happy coding!** 🚀
