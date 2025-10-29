# Product Requirements Document: Stretch Goals & Advanced Features
**Date**: October 29, 2025
**Version**: 1.0
**Status**: Planning - To Be Implemented After Core Features

---

## Overview

This PRD covers advanced features and enhancements that go beyond the core video editing functionality. These features should only be implemented after all core features are complete and stable.

**Goal**: Add professional polish and advanced capabilities to make Clipforge competitive with commercial editors.

**Scope**: Text overlays, transitions, audio controls, effects, export presets, and cloud integration.

**Priority**: All features in this PRD are **STRETCH GOALS** - implement only after core functionality is complete.

---

## Prerequisites

Before implementing ANY stretch goals, these MUST be complete:

- [x] ✅ Basic timeline editing (trim, drag, zoom)
- [ ] ❌ Multi-track timeline with visual lanes
- [ ] ❌ Clip split/delete operations
- [ ] ❌ Multi-clip preview playback
- [ ] ❌ All critical bugs fixed (drag performance, playhead sync, play/pause)
- [ ] ❌ Keyboard shortcuts implemented
- [ ] ❌ Media library with thumbnails
- [ ] ❌ Real FFmpeg export progress
- [ ] ❌ Snap-to functionality (grid, edges, trim)

**Do NOT start stretch goals until all above are ✅**

---

## Stretch Goal Categories

### 1. Text Overlays & Titles
**Priority**: Medium Stretch
**Estimated Effort**: 5-8 hours

**Description**: Add text overlays to videos with customizable fonts, colors, and animations.

**Acceptance Criteria**:
- [ ] Add text layer to timeline (new track type or overlay on video track)
- [ ] Text editor with font selection
- [ ] Color picker for text and background
- [ ] Position text anywhere on frame (drag to position)
- [ ] Text animations:
  - [ ] Fade in/out
  - [ ] Slide in/out (from edges)
  - [ ] Typewriter effect
- [ ] Text duration controls (start/end time on timeline)
- [ ] Preview text in real-time

**Technical Details**:
- Add `TextOverlay` type to Clip interface
- Use FFmpeg drawtext filter for export:
  ```bash
  ffmpeg -i input.mp4 -vf "drawtext=text='Hello':fontsize=24:x=100:y=100" output.mp4
  ```
- Frontend: Canvas overlay for text positioning
- Store text data (content, font, size, color, position, start, end) in clip

**Implementation Priority**: After multi-track timeline is working

---

### 2. Transitions Between Clips
**Priority**: High Stretch
**Estimated Effort**: 6-10 hours

**Description**: Add smooth transitions between clips for professional polish.

**Acceptance Criteria**:
- [ ] Transition types:
  - [ ] Fade (crossfade between clips)
  - [ ] Slide (left, right, up, down)
  - [ ] Wipe (various directions)
  - [ ] Dissolve
- [ ] Transition duration controls (0.5s - 3s)
- [ ] Visual indicators on timeline showing transition zones
- [ ] Preview transitions in real-time
- [ ] Apply to clip boundaries automatically or manually

**Technical Details**:
- Use FFmpeg xfade filter:
  ```bash
  ffmpeg -i clip1.mp4 -i clip2.mp4 -filter_complex "[0][1]xfade=transition=fade:duration=1:offset=5" output.mp4
  ```
- Add `transition` field to Clip interface
- Timeline visualization: Show transition overlap region
- Complex filter graph for multiple transitions

**Implementation Priority**: After text overlays

---

### 3. Audio Controls
**Priority**: Medium Stretch
**Estimated Effort**: 4-6 hours

**Description**: Advanced audio manipulation for better sound design.

**Acceptance Criteria**:
- [ ] Volume adjustment per clip (0-200%, with slider)
- [ ] Audio fade in/out at clip boundaries
- [ ] Mute/unmute clips
- [ ] Audio waveform visualization on timeline
- [ ] Audio normalization (automatic level adjustment)
- [ ] Audio ducking (lower music when voice is present)
- [ ] Separate audio track (extract audio, edit separately)

