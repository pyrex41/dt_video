Below are the streamlined Product Requirements Documents (PRDs) for the Rust backend and React frontend of ClipForge, a desktop video editor built with Tauri, along with a clear frontend-backend integration document. These documents are optimized for efficiency, focusing on a trim-only editor for the MVP (video import, single-track Konva.js timeline, trim, MP4 export) and adding webcam capture (via the `nokhwa` crate, as specified), screen recording, and multi-track features for the final submission. The plan incorporates the critique’s insights: using the mature `nokhwa` crate (129,000+ downloads, 3+ years stable) instead of the untested `crabcamera`, leveraging `tauri-plugin-shell` for FFmpeg sidecar, and using browser-based `getDisplayMedia` as a fallback for screen recording. The Elm frontend is excluded to maximize velocity, and React with `react-konva` and Zustand is prioritized for rapid development. The integration section ensures seamless communication via Tauri commands, shareable with the frontend team. Timelines are ignored as requested, focusing on a ruthlessly efficient workflow to deliver a working end-to-end video editor.

---

## Rust Backend PRD

### Objective
Deliver a lightweight, cross-platform Tauri backend for ClipForge, handling video import, webcam capture (via `nokhwa`), screen recording storage, and video processing (FFmpeg sidecar via `tauri-plugin-shell`). Expose async commands for React frontend integration, ensuring a trim-only editor MVP and full features (recording, multi-clip export) for the final submission.

### Scope
- **MVP**: Import MP4/MOV files, trim clips, export single clip to MP4, package as native app (`.dmg`, `.exe`).
- **Final Submission**: Add webcam capture (`nokhwa`), screen recording save (from frontend blobs), multi-clip export with progress tracking.
- **Out of Scope**: Multi-track compositing, real-time effects, transitions, cloud uploads, undo/redo, audio waveforms, color grading, keyframe animations.

### Requirements
#### MVP
1. **Tauri Setup**:
   - Cross-platform app supporting macOS and Windows.
   - Bundle size <200MB (including FFmpeg binaries).
   - macOS camera permissions (`NSCameraUsageDescription`).
   - Launch time <5 seconds.
2. **File Import**:
   - Copy MP4/MOV files to a local `clips/` directory.
   - Extract metadata (duration, resolution) using `ffprobe`.
3. **Video Trimming**:
   - Trim clips using FFmpeg (`-c copy` for speed).
   - Input: file path, start/end times (seconds); output: trimmed MP4.
4. **Video Export**:
   - Export single clip to MP4 (720p) using FFmpeg sidecar.
   - Emit progress events via stderr parsing (`-progress pipe:1`).
5. **Packaging**:
   - Build native `.dmg` (macOS) and `.exe` (Windows) with `cargo tauri build`.
   - Bundle FFmpeg static binaries in `src-tauri/binaries/`.

#### Final Submission
1. **Webcam Capture**:
   - Capture 10–30s video clips (1280x720, 30fps, MJPG) using `nokhwa`.
   - Save as MP4 via FFmpeg sidecar.
2. **Screen Recording Save**:
   - Store WebM blobs from frontend `getDisplayMedia` to `clips/`.
   - Optional: Convert to MP4 via FFmpeg.
3. **Multi-Clip Export**:
   - Concatenate multiple clips using FFmpeg’s `concat` demuxer.
   - Support 720p and 1080p output resolutions.
   - Provide progress updates (percentage, time remaining).
4. **Performance**:
   - No crashes during export.
   - Reasonable file sizes (e.g., 10MB/min at 720p).
   - No memory leaks in 15-minute editing sessions.
5. **Error Handling**:
   - Check FFmpeg availability at startup.
   - Provide user-friendly error messages (e.g., “Missing input file” instead of raw FFmpeg stderr).

