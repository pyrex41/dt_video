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
- **Error Handling**: Catch errors from each command and display user-friendly messages (e.g., "FFmpeg not installed" for `check_ffmpeg` failure). Parse stderr for specific FFmpeg errors (e.g., "Invalid input").
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
- **FFmpeg Error Handling**: Parse stderr for specific errors (e.g., "Invalid input" via regex) to display user-friendly alerts. Check FFmpeg at app startup to guide users to install if missing.
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