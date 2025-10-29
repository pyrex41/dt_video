# Project Log - 2025-01-29: Video Preview & Plyr Integration Fixes

## Session Summary
Fixed critical video preview issues including Plyr player initialization, playhead synchronization, clip selection logic, and workspace restoration. The session focused on ensuring smooth video playback with proper multi-track clip switching and persistent playhead state across app reloads.

## Changes Made

### 1. Video Preview Component (clipforge/src/components/preview.tsx)

#### Plyr Integration Refactor
- **Removed recreate-on-clip-change pattern** (lines 45-107)
  - Previously: Destroyed and recreated Plyr instance every time clip changed
  - Now: Initialize Plyr once on mount, use `player.source` API to swap videos
  - Reference: Plyr documentation from Context7 (/sampotts/plyr)

- **Implemented correct source switching** (lines 109-132)
  ```typescript
  player.source = {
    type: 'video',
    sources: [{ src: convertedSrc, type: 'video/mp4' }]
  }
  ```
  - Uses Plyr's official source API instead of direct video element manipulation
  - Eliminates orphaned DOM elements and race conditions

#### Clip Selection Logic (lines 17-39)
- **Added intelligent clip selection with useMemo**
  - Priority 1: Show selected clip if user clicked on timeline clip
  - Priority 2: Auto-select clip at playhead (lowest track number wins)
  - Logs selection decision for debugging

- **Implemented selection clearing** (lines 173-185)
  - Clears `selectedClipId` when playhead moves outside selected clip bounds
  - Allows proper auto-selection of clips based on playhead position
  - Fixes issue where clicking timeline at 1-minute mark showed wrong video

#### Playhead Synchronization Improvements (lines 191-245)
- **Enhanced metadata loading handling**
  - Checks `videoRef.current.readyState >= 2` before seeking
  - Falls back to `loadedmetadata` event listener if not ready
  - Ensures correct frame display on app reload with workspace restoration

- **Fixed workspace restoration seeking** (lines 201-224)
  ```typescript
  const syncTime = () => {
    const timeDiff = Math.abs(player.currentTime - clipLocalTime)
    if (timeDiff > 0.1) {
      player.currentTime = clipLocalTime
    }
  }

  if (videoRef.current && videoRef.current.readyState >= 2) {
    syncTime()
  } else {
    videoRef.current?.addEventListener('loadedmetadata', handleLoadedMetadata)
  }
  ```
  - Handles both immediate sync (video loaded) and deferred sync (waiting for metadata)
  - Reads playhead from Zustand store to get current persisted value

### 2. Build Artifacts
- Updated webpack build outputs:
  - Deleted: `index-BZE9Z4Kd.js`, `index-CFOgsGaN.css`
  - Added: `index-CnQo7Fz0.css`, `index-DYA8cZn2.js`
  - Modified: `dist/index.html` with new asset references

## Task-Master Status
All tasks completed (8/8 tasks, 20/20 subtasks):
- ✓ Task 1: Fix Jumpy Drag Performance
- ✓ Task 2: Fix Playhead Seek During Playback
- ✓ Task 3: Fix Play/Pause Sync Issues
- ✓ Task 4: Implement Keyboard Shortcuts
- ✓ Task 5: Implement Multi-Track Timeline UI
- ✓ Task 6: Implement Clip Operations
- ✓ Task 7: Implement Multi-Clip Preview (current session focused here)
- ✓ Task 8: Enhance Export with Real FFmpeg Progress

## Todo List Status
- No active todos (session work completed)
- Work focused on fixing video preview issues discovered during testing

## Technical Decisions

### Why Keep Plyr Instead of Native HTML5?
- Native HTML5 video worked but lacked smooth controls and polish
- Plyr provides better UX with professional controls and keyboard shortcuts
- Solution: Use Plyr correctly per official documentation instead of removing it

### Key Plyr Best Practices Applied
1. Initialize player once, reuse instance
2. Change sources via `player.source` API, not direct video element
3. Use Plyr events (`ready`, `timeupdate`, `play`, `pause`) instead of video events
4. Let Plyr handle DOM wrapping and control rendering

## Issues Resolved

### Issue 1: Video Not Displaying After Plyr Integration
- **Root Cause**: Destroying and recreating Plyr on every clip change caused race conditions
- **Solution**: Single initialization pattern with source API for switching videos
- **Location**: preview.tsx:45-107

### Issue 2: Playhead Constrained to Second Video Start
- **Root Cause**: `selectedClipId` kept second clip selected even when playhead moved
- **Solution**: Clear selection when playhead moves outside clip bounds
- **Location**: preview.tsx:173-185

### Issue 3: Wrong Video Shown When Clicking Timeline
- **Root Cause**: Auto-selection logic not triggered when `selectedClipId` was set
- **Solution**: Clear selection to allow auto-selection based on playhead position
- **Location**: preview.tsx:19-38

### Issue 4: Workspace Restoration Shows Wrong Frame
- **Root Cause**: Seeking attempted before video metadata loaded
- **Solution**: Wait for `loadedmetadata` event before seeking on initial load
- **Location**: preview.tsx:210-224

## Next Steps

### Potential Improvements
1. Add visual loading indicator while video metadata loads
2. Implement preview thumbnails for timeline scrubbing
3. Add waveform visualization for audio tracks
4. Consider caching decoded video frames for faster switching

### Testing Recommendations
1. Test workspace restoration with various playhead positions
2. Verify multi-track switching with overlapping clips
3. Test trim handle adjustments with playback active
4. Validate keyboard shortcuts work with Plyr controls

## References
- Plyr Documentation: /sampotts/plyr (via Context7)
- Tauri convertFileSrc API: Used for asset:// protocol conversion
- Zustand Store: useClipStore for state management
- Fabric.js Timeline: Multi-track rendering with drag-and-drop

## Code Quality Notes
- Added comprehensive logging with `[ClipForge]` prefix for debugging
- Used TypeScript strict mode compatible patterns
- Followed React hooks best practices (proper dependencies, cleanup)
- Maintained separation of concerns (preview vs timeline components)
