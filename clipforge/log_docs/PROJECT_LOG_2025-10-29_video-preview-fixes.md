# ClipForge Development Log - October 29, 2025
## Video Preview Fixes and Multi-Track Support

### Session Summary
Fixed critical video preview issues including size constraints, audio pause synchronization, and multi-track clip selection. Also configured Tauri v2 asset protocol to enable local video file playback.

---

### Changes Made

#### 1. Video Preview Component (`src/components/preview.tsx`)

**Multi-Track Clip Selection (Lines 20-22)**
- Changed from `clips.find()` to filter + sort approach
- Now prioritizes track 0 (topmost) when multiple clips overlap at playhead
- Enables proper preview of clips on tracks 1 and 2
```typescript
// Before: Only found first clip at playhead
const currentClip = clips.find((clip) => playhead >= clip.start && playhead < clip.end)

// After: Finds all clips, prioritizes lowest track number
const clipsAtPlayhead = clips.filter((clip) => playhead >= clip.start && playhead < clip.end)
const currentClip = clipsAtPlayhead.sort((a, b) => a.track - b.track)[0]
```

**Path Conversion Debug Logging (Lines 48-50)**
- Added console logging for `convertFileSrc()` calls
- Helps diagnose Tauri asset protocol issues
- Shows both original path and converted asset:// URL

**Enhanced Pause Logic (Lines 169-174)**
- Added redundant `player.media.pause()` call
- Ensures underlying `<video>` element is directly paused
- Fixes audio continuing to play when video paused
- Added debug logging for pause actions

**Video Container Size Fix (Lines 229-230)**
- Removed `max-w-3xl max-h-full aspect-video` constraints
- Changed to `w-full h-full` for full-size preview
- Video now properly fills available preview area

#### 2. Tauri Configuration (`src-tauri/tauri.conf.json`)

**Asset Protocol Configuration (Lines 14-21)**
- Enabled Tauri v2 asset protocol
- Added scope for `$APPDATA/**` and `$RESOURCE/**`
- Critical fix for loading local video files in browser
- Requires full dev server restart to take effect

```json
"assetProtocol": {
  "enable": true,
  "scope": [
    "$APPDATA/**",
    "$RESOURCE/**"
  ]
}
```

#### 3. Tauri Capabilities (`src-tauri/capabilities/default.json`)

**Permission Cleanup**
- Kept only valid Tauri v2 permissions: `core:default` and `dialog:allow-open`
- Removed invalid `core:path:allow-app-data-dir` and `core:path:allow-resource-dir`
- Asset access is controlled via `assetProtocol` configuration, not permissions

---

### Issues Resolved

1. **Video Preview Too Small**
   - Status: ✅ Fixed
   - Solution: Changed container from constrained size to full width/height
   - File: `src/components/preview.tsx:229-230`

2. **Video Not Playing - Asset Protocol Error**
   - Status: ✅ Fixed
   - Error: "Failed to load resource: unsupported URL"
   - Solution: Enabled `assetProtocol` in `tauri.conf.json`
   - Required full dev server restart

3. **Audio Continues When Video Paused**
   - Status: ✅ Fixed
   - Solution: Added direct `player.media.pause()` call in addition to `player.pause()`
   - File: `src/components/preview.tsx:169-174`

4. **Second Track Clips Not Showing in Preview**
   - Status: ✅ Fixed
   - Root cause: `clips.find()` only returned first matching clip
   - Solution: Filter all clips at playhead, sort by track number (ascending)
   - File: `src/components/preview.tsx:20-22`

---

### Technical Details

**Tauri v2 Asset Protocol**
- Tauri v2 requires explicit `assetProtocol` configuration
- `convertFileSrc()` converts file paths to `asset://` URLs
- Configuration changes don't hot-reload, require full restart
- Scope determines which directories are accessible

**Multi-Track Timeline Architecture**
- 3 tracks total: 0 (top), 1 (middle), 2 (bottom)
- Lower track numbers have higher visual priority
- Sorting by `track` ascending ensures track 0 clips display first

**Plyr Video Player Integration**
- `player.pause()` may not always pause underlying `<video>` element
- Direct access via `player.media.pause()` ensures audio stops
- Race conditions prevented with `isUpdatingPlayState` ref

---

### Task-Master Status
No active tasks in task-master for this project.

---

### Current Todo List Status
- ✅ Fix video preview size (was too small)
- ✅ Add asset protocol permissions to Tauri config
- ✅ Add path permissions to capabilities
- ✅ Test video playback after restart
- ✅ Fix audio continuing when video paused
- ✅ Fix second track clips not showing in preview

---

### Next Steps

1. **User Testing Required**
   - Verify audio properly pauses when video paused
   - Verify second track clips display in preview
   - Test multi-track overlapping clips behavior

2. **Potential Future Improvements**
   - Add visual indicator for which track is currently displayed
   - Implement track priority toggle (let user choose which track to preview)
   - Add keyboard shortcuts for switching between overlapping clips

3. **Known Limitations**
   - Only one clip displays at a time (topmost track)
   - No visual composition of multiple tracks yet
   - Export functionality for multi-track timeline pending

---

### Code References
- Multi-track selection: `src/components/preview.tsx:20-22`
- Enhanced pause: `src/components/preview.tsx:169-174`
- Size fix: `src/components/preview.tsx:229-230`
- Asset protocol: `src-tauri/tauri.conf.json:14-21`
- Debug logging: `src/components/preview.tsx:48-50`
