# Product Requirements Document: Recording & Import Enhancements
**Date**: October 28, 2025
**Version**: 1.0
**Status**: Active

---

## Overview

This PRD covers the recording features and import enhancements needed for the full submission (Wednesday, October 29th, 10:59 PM CT). While webcam recording exists in the backend, it needs frontend integration and UI. Screen recording is missing entirely and requires significant implementation. Import features need drag-and-drop and a media library.

**Goal**: Complete all recording capabilities and enhance import workflow to provide a comprehensive content creation experience.

**Scope**: Add screen recording, integrate webcam UI, implement drag-and-drop, create media library panel.

---

## Requirements

### 1. Screen Recording Implementation
**Priority**: Critical
**Description**: Add native screen recording capability with window/fullscreen selection.

**Acceptance Criteria**:
- [ ] Screen recording command in Rust backend
- [ ] Frontend UI for screen selection (window/fullscreen)
- [ ] Record button starts/stops screen capture
- [ ] Recorded video saved to timeline automatically
- [ ] Support for audio capture from system/desktop
- [ ] Preview of selected screen area before recording

**Technical Details**:
- Use Tauri's platform APIs (AVFoundation on macOS, Windows.Graphics.Capture on Windows)
- Consider `tauri-plugin-screen-recorder` if available
- Fallback: `navigator.mediaDevices.getDisplayMedia()` in frontend (limited window selection)
- Save to `clips/` directory with auto-generated filename
- Integrate with existing `save_recording` command for consistency

### 2. Webcam Recording Integration
**Priority**: High
**Description**: Complete the webcam recording feature with proper UI and timeline integration.

**Acceptance Criteria**:
- [ ] Webcam preview in recording UI
- [ ] Start/stop controls for webcam capture
- [ ] Duration input or continuous recording
- [ ] Recorded webcam clips auto-added to timeline
- [ ] Camera permission handling with user feedback
- [ ] Resolution options (720p/1080p)

**Technical Details**:
- Use existing `record_webcam_clip` Rust command
- Add frontend UI in RecordButton component
- Integrate `getUserMedia()` for live preview
- Handle camera permissions gracefully
- Auto-save to timeline after recording completes

### 3. Simultaneous Screen + Webcam (PiP)
**Priority**: Medium
**Description**: Support recording screen with webcam overlay in picture-in-picture mode.

**Acceptance Criteria**:
- [ ] UI option to enable webcam overlay during screen recording
- [ ] Adjustable PiP position and size
- [ ] Audio mixing (microphone + system audio)
- [ ] Preview of composited view before recording
- [ ] Export maintains PiP composition

**Technical Details**:
- Extend screen recording to include webcam stream
- Use FFmpeg for real-time compositing or post-processing
- Add overlay controls in recording UI
- Test audio synchronization

### 4. Drag-and-Drop Import
**Priority**: High
**Description**: Add drag-and-drop support for importing video files.

**Acceptance Criteria**:
- [ ] Drag video files onto app window
- [ ] Visual feedback during drag operation
- [ ] Automatic import and timeline addition
- [ ] Support for multiple files at once
- [ ] Error handling for unsupported formats

**Technical Details**:
- Use `react-dropzone` or native HTML5 drag events
- Integrate with existing `import_file` command
- Add drop zone overlay on main app area
- Handle file validation before import

### 5. Media Library Panel
**Priority**: Medium
**Description**: Create a sidebar panel showing all imported media with thumbnails and metadata.

**Acceptance Criteria**:
- [ ] Collapsible sidebar with media list
- [ ] Thumbnail previews for each clip
- [ ] Metadata display (duration, resolution, size)
- [ ] Drag clips from library to timeline
- [ ] Delete clips from library
- [ ] Search/filter functionality

**Technical Details**:
- New MediaLibrary component
- Generate thumbnails using FFmpeg (add Rust command if needed)
- Store metadata in clip objects
- Integrate with existing store and timeline

### 6. Audio Capture Integration
**Priority**: Medium
**Description**: Add microphone audio capture to recording features.

