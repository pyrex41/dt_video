# Tauri-Elm Integration Guide

## Overview

This document describes how the Elm frontend communicates with the Tauri Rust backend via ports and the `@tauri-apps/api` library. All backend integration points are clearly marked in `src/main.js` with comments showing both the current mock implementation and the future Tauri integration code.

## Port Architecture

```
Elm Application
    ↓ (Cmd via port)
JavaScript Bridge (main.js)
    ↓ (invoke)
Tauri Runtime
    ↓ (async command)
Rust Backend
    ↓ (return value)
Tauri Runtime
    ↓ (promise resolution)
JavaScript Bridge
    ↓ (Sub via port)
Elm Application
```

## Elm Ports Defined

### Outgoing Ports (Elm → JavaScript → Tauri)

| Port Name | Type | Purpose |
|-----------|------|---------|
| `requestImport` | `() -> Cmd msg` | Open file dialog and import video |
| `setVideoTime` | `Float -> Cmd msg` | Seek video to specific time |
| `playVideo` | `() -> Cmd msg` | Start video playback |
| `pauseVideo` | `() -> Cmd msg` | Pause video playback |
| `trimClip` | `Encode.Value -> Cmd msg` | Trim clip with FFmpeg |
| `exportVideo` | `Encode.Value -> Cmd msg` | Export clips to MP4 |
| `recordWebcam` | `Encode.Value -> Cmd msg` | Record from webcam |
| `recordScreen` | `() -> Cmd msg` | Record screen (browser API) |

### Incoming Ports (Tauri → JavaScript → Elm)

| Port Name | Type | Purpose |
|-----------|------|---------|
| `clipImported` | `(Encode.Value -> msg) -> Sub msg` | Receive imported clip data |
| `videoTimeUpdate` | `(Float -> msg) -> Sub msg` | Receive video time updates |
| `exportProgress` | `(Float -> msg) -> Sub msg` | Receive export progress (0-100) |
| `recordingComplete` | `(Encode.Value -> msg) -> Sub msg` | Receive completed recording clip |

## Tauri Backend Commands

Based on `prd-integration-reference.md`, the following commands should be implemented in Rust:

### 1. check_ffmpeg

**Purpose:** Verify FFmpeg is available and get version

**Rust Signature:**
```rust
#[tauri::command]
async fn check_ffmpeg() -> Result<String, String>
```

**JavaScript Integration:**
```javascript
const version = await invoke('check_ffmpeg')
// Returns: "ffmpeg version 6.0-static" or error
```

**Elm Integration:**
Not currently used in frontend, but can be added for startup validation.

---

### 2. import_file

**Purpose:** Copy video file to `clips/` directory and extract metadata using FFprobe

**Rust Signature:**
```rust
#[tauri::command]
async fn import_file(path: String, dest: String) -> Result<String, String>
```

**Returns:** JSON string with metadata
```json
{
  "duration": 60.5,
  "width": 1920,
  "height": 1080
}
```

**JavaScript Integration:**
```javascript
const metadataJson = await invoke('import_file', {
  path: '/path/to/video.mp4',
  dest: 'clips/video.mp4'
})
const metadata = JSON.parse(metadataJson)
```

**Elm Port Flow:**
1. User clicks "Import Video" button → `RequestImport` message
2. JavaScript opens file dialog (Tauri dialog plugin)
3. JavaScript calls `invoke('import_file', ...)`
4. JavaScript sends clip data via `clipImported` port
5. Elm receives data via `ClipImported` message

**Current Status:** ✅ UI implemented, using mock data. Ready for backend integration.

---

### 3. trim_clip

**Purpose:** Trim video clip using FFmpeg `-c copy` (fast, lossless)

**Rust Signature:**
```rust
#[tauri::command]
async fn trim_clip(
    input: String,
    output: String,
    start: f32,
    end: f32
) -> Result<(), String>
```

**JavaScript Integration:**
```javascript
await invoke('trim_clip', {
  input: 'clips/video.mp4',
  output: 'clips/trimmed_video.mp4',
  start: 5.0,
  end: 15.0
})
```

