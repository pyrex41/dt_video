# Project Log: Video Preview Loading & Continuity Camera Fix

**Date:** October 29, 2025
**Session:** Video preview loading fixes and macOS Continuity Camera support

---

## Summary

This session focused on fixing critical video preview loading issues that prevented videos from displaying on initial import and workspace load. Additionally, added proper macOS Continuity Camera support to eliminate deprecation warnings.

---

## Changes Made

### 1. Video Preview Loading Fix

**File:** `src/components/preview.tsx`

#### Fixed Initial Video Loading (lines 114-169)
**Problem:** Videos showed black screen on initial import until page reload
**Root Cause:** Video source was set but playback didn't wait for metadata to load before seeking

**Solution Implemented:**
- Added `loadedmetadata` event listener to wait for video to be ready
- Gets current playhead position from Zustand store (not from closure)
- Calculates correct seek position once video metadata loads
- Properly cleans up event listener on unmount

**Code Changes:**
```typescript
// Seek to the correct position once video is loaded
const handleLoadedMetadata = () => {
  if (!playerRef.current || !currentClip) return

  // Get current playhead position from store (not from closure)
  const state = useClipStore.getState()
  const currentPlayhead = state.playhead

  // Calculate initial video position based on playhead
  let timelineOffset = currentPlayhead - currentClip.start
  // ... position calculation logic ...

  playerRef.current.currentTime = constrainedTime
}

// Add one-time listener for when video metadata is loaded
if (videoRef.current) {
  videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
}
```

**Dependency Array Fix:**
- Removed `playhead` from dependency array (line 169)
- Previously caused video to reload on every playhead change
- Now only reloads when `currentClip?.id` or `currentClip?.path` changes
- Playhead position retrieved from store when needed

### 2. Responsive Video Preview Sizing

**File:** `src/components/preview.tsx` (lines 273-281)

**Evolution of sizing fixes:**

**Attempt 1:** Fixed width broke on resize
```tsx
// BEFORE: Fixed width
style={{ width: '960px', maxWidth: '90%', aspectRatio: '16/9' }}
```

**Attempt 2:** Full width/height didn't work with aspect ratio
```tsx
// DIDN'T WORK: Browser couldn't resolve constraints
style={{ width: '100%', height: '100%', aspectRatio: '16/9' }}
```

**Final Solution:** Calculated width based on viewport
```tsx
// WORKS: Responsive scaling
style={{
  aspectRatio: '16/9',
  width: 'min(95%, calc(100vh * 16/9))',
  height: 'auto'
}}
```

**What this achieves:**
- Takes smaller of 95% container width OR viewport-height-based width
- Automatically adjusts when window resizes
- Maintains 16:9 aspect ratio
- Works in both wide and tall window configurations

**Padding improvements:**
- Changed from `p-6` to `px-8 py-6` for better horizontal spacing
- Prevents video from appearing to run off screen edges

### 3. macOS Continuity Camera Support

**File:** `src-tauri/Info.plist` (lines 9-10)

**Problem:** Deprecation warning on app startup:
```
WARNING: AVCaptureDeviceTypeExternal is deprecated for Continuity Cameras.
Please use AVCaptureDeviceTypeContinuityCamera and add
NSCameraUseContinuityCameraDeviceType to your Info.plist.
```

**Solution:**
```xml
<key>NSCameraUseContinuityCameraDeviceType</key>
<true/>
```

**What this does:**
- Declares support for Continuity Camera devices (iPhone/iPad as webcam)
- Eliminates deprecation warning
- Future-proofs camera support for macOS

---

## Technical Details

### Video Loading Flow

**Before Fix:**
1. User imports video or loads workspace
2. Video source set → Video element shows black
3. Code tries to seek before video ready → Fails silently
4. User sees black screen until manual reload

**After Fix:**
1. User imports video or loads workspace
2. Video source set
3. `loadedmetadata` event waits for video ready
4. Once ready, seeks to correct playhead position
5. Video displays immediately ✅

### Responsive Sizing Logic

**Formula:** `width: 'min(95%, calc(100vh * 16/9))'`

**How it works:**
- `100vh` = viewport height
- `100vh * 16/9` = width needed for 16:9 at full height
- `min(...)` = take smaller value (prevents overflow)
- `95%` = cap at 95% of container width (leaves padding)

