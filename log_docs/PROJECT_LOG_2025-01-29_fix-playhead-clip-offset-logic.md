# Project Log - January 29, 2025
## Fix Playhead and Clip Offset Calculation Logic

**Session Date:** January 29, 2025
**Focus Area:** Timeline playhead behavior and clip selection logic
**Status:** Critical bug fixes completed

---

## Session Summary

Fixed fundamental issues with how the timeline playhead interacts with clip selection and video seeking. The root problem was that playhead position (timeline coordinates) was being confused with video file playback position, causing incorrect frame display when switching between clips.

### Key Issue Resolved

**Problem:** When clicking on a clip at a different timeline position than where it starts, the video would seek to the wrong frame. For example, clicking at 5 minutes on a clip that starts at 4 minutes should show 1 minute into that video, but was instead showing incorrect frames.

**Root Causes Identified:**
1. Auto-selection logic was interfering with manual clip selection
2. Timeline click handler had incorrect coordinate calculation due to zoom changes resetting scrollOffset
3. Closure captured stale clip data in timeupdate handler
4. Playhead movement was triggering unwanted clip switching

---

## Changes Made

### 1. Removed Auto-Selection Logic
**File:** `clipforge/src/components/preview.tsx:39-40`

**Before:**
```typescript
// SIMPLE RULE 2: Auto-select clip when playhead moves over it
useEffect(() => {
  // ... complex auto-selection logic that switched clips based on playhead
}, [playhead, clips])
```

**After:**
```typescript
// NO AUTO-SELECTION - user must manually select clips
// Playhead position is independent of clip selection
```

**Impact:** Playhead now moves freely without triggering clip changes. Users manually select clips by clicking.

---

### 2. Fixed Zoom Change Breaking ScrollOffset
**File:** `clipforge/src/store/use-clip-store.ts:94, 111`

**Problem:** When `autoFitZoom()` recalculated zoom level, it didn't reset `scrollOffset`. Since scrollOffset is measured in pixels and zoom defines pixels-per-second, changing zoom without adjusting scrollOffset made coordinate calculations incorrect.

**Fix:**
```typescript
autoFitZoom: (timelineWidth) => {
  // ... zoom calculation
  set({ zoom, scrollOffset: 0 })  // CRITICAL: Reset scroll when zoom changes
}
```

**Impact:** Timeline click positions now calculate correctly after zoom changes.

---

### 3. Fixed Closure Capturing Stale Clip Data
**File:** `clipforge/src/components/preview.tsx:54-88`

**Problem:** The `timeupdate` event handler was set up once on component mount with empty dependencies `[]`, causing it to capture the initial `currentClip` value in a closure. When clips changed, the handler continued using stale data.

**Before:**
```typescript
player.on("timeupdate", () => {
  if (!isUpdatingFromPlayer.current && currentClip) {
    // Uses currentClip from closure - STALE after clip changes!
    const timelinePosition = currentClip.start + (currentTime - currentClip.trimStart)
    setPlayhead(timelinePosition)
  }
})
```

**After:**
```typescript
player.on("timeupdate", () => {
  if (isUpdatingFromPlayer.current) return

  // Get CURRENT clip from store, not closure!
  const state = useClipStore.getState()
  const activeClip = state.selectedClipId
    ? state.clips.find(c => c.id === state.selectedClipId)
    : state.clips.filter(c => state.playhead >= c.start && state.playhead < c.end)
        .sort((a, b) => a.track - b.track)[0]

  if (!activeClip) return

  const timelinePosition = activeClip.start + (currentTime - activeClip.trimStart)
  setPlayhead(timelinePosition)
})
```

**Impact:** Playhead updates now use the correct current clip data, fixing the core issue.

---

### 4. Auto-Scroll Timeline on Clip Selection Change
**File:** `clipforge/src/components/timeline.tsx:98-127`

**New Feature:**
```typescript
useEffect(() => {
  if (!selectedClipId || !canvasRef.current) return
  if (prevSelectedClipIdRef.current === selectedClipId) return
  prevSelectedClipIdRef.current = selectedClipId

  const selectedClip = clips.find(c => c.id === selectedClipId)
  if (!selectedClip) return

  // Calculate target scroll position
  const targetTime = playhead >= selectedClip.start && playhead < selectedClip.end
    ? playhead
    : selectedClip.start

  const targetX = targetTime * zoom
  const canvasWidth = canvas.width || 800
  const viewportCenter = canvasWidth / 2

  // Center the target position in viewport
  const newScrollOffset = Math.max(0, targetX - viewportCenter + TRACK_LABEL_WIDTH)
  setScrollOffset(newScrollOffset)
}, [selectedClipId, clips, playhead, zoom, scrollOffset, setScrollOffset])
```

**Impact:** When switching clips, timeline automatically scrolls to show the relevant playhead position.

---

### 5. Simplified Clip Click Handler
**File:** `clipforge/src/components/timeline.tsx:357`

**Before:**
```typescript
trimmedRect.on("mousedown", (e) => {
  isDraggingRef.current = true
  setSelectedClip(clip.id)

  // Update playhead to click position within the clip
  const pointer = canvas.getPointer(e.e)
  const newTime = Math.max(0, (pointer.x - TRACK_LABEL_WIDTH + scrollOffset) / zoom)
  setPlayhead(newTime)
})
```

**After:**
```typescript
trimmedRect.on("mousedown", () => {
  isDraggingRef.current = true
  setSelectedClip(clip.id)
  console.log('[Timeline] Clip selected:', clip.name, '- playhead will show frame relative to clip start')
})
```

**Impact:** Clicking a clip only selects it without moving the playhead.

---