**Technical Details**:
- FFmpeg volume filter: `volume=0.5` (50%)
- FFmpeg fade filter: `afade=t=in:st=0:d=1`
- Waveform generation: FFmpeg or Web Audio API
- Add `volume`, `audioFadeIn`, `audioFadeOut`, `muted` to Clip
- Audio ducking: Use FFmpeg sidechaincompress

**Implementation Priority**: After transitions

---

### 4. Visual Filters & Effects
**Priority**: Low Stretch
**Estimated Effort**: 8-12 hours

**Description**: Color grading and visual effects for enhanced video quality.

**Acceptance Criteria**:
- [ ] Basic adjustments:
  - [ ] Brightness (-100 to +100)
  - [ ] Contrast (-100 to +100)
  - [ ] Saturation (-100 to +100)
  - [ ] Hue rotation (0-360°)
- [ ] Color filters:
  - [ ] Black & white
  - [ ] Sepia
  - [ ] Vintage/retro
  - [ ] Warm/cool tint
- [ ] Effects:
  - [ ] Blur (adjustable radius)
  - [ ] Sharpen
  - [ ] Vignette
- [ ] Apply per-clip or globally
- [ ] Real-time preview of effects

**Technical Details**:
- FFmpeg filters: `eq`, `hue`, `colorbalance`, `curves`
- Example: `eq=brightness=0.1:contrast=1.2:saturation=1.5`
- Add `effects` object to Clip
- UI: Slider controls in effects panel
- Preview: Apply filters to video element (CSS or canvas)

**Implementation Priority**: After audio controls

---

### 5. Export Presets for Platforms
**Priority**: Medium Stretch
**Estimated Effort**: 3-5 hours

**Description**: One-click export optimized for different social media platforms.

**Acceptance Criteria**:
- [ ] Preset buttons:
  - [ ] YouTube (1080p, 16:9, high bitrate)
  - [ ] Instagram Feed (1080x1080, square, optimized for mobile)
  - [ ] Instagram Stories (1080x1920, vertical)
  - [ ] TikTok (1080x1920, vertical, max 60s)
  - [ ] Twitter (720p, 16:9, 2:20 max)
- [ ] Auto-crop/letterbox to fit aspect ratio
- [ ] Platform-specific codec settings
- [ ] File size optimization
- [ ] Duration warnings if exceeding platform limits

**Technical Details**:
- Preset configurations in JSON or code
- FFmpeg scale and crop filters for aspect ratios
- Example TikTok: `scale=1080:1920,setsar=1`
- Bitrate/quality presets per platform
- UI: Dropdown or buttons in export dialog

**Implementation Priority**: After core export enhancements

---

### 6. Keyboard Shortcuts (Extended)
**Priority**: High Stretch (partial - basic shortcuts are CORE)
**Estimated Effort**: 2-3 hours

**Core shortcuts** (Space, Delete, Escape, Cmd+A) are in main timeline PRD.

**Extended shortcuts** (stretch):
- [ ] `J/K/L` - Rewind/Pause/Play (industry standard)
- [ ] `I/O` - Mark in/out points for trimming
- [ ] `S` - Split clip at playhead
- [ ] `Cmd+Z` / `Ctrl+Z` - Undo
- [ ] `Cmd+Shift+Z` / `Ctrl+Y` - Redo
- [ ] `Cmd+C` / `Ctrl+C` - Copy selected clip
- [ ] `Cmd+V` / `Ctrl+V` - Paste clip
- [ ] `Cmd+X` / `Ctrl+X` - Cut clip
- [ ] `Arrow keys` - Move playhead frame-by-frame
- [ ] `+/-` - Zoom in/out timeline

**Technical Details**:
- Extend keyboard event handler
- Integrate with undo/redo system (see below)
- Clipboard operations for copy/paste

**Implementation Priority**: After undo/redo system

---

### 7. Auto-Save & Project State
**Priority**: High Stretch
**Status**: ⚠️ PARTIALLY IMPLEMENTED

**Acceptance Criteria**:
- [x] Auto-save workspace (IMPLEMENTED via workspace-persistence.ts)
- [x] Restore on app launch (IMPLEMENTED)
- [ ] Save/load named projects (multiple projects)
- [ ] Project file format (.clipforge or JSON)
- [ ] "Save As" functionality
- [ ] Recent projects list
- [ ] Project settings (name, description, created date)