**Examples:**
- Wide window (1920×1080): Uses 95% width, constrainedby container
- Tall window (1080×1920): Uses `calc(100vh * 16/9)`, height-constrained
- Small window (800×600): Scales down proportionally

---

## Issues Resolved

1. ✅ **Video black screen on initial import**: Fixed with `loadedmetadata` listener
2. ✅ **Video black screen on workspace load**: Same fix applies
3. ✅ **Video not responding to playback after import**: Proper seek timing
4. ✅ **Video container not resizing with window**: Responsive calc() formula
5. ✅ **Continuity Camera deprecation warning**: Added Info.plist key
6. ✅ **Video reloading on every playhead change**: Removed from deps array

---

## Code References

**Key Implementation Points:**
- Video metadata loading: `preview.tsx:133-157`
- Event listener cleanup: `preview.tsx:164-168`
- Dependency array fix: `preview.tsx:169`
- Responsive sizing: `preview.tsx:274-281`
- Continuity Camera support: `Info.plist:9-10`

---

## Task-Master Status

**All tasks completed:** 8/8 tasks done (100%)
**All subtasks completed:** 20/20 subtasks done (100%)

**This session:** Bug fixes and polish (no specific task)
- Addressed issues discovered during testing
- Improved UX for video loading and window resizing

---

## Testing Notes

### Scenarios Tested
✅ Import new video - displays immediately
✅ Load workspace with existing clips - displays immediately
✅ Resize window larger - video scales up
✅ Resize window smaller - video scales down
✅ Click timeline to seek - video updates position
✅ Playback - smooth playhead tracking

### Edge Cases
- Very wide windows: Video width capped at 95%
- Very tall windows: Video height-constrained, proper aspect ratio
- Multiple rapid imports: Each video loads correctly

---

## Current Status

### Working Features
✅ Video preview loads on initial import
✅ Video preview loads on workspace open
✅ Responsive video sizing on window resize
✅ Proper 16:9 aspect ratio maintenance
✅ Continuity Camera support (no warnings)
✅ Smooth playback and seeking

### Code Quality
✅ No compilation errors
✅ No runtime errors
✅ Proper event listener cleanup
✅ No deprecation warnings
✅ Clean, maintainable code

---

## Next Steps

**Potential Enhancements:**
1. Add loading indicator while video metadata loads
2. Handle videos with non-16:9 aspect ratios
3. Add error handling for video loading failures
4. Consider lazy loading for multiple clips
5. Optimize memory usage for long sessions

**Testing Recommendations:**
1. Test with various video formats (MP4, MOV, WebM)
2. Test with 4K and high bitrate videos
3. Test with very short clips (< 1 second)
4. Test workspace persistence across app restarts
5. Test Continuity Camera recording functionality

---

## Files Modified

```
src/components/preview.tsx              (+46, -2)
src-tauri/Info.plist                    (+2, -0)
```

**Build Artifacts:**
```
dist/assets/index-*.js                  (regenerated)
dist/assets/index-*.css                 (regenerated)
dist/index.html                         (updated)
```

---

## Lessons Learned

1. **Video elements need metadata before seeking** - Can't seek to a position until the video knows its duration and codec
2. **Event listeners with `{ once: true }` are cleaner** - Automatic cleanup for one-time events
3. **Closures capture values at creation time** - Use store getters for dynamic values
4. **CSS calc() enables responsive sizing** - Viewport-based calculations work well for aspect ratios
5. **macOS plist keys matter** - Proper declarations eliminate warnings and enable features

---

## Debugging Journey

### Initial Problem
User reported: "Video doesn't show on first import, only after reload"

### Investigation Steps
1. Checked video source setting - ✅ Working
2. Checked Plyr initialization - ✅ Working
3. Checked seek calls - ❌ Called before video ready
4. Found: No wait for `loadedmetadata` event

### Solution Path
1. Added `loadedmetadata` listener
2. Removed playhead from dependency array (was causing reloads)
3. Used store getter for dynamic playhead value
4. Added proper cleanup

### Window Resize Issue
User reported: "Video doesn't resize with window"

### Fix Iterations
1. Tried `width: 100%` - Didn't expand
2. Tried `width/height: 100%` - Broke aspect ratio
3. **Success**: `calc(100vh * 16/9)` with `min()`

---

**Session completed successfully** ✓
