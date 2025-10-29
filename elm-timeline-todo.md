# Elm Timeline Implementation Plan

## Phase 1: UI Fixes (Tasks 1-4) - Day 1
- [x] **Task 1: Fix Jumpy Drag Performance** ✅
  - Added `Browser.Events.onAnimationFrame` for 60fps drag updates
  - Simplified MouseMove to just update mouse position
  - DragFrameUpdate performs calculations at animation frame rate
  - Removed complex throttling logic in favor of Elm's built-in RAF

- [x] **Task 2: Fix Playhead Seek During Playback** ✅
  - TimelineClicked handler already allows seeking during playback (no isPlaying check)
  - Added proper clamping to valid time range
  - Video seeking works through setVideoTime port regardless of playback state

- [x] **Task 3: Fix Play/Pause Sync Issues** ✅
  - Added videoPlayEvent and videoPauseEvent ports for Plyr synchronization
  - Added VideoPlayEvent/VideoPauseEvent messages to update isPlaying state
  - Fixed PlayVideo handler to always start playback (removed toggle logic)
  - External controls now properly sync with actual video playback state

- [x] **Task 4: Implement Keyboard Shortcuts** ✅
  - Enhanced keyDecoder with KeyEvent type for modifier key detection
  - Added Cmd/Ctrl+A for select all functionality
  - Added Escape key to deselect all clips
  - Maintained existing shortcuts (space, arrows, zoom, delete)
  - Added SelectAllClips message and handler

## Phase 2: Multi-Track Timeline (Task 5) - Day 2
- [ ] **Visual Track Lanes**
  - Add track headers with labels ("Main", "PiP")
  - Implement adjustable track heights via drag handles
  - Add visual separators between tracks
  - Support dynamic track count (up to 4 tracks)

- [ ] **Cross-Track Dragging**
  - Extend `findClipAtPosition` to detect drop target track
  - Update `DraggingClip` to include target track
  - Implement smooth cross-track animation during drag
  - Add track change preview (highlight target track)

- [ ] **Overlap Detection**
  - Create `checkTrackOverlap` function for target track
  - Implement visual overlap indicators (red highlighting)
  - Add conflict resolution dialog with options
  - Support multi-selection drag with bulk overlap checking

## Phase 3: Clip Operations (Task 6) - Day 2-3
- [ ] **Split at Playhead**
  - Create two clips from original at playhead position
  - Handle edge cases (playhead outside bounds, very short clips)
  - Add visual split indicator and animation
  - Auto-select both new clips

- [ ] **Delete Operations**
  - Enhance existing `RemoveSelectedClip` with multi-select support
  - Adjust subsequent clips' positions after deletion
  - Implement simple undo for delete operations
  - Add visual confirmation before permanent delete

- [ ] **Context Menu**
  - Add `onContextMenu` to clip elements
  - Implement menu items: Split, Delete, Properties, Copy to clipboard
  - Position menu at click location with proper z-index
  - Support keyboard navigation for menu

## Phase 4: Multi-Clip Preview (Task 7) - Day 3
- [ ] **Multi-Clip Detection**
  - Find all clips active at current playhead position
  - Sort by track priority (higher tracks overlay lower)
  - Handle resolution mismatches with scaling

- [ ] **Track Compositing**
  - Use Canvas 2D context for real-time compositing
  - Implement z-index based on track number
  - Support alpha blending for PiP overlays
  - Cache composite frames for performance

- [ ] **Seamless Transitions**
  - Pre-load adjacent clips (next/previous on timeline)
  - Implement crossfade between clips (0.1-0.3s)
  - Handle gap filling with black frames or stretch
  - Buffer management to prevent stuttering

## Phase 5: Enhanced Export (Task 8) - Day 4
- [ ] **Real FFmpeg Progress**
  - Parse FFmpeg stderr for actual frame/time data
  - Stream stderr line-by-line via Tauri port
  - Real-time progress calculation based on total duration
  - Error detection from FFmpeg stderr

- [ ] **Cancel Functionality**
  - Send SIGTERM to FFmpeg process
  - Remove partial output files
  - Clear export state and show cancellation message
  - Add cancel button with loading state

- [ ] **Resolution/Quality Options**
  - Implement presets: Source, 480p, 720p, 1080p, 4K
  - Add quality settings: Fast, Medium, High, Best
  - Configure audio bitrates: 128k, 192k, 256k AAC
  - Add validation for input vs target resolution

## Success Metrics
- [ ] All 8 tasks fully implemented and tested
- [ ] Multi-track timeline with drag/drop between tracks
- [ ] Split, delete, and context menu operations working
- [ ] Seamless multi-clip playback with compositing
- [ ] Real-time FFmpeg export progress with cancel support
- [ ] Timeline rendering: 60fps with 10+ clips across 4 tracks
- [ ] Memory usage: < 500MB after 15-minute editing session
- [ ] Keyboard-only workflow fully functional
- [ ] Responsive design working on all major screen sizes

## Technical Risks & Mitigations
- [ ] Performance: Implement offscreen canvas and clip culling
- [ ] Browser Compatibility: Feature detection and fallbacks
- [ ] Memory Management: Proper cleanup and monitoring
- [ ] FFmpeg Integration: Robust parsing with version detection