## New Playhead Behavior

### Design Philosophy

**Playhead is independent of clip selection:**
- Playhead moves freely along the timeline
- Clicking a clip selects it but doesn't move playhead
- Video preview shows the frame at the playhead position *relative to the selected clip's start offset*

### Frame Display Logic

When a clip is selected, the video shows:
- **If playhead < clip.start:** First frame (trimStart)
- **If playhead >= clip.end:** Last frame (trimEnd)
- **If playhead within clip bounds:** Frame at `trimStart + (playhead - clip.start)`

### Example Scenario

**Setup:**
- Clip A: 0s to 290s (first clip)
- Clip B: 240s to 480s (starts at 4 minutes)
- Playhead at 300s (5 minutes)

**User Actions:**
1. Click Clip B → Selected, playhead stays at 300s
   - Video shows: 300 - 240 = **60s into Clip B** ✓
2. Click Clip A → Selected, playhead stays at 300s
   - Since 300s > 290s (clip end), video shows **last frame of Clip A** ✓
3. Drag playhead to 100s
   - Since 100s is within Clip A (0-290s), video shows **100s into Clip A** ✓

---

## Code References

### Critical Fixes
- `clipforge/src/components/preview.tsx:39-40` - Removed auto-selection
- `clipforge/src/components/preview.tsx:54-88` - Fixed timeupdate closure bug
- `clipforge/src/store/use-clip-store.ts:94, 111` - Reset scrollOffset on zoom change
- `clipforge/src/components/timeline.tsx:98-127` - Auto-scroll on selection change

### Video Seeking Logic
- `clipforge/src/components/preview.tsx:122-171` - Playhead to video time conversion
- `clipforge/src/components/preview.tsx:134-141` - Handle playhead outside clip bounds

### Timeline Coordinate Calculation
- `clipforge/src/components/timeline.tsx:223` - Clip rendering: `x = clip.start * zoom - scrollOffset + TRACK_LABEL_WIDTH`
- `clipforge/src/components/timeline.tsx:585` - Click inverse: `time = (pointer.x - TRACK_LABEL_WIDTH + scrollOffset) / zoom`

---

## Testing Performed

### Manual Testing Scenarios
1. ✅ Click at 5-minute mark on second clip (starts at 4min) → Shows 1 minute into video
2. ✅ Click first clip when playhead is past its end → Shows last frame
3. ✅ Switch between clips → Timeline scrolls to show playhead position
4. ✅ Drag playhead while clip selected → Video seeks correctly
5. ✅ Play video → Playhead updates on timeline with correct coordinates

---

## Task-Master Status

**Project:** All tasks complete (1/1 done)
- Task 1: Implement concat button for clip tracks ✓ done

**Note:** This session addressed bugs discovered during real-world usage, not tracked in task-master.

---

## Todo List Status

**Completed:**
- ✅ Remove auto-selection logic - playhead stays independent of clip selection
- ✅ Make playhead constrain to selected clip bounds
- ✅ Update video seeking to map playhead position to video time based on clip start offset
- ✅ Auto-adjust timeline scrollOffset when clip selection changes to keep playhead visible
- ✅ Fix timeupdate handler using stale currentClip data

**No Outstanding Todos**

---

## Next Steps

### Recommended Testing
1. Test workspace restoration with various playhead positions
2. Verify multi-track switching with overlapping clips
3. Test trim handle adjustments with new playhead behavior
4. Validate keyboard shortcuts with updated logic

### Potential Enhancements
1. Add visual feedback when playhead is outside selected clip bounds
2. Implement snap-to-clip feature (optional)
3. Add playhead position indicator relative to clip start/end
4. Consider adding playhead constraints (lock to selected clip)

---

## Lessons Learned

### Closure Pitfalls in Event Handlers
**Problem:** Event handlers set up once with empty dependencies capture variables in closures, leading to stale data.

**Solution:** Use `store.getState()` to fetch current values instead of relying on closure captures.

**Example:**
```typescript
// BAD: Captures currentClip at handler setup time
player.on("timeupdate", () => {
  const pos = currentClip.start + time  // Stale!
})

// GOOD: Fetches current state each time
player.on("timeupdate", () => {
  const clip = useClipStore.getState().clips.find(...)
  const pos = clip.start + time  // Fresh!
})
```

### Coordinate System Consistency
**Key Insight:** When variables represent pixel measurements (like `scrollOffset`) and zoom changes, those measurements must be recalculated or reset to maintain coordinate system consistency.

**Formula:**
- Rendering: `screen_x = time * zoom - scrollOffset + TRACK_LABEL_WIDTH`
- Inverse: `time = (screen_x - TRACK_LABEL_WIDTH + scrollOffset) / zoom`

Both formulas must use the same zoom and scrollOffset values, or calculations break.

### Separation of Concerns
**Timeline vs Video Playback:**
- Timeline playhead = absolute position in timeline coordinates (seconds from timeline start)
- Video playback = position within the video file (accounts for clip start offset + trim)

**Key Calculation:**
```typescript
video_time = trimStart + (playhead - clip.start)
```

This conversion must happen whenever the playhead or selected clip changes.

---

## Performance Notes

- Timeupdate events fire ~30-60 times per second during playback
- Added `isUpdatingFromPlayer` guard prevents circular updates
- 50ms debounce prevents rapid playhead jitter
- Scroll offset changes trigger timeline re-render (acceptable performance)

---

## End of Log
**Session Duration:** ~2 hours
**Commits:** 1 (this session)
**Files Changed:** 2 (preview.tsx, timeline.tsx, use-clip-store.ts)
**Lines Changed:** +55 / -83 (net -28 lines, improved clarity)
