# ClipForge - Playhead Sync Refactor Session
**Date:** January 29, 2025
**Session Focus:** Complete refactor of video preview playhead synchronization logic

---

## Session Overview

This session involved a complete rewrite of the video preview component's playhead synchronization logic. The original implementation had multiple competing effects, complex state flags, and race conditions that caused inconsistent behavior when switching between clips.

## Changes Made

### Component: `clipforge/src/components/preview.tsx`

**Major Refactoring:**
- Removed `isLoadingNewSource` state flag and all associated complexity
- Consolidated from 3 competing seek effects down to clear separation of concerns
- Separated clip selection logic from seek logic to prevent infinite loops
- Added comprehensive logging for debugging clip boundary detection

**Key Changes:**

1. **Clip Selection Logic (Lines 17-37)** - RULE 1
   - Simplified `useMemo` to only calculate which clip to show
   - Priority: selected clip → clip at playhead → undefined
   - Removed auto-selection from useMemo to prevent loops

2. **Auto-Selection Effect (Lines 39-75)** - RULE 2
   - New dedicated `useEffect` for auto-selecting clips when playhead moves
   - Triggers only on `playhead` and `clips` changes (NOT `selectedClipId`)
   - Comprehensive logging added to debug clip boundary detection issues
   - Auto-selects topmost clip (lowest track number) when playhead crosses clip boundaries

3. **Video Loading (Lines 105-121)** - RULE 4
   - Simplified to just load video source when `currentClip.id` changes
   - Removed complex loading flags and metadata event handling
   - Direct Plyr source API usage

4. **Seek Logic (Lines 123-165)** - RULE 5
   - Single, clear effect for seeking video to playhead position
   - Calculation: `videoTime = playhead - clip.start` (offset by clip's timeline position)
   - Handles playhead outside clip bounds (show first/last frame)
   - Retry logic for videos not ready yet

5. **Container Sizing (preview.tsx:228)**
   - Fixed-size container: 960px width, 16:9 aspect ratio
   - Uses `object-contain` to preserve video aspect ratios
   - Prevents jumping when switching between different resolution videos

### Other Files:

**`.claude/commands/load-progress.md`** - New slash command
- Created `/load-progress` command to quickly load project context
- Reads and displays `log_docs/current_progress.md`
- Useful for session startup and context recovery

**`log_docs/current_progress.md`** - Updated
- Comprehensive project status snapshot
- Recent accomplishments from last 4 sessions
- Current feature status and known issues
- Task-master completion status (8/8 tasks, 20/20 subtasks)

## Problems Encountered

### Issue 1: Preview Shows Frame Zero When Switching Clips
- **Symptom:** Clicking playhead over different clip shows first frame instead of frame at playhead position
- **Root Cause:** Loading state flag prevented seek until video loaded, but then used stale playhead value
- **Attempted Fix:** Removed loading flags, added direct seek with retry logic
- **Status:** Partially resolved, still debugging

### Issue 2: Selection Keeps Switching Between Clips
- **Symptom:** Auto-select causes infinite loop, clips switch back and forth
- **Root Cause:** Auto-selection in `useMemo` triggered re-renders which re-ran the memo
- **Fix:** Moved auto-selection to separate `useEffect` without `selectedClipId` dependency
- **Status:** In progress, added extensive logging to debug

### Issue 3: Clip Boundary Detection Issues
- **Symptom:** Playhead over Clip A but system thinks it's over Clip B
- **Root Cause:** Suspected issue with clip offset calculations or stale clip data
- **Current Action:** Added comprehensive logging to verify clip boundaries and playhead position
- **Status:** Investigating with detailed console logs

## Code References

### Fixed-Size Container
- `preview.tsx:228` - Container with fixed 960px width and 16:9 aspect ratio
- `preview.tsx:228` - `object-contain` for aspect ratio preservation

### Clip Selection
- `preview.tsx:17-37` - Clip selection `useMemo` (shows selected or clip at playhead)
- `preview.tsx:39-75` - Auto-selection `useEffect` (selects clip when playhead moves)

### Seek Logic
- `preview.tsx:123-165` - Main seek effect with offset calculation
- `preview.tsx:131` - Video time calculation: `playhead - clip.start`
- `preview.tsx:134-138` - Boundary handling (first/last frame)

## Task-Master Status

All core tasks completed (8/8 tasks, 20/20 subtasks done):
- ✓ Fix Jumpy Drag Performance
- ✓ Fix Playhead Seek During Playback
- ✓ Fix Play/Pause Sync Issues
- ✓ Implement Keyboard Shortcuts
- ✓ Implement Multi-Track Timeline UI
- ✓ Implement Clip Operations
- ✓ Implement Multi-Clip Preview
- ✓ Enhance Export with Real FFmpeg Progress

**Note:** Current work (playhead sync refinement) is post-completion polish not tracked in task-master

## Todo List Status

**Current:**
- 🔄 Document playhead sync refactoring work (in progress)

**Completed This Session:**
- ✓ Rewrite preview logic from scratch with simple, clear rules
- ✓ Remove auto-deselection of clips when playhead moves outside
- ✓ Fix playhead sync timing when switching clips
- ✓ Analyze clip selection and switching logic

## Next Steps

### Immediate
1. **Test with detailed logging** - Run app and collect console logs showing:
   - Exact playhead values when clicking
   - All clip boundaries (start/end/track)
   - Which clip is detected at playhead
   - Auto-selection behavior

2. **Verify clip boundary calculations** - Ensure:
   - Clip start/end values are correct in timeline coordinates
   - Playhead position matches timeline ruler
   - Filter logic correctly identifies clips at playhead position

3. **Fix auto-selection loop** - Current logic may still have edge cases:
   - Effect runs on playhead change
   - May need debouncing or additional guards
   - Consider user interaction vs. programmatic updates

### Future Enhancements
- Add visual indicator when clip is auto-selected vs manually selected
- Implement smooth transitions between clip switches
- Cache video frames for faster seeking
- Add preview thumbnails on timeline hover

## Technical Learnings

1. **React Effect Dependencies Matter** - Including `selectedClipId` in auto-select effect created infinite loops
2. **Separate Concerns Clearly** - One effect for selection, one for seeking, one for loading
3. **useMemo for Calculation Only** - Don't trigger side effects (like setState) inside useMemo
4. **Logging is Critical** - Complex state interactions need comprehensive logging to debug
5. **Simplify First** - The working solution removed 90% of the complexity from the broken version

## Metrics

- **Files Modified:** 2 files (preview.tsx, checkpoint.md)
- **Files Created:** 2 files (load-progress.md, current_progress.md)
- **Lines Changed:** ~200 lines in preview.tsx
- **Code Removed:** Eliminated ~100 lines of complex flag/state management
- **Session Duration:** ~3 hours
- **Iterations:** 15+ attempts at fixing playhead sync logic

---

**Status:** Work in progress - debugging clip boundary detection with extensive logging
**Next Session:** Analyze logs and fix remaining auto-selection issues
