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