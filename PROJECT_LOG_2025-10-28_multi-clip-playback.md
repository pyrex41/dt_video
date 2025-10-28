# ClipForge Multi-Clip Playback Fix - October 28, 2025

## Problem Statement

When moving the timeline playhead to the second imported clip, the video player still shows the first clip instead of switching to the new clip's video source.

### User Report
- Import functionality works fine
- Multiple clips appear correctly on timeline
- When moving playhead over to second clip, video doesn't switch
- First video continues playing/displaying

## Root Cause Analysis

### Issue Location
**File:** `clipforge/src/components/preview.tsx`

### The Bug
The Plyr player initialization and video source changes are not properly synchronized:

1. **Current clip detection works correctly** (line 14):
   ```typescript
   const currentClip = clips.find((clip) => playhead >= clip.start && playhead < clip.end)
   ```

2. **Video source updates in JSX** (line 76):
   ```typescript
   <video ref={videoRef} src={convertFileSrc(currentClip.path)} />
   ```

3. **Plyr reinitializes when currentClip changes** (lines 16-50):
   - useEffect destroys and recreates Plyr player
   - BUT: Race condition between video source loading and Plyr initialization
   - Video element's `src` changes, but Plyr doesn't properly reload the new source

### Why It Fails

**Sequence of events:**
1. Playhead at 0s → `currentClip` = Video 1 → Player initialized with Video 1
2. User moves playhead to 12s (into second clip) → `currentClip` = Video 2
3. useEffect triggers, destroys and recreates Plyr
4. Video element's `src` attribute changes to Video 2's path
5. **Race condition:** Plyr initializes before video loads, or doesn't detect the source change
6. Result: Player UI exists but shows/plays wrong video

### Additional Issues

**Playhead sync problems** (lines 52-68):
- Attempts to sync playhead to video time
- When switching clips, video source hasn't loaded yet
- Setting `currentTime` on unloaded video fails silently
- No handling for video loading state

## Expected Behavior

When playhead moves from Clip 1's range to Clip 2's range:
1. Detect clip change (currentClip changes from Clip 1 to Clip 2)
2. Pause current playback
3. Update video source to Clip 2's file
4. Wait for video to load (`loadeddata` event)
5. Seek to correct position within new clip (playhead - clip.start)
6. Resume playback if was playing before

## Solution Plan

### Approach: Proper Video Loading State Management

### 1. Modify `clipforge/src/components/preview.tsx`

**Changes needed:**
- Add explicit video loading state
- Listen for video `loadeddata` event before seeking/playing
- Separate video source updates from Plyr initialization
- Use `key` prop on video element tied to `currentClip.id` to force React remount
- Or: Manually handle `src` changes with proper load event listeners
- Wait for `loadeddata` event before initializing Plyr
- Calculate correct seek position within new clip after loading
- Preserve and restore playback state during clip switches

**Implementation strategy:**
```typescript
// Option 1: Use key to force video element recreation
<video
  key={currentClip?.id}
  ref={videoRef}
  src={convertFileSrc(currentClip.path)}
/>

// Option 2: Manual source management
useEffect(() => {
  if (!videoRef.current || !currentClip) return

  const video = videoRef.current

  // Pause current playback
  video.pause()

  // Update source
  video.src = convertFileSrc(currentClip.path)

  // Wait for load
  const handleLoadedData = () => {
    // Initialize Plyr
    // Seek to correct position
    // Resume if was playing
  }

  video.addEventListener('loadeddata', handleLoadedData)

  return () => {
    video.removeEventListener('loadeddata', handleLoadedData)
  }
}, [currentClip])
```

### 2. Testing Plan

**Test scenarios:**
1. Import multiple videos (2-3 clips)
2. Move playhead between clips using timeline
3. Verify video switches correctly to new clip
4. Test playback across clip boundaries
5. Verify play/pause state persists during clip switches
6. Test rapid playhead movements between clips
7. Test with clips of different durations/formats

### 3. Files to Modify

**Primary:**
- `clipforge/src/components/preview.tsx` - Fix video source switching logic

**No changes needed:**
- Timeline component (correctly displays multiple clips)
- Clip store (correctly tracks clips and playhead)
- Import functionality (working correctly)

## Current System Context

### Working Components
- ✅ Import functionality (adds clips sequentially)
- ✅ Timeline visualization (shows multiple clips)
- ✅ Clip detection (currentClip calculation)
- ✅ Playhead tracking

### Broken Component
- ❌ Video player source switching

### Architecture Notes

**Clip Data Structure:**
```typescript
{
  id: string
  path: string
  start: number    // Timeline position (seconds)
  end: number      // Timeline position (seconds)
  duration: number // Original video duration
}
```

**Timeline Layout:**
- Clips stack sequentially (end of previous = start of next)
- Example: Clip 1 (0-10s), Clip 2 (10-20s), Clip 3 (20-35s)

**Current Clip Calculation:**
```typescript
const currentClip = clips.find((clip) =>
  playhead >= clip.start && playhead < clip.end
)
```

## Implementation Steps

### Step 1: Read current preview.tsx
- Understand full component structure
- Identify all useEffect dependencies
- Note current event handlers

### Step 2: Implement video loading state
- Add loading flag
- Add loadeddata event listener
- Separate source change from Plyr init

### Step 3: Test with dev server
- Use existing `pnpm run tauri dev`
- Test multi-clip scenarios
- Verify in browser console logs

### Step 4: Verify fix
- Confirm video switches when playhead moves
- Confirm playback state preserved
- Confirm no console errors

## Success Criteria

- [ ] Moving playhead to second clip shows second video
- [ ] Moving playhead to third clip shows third video
- [ ] Video seeks to correct position within clip
- [ ] Playback state (playing/paused) preserved during switches
- [ ] No console errors or race conditions
- [ ] Smooth transitions between clips

## Notes

- Dev server already running (background bash eac274)
- Tauri asset protocol configured correctly
- FFmpeg conversion working properly
- Issue is purely frontend React/Plyr integration

## Related Files

- `clipforge/src/components/preview.tsx` - Main file to modify
- `clipforge/src/components/timeline.tsx` - Reference for clip layout
- `clipforge/src/store/use-clip-store.ts` - State management
- `clipforge/src/types/clip.ts` - Type definitions