**Technical Details**:
- Extend existing workspace persistence
- Add project metadata structure
- File format: JSON with clips array, settings, timeline state
- Use Tauri file system API for save/load dialogs

**Implementation Priority**: Medium (basic auto-save exists, extend it)

---

### 8. Undo/Redo Functionality
**Priority**: High Stretch
**Estimated Effort**: 5-7 hours

**Description**: Allow users to undo/redo editing actions.

**Acceptance Criteria**:
- [ ] Undo/redo for all destructive actions:
  - [ ] Add/delete clips
  - [ ] Move clips
  - [ ] Trim clips
  - [ ] Split clips
  - [ ] Effect changes
- [ ] Undo/redo stack (up to 50 actions)
- [ ] Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
- [ ] Visual indication of undo/redo availability
- [ ] Clear history on project save (optional)

**Technical Details**:
- Use Zustand middleware: `temporal` or custom history middleware
- Store action history: `{ type, before, after, clipId }`
- Implement inverse operations for each action type
- Example:
  ```ts
  undoHistory.push({
    type: 'DELETE_CLIP',
    before: clip,
    after: null
  })
  ```

**Implementation Priority**: After keyboard shortcuts

---

### 9. Cloud Storage Integration
**Priority**: Low Stretch
**Estimated Effort**: 10-15 hours

**Description**: Upload exports to cloud storage and generate shareable links.

**Acceptance Criteria**:
- [ ] Google Drive integration:
  - [ ] OAuth authentication
  - [ ] Upload exported video
  - [ ] Generate shareable link
- [ ] Dropbox integration (similar to Drive)
- [ ] Direct link sharing (copy to clipboard)
- [ ] Upload progress indicator
- [ ] Option to keep local copy

**Technical Details**:
- OAuth 2.0 flow for authentication
- Google Drive API: `POST /drive/v3/files`
- Dropbox API: `POST /files/upload`
- Tauri: Use `tauri-plugin-oauth` or custom implementation
- Store auth tokens securely (system keychain)

**Implementation Priority**: Low (requires significant backend/auth work)

---

### 10. Advanced Timeline Features
**Priority**: Medium Stretch
**Estimated Effort**: 6-8 hours

**Description**: Professional timeline enhancements.

**Acceptance Criteria**:
- [ ] Ripple delete (delete clip and close gap)
- [ ] Ripple trim (trim clip and shift subsequent clips)
- [ ] Clip grouping (select and move multiple clips as one)
- [ ] Timeline markers (add labeled markers at specific times)
- [ ] Nested sequences (edit sub-sequences separately)
- [ ] Track locking (prevent accidental edits)
- [ ] Solo track (preview only one track)

**Technical Details**:
- Ripple operations: Shift all clips after edit point
- Grouping: Store group ID, apply operations to all group members
- Markers: Array of `{ time, label, color }`
- Track states: `locked`, `solo`, `muted`

**Implementation Priority**: After undo/redo

---

## Implementation Roadmap

### Phase 1: After Core Features (Weeks 1-2)
1. Extended keyboard shortcuts
2. Undo/redo functionality
3. Auto-save enhancements (named projects)

### Phase 2: Visual Enhancements (Weeks 3-4)
1. Transitions between clips
2. Text overlays with animations
3. Audio controls (volume, fade)

### Phase 3: Polish & Presets (Weeks 5-6)
1. Export presets for platforms
2. Visual filters & effects
3. Advanced timeline features

### Phase 4: Cloud Integration (Optional)
1. Google Drive / Dropbox upload
2. Shareable link generation

---

## Success Criteria

This PRD is successful when:
- [ ] All CORE features from other PRDs are complete and stable
- [ ] At least 3-5 stretch goals are implemented
- [ ] App feels professional and polished
- [ ] Users can create content ready for social media platforms
- [ ] Undo/redo works reliably for all actions

---

## Testing Scenarios

- Create a video with text overlays and transitions
- Export with different platform presets (YouTube, Instagram, TikTok)
- Use undo/redo extensively during editing
- Apply audio fades and volume adjustments
- Test keyboard shortcuts for all actions
- Upload exported video to Google Drive

---

**End of PRD** - Stretch Goals & Advanced Features