### Technical Stack
- **Tauri**: v1.7, with `tauri-plugin-shell` for FFmpeg sidecar.
- **nokhwa**: v0.10.4 for cross-platform webcam capture (https://crates.io/crates/nokhwa).
- **FFmpeg**: Static binaries (80–100MB per platform) for video processing.
- **Rust**: Stable channel, with `tokio` for async operations.
- **Dependencies**:
  ```toml
  [dependencies]
  tauri = { version = "1.7", features = ["api-all"] }
  tauri-plugin-shell = "1.7"
  nokhwa = { version = "0.10.4", features = ["input-v4l", "input-avfoundation", "input-dshow"] }
  serde = { version = "1.0", features = ["derive"] }
  serde_json = "1.0"
  tokio = { version = "1.38", features = ["rt", "process"] }
  ```

### Implementation Details
- **Setup**:
  - Scaffold Tauri project: `cargo create-tauri-app clipforge --frontend react`.
  - Download FFmpeg static binaries (e.g., from [ffmpeg.org](https://ffmpeg.org/download.html)) for macOS (aarch64), Windows (x86_64), and place in `src-tauri/binaries/` (e.g., `ffmpeg-x86_64-pc-windows-msvc.exe`, `ffmpeg-aarch64-apple-darwin`).
  - Configure `tauri.conf.json`:
    ```json
    {
      "tauri": {
        "allowlist": {
          "fs": { "all": true },
          "dialog": { "open": true },
          "shell": { "all": true, "sidecar": true }
        },
        "security": { "csp": "default-src 'self' blob: data: filesystem: tauri://localhost" },
        "macOS": { "entitlements": { "com.apple.security.device.camera": true } }
      },
      "package": { "productName": "ClipForge" },
      "build": {
        "externalBin": ["binaries/ffmpeg-$ARCH-$OS"]
      }
    }
    ```
- **Commands**:
  1. **Check FFmpeg Availability**:
     ```rust
     use tauri::plugin::shell::Command;

     #[tauri::command]
     async fn check_ffmpeg() -> Result<String, String> {
         let output = Command::new_sidecar("ffmpeg")
             .args(["-version"])
             .output()
             .await
             .map_err(|e| e.to_string())?;
         if output.status.success() {
             Ok(String::from_utf8_lossy(&output.stdout).to_string())
         } else {
             Err("FFmpeg not found. Install via: brew install ffmpeg (macOS) or download from ffmpeg.org (Windows)".to_string())
         }
     }
     ```
  2. **Import File**:
     ```rust
     #[tauri::command]
     async fn import_file(path: String, dest: String) -> Result<String, String> {
         let output = Command::new_sidecar("ffprobe")
             .args(["-v", "error", "-show_entries", "format=duration,stream=width,height", "-of", "json", &path])
             .output()
             .await
             .map_err(|e| e.to_string())?;
         if !output.status.success() {
             return Err(String::from_utf8_lossy(&output.stderr).to_string());
         }
         std::fs::create_dir_all("clips").map_err(|e| e.to_string())?;
         std::fs::copy(&path, &dest).map_err(|e| e.to_string())?;
         Ok(String::from_utf8_lossy(&output.stdout).to_string())
     }
     ```
  3. **Trim Clip**:
     ```rust
     #[tauri::command]
     async fn trim_clip(input: String, output: String, start: f32, end: f32) -> Result<(), String> {
         let output = Command::new_sidecar("ffmpeg")
             .args(["-i", &input, "-ss", &start.to_string(), "-to", &end.to_string(), "-c", "copy", &output])
             .output()
             .await
             .map_err(|e| e.to_string())?;
         if output.status.success() {
             Ok(())
         } else {
             Err(String::from_utf8_lossy(&output.stderr).to_string())
         }
     }
     ```
  4. **Export Video**:
     ```rust
     #[tauri::command]
     async fn export_video(inputs: Vec<String>, output: String, resolution: String, app_handle: tauri::AppHandle) -> Result<(), String> {
         let concat_file = inputs.iter().map(|i| format!("file '{}'", i)).collect::<Vec<_>>().join("\n");
         std::fs::write("concat.txt", concat_file).map_err(|e| e.to_string())?;
         let mut cmd = Command::new_sidecar("ffmpeg")
             .args(["-f", "concat", "-safe", "0", "-i", "concat.txt", "-c:v", "libx264", "-s", &resolution, "-progress", "pipe:1", &output]);
         let child = cmd.spawn().map_err(|e| e.to_string())?;
         let output = child.output().await.map_err(|e| e.to_string())?;
         if output.status.success() {
             Ok(())
         } else {
             Err(String::from_utf8_lossy(&output.stderr).to_string())
         }
     }
     ```
  5. **Webcam Capture (nokhwa)**:
     ```rust
     use nokhwa::{Camera, NokhwaError, pixel_format::RgbAFormat, utils::{CameraIndex, RequestedFormatType}};
     use tokio::process::Command as TokioCommand;

     #[tauri::command]
     async fn record_webcam_clip(output: String, duration: u32) -> Result<String, String> {
         let index = CameraIndex::Index(0);
         let format = RequestedFormatType::Exact(RgbAFormat::new(1280, 720, 30));
         let mut camera = Camera::new(index, format).map_err(|e: NokhwaError| e.to_string())?;
         camera.open_stream().map_err(|e| e.to_string())?;

         let mut cmd = TokioCommand::new("ffmpeg");
         cmd.args(["-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "1280x720", "-framerate", "30", "-i", "pipe:0", &output]);
         let mut child = cmd.stdin(std::process::Stdio::piped()).spawn().map_err(|e| e.to_string())?;
         let stdin = child.stdin.as_mut().ok_or("Failed to open FFmpeg stdin")?;

         let start = std::time::Instant::now();
         while start.elapsed().as_secs() < duration as u64 {
             let frame = camera.frame().map_err(|e| e.to_string())?;
             let buffer = frame.buffer();
             tokio::io::AsyncWriteExt::write_all(stdin, buffer).await.map_err(|e| e.to_string())?;
         }
         camera.stop_stream().map_err(|e| e.to_string())?;
         child.wait().await.map_err(|e| e.to_string())?;
         Ok(output)
     }
     ```
  6. **Save Recording**:
     ```rust
     #[tauri::command]
     async fn save_recording(path: String, data: Vec<u8>) -> Result<(), String> {
         std::fs::write(&path, data).map_err(|e| e.to_string())?;
         Ok(())
     }
     ```
- **Main Setup**:
  ```rust
  fn main() {
      tauri::Builder::default()
          .plugin(tauri_plugin_shell::init())
          .invoke_handler(tauri::generate_handler![
              check_ffmpeg,
              import_file,
              trim_clip,
              export_video,
              record_webcam_clip,
              save_recording
          ])
          .run(tauri::generate_context!())
          .expect("Error running Tauri app");
  }
  ```

### Deliverables
- GitHub repository with Rust backend in `src-tauri/`.
- `README.md`:
  ```markdown
  # ClipForge Backend
  ## Setup
  1. Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
  2. Install Tauri CLI: `cargo install tauri-cli`
  3. Install FFmpeg: `brew install ffmpeg` (macOS) or download from ffmpeg.org (Windows)
  4. Clone repo: `git clone <repo-url>`
  5. Place FFmpeg binaries in `src-tauri/binaries/` (e.g., ffmpeg-x86_64-pc-windows-msvc.exe)
  6. Build: `cargo tauri build`
  ```
- Packaged `.dmg` and `.exe` with FFmpeg binaries.

---

## React Frontend PRD

### Objective
Build a fast, responsive React frontend for ClipForge, using `react-konva` for a canvas-based timeline, `Zustand` for state management, and `Plyr` for video preview. Integrate with the Tauri Rust backend to deliver a trim-only editor MVP and add recording and multi-track features for the final submission.

### Scope
- **MVP**: Video import (drag-and-drop/file picker), single-track Konva.js timeline (draggable clips, playhead), trim functionality, MP4 export, basic UI with `shadcn/ui`.
- **Final Submission**: Webcam capture (`nokhwa` via backend), screen recording (`getDisplayMedia`), two-track timeline, clip splitting, zoom, snap-to-grid.
- **Out of Scope**: Real-time effects, transitions, text overlays, audio waveforms, undo/redo.

### Requirements
#### MVP
1. **App UI**:
   - Basic layout with import button, timeline, and preview pane.
   - Responsive design (800x600 minimum) using `shadcn/ui`.
2. **Video Import**:
   - Support drag-and-drop and file picker for MP4/MOV.
   - Display clip metadata (duration, resolution).
3. **Timeline**:
   - Konva.js canvas with draggable `Rect` for clips, `Line` for playhead.
   - Single track, basic drag (no snap-to-grid).
   - Virtualized rendering (only visible clips).
4. **Preview**:
   - Plyr player for video playback, synced with timeline playhead.
   - Play/pause controls, scrubbing via playhead drag.
5. **Trim**:
   - Drag handles (`Rect`) on clips for in/out points.
   - Invoke backend `trim_clip` command.
6. **Export**:
   - Export single clip to MP4 (720p) via `export_video` command.
   - Show progress bar using backend stderr events.

#### Final Submission
1. **Recording**:
   - Webcam capture button invoking `record_webcam_clip`.
   - Screen recording via `getDisplayMedia`, saved via `save_recording`.
   - Add recordings to timeline.
2. **Timeline Enhancements**:
   - Two tracks (main + picture-in-picture).
   - Split clips at playhead position.
   - Zoom in/out (stage scaling).
   - Snap-to-grid for clip drags.
3. **Performance**:
   - 30fps timeline with 10+ clips.
   - No memory leaks in 15-minute sessions.
   - Responsive UI during export.

### Technical Stack
- **React**: v18 for component-based UI.
- **react-konva**: v18 for canvas-based timeline.
- **Zustand**: v4 for lightweight state management.
- **Plyr**: v3 for video preview (15KB, keyboard shortcuts).
- **shadcn/ui**: For UI components (buttons, dialogs).
- **@tauri-apps/api**: v1.7 for backend commands.
- **V0.dev**: Generate initial timeline component.

### Implementation Details
- **Setup**:
  ```bash
  cd clipforge/src-tauri/frontend
  npm install react-konva konva zustand plyr @tauri-apps/api
  npx create-tauri-ui --template shadcn
  ```
- **State Management (Zustand)**:
  ```jsx
  import { create } from 'zustand';

  const useClipStore = create((set) => ({
    clips: [],
    addClip: (clip) => set((state) => ({ clips: [...state.clips, clip] })),
    updateClip: (id, updates) => set((state) => ({
      clips: state.clips.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
    playhead: 0,
    setPlayhead: (time) => set({ playhead: time }),
  }));
  ```
- **Import UI**:
  ```jsx
  import { open } from '@tauri-apps/api/dialog';
  import { invoke } from '@tauri-apps/api/tauri';
  import { useClipStore } from './store';

  const ImportButton = () => {
    const addClip = useClipStore((state) => state.addClip);
    const handleImport = async () => {
      const file = await open({ filters: [{ name: 'Video', extensions: ['mp4', 'mov'] }] });
      if (file) {
        const metadata = await invoke('import_file', { path: file, dest: `clips/${file.split('/').pop()}` });
        addClip({ id: Date.now(), path: file, ...JSON.parse(metadata) });
      }
    };
    return <button onClick={handleImport}>Import Video</button>;
  };
  ```
- **Timeline**:
  ```jsx
  import { Stage, Layer, Rect, Line } from 'react-konva';
  import { useClipStore } from './store';

  const Timeline = () => {
    const { clips, updateClip, playhead, setPlayhead } = useClipStore();
    return (
      <Stage width={800} height={200}>
        <Layer>
          {clips.map((clip) => (
            <Rect
              key={clip.id}
              x={clip.start * 10}
              y={50}
              width={(clip.end - clip.start) * 10}
              height={40}
              fill="blue"
              draggable
              onDragEnd={(e) => updateClip(clip.id, { start: e.target.x() / 10, end: e.target.x() / 10 + (clip.end - clip.start) })}
            />
          ))}
          <Line points={[playhead * 10, 0, playhead * 10, 200]} stroke="red" strokeWidth={2} />
        </Layer>
      </Stage>
    );
  };
  ```
- **Preview**:
  ```jsx
  import Plyr from 'plyr';
  import { useEffect, useRef } from 'react';
  import { useClipStore } from './store';

  const Preview = () => {
    const { clips, playhead } = useClipStore();
    const videoRef = useRef(null);
    useEffect(() => {
      const player = new Plyr(videoRef.current);
      player.currentTime = playhead;
      return () => player.destroy();
    }, [playhead]);
    return <video ref={videoRef} src={clips[0]?.path} controls />;
  };
  ```
- **Trim**:
  ```jsx
  const TrimHandle = ({ clip }) => {
    const updateClip = useClipStore((state) => state.updateClip);
    return (
      <>
        <Rect
          x={clip.start * 10}
          y={50}
          width={10}
          height={40}
          fill="green"
          draggable
          onDragEnd={(e) => {
            updateClip(clip.id, { start: e.target.x() / 10 });
            invoke('trim_clip', { input: clip.path, output: `clips/trimmed_${clip.id}.mp4`, start: e.target.x() / 10, end: clip.end });
          }}
        />
        <Rect
          x={clip.end * 10 - 10}
          y={50}
          width={10}
          height={40}
          fill="green"
          draggable
          onDragEnd={(e) => {
            updateClip(clip.id, { end: e.target.x() / 10 + 10 });
            invoke('trim_clip', { input: clip.path, output: `clips/trimmed_${clip.id}.mp4`, start: clip.start, end: e.target.x() / 10 + 10 });
          }}
        />
      </>
    );
  };
  ```
- **Export**:
  ```jsx
  const ExportButton = () => {
    const clips = useClipStore((state) => state.clips);
    const handleExport = async () => {
      await invoke('export_video', { inputs: clips.map(c => c.path), output: 'output.mp4', resolution: '1280x720' });
    };
    return <button onClick={handleExport}>Export</button>;
  };
  ```
- **Recording**:
  ```jsx
  import { invoke } from '@tauri-apps/api/tauri';
  import { useClipStore } from './store';

  const RecordButton = () => {
    const addClip = useClipStore((state) => state.addClip);
    const handleWebcam = async () => {
      const output = await invoke('record_webcam_clip', { output: 'clips/webcam.mp4', duration: 10 });
      addClip({ id: Date.now(), path: output, start: 0, end: 10 });
    };
    const handleScreen = async () => {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        await invoke('save_recording', { path: 'clips/screen.webm', data });
        addClip({ id: Date.now(), path: 'clips/screen.webm', start: 0, end: 10 });
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 10000);
    };
    return (
      <>
        <button onClick={handleWebcam}>Record Webcam</button>
        <button onClick={handleScreen}>Record Screen</button>
      </>
    );
  };
  ```

### Deliverables
- React frontend code in `src-tauri/frontend/`.
- Demo video showing import, timeline, trim, export, and recording.
- UI built with `shadcn/ui` components.

---

## Frontend-Backend Integration

### Overview
The React frontend communicates with the Rust backend via Tauri’s `invoke` API using the `@tauri-apps/api` library. The backend exposes five async commands to handle video import, webcam capture, screen recording save, trimming, and export. This section provides a clear contract for the frontend team, ensuring seamless integration.

### Tauri Commands
| Command                | Input Parameters                          | Output                     | Description                          |
|------------------------|-------------------------------------------|----------------------------|--------------------------------------|
| `check_ffmpeg`         | None                                      | `String` (FFmpeg version) or error | Verify FFmpeg availability.           |
| `import_file`          | `path: String`, `dest: String`            | `String` (metadata JSON)   | Copy video to `clips/` and return metadata. |
| `record_webcam_clip`   | `output: String`, `duration: u32`         | `String` (output path)     | Capture webcam video via `nokhwa`.   |
| `save_recording`       | `path: String`, `data: Vec<u8>`           | `()`                       | Save screen recording blob from frontend. |
| `trim_clip`            | `input: String`, `output: String`, `start: f32`, `end: f32` | `()`                       | Trim clip using FFmpeg.              |
| `export_video`         | `inputs: Vec<String>`, `output: String`, `resolution: String` | `()`                       | Export clips to MP4 via FFmpeg.      |

### React Integration
- **Setup**:
  ```bash
  npm install @tauri-apps/api
  ```
- **Example Invocations**:
  ```jsx
  import { invoke } from '@tauri-apps/api/tauri';
  import { open } from '@tauri-apps/api/dialog';

  // Check FFmpeg
  const checkFFmpeg = async () => {
    try {
      const version = await invoke('check_ffmpeg');
      console.log(`FFmpeg version: ${version}`);
    } catch (error) {
      alert(error); // Show user-friendly error
    }
  };

  // Import
  const handleImport = async () => {
    const file = await open({ filters: [{ name: 'Video', extensions: ['mp4', 'mov'] }] });
    if (file) {
      const metadata = await invoke('import_file', { path: file, dest: `clips/${file.split('/').pop()}` });
      return JSON.parse(metadata); // Add to state
    }
  };

  // Webcam
  const handleWebcam = async () => {
    const output = await invoke('record_webcam_clip', { output: 'clips/webcam.mp4', duration: 10 });
    return output; // Add to timeline
  };

  // Screen
  const handleScreen = async () => {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      await invoke('save_recording', { path: 'clips/screen.webm', data });
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 10000);
  };

  // Trim
  const handleTrim = async (clip) => {
    await invoke('trim_clip', { input: clip.path, output: `clips/trimmed_${clip.id}.mp4`, start: clip.start, end: clip.end });
  };

  // Export
  const handleExport = async (clips) => {
    await invoke('export_video', { inputs: clips.map(c => c.path), output: 'output.mp4', resolution: '1280x720' });
  };
  ```

### Integration Notes
- **Error Handling**: Catch errors from each command and display user-friendly messages (e.g., “FFmpeg not installed” for `check_ffmpeg` failure). Parse stderr for specific FFmpeg errors (e.g., “Invalid input”).
- **File Paths**: Use relative paths (`clips/`) for consistency. Ensure frontend sends unique filenames to avoid overwrites.
- **Progress Tracking**: For `export_video`, parse FFmpeg’s `-progress pipe:1` stderr output (e.g., `out_time_ms=5000000`) to calculate percentage complete. Emit via Tauri events if needed.
- **Testing**: Test commands independently with `tauri invoke` (e.g., `tauri invoke import_file --args '{"path": "test.mp4", "dest": "clips/test.mp4"}'`). Verify webcam on macOS/Windows with `nokhwa` to ensure device detection.
- **Performance**: Commands are async to avoid UI blocking. For large blobs in `save_recording`, ensure clips are <100MB to avoid Tauri’s invoke limit; alternatively, use browser `download` API to save locally and pass path to `import_file`.

---

### Comprehensive Details Supporting the PRDs

This section provides additional context and reasoning behind the PRDs, drawing on the critique, `nokhwa` documentation (https://crates.io/crates/nokhwa), and prior discussions to ensure efficiency and reliability.

#### Why This Approach?
- **Backend Efficiency**:
  - **nokhwa**: Chosen over `crabcamera` due to its maturity (129,000+ downloads, stable since 2022) and cross-platform support (Windows: DirectShow, macOS: AVFoundation, Linux: V4L2). It provides reliable webcam capture with minimal setup, supporting MJPG at 1280x720, 30fps, ideal for ClipForge’s recording needs. Documentation confirms simple frame piping to FFmpeg, reducing complexity compared to `scap` or `CrabGrab`.
  - **tauri-plugin-shell**: The FFmpeg sidecar approach avoids Rust compilation of FFmpeg libraries, saving 8–16 hours. Static binaries ensure cross-platform compatibility, and stderr parsing (`-progress pipe:1`) provides real-time progress without complex Rust bindings.
  - **Async Commands**: Using `tokio` ensures non-blocking video processing, critical for UI responsiveness during long exports.
- **Frontend Efficiency**:
  - **React + react-konva**: `react-konva` is lightweight (~30KB) and optimized for simple timelines (draggable rectangles, playhead). V0.dev generates components quickly, and `Zustand` simplifies state management for clip arrays.
  - **Plyr**: At 15KB, it’s lighter than Video.js and supports keyboard shortcuts, aligning with MVP needs.
  - **Browser Fallback**: `getDisplayMedia` for screen recording leverages mature browser APIs, reducing Rust backend work. It’s cross-platform (except Linux WebKitGTK quirks) and implements in 1–2 hours vs. 8–12 for native `scap`.
- **Integration Simplicity**: Tauri’s `invoke` API is well-documented, and the command structure (input/output types) ensures a clear contract. Web fallback for recording minimizes backend complexity while maintaining functionality.

#### Addressing Critique Points
- **nokhwa vs. crabcamera**: `nokhwa`’s proven track record eliminates risks of `crabcamera`’s untested status (published October 27, 2025). Its API (`Camera::new`, `frame.buffer`) is straightforward for piping to FFmpeg, and features like `input-v4l` ensure Linux support.
- **FFmpeg Sidecar**: Using `tauri-plugin-shell` avoids the complexity of `ffmpeg-next` or `ffmpeg-sidecar` crates, which require deep Rust integration. Static binaries add 80–100MB per platform but are reliable and fast to set up.
- **Browser Recording**: `getDisplayMedia` + `MediaRecorder` is a low-risk fallback for screen capture, avoiding native Rust implementation (e.g., `scap`). It supports WebM output, convertible to MP4 via FFmpeg if needed. Performance trade-offs (e.g., 50–200ms latency, FPS jitter) are acceptable for short clips (10–30s).
- **Timeline Performance**: `react-konva` with virtualized rendering (only visible clips) ensures 30fps with 10+ clips. `Zustand` prevents state bloat, and `React.memo` avoids unnecessary redraws.
- **Bundle Size**: FFmpeg binaries increase the bundle to 90–200MB, but this is 3x smaller than Electron (300–500MB). Direct downloads avoid App Store compliance, saving 16–20 hours.

#### Performance Targets
| Feature              | Target                     | Approach                     |
|----------------------|----------------------------|------------------------------|
| Timeline UI          | 30fps with 10+ clips       | `react-konva`, virtualized rendering |
| App Launch           | <5s                        | Tauri + React, minimal bundle |
| Export               | No crashes, 10MB/min (720p)| FFmpeg sidecar, `-c copy` for trim |
| Memory               | No leaks (15-min session)   | Zustand, async commands      |
| Webcam Capture       | 1280x720, 30fps, 10–30s    | `nokhwa`, FFmpeg piping      |

#### Implementation Notes
- **nokhwa Integration**: Use `RgbAFormat` for compatibility with FFmpeg’s `rawvideo` input. Test on macOS/Windows to ensure device detection (`CameraIndex::Index(0)`). Handle errors (e.g., no cameras) with clear messages.
- **FFmpeg Error Handling**: Parse stderr for specific errors (e.g., “Invalid input” via regex) to display user-friendly alerts. Check FFmpeg at app startup to guide users to install if missing.
- **Virtualized Timeline**: Calculate visible clips based on scroll/zoom (e.g., `clip.start < viewEnd && clip.end > viewStart`). Use Konva layers per track to optimize rendering.
- **Blob Handling**: For screen recordings, save WebM blobs via browser `download` API to avoid Tauri’s 100MB invoke limit, then use `import_file` to add to timeline.
- **Testing**: Verify each command with `tauri invoke` (e.g., `tauri invoke check_ffmpeg`). Test webcam capture on target hardware to catch platform-specific issues (e.g., macOS permissions).

---

### Final Answer
The Rust backend PRD uses Tauri with `nokhwa` for webcam capture, `tauri-plugin-shell` for FFmpeg sidecar, and async commands for import, trim, export, and recording save. The React frontend PRD leverages `react-konva` for a single-track timeline, `Zustand` for state, and `Plyr` for preview, with `getDisplayMedia` as a screen recording fallback. The integration document defines five Tauri commands (`check_ffmpeg`, `import_file`, `record_webcam_clip`, `save_recording`, `trim_clip`, `export_video`) with clear inputs/outputs, ensuring seamless communication. This plan delivers a trim-only MVP and adds recording/multi-track features, optimized for efficiency with `nokhwa`’s reliability and FFmpeg’s simplicity.

**Key Citations**:
- [nokhwa on crates.io](https://crates.io/crates/nokhwa)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [tauri-plugin-shell Documentation](https://tauri.app/v1/api/rust/tauri_plugin_shell)
- [React-Konva Documentation](https://github.com/konvajs/react-konva)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Plyr Documentation](https://github.com/sampotts/plyr)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Tauri React Template](https://tauri.app/v1/guides/getting-started/setup/react/)
