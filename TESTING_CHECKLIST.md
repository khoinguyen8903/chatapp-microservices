# Migration & Testing Checklist

## ✅ Pre-Deployment Checklist

### 1. Build & Compile
- [ ] Run `npm install` (ensure all dependencies are up to date)
- [ ] Run `ng build --configuration production` 
- [ ] Verify no TypeScript compilation errors
- [ ] Check bundle size (should be similar or smaller than before)

### 2. Local Testing
- [ ] Run `ng serve` and test locally
- [ ] Open chat, send 50+ messages to test scrolling
- [ ] Test rapid scrolling (should be 60fps)
- [ ] Test typing indicator (should be smooth)
- [ ] Test online/offline status updates
- [ ] Test file/image/video uploads

### 3. Mobile Testing (Critical!)
- [ ] Test on **real iOS device** (iPhone):
  - [ ] Open keyboard, verify input stays visible
  - [ ] Type message while keyboard is open
  - [ ] Scroll messages while keyboard is open
  - [ ] Test back button navigation
  - [ ] Test in portrait mode
  - [ ] Test in landscape mode

- [ ] Test on **real Android device**:
  - [ ] Same tests as iOS above
  - [ ] Test with different keyboards (Gboard, Samsung, etc.)

- [ ] Test on **tablet** (iPad/Android tablet):
  - [ ] Verify responsive breakpoints work
  - [ ] Test sidebar visibility

### 4. Browser Compatibility
- [ ] Chrome (Desktop)
- [ ] Firefox (Desktop)
- [ ] Safari (Desktop)
- [ ] Edge (Desktop)
- [ ] Safari iOS
- [ ] Chrome Android

### 5. Performance Verification

#### Using Chrome DevTools:
1. [ ] Open DevTools → Performance
2. [ ] Start recording
3. [ ] Scroll through 100+ messages rapidly
4. [ ] Stop recording
5. [ ] **Verify:** FPS should stay at 60fps (green line at top)
6. [ ] **Verify:** Scripting time should be low (mostly yellow, not red)

#### Using Chrome DevTools - Memory:
1. [ ] Take heap snapshot before loading chat
2. [ ] Load chat with 100+ messages
3. [ ] Take another heap snapshot
4. [ ] **Verify:** No major memory leaks (heap size stabilizes)

### 6. Functional Testing
- [ ] User can send text messages
- [ ] User can send images
- [ ] User can send videos
- [ ] User can send files
- [ ] User can see typing indicator
- [ ] User can see online/offline status
- [ ] User can see message status (sent/delivered/seen)
- [ ] User can make voice/video calls
- [ ] User can create groups
- [ ] User can receive notifications
- [ ] Back button works on mobile

### 7. Edge Cases
- [ ] Test with 500+ messages (should still scroll smoothly)
- [ ] Test with slow network (3G throttling in DevTools)
- [ ] Test with multiple images in rapid succession
- [ ] Test switching between multiple chats quickly
- [ ] Test receiving message while typing
- [ ] Test keyboard shortcuts (Enter to send)

---

## 🐛 Known Issues & Workarounds

### Issue: Keyboard still covers input on some Android devices
**Workaround:** Add this to `android` section of `capacitor.config.json` (if using Capacitor):
```json
{
  "android": {
    "windowSoftInputMode": "adjustResize"
  }
}
```

### Issue: Scroll jumps when new message arrives
**Expected:** This is by design (auto-scroll to bottom). If you want to prevent this when user has scrolled up, add scroll position detection in `scrollToBottom()` method.

---

## 🔧 Rollback Plan (If Issues Found)

### Quick Rollback:
```bash
# If you have git:
git checkout HEAD~1 -- src/app/pages/chat

# Or restore from backup
```

### Gradual Rollback (if specific feature breaks):
1. Remove OnPush strategy (set back to Default)
2. Revert pipes back to functions (but keep pipes for future)
3. Keep trackBy and distinctUntilChanged (safe optimizations)

---

## 📊 Performance Metrics to Monitor

### After Deployment:
- [ ] Monitor error rates (should not increase)
- [ ] Monitor load times (should be same or better)
- [ ] Check user feedback on mobile experience
- [ ] Monitor CPU/memory usage on low-end devices

### Success Criteria:
✅ **60fps scrolling** on desktop and mobile
✅ **Keyboard doesn't cover input** on mobile
✅ **No increase in error rates**
✅ **Same or better load times**

---

## 🆘 Troubleshooting

### Problem: "ExpressionChangedAfterItHasBeenCheckedError"
**Cause:** OnPush + manual signal updates
**Fix:** Wrap signal updates in `setTimeout()` or use `ChangeDetectorRef.detectChanges()`

### Problem: Changes not reflecting in UI
**Cause:** OnPush strategy + mutable state changes
**Fix:** Use immutable updates (always create new objects/arrays)

### Problem: TrackBy function errors
**Cause:** Null/undefined IDs
**Fix:** Fallback to index (already implemented: `message.id || index`)

### Problem: Mobile keyboard still covers input
**Cause:** Browser-specific viewport handling
**Fix:** Test with different viewport-fit values or add padding-bottom dynamically

---

## 📞 Support

If you encounter any issues:
1. Check `PERFORMANCE_OPTIMIZATIONS.md` for detailed explanations
2. Check browser console for errors
3. Check network tab for failed requests
4. Verify all pipes are imported correctly

---

## ✅ Sign-Off

- [ ] All tests passed
- [ ] Performance verified (60fps)
- [ ] Mobile keyboard issue fixed
- [ ] No linting errors
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Ready for deployment

**Tester Name:** ___________________  
**Date:** ___________________  
**Signature:** ___________________

---

**Next Steps After Deployment:**
1. Monitor application for 24-48 hours
2. Collect user feedback on mobile experience
3. Review performance metrics in production
4. Plan additional optimizations if needed

