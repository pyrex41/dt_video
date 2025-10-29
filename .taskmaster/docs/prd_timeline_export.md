# Product Requirements Document: Timeline & Export Advanced Features
**Date**: October 28, 2025
**Version**: 1.0
**Status**: Active

---

## Overview

This PRD covers the advanced timeline editing features and export enhancements needed for the full submission (Wednesday, October 29th, 10:59 PM CT). The current timeline supports basic dragging and trimming, but lacks multi-track editing, clip splitting, and real-time preview of multi-clip sequences. Export needs progress indicators and better resolution handling.

**Goal**: Transform the basic timeline into a professional editing interface with multi-track support and seamless export experience.

**Scope**: Add multi-track timeline, clip operations (split/delete), real-time preview, and export improvements.

---

## Requirements

### 1. Multi-Track Timeline
**Priority**: Critical
**Description**: Support multiple video/audio tracks for complex editing (main video + overlays/PiP).

**Acceptance Criteria**:
- [ ] At least 2 tracks (main video + overlay)
- [ ] Visual track lanes in timeline canvas
- [ ] Drag clips between tracks
- [ ] Track height adjustable
- [ ] Track labels and organization
- [ ] Preview respects track layering

**Technical Details**:
- Extend Clip interface with `track: number` field
- Modify timeline canvas to render multiple horizontal lanes
- Update drag logic to respect track boundaries
- Adjust preview to composite tracks (if not real-time)

### 2. Clip Operations (Split/Delete)
**Priority**: High
**Description**: Add essential clip editing operations for professional workflow.

**Acceptance Criteria**:
- [ ] Split clip at playhead position (creates two clips)
- [ ] Delete clips from timeline (with confirmation)
- [ ] Context menu for clip operations
- [ ] Keyboard shortcuts (Delete key, etc.)
- [ ] Undo support for destructive operations

**Technical Details**:
- Add split logic: create two clips from one at playhead
- Implement delete with store updates
- Add right-click context menu to clips
- Consider Zustand undo middleware

### 3. Real-Time Multi-Clip Preview
**Priority**: Critical
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

### 4. Timeline Enhancements
**Priority**: Medium
**Description**: Improve timeline usability with professional features.

**Acceptance Criteria**:
- [ ] Snap-to-grid functionality
- [ ] Snap-to-clip edges for alignment
- [ ] Zoom controls (buttons + mouse wheel)
- [ ] Timeline ruler improvements
- [ ] Clip selection improvements (multi-select)
- [ ] Better visual feedback during operations

**Technical Details**:
- Add snap detection in drag handlers
- Implement zoom with mouse wheel support
- Enhance ruler with time markers
- Add multi-select with shift/ctrl modifiers

### 5. Export Progress & Enhancements
**Priority**: High
**Description**: Add real-time progress indicators and better export options.

**Acceptance Criteria**:
- [ ] Real-time progress bar during export
- [ ] Estimated time remaining
- [ ] Cancel export functionality
- [ ] Better resolution options (source, 480p, 720p, 1080p, 4K)
- [ ] Quality presets (fast, balanced, high quality)
- [ ] Export status notifications

**Technical Details**:
- Parse FFmpeg stderr for progress (frame/time/fps)
- Emit progress events from Rust to frontend
- Add cancel logic with process termination
- Extend export_video command parameters

### 6. Transitions & Effects (Stretch)
**Priority**: Low
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

- [ ] Multi-track timeline with at least 2 lanes
- [ ] Clip split and delete operations working
- [ ] Seamless preview across multiple clips
- [ ] Snap-to-grid and edge alignment
- [ ] Real-time export progress indicators
- [ ] Cancel export functionality
- [ ] Enhanced resolution and quality options
- [ ] All features work in packaged app

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