**Elm Port Flow:**
1. User drags trim handles or clicks "Trim Clip" → `TrimClip clipId` message
2. Elm sends trim data via `trimClip` port
3. JavaScript calls `invoke('trim_clip', ...)`
4. Alert shown on completion (can be replaced with Elm notification)

**Current Status:** ✅ UI implemented with visual trim handles and trim button. Mock implementation shows alert. Ready for backend.

---

### 4. export_video

**Purpose:** Export one or more clips to MP4 at specified resolution

**Rust Signature:**
```rust
#[tauri::command]
async fn export_video(
    inputs: Vec<String>,
    output: String,
    resolution: String  // e.g., "1280x720"
) -> Result<(), String>
```

**Progress Tracking:** Backend should emit Tauri events with FFmpeg progress.

**JavaScript Integration:**
```javascript
// Resolution mapping
const resolutionMap = {
  '720p': '1280x720',
  '1080p': '1920x1080'
}

await invoke('export_video', {
  inputs: ['clips/video1.mp4', 'clips/video2.mp4'],
  output: 'output.mp4',
  resolution: resolutionMap[exportData.resolution]
})

// TODO: Listen to Tauri events for progress updates
// const unlisten = await listen('export-progress', (event) => {
//   app.ports.exportProgress.send(event.payload.percentage)
// })
```

**Elm Port Flow:**
1. User clicks "Export MP4" button → `ExportVideo` message
2. Elm sends export data via `exportVideo` port
3. JavaScript calls `invoke('export_video', ...)`
4. Progress updates sent via `exportProgress` port (currently simulated)
5. Elm updates progress bar via `ExportProgress` messages

**Current Status:** ✅ UI implemented with progress bar. Simulated progress (10% every 500ms). Ready for backend + event streaming.

---

### 5. record_webcam_clip

**Purpose:** Capture webcam video using nokhwa library

**Rust Signature:**
```rust
#[tauri::command]
async fn record_webcam_clip(
    output: String,
    duration: u32
) -> Result<String, String>
```

**Returns:** Output path of recorded MP4

**JavaScript Integration:**
```javascript
const outputPath = await invoke('record_webcam_clip', {
  output: 'webcam_1234.mp4',
  duration: 10  // seconds
})

// Then get metadata
const metadataJson = await invoke('import_file', {
  path: outputPath,
  dest: outputPath
})
```

**Elm Port Flow:**
1. User clicks "Record Webcam" → `RecordWebcam` message
2. Elm sends record request via `recordWebcam` port
3. JavaScript calls `invoke('record_webcam_clip', ...)`
4. On completion, get metadata and send via `recordingComplete` port
5. Elm adds clip to timeline via `RecordingComplete` message

**Current Status:** ✅ UI implemented. Simulates 10s recording with 2s delay. Ready for backend (nokhwa).

---

### 6. save_recording

**Purpose:** Save screen recording blob from browser MediaRecorder API

**Rust Signature:**
```rust
#[tauri::command]
async fn save_recording(
    path: String,
    data: Vec<u8>
) -> Result<(), String>
```

**JavaScript Integration:**
```javascript
// After MediaRecorder finishes
const blob = new Blob(chunks, { type: 'video/webm' })
const arrayBuffer = await blob.arrayBuffer()
const data = Array.from(new Uint8Array(arrayBuffer))

await invoke('save_recording', {
  path: 'clips/screen_recording.webm',
  data: data
})
```

**Elm Port Flow:**
1. User clicks "Record Screen" → `RecordScreen` message
2. JavaScript uses browser `getDisplayMedia` + `MediaRecorder`
3. On completion, save via `invoke('save_recording', ...)`
4. Get metadata and send via `recordingComplete` port
5. Elm adds clip to timeline

**Current Status:** ✅ UI implemented. Mock simulation only. Full browser MediaRecorder code ready in comments.

---

## Data Structures

### Clip (Elm Type)
```elm
type alias Clip =
    { id : String
    , path : String
    , fileName : String
    , duration : Float
    , width : Int
    , height : Int
    , startTime : Float   -- Position on timeline
    , trimStart : Float   -- Trim in-point
    , trimEnd : Float     -- Trim out-point
    }
```

