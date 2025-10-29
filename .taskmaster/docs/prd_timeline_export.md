# Product Requirements Document: Timeline & Export Advanced Features
**Date**: October 28, 2025
**Version**: 1.1
**Status**: Active
**Last Updated**: October 29, 2025

---

## Overview

This PRD covers the advanced timeline editing features and export enhancements needed for the full submission (Wednesday, October 29th, 10:59 PM CT).

**Current State (as of Oct 29)**: The timeline supports clip trimming with visual handles, zoom controls (in/out + auto-fit), and basic export with simulated progress. The `track` field exists in the Clip interface but multi-track rendering is NOT implemented. Preview only shows single clip at playhead, not multi-clip sequences.

**Goal**: Transform the basic timeline into a professional editing interface with multi-track support and seamless export experience.

**Scope**: Add multi-track timeline, clip operations (split/delete), real-time preview, and export improvements.

**Implementation Status Summary**:
- ✅ Basic trim/zoom: IMPLEMENTED
- ❌ Multi-track: NOT IMPLEMENTED (infrastructure exists, UI doesn't use it)
- ❌ Clip operations (split/delete): NOT IMPLEMENTED
- ❌ Multi-clip preview: NOT IMPLEMENTED
- ⚠️ Export progress: PARTIALLY IMPLEMENTED (simulated, not real FFmpeg parsing)

---

## Quick Status Overview

| Feature | Status | Completion | Notes |
|---------|--------|------------|-------|
| **Phase 1: Multi-Track** | ❌ NOT STARTED | 0% | Data model ready (`track` field exists), UI doesn't render multiple tracks |
| **Phase 2: Clip Ops** | ❌ NOT STARTED | 0% | Store methods exist (`deleteClip`), no UI/shortcuts |
| **Phase 3: Multi-Clip Preview** | ❌ NOT STARTED | 0% | Preview only shows single clip at playhead |
| **Phase 4: Timeline Polish** | ⚠️ PARTIAL | 60% | ✅ Zoom/trim/ruler, ❌ snap/multi-select |
| **Phase 5: Export** | ⚠️ PARTIAL | 50% | ✅ Progress bar (simulated), ❌ real FFmpeg parsing/cancel |
| **Phase 6: Transitions** | ❌ NOT STARTED | 0% | Stretch goal, not implemented |

**Overall Completion**: ~18% (2 of 6 phases partially done)

---

## Critical Bugs & UX Issues (Oct 29, 2025)

### 🐛 High Priority Bugs

1. **Jumpy Drag Performance** (Timeline)
   - **Issue**: Dragging clips/playhead/trim handles is not smooth, jumps around
   - **Impact**: Poor editing experience, hard to position clips precisely
   - **Location**: clipforge/src/components/timeline.tsx (drag handlers)
   - **Likely Cause**: Re-rendering during drag, or event throttling issues

2. **Playhead Seek Fails During Playback**
   - **Issue**: Clicking timeline to jump playhead doesn't work when video is playing
   - **Expected**: Should seek to clicked position even during playback
   - **Location**: timeline.tsx:334-340 (mouse:down handler), preview.tsx playhead sync
   - **Impact**: Can't skip to different parts while previewing

3. **Play/Pause Control Sync Issues**
   - **Issue**: External play/pause button doesn't always pause when video is playing
   - **Behavior**: Inconsistent - sometimes works, sometimes doesn't
   - **Location**: controls.tsx:31-33, preview.tsx Plyr event handlers
   - **Impact**: Confusing UX, users lose control of playback

### ⌨️ Missing Keyboard Shortcuts (Required)

**Priority**: High - Essential for professional editing workflow

| Shortcut | Action | Status |
|----------|--------|--------|
| `Space` | Play/Pause toggle | ❌ Not implemented |
| `Delete` / `Backspace` | Delete selected clip(s) | ❌ Not implemented |
| `Escape` | Deselect clip | ❌ Not implemented |
| `Cmd+A` (Mac) / `Ctrl+A` (Win) | Select all clips | ❌ Not implemented (no multi-select exists) |

**Implementation Notes**:
- Need global keyboard event listener (useEffect with document.addEventListener)
- Respect when user is typing in inputs (check document.activeElement)
- Should work regardless of which component has focus

---

## Bug Fixes Required (Before Feature Work)

These bugs must be fixed before continuing with new features, as they impact core usability.

### BUG-1: Fix Jumpy Drag Performance
**Priority**: Critical
**Status**: ❌ NOT FIXED
**Description**: Dragging clips, playhead, and trim handles is not smooth - elements jump around instead of following cursor smoothly.

**Root Cause Analysis Needed**:
- Is timeline re-rendering during drag? (Check `isDraggingRef` usage)
- Are event handlers being throttled/debounced incorrectly?
- Is Fabric.js canvas redrawing too frequently?

**Acceptance Criteria**:
- [ ] Clip dragging feels smooth and responsive
- [ ] Playhead dragging doesn't jump
- [ ] Trim handles follow cursor precisely
- [ ] No visual jitter during drag operations

**Files to Investigate**:
- clipforge/src/components/timeline.tsx:199-209 (clip moving)
- clipforge/src/components/timeline.tsx:217-255 (left trim handle)
- clipforge/src/components/timeline.tsx:257-291 (right trim handle)
- clipforge/src/components/timeline.tsx:321-327 (playhead moving)

### BUG-2: Fix Playhead Seek During Playback
**Priority**: High
**Status**: ❌ NOT FIXED
**Description**: Clicking the timeline to jump to a position doesn't work when video is playing. User expects to be able to seek while playing.

**Acceptance Criteria**:
- [ ] Clicking timeline seeks playhead even when isPlaying=true
- [ ] Video jumps to clicked position and continues playing
- [ ] Playhead updates immediately on click

**Files to Fix**:
- clipforge/src/components/timeline.tsx:334-340 (canvas mouse:down handler)
- clipforge/src/components/preview.tsx:144-168 (playhead sync effect)

### BUG-3: Fix Play/Pause Control Sync
**Priority**: High
**Status**: ❌ NOT FIXED
**Description**: External play/pause button (in controls) doesn't consistently pause the video when playing. Sometimes works, sometimes doesn't.

**Root Cause Analysis Needed**:
- Is `isPlaying` state getting out of sync with Plyr player state?
- Are Plyr events not firing reliably?
- Race condition between setIsPlaying and player.play()/pause()?

**Acceptance Criteria**:
- [ ] Play button always starts playback
- [ ] Pause button always pauses playback
- [ ] State stays in sync between controls and Plyr player
- [ ] No race conditions or timing issues

**Files to Fix**:
- clipforge/src/components/controls.tsx:31-33 (handlePlayPause)
- clipforge/src/components/preview.tsx:79-80 (Plyr event handlers)
- clipforge/src/components/preview.tsx:163-167 (isPlaying sync)

---

## Requirements

### 1. Multi-Track Timeline
**Priority**: Critical
**Status**: ❌ NOT IMPLEMENTED (infrastructure ready, UI doesn't use it)
**Description**: Support multiple video/audio tracks for complex editing (main video + overlays/PiP).

**Acceptance Criteria**:
- [ ] At least 2 tracks (main video + overlay) - **separate visual lanes**
- [ ] Visual track lanes in timeline canvas (one per track)
- [ ] Drag clips between tracks
- [ ] Track height adjustable
- [ ] Track labels and organization
- [ ] Preview respects track layering (top track overlays bottom)
- [ ] **Auto-handle overlaps**: When clips overlap on same track, prompt user to choose which to keep/trim
- [ ] **Track overlap visualization**: Clearly show when clips on different tracks overlap in time

**Technical Details**:
- ✅ Clip interface already has `track: number` field (clipforge/src/types/clip.ts:8)
- ❌ Timeline canvas only renders single track lane (clipforge/src/components/timeline.tsx:72-81)
- ❌ Drag logic doesn't respect track boundaries
- ❌ Preview doesn't composite multiple tracks

**Implementation Notes**:
- Data model is ready, just need UI implementation
- Timeline.tsx needs to loop over track numbers and render multiple lanes (similar to Premiere Pro)
- Clip positioning logic (lines 114-300) needs track-aware Y positioning
- **USER REQUEST: Each track should be on a separate line for easy visualization**
- **USER REQUEST: Auto-trim overlaps - when clips overlap on same track, show dialog to pick which one to keep or how to trim**
- Track layout inspiration: Premiere Pro (separate horizontal lanes stacked vertically)

### 2. Clip Operations (Split/Delete)
**Priority**: High
**Status**: ❌ NOT IMPLEMENTED
**Description**: Add essential clip editing operations for professional workflow.

**Acceptance Criteria**:
- [ ] Split clip at playhead position (creates two clips)
- [ ] Delete clips from timeline (with confirmation or keyboard shortcut)
- [ ] Context menu for clip operations
- [ ] **Keyboard shortcuts (REQUIRED - see Critical Bugs section)**:
  - [ ] `Delete` or `Backspace` to delete selected clip(s)
  - [ ] `Escape` to deselect clip
  - [ ] `Space` to play/pause (global)
  - [ ] `Cmd+A` / `Ctrl+A` to select all clips
- [ ] Undo support for destructive operations

**Technical Details**:
- Add split logic: create two clips from one at playhead
- Implement delete with store updates
- Add right-click context menu to clips
- Consider Zustand undo middleware
- **Add global keyboard event handler in App.tsx or Timeline component**

**Implementation Notes**:
- Store has `deleteClip()` and `removeClip()` methods (use-clip-store.ts:20,62)
- No UI buttons/shortcuts to trigger these operations
- No split functionality exists
- No context menu component
- **USER REPORTED: Keyboard shortcuts are critical missing feature**

### 3. Real-Time Multi-Clip Preview
**Priority**: Critical
**Status**: ❌ NOT IMPLEMENTED
**Description**: Preview should play through multiple clips in sequence, not just current clip.

**Acceptance Criteria**:
- [ ] Seamless playback across clip boundaries
- [ ] No loading delays between clips
- [ ] Maintains playhead synchronization
- [ ] Handles different clip durations/resolutions
- [ ] Audio continuity across clips

**Technical Details**:
- Modify Preview component to detect next clip at current clip end
- Pre-load adjacent clips for smooth transitions
- Update playhead logic to span multiple clips
- Handle resolution changes gracefully

**Implementation Notes**:
- Current preview only shows single clip: `currentClip = clips.find(clip => playhead >= clip.start && playhead < clip.end)` (preview.tsx:18)
- When playhead moves beyond current clip, preview shows "No clip selected"
- No preloading or transition logic exists
- Plyr player is destroyed and recreated on every clip change (lines 38-51)
- Would need sophisticated buffering/switching logic for seamless playback

### 4. Timeline Enhancements
**Priority**: Medium
**Status**: ⚠️ PARTIALLY IMPLEMENTED
**Description**: Improve timeline usability with professional features.

**Acceptance Criteria**:
- [ ] Snap-to-grid functionality (configurable grid size)
- [ ] Snap-to-clip edges for alignment (when dragging clips)
- [ ] **Snap-to-trim boundaries (USER REQUEST)** - When dragging/trimming, snap to trim start/end points of other clips
- [x] Zoom controls (buttons + mouse wheel)
- [x] Timeline ruler improvements
- [ ] Clip selection improvements (multi-select)
- [x] Better visual feedback during operations

**Technical Details**:
- Add snap detection in drag handlers (threshold ~5-10px or 0.1s in timeline units)
- Implement zoom with mouse wheel support
- Enhance ruler with time markers
- Add multi-select with shift/ctrl modifiers
- **Snap to trim points**: When dragging/trimming, detect nearby trim boundaries and snap

**Implementation Notes**:
- ✅ Zoom in/out/auto-fit buttons implemented (controls.tsx:43-53)
- ✅ Time ruler with dynamic intervals based on duration (timeline.tsx:83-111)
- ✅ Visual trim handles with hover states (timeline.tsx:166-196)
- ✅ Trim/drag feedback with dimmed untrimmed portions (timeline.tsx:126-139, 142-153)
- ❌ No snap-to-grid or snap-to-edges
- ❌ **No snap-to-trim boundaries (USER REQUESTED)**
- ❌ No multi-select (only single selectedClipId in store)
- ❌ No mouse wheel zoom support

**Snap Implementation Guide**:
1. **Snap-to-grid**: Round clip positions to nearest grid interval (e.g., 0.5s, 1s)
2. **Snap-to-clip-edges**: When dragging, check if clip start/end is within snap threshold of other clip start/end
3. **Snap-to-trim**: Check if drag position is near any clip's trimStart or trimEnd boundaries
4. Visual feedback: Show snap guides/lines when snapping occurs

### 5. Export Progress & Enhancements
**Priority**: High
**Status**: ⚠️ PARTIALLY IMPLEMENTED (simulated progress only)
**Description**: Add real-time progress indicators and better export options.

**Acceptance Criteria**:
- [x] Real-time progress bar during export (simulated)
- [ ] Estimated time remaining (showing percentage only)
- [ ] Cancel export functionality
- [~] Better resolution options (source, 480p, 720p, 1080p, 4K) - only 720p/1080p
- [ ] Quality presets (fast, balanced, high quality)
- [x] Export status notifications

**Technical Details**:
- Parse FFmpeg stderr for progress (frame/time/fps)
- Emit progress events from Rust to frontend
- Add cancel logic with process termination
- Extend export_video command parameters

**Implementation Notes**:
- ✅ Progress bar exists (export-button.tsx:189-198)
- ⚠️ Progress is SIMULATED with setInterval, NOT real FFmpeg parsing (lines 82-89)
- ✅ Success notification shows after export (lines 131-138)
- ✅ Resolution dropdown with 720p/1080p options (lines 142-169)
- ❌ No cancel button or functionality
- ❌ No source/480p/4K options
- ❌ No quality presets
- ❌ No estimated time remaining (just percentage)
- Backend needs to emit progress events for real tracking

### 6. Transitions & Effects (Stretch)
**Priority**: Low
**Status**: ❌ NOT IMPLEMENTED
**Description**: Basic transitions between clips for polished exports.

**Acceptance Criteria**:
- [ ] Fade in/out transitions
- [ ] Crossfade between clips
- [ ] Transition duration controls
- [ ] Preview transitions in timeline

**Technical Details**:
- Add transition metadata to clips
- Implement in FFmpeg export with filter_complex
- Visual transition indicators in timeline

**Implementation Notes**:
- No transition fields in Clip interface
- No transition UI or controls
- Export uses simple concat, no FFmpeg transitions

---

## Technical Architecture

### Timeline Architecture
```
Frontend (React + Fabric.js)
├── Timeline.tsx               # Main canvas component
├── Track.tsx                  # Individual track rendering
├── Clip.tsx                   # Enhanced clip with operations
├── ContextMenu.tsx            # Right-click operations
└── SnapSystem.tsx             # Grid/edge snapping

Store (Zustand)
├── clips[] with track field
├── selectedClips[] for multi-select
├── snapEnabled, gridSize
└── undo/redo stack
```

### Preview Architecture
```
Preview.tsx
├── detectCurrentClip()        # Find clip at playhead
├── preloadAdjacentClips()     # Cache next/prev clips
├── handleClipTransition()     # Seamless switching
├── maintainAudioSync()        # Audio continuity
└── handleResolutionChanges()  # Smooth scaling
```

### Export Architecture
```
Backend (Rust)
├── export_video()             # Enhanced with progress
├── parse_ffmpeg_progress()    # Stderr parsing
├── emit_progress_events()     # Tauri events
└── handle_cancel()            # Process termination

Frontend (React)
├── ExportDialog.tsx           # Resolution/quality options
├── ProgressMonitor.tsx        # Real-time updates
└── CancelHandler.tsx          # Export cancellation
```

### Data Flow
1. **Multi-Track**: Clips have track numbers → Timeline renders lanes → Drag respects track boundaries
2. **Split/Delete**: User action → Store updates → Timeline re-renders → Undo stack updated
3. **Real-Time Preview**: Playhead moves → Detect current clip → Switch video source → Maintain sync
4. **Export Progress**: FFmpeg runs → Parse stderr → Emit events → Update UI progress bar

---

## Implementation Plan

### Phase 1: Multi-Track Timeline (4-5 hours)
1. Add track field to Clip interface and store
2. Modify timeline canvas to render multiple tracks
3. Update drag logic for track constraints
4. Add track controls (height, labels)

### Phase 2: Clip Operations (3-4 hours)
1. Implement split-at-playhead functionality
2. Add delete with confirmation
3. Create context menu component
4. Add keyboard shortcuts

### Phase 3: Real-Time Preview (4-5 hours)
1. Modify preview to handle multi-clip sequences
2. Add preloading for adjacent clips
3. Implement seamless transitions
4. Handle resolution/duration differences

### Phase 4: Timeline Polish (2-3 hours)
1. Add snap-to-grid/edges
2. Improve zoom controls
3. Enhance selection (multi-select)
4. Better visual feedback

### Phase 5: Export Enhancements (3-4 hours)
1. Add progress parsing to Rust commands
2. Implement progress events
3. Add cancel functionality
4. Extend resolution/quality options

### Phase 6: Transitions (Stretch, 2-3 hours)
1. Add transition metadata
2. Implement FFmpeg filters
3. Visual timeline indicators

---

## Success Criteria

**Original Goals**:
- [ ] Multi-track timeline with at least 2 lanes
- [ ] Clip split and delete operations working
- [ ] Seamless preview across multiple clips
- [ ] Snap-to-grid and edge alignment
- [ ] Real-time export progress indicators
- [ ] Cancel export functionality
- [ ] Enhanced resolution and quality options
- [ ] All features work in packaged app

**Current Achievement (Oct 29, 2025)**:
- [x] Single-track timeline with trim/zoom controls
- [x] Visual trim handles with apply functionality
- [x] Simulated export progress (not real FFmpeg parsing)
- [x] Basic resolution options (720p/1080p)
- [x] Export success notifications
- [ ] Multi-track rendering (data model ready, UI not implemented)
- [ ] Multi-clip preview playback
- [ ] Split/delete clip operations
- [ ] Real FFmpeg progress parsing
- [ ] Cancel export
- [ ] Snap-to-grid/edges
- [ ] Multi-select clips

---

## Risks & Mitigations

### Risk: Performance with Multi-Track
**Impact**: Timeline becomes sluggish with many clips/tracks
**Mitigation**: Optimize Fabric.js rendering, virtual scrolling if needed

### Risk: Preview Sync Issues
**Impact**: Audio/video desync during clip transitions
**Mitigation**: Thorough testing, use Plyr's sync features

### Risk: Export Progress Parsing
**Impact**: Progress bar inaccurate or fails
**Mitigation**: Robust regex parsing, fallback to indeterminate progress

### Risk: Complex State Management
**Impact**: Bugs with multi-track, undo, multi-select
**Mitigation**: Extensive testing, consider state debugging tools

---

## Dependencies

- Fabric.js for advanced canvas operations
- FFmpeg for export progress parsing
- Tauri events for progress communication
- Robust testing with multiple clips/tracks

---

**End of PRD** - Timeline & Export Advanced Features</content>
</xai:function_call