**Acceptance Criteria**:
- [ ] Microphone selection in recording UI
- [ ] Audio level monitoring during recording
- [ ] Audio mixing with video recordings
- [ ] Mute/unmute controls
- [ ] Audio export in final videos

**Technical Details**:
- Extend webcam/screen commands to include audio streams
- Use `getUserMedia()` with audio constraints
- FFmpeg audio encoding (AAC preferred)
- Test audio sync with video

---

## Technical Architecture

### Recording Architecture
```
Frontend (React)
├── RecordButton.tsx          # Main recording UI
├── ScreenSelector.tsx        # Screen/window selection
├── WebcamPreview.tsx         # Live camera preview
└── AudioControls.tsx         # Microphone controls

Backend (Rust/Tauri)
├── record_screen_clip()      # NEW: Screen recording
├── record_webcam_clip()      # EXISTING: Camera recording
├── save_recording()          # EXISTING: Save WebM/MP4
└── import_file()             # EXISTING: File import
```

### Import Architecture
```
Frontend (React)
├── DragDropZone.tsx          # Drag-and-drop overlay
├── MediaLibrary.tsx           # Sidebar library panel
└── ThumbnailGenerator.tsx     # Thumbnail creation

Backend (Rust/Tauri)
├── import_file()              # EXISTING: Copy to clips/
├── generate_thumbnail()       # NEW: FFmpeg thumbnail
└── list_clips()               # EXISTING: Directory scan
```

### Data Flow
1. **Recording**: UI → Tauri command → FFmpeg capture → Save to clips/ → Add to store
2. **Import**: Drag/file picker → Validate → Copy to clips/ → Generate metadata → Add to store
3. **Library**: Scan clips/ → Generate thumbnails → Display in sidebar → Drag to timeline

---

## Implementation Plan

### Phase 1: Screen Recording (4-6 hours)
1. Implement `record_screen_clip` Rust command
2. Add screen selection UI
3. Integrate with timeline auto-add
4. Test on target platforms

### Phase 2: Webcam UI Integration (2-3 hours)
1. Enhance RecordButton with preview controls
2. Add live camera preview
3. Implement start/stop with auto-save
4. Handle permissions and errors

### Phase 3: Drag-and-Drop Import (2-3 hours)
1. Add drop zone component
2. Integrate with import_file command
3. Handle multiple files
4. Add visual feedback

### Phase 4: Media Library (3-4 hours)
1. Create library sidebar component
2. Implement thumbnail generation
3. Add drag-to-timeline functionality
4. Include metadata display

### Phase 5: Audio & PiP (3-4 hours)
1. Add microphone capture to recording
2. Implement PiP compositing
3. Test audio synchronization
4. Add overlay controls

---

## Success Criteria

- [ ] Screen recording captures full screen or selected window
- [ ] Webcam recording integrates with UI and auto-saves to timeline
- [ ] Drag-and-drop imports multiple video files
- [ ] Media library shows thumbnails and metadata
- [ ] Audio capture works with microphone
- [ ] PiP mode available for screen + webcam
- [ ] All features work in packaged app

---

## Risks & Mitigations

### Risk: Platform-Specific Recording
**Impact**: Screen recording works on one platform but not others
**Mitigation**: Test on both Mac and Windows, have fallback options

### Risk: Camera/Microphone Permissions
**Impact**: Recording fails due to permission issues
**Mitigation**: Clear error messages, permission request handling

### Risk: Performance During Recording
**Impact**: High CPU usage or dropped frames
**Mitigation**: Optimize FFmpeg settings, add quality options

### Risk: Audio Sync Issues
**Impact**: Audio and video out of sync
**Mitigation**: Test thoroughly, use FFmpeg sync options

---

## Dependencies

- FFmpeg with screen capture support (avfoundation/dshow)
- Tauri platform APIs for native screen access
- Web APIs for camera/microphone access
- File system permissions for saving recordings

---

**End of PRD** - Recording & Import Enhancements</content>
</xai:function_call