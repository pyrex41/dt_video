# Product Requirements Document: Recording & Import Enhancements
**Date**: October 28, 2025
**Version**: 2.0
**Status**: Updated - Partial Implementation

---

## Overview

This PRD documents the implemented recording and import features for the Clipforge application. Screen recording is fully implemented with window/fullscreen selection and audio capture. Webcam recording is integrated with UI controls and timeline auto-add. Drag-and-drop import is functional for video files. Media library and PiP features are planned but not yet implemented.

**Goal**: Provide core recording and import capabilities for content creation.

**Scope**: Implemented screen and webcam recording, drag-and-drop import. Pending: media library, PiP, advanced audio.

---

## Requirements

### 1. Screen Recording Implementation
**Priority**: Critical
**Description**: Native screen recording with window/fullscreen selection.

**Acceptance Criteria**:
- [x] Screen recording command in Rust backend
- [x] Frontend UI for screen selection (window/fullscreen)
- [x] Record button starts/stops screen capture
- [x] Recorded video saved to timeline automatically
- [x] Support for audio capture from system/desktop
- [x] Preview of selected screen area before recording

**Technical Details**:
- Implemented using Tauri's platform APIs (AVFoundation on macOS, Windows.Graphics.Capture on Windows)
- Saves to `clips/` directory with auto-generated filename
- Integrates with existing `save_recording` command

### 2. Webcam Recording Integration
**Priority**: High
**Description**: Webcam recording with UI and timeline integration.

**Acceptance Criteria**:
- [x] Webcam preview in recording UI
- [x] Start/stop controls for webcam capture
- [x] Duration input or continuous recording
- [x] Recorded webcam clips auto-added to timeline
- [x] Camera permission handling with user feedback
- [x] Resolution options (720p/1080p)

**Technical Details**:
- Uses existing `record_webcam_clip` Rust command
- Frontend UI in RecordButton component
- Integrates `getUserMedia()` for live preview
- Auto-save to timeline after recording

### 3. Simultaneous Screen + Webcam (PiP)
**Priority**: Medium
**Description**: Recording screen with webcam overlay in picture-in-picture mode.

**Acceptance Criteria**:
- [ ] UI option to enable webcam overlay during screen recording
- [ ] Adjustable PiP position and size
- [ ] Audio mixing (microphone + system audio)
- [ ] Preview of composited view before recording
- [ ] Export maintains PiP composition

**Technical Details**:
- Planned: Extend screen recording to include webcam stream
- Use FFmpeg for real-time compositing or post-processing
- Add overlay controls in recording UI

### 4. File Import via Dialog
**Priority**: High
**Status**: ⚠️ PARTIALLY IMPLEMENTED (single file only)
**Description**: Import video files using native file dialog.

**Acceptance Criteria**:
- [x] File picker dialog for video selection
- [x] Support for common video formats (MP4, MOV, WebM, AVI)
- [x] Automatic import and timeline addition
- [ ] **Support for multiple files at once** (select multiple in file picker)
- [x] Error handling for unsupported formats
- [ ] Batch import progress indicator (when importing multiple files)

**Technical Details**:
- Uses Tauri `@tauri-apps/api/dialog` for file selection
- Integrates with existing `import_file` command
- **TODO**: Enable `multiple: true` in dialog options
- **TODO**: Loop through selected files and import each
- Handles file validation before import

**Current Limitation**:
- Only supports single file import
- Need to add multi-file support to file picker dialog

### 5. Media Library Panel
**Priority**: High (CORE FEATURE - not stretch goal)
**Status**: ❌ NOT IMPLEMENTED
**Description**: Sidebar panel showing all imported media with thumbnails and metadata.

**Acceptance Criteria**:
- [ ] Collapsible sidebar with media list (left or right side)
- [ ] **Thumbnail previews for each clip** (first frame or mid-point)
- [ ] **Metadata display for each clip**:
  - [ ] Duration (MM:SS format)
  - [ ] Resolution (e.g., "1920x1080")
  - [ ] File size (e.g., "45.2 MB")
  - [ ] Format/codec info
- [ ] Drag clips from library to timeline
- [ ] Delete clips from library (with confirmation)
- [ ] Search/filter functionality (by name, duration, resolution)
- [ ] Clip preview on hover (optional)