### Clip (JavaScript/JSON)
```javascript
{
  id: "1234567890",
  path: "clips/video.mp4",
  fileName: "video.mp4",
  duration: 60.0,
  width: 1920,
  height: 1080
  // startTime, trimStart, trimEnd added by Elm
}
```

## Integration Checklist

### Phase 1: Basic Import & Metadata
- [ ] Implement `check_ffmpeg` in Rust
- [ ] Implement `import_file` in Rust
- [ ] Uncomment Tauri integration code in `requestImport` handler
- [ ] Test import flow end-to-end
- [ ] Verify real video metadata displays correctly

### Phase 2: Trim Functionality
- [ ] Implement `trim_clip` in Rust
- [ ] Uncomment Tauri integration code in `trimClip` handler
- [ ] Test trim with various start/end times
- [ ] Verify trimmed output quality (should use `-c copy`)

### Phase 3: Export with Progress
- [ ] Implement `export_video` in Rust
- [ ] Add FFmpeg progress parsing (`-progress pipe:1`)
- [ ] Implement Tauri event emitter for progress
- [ ] Add Tauri event listener in JavaScript
- [ ] Uncomment export integration code
- [ ] Test progress bar updates in real-time

### Phase 4: Recording Features
- [ ] Implement `record_webcam_clip` with nokhwa
- [ ] Test webcam recording on macOS/Windows
- [ ] Uncomment webcam integration code
- [ ] Implement `save_recording` for WebM blobs
- [ ] Uncomment screen recording browser API code
- [ ] Test screen recording flow

### Phase 5: Error Handling
- [ ] Add user-friendly error messages for all commands
- [ ] Handle FFmpeg not installed scenario
- [ ] Handle webcam permission denied
- [ ] Handle invalid file formats
- [ ] Test error paths thoroughly

## Testing Strategy

### Unit Testing (per command)
```bash
# Use tauri CLI to test individual commands
tauri invoke check_ffmpeg
tauri invoke import_file --args '{"path": "test.mp4", "dest": "clips/test.mp4"}'
```

### Integration Testing
1. **Import → Timeline:** Import video, verify it appears on timeline
2. **Trim → Preview:** Trim clip, verify handles update
3. **Export → File:** Export clip, verify output file exists and plays
4. **Record → Timeline:** Record webcam, verify clip added
5. **Screen → Save:** Record screen, verify WebM saved

### Cross-Platform Testing
- **macOS:** Test all features, especially webcam permissions
- **Windows:** Test all features with DirectShow webcam backend
- **Linux:** Test screen recording (WebM only, no native capture)

## Performance Targets

| Feature | Target | Notes |
|---------|--------|-------|
| Import metadata | <1s | FFprobe should be fast |
| Trim 1-minute clip | <5s | Using `-c copy` (no re-encode) |
| Export 1-minute clip (720p) | <30s | Depends on codec/hardware |
| Webcam recording | 30fps @ 1280x720 | nokhwa spec |
| Timeline with 10+ clips | 30fps rendering | Already optimized with canvas |

## Known Limitations

1. **No drag-and-drop:** File import uses dialog only (can add drag-and-drop later)
2. **Single clip export:** Currently exports first clip only (multi-clip concatenation pending)
3. **Hardcoded durations:** Webcam recording fixed at 10s (no UI control)
4. **No recording preview:** No live preview during recording
5. **WebM for screen:** Screen recordings save as WebM (convertible to MP4 if needed)

## Next Steps

1. Implement Rust backend commands following `prd-integration-reference.md`
2. Test each command individually with Tauri CLI
3. Uncomment integration code in `main.js` (clearly marked)
4. Test full flow end-to-end
5. Add error handling and user notifications
6. Optimize FFmpeg progress parsing
7. Add recording duration controls

---

**File Locations:**
- Elm ports: `src/Main.elm` (lines 247-333)
- JavaScript bridge: `src/main.js` (all port handlers)
- Integration reference: `.taskmaster/docs/prd-integration-reference.md`

**Last Updated:** 2025-10-27