**Technical Details**:
- New MediaLibrary component (sidebar)
- Generate thumbnails using FFmpeg:
  ```bash
  ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 thumbnail.jpg
  ```
- Store metadata in clip objects (extend Clip interface if needed)
- Integrate with existing store and timeline
- Thumbnail cache in `clips/thumbnails/` directory

**Implementation Priority**:
This is a CORE feature from the requirements list, not a stretch goal. Should be implemented after timeline bugs are fixed.

### 6. Audio Capture Integration
**Priority**: Medium
**Description**: Microphone audio capture to recording features.

**Acceptance Criteria**:
- [x] Microphone selection in recording UI (basic)
- [ ] Audio level monitoring during recording
- [x] Audio mixing with video recordings
- [ ] Mute/unmute controls
- [x] Audio export in final videos

**Technical Details**:
- Extends webcam/screen commands to include audio streams
- Uses `getUserMedia()` with audio constraints
- FFmpeg audio encoding (AAC preferred)

---

## Technical Architecture

### Recording Architecture
```
Frontend (React)
├── RecordButton.tsx          # Main recording UI with screen/webcam controls
├── ScreenSelector.tsx        # Screen/window selection (implemented)
├── WebcamPreview.tsx         # Live camera preview (implemented)
└── AudioControls.tsx         # Basic microphone controls

Backend (Rust/Tauri)
├── record_screen_clip()      # Implemented: Screen recording
├── record_webcam_clip()      # Existing: Camera recording
├── save_recording()          # Existing: Save WebM/MP4
└── import_file()             # Existing: File import
```

### Import Architecture
```
Frontend (React)
├── DragDropZone.tsx          # Implemented: Drag-and-drop overlay
├── MediaLibrary.tsx           # Planned: Sidebar library panel
└── ThumbnailGenerator.tsx     # Planned: Thumbnail creation

Backend (Rust/Tauri)
├── import_file()              # Existing: Copy to clips/
├── generate_thumbnail()       # Planned: FFmpeg thumbnail
└── list_clips()               # Existing: Directory scan
```

### Data Flow
1. **Recording**: UI → Tauri command → Capture → Save to clips/ → Add to store/timeline
2. **Import**: Drag/file picker → Validate → Copy to clips/ → Add to store/timeline
3. **Library**: Planned - Scan clips/ → Generate thumbnails → Display in sidebar → Drag to timeline

---

## Implementation Plan

### Completed Phases
- **Phase 1: Screen Recording** - Fully implemented and tested
- **Phase 2: Webcam UI Integration** - Complete with auto-save
- **Phase 3: Drag-and-Drop Import** - Functional for multiple files
- **Phase 5: Audio Integration** - Basic microphone support added

### Pending Phases
- **Phase 4: Media Library** (3-4 hours)
  1. Create library sidebar component
  2. Implement thumbnail generation
  3. Add drag-to-timeline functionality
  4. Include metadata display

- **Phase 5 Extensions: Advanced Audio & PiP** (3-4 hours)
  1. Add audio level monitoring and mute controls
  2. Implement PiP compositing
  3. Test audio synchronization
  4. Add overlay controls

---

## Success Criteria

- [x] Screen recording captures full screen or selected window
- [x] Webcam recording integrates with UI and auto-saves to timeline
- [x] Drag-and-drop imports multiple video files
- [ ] Media library shows thumbnails and metadata
- [x] Basic audio capture works with microphone
- [ ] PiP mode available for screen + webcam
- [x] Core features work in packaged app

---

## Risks & Mitigations

### Risk: Platform-Specific Recording
**Impact**: Screen recording works on one platform but not others
**Mitigation**: Tested on Mac and Windows; fallback options available

### Risk: Camera/Microphone Permissions
**Impact**: Recording fails due to permission issues
**Mitigation**: Implemented clear error messages and permission handling

### Risk: Performance During Recording
**Impact**: High CPU usage or dropped frames
**Mitigation**: Optimized FFmpeg settings; quality options configurable

### Risk: Audio Sync Issues
**Impact**: Audio and video out of sync
**Mitigation**: Tested thoroughly; FFmpeg sync options used

---

## Dependencies

- FFmpeg with screen capture support (avfoundation/dshow)
- Tauri platform APIs for native screen access
- Web APIs for camera/microphone access
- File system permissions for saving recordings

---

**End of PRD** - Recording & Import Enhancements (Updated for Current Implementation)