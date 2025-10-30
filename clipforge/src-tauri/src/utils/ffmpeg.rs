use std::path::Path;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader as AsyncBufReader};
use tauri::{Manager, Emitter};



impl std::fmt::Display for FFmpegError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FFmpegError::CommandSpawn(msg) => write!(f, "Failed to spawn FFmpeg: {}", msg),
            FFmpegError::ExecutionFailed(msg) => write!(f, "FFmpeg execution failed: {}", msg),
            FFmpegError::OutputValidation(msg) => write!(f, "Output validation failed: {}", msg),
            FFmpegError::InvalidPath(msg) => write!(f, "Invalid path: {}", msg),
        }
    }
}

/// Error types for FFmpeg operations
#[derive(Debug)]
pub enum FFmpegError {
    CommandSpawn(String),
    ExecutionFailed(String),
    OutputValidation(String),
    InvalidPath(String),
}

impl std::error::Error for FFmpegError {}

/// Result type for FFmpeg operations
pub type FFmpegResult<T> = Result<T, FFmpegError>;

/// Builder for constructing FFmpeg commands with fluent API
#[derive(Default)]
pub struct FfmpegBuilder {
    input: Option<String>,
    output: Option<String>,
    trim_start: Option<f64>,
    trim_duration: Option<f64>,
    scale_width: Option<u32>,
    scale_height: Option<u32>,
    crop_width: Option<u32>,
    crop_height: Option<u32>,
    crop_x: Option<u32>,
    crop_y: Option<u32>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    preset: Option<String>,
    crf: Option<u32>,
    audio_bitrate: Option<String>,
    progress_enabled: bool,
    thumbnail_time: Option<f64>,
    stream_copy: bool,
    raw_input: Option<RawInputConfig>,
    concat_list: Option<String>,
    pixel_format: Option<String>,
    app_handle: Option<tauri::AppHandle>,
    scale_pad: bool,  // Whether to pad to maintain aspect ratio
    volume: Option<f64>,  // Audio volume (0.0-1.0, where 1.0 is 100%)
    muted: bool,  // Whether audio should be muted
}

#[derive(Clone)]
pub struct RawInputConfig {
    pub pixel_format: String,
    pub video_size: String,
    pub framerate: u32,
}

impl FfmpegBuilder {
    /// Create a new FFmpeg builder
    pub fn new() -> Self {
        Self::default()
    }

    /// Set input file path
    pub fn input(mut self, path: &str) -> Self {
        self.input = Some(path.to_string());
        self
    }

    /// Set output file path
    pub fn output(mut self, path: &str) -> Self {
        self.output = Some(path.to_string());
        self
    }

    /// Set trim parameters (start time and duration)
    pub fn trim(mut self, start: f64, duration: f64) -> Self {
        self.trim_start = Some(start);
        self.trim_duration = Some(duration);
        self
    }

    /// Set scaling parameters
    pub fn scale(mut self, width: u32, height: Option<u32>) -> Self {
        self.scale_width = Some(width);
        self.scale_height = height;
        self
    }

    /// Scale with padding to maintain aspect ratio (adds black bars)
    pub fn scale_with_pad(mut self, width: u32, height: u32) -> Self {
        self.scale_width = Some(width);
        self.scale_height = Some(height);
        self.scale_pad = true;
        self
    }

    /// Scale and crop to fill target dimensions (zoom in, no black bars)
    /// This maintains aspect ratio by cropping excess content from center
    pub fn scale_crop(mut self, width: u32, height: u32) -> Self {
        // We'll use special negative values to signal scale+crop mode
        // The actual filter will be built in build_args
        self.scale_width = Some(width);
        self.scale_height = Some(height);
        self.scale_pad = false;
        // Set crop to same dimensions to trigger crop filter
        self.crop_width = Some(width);
        self.crop_height = Some(height);
        // Leave x,y as None for center crop
        self.crop_x = None;
        self.crop_y = None;
        self
    }

    /// Set even dimensions scaling (for MP4 compatibility)
    pub fn scale_even(mut self) -> Self {
        self.scale_width = Some(0); // Special marker for even scaling
        self.scale_height = None;
        self
    }

    /// Set cropping parameters (width, height, x offset, y offset)
    /// If x and y are None, crop will be centered
    pub fn crop(mut self, width: u32, height: u32, x: Option<u32>, y: Option<u32>) -> Self {
        self.crop_width = Some(width);
        self.crop_height = Some(height);
        self.crop_x = x;
        self.crop_y = y;
        self
    }

    /// Set encoding parameters (libx264 + aac defaults)
    pub fn encode(mut self) -> Self {
        self.video_codec = Some("libx264".to_string());
        self.audio_codec = Some("aac".to_string());
        self.preset = Some("medium".to_string());
        self.crf = Some(23);
        self.audio_bitrate = Some("128k".to_string());
        self
    }

    /// Override preset
    pub fn preset(mut self, preset: &str) -> Self {
        self.preset = Some(preset.to_string());
        self
    }

    /// Enable stream copy mode (fast, no re-encoding)
    pub fn stream_copy(mut self) -> Self {
        self.stream_copy = true;
        self
    }

    /// Set thumbnail extraction at specific time
    pub fn thumbnail(mut self, time: f64) -> Self {
        self.thumbnail_time = Some(time);
        self
    }

    /// Set raw video input configuration
    pub fn raw_input(mut self, config: RawInputConfig) -> Self {
        self.raw_input = Some(config);
        self
    }

    /// Set concat demuxer input
    pub fn concat(mut self, list_path: &str) -> Self {
        self.concat_list = Some(list_path.to_string());
        self
    }

    /// Enable progress reporting
    pub fn with_progress(mut self) -> Self {
        self.progress_enabled = true;
        self
    }

    /// Set output pixel format
    pub fn pixel_format(mut self, format: &str) -> Self {
        self.pixel_format = Some(format.to_string());
        self
    }

    /// Set app handle for sidecar binary resolution
    pub fn with_app_handle(mut self, handle: tauri::AppHandle) -> Self {
        self.app_handle = Some(handle);
        self
    }

    /// Set audio volume (0.0-1.0, where 1.0 is 100%)
    pub fn volume(mut self, vol: f64) -> Self {
        self.volume = Some(vol.max(0.0).min(1.0));
        self
    }

    /// Mute audio output
    pub fn mute(mut self) -> Self {
        self.muted = true;
        self
    }

    /// Build the argument vector
    pub fn build_args(&self) -> Vec<String> {
        let mut args: Vec<String> = Vec::new();

        // Handle concat demuxer (special case)
        if let Some(concat_path) = &self.concat_list {
            args.extend([
                "-f".to_string(), "concat".to_string(),
                "-safe".to_string(), "0".to_string(),
                "-i".to_string(), concat_path.clone(),
            ]);
            // For concat, skip seek, input, and filter processing but still do encoding
        } else {

        // Seek parameters (before input for efficiency)
        // Thumbnail takes precedence over trim for seek position
        if let Some(time) = self.thumbnail_time {
            args.extend(["-ss".to_string(), time.to_string()]);
        } else if let Some(start) = self.trim_start {
            args.extend(["-ss".to_string(), start.to_string()]);
        }
        if let Some(duration) = self.trim_duration {
            args.extend(["-t".to_string(), duration.to_string()]);
        }

        // Input file or raw input
        if let Some(raw) = &self.raw_input {
            args.extend([
                "-f".to_string(), "rawvideo".to_string(),
                "-pixel_format".to_string(), raw.pixel_format.clone(),
                "-video_size".to_string(), raw.video_size.clone(),
                "-framerate".to_string(), raw.framerate.to_string(),
                "-i".to_string(), self.input.as_ref().unwrap_or(&"pipe:0".to_string()).clone()
            ]);
        } else if let Some(input) = &self.input {
            args.extend(["-i".to_string(), input.clone()]);
        }

        // Video filters
        let mut filters = Vec::new();

        // Check if this is a scale+crop operation (for thumbnails)
        let is_scale_crop = self.scale_width.is_some()
            && self.scale_height.is_some()
            && self.crop_width == self.scale_width
            && self.crop_height == self.scale_height
            && self.crop_x.is_none()
            && self.crop_y.is_none()
            && !self.scale_pad;

        if is_scale_crop {
            // Scale+crop mode: scale to cover dimensions, then crop excess from center
            // This creates a "zoom in" effect without stretching
            let w = self.scale_width.unwrap();
            let h = self.scale_height.unwrap();
            // Use explicit center positioning for crop: (iw-width)/2, (ih-height)/2
            filters.push(format!(
                "scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}:(iw-{})/2:(ih-{})/2",
                w, h, w, h, w, h
            ));
        } else {
            // Normal mode: apply crop before scaling (if crop is set without matching scale)
            if let (Some(cw), Some(ch)) = (self.crop_width, self.crop_height) {
                // Only apply crop if it's not part of scale_crop
                if self.scale_width != Some(cw) || self.scale_height != Some(ch) {
                    let crop_str = if let (Some(x), Some(y)) = (self.crop_x, self.crop_y) {
                        format!("crop={}:{}:{}:{}", cw, ch, x, y)
                    } else {
                        // Center crop using FFmpeg expressions
                        format!("crop={}:{}:(iw-{})/2:(ih-{})/2", cw, ch, cw, ch)
                    };
                    filters.push(crop_str);
                }
            }

            // Apply scaling
            if let Some(w) = self.scale_width {
                if w == 0 {
                    // Special case: even dimensions scaling
                    filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2".to_string());
                } else if self.scale_pad {
                    // Scale with padding to maintain aspect ratio
                    if let Some(h) = self.scale_height {
                        // Use scale with force_original_aspect_ratio and pad
                        filters.push(format!(
                            "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
                            w, h, w, h
                        ));
                    } else {
                        // Fallback to regular scale if height not specified
                        filters.push(format!("scale={}:trunc(ih/2)*2", w));
                    }
                } else if !is_scale_crop {
                    // Regular scale (but not if we're in scale_crop mode)
                    let scale_str = if let Some(h) = self.scale_height {
                        format!("scale={}:{}", w, h)
                    } else {
                        format!("scale={}:trunc(ih/2)*2", w)
                    };
                    filters.push(scale_str);
                }
            }
        }

        if !filters.is_empty() {
            args.extend(["-vf".to_string(), filters.join(",")]);
        }
        } // Close the else block for concat handling

        // Audio filters (volume and mute)
        let mut audio_filters = Vec::new();

        if self.muted {
            // Mute audio completely
            audio_filters.push("volume=0".to_string());
        } else if let Some(vol) = self.volume {
            // Apply volume adjustment (convert 0.0-1.0 to FFmpeg volume scale)
            audio_filters.push(format!("volume={}", vol));
        }

        let has_audio_filters = !audio_filters.is_empty();

        if has_audio_filters {
            args.extend(["-af".to_string(), audio_filters.join(",")]);
        }

        // Encoding parameters (applied to both concat and regular input)
        if self.stream_copy {
            // If we have audio filters, we can't use stream_copy for audio
            // Instead, copy video stream only and encode audio
            if has_audio_filters {
                args.extend([
                    "-c:v".to_string(), "copy".to_string(),
                    "-c:a".to_string(), "aac".to_string(),
                    "-avoid_negative_ts".to_string(), "make_zero".to_string()
                ]);
            } else {
                args.extend(["-c".to_string(), "copy".to_string(), "-avoid_negative_ts".to_string(), "make_zero".to_string()]);
            }
        } else {
            if let Some(codec) = &self.video_codec {
                args.extend(["-c:v".to_string(), codec.clone()]);
            }
            if let Some(preset) = &self.preset {
                args.extend(["-preset".to_string(), preset.clone()]);
            }
            if let Some(crf) = self.crf {
                args.extend(["-crf".to_string(), crf.to_string()]);
            }
            if let Some(format) = &self.pixel_format {
                args.extend(["-pix_fmt".to_string(), format.clone()]);
            }
            if let Some(codec) = &self.audio_codec {
                args.extend(["-c:a".to_string(), codec.clone()]);
            }
            if let Some(bitrate) = &self.audio_bitrate {
                args.extend(["-b:a".to_string(), bitrate.clone()]);
            }
        }

        // Thumbnail-specific parameters
        if self.thumbnail_time.is_some() {
            args.extend(["-vframes".to_string(), "1".to_string()]);
        }

        // Progress and output
        if self.progress_enabled {
            args.extend(["-progress".to_string(), "pipe:2".to_string()]);
        }

        if let Some(output) = &self.output {
            args.extend(["-y".to_string(), output.clone()]);
        }

        args
    }

    /// Get platform-specific binary name with extension
    fn get_platform_binary_name(base_name: &str) -> String {
        #[cfg(target_os = "windows")]
        {
            format!("{}-x86_64-pc-windows-msvc.exe", base_name)
        }
        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            format!("{}-aarch64-apple-darwin", base_name)
        }
        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            format!("{}-x86_64-apple-darwin", base_name)
        }
        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            format!("{}-x86_64-unknown-linux-gnu", base_name)
        }
        #[cfg(not(any(
            target_os = "windows",
            all(target_os = "macos", any(target_arch = "aarch64", target_arch = "x86_64")),
            all(target_os = "linux", target_arch = "x86_64")
        )))]
        {
            base_name.to_string() // Fallback to base name
        }
    }

    /// Resolve FFmpeg/FFprobe sidecar binary path
    fn resolve_sidecar_binary(
        app_handle: &tauri::AppHandle,
        binary_name: &str,
    ) -> Result<std::path::PathBuf, String> {
        // Get platform-specific binary name
        let platform_binary = Self::get_platform_binary_name(binary_name);

        eprintln!("INFO: Resolving {} (platform name: {})", binary_name, platform_binary);

        // Try bundled sidecar FIRST (required)
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            eprintln!("INFO: Resource directory: {}", resource_dir.display());

            // Try platform-specific name first
            let resource_path = resource_dir.join(&platform_binary);
            eprintln!("INFO: Checking for bundled binary at: {}", resource_path.display());

            if resource_path.exists() {
                eprintln!("INFO: Found bundled {} at {}", binary_name, resource_path.display());

                // Ensure the binary is executable (important on macOS/Linux)
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(metadata) = std::fs::metadata(&resource_path) {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755); // rwxr-xr-x
                        let _ = std::fs::set_permissions(&resource_path, perms);
                    }
                }

                return Ok(resource_path);
            }

            // Fallback to base name (Tauri might strip the suffix)
            let base_path = resource_dir.join(binary_name);
            eprintln!("INFO: Checking fallback path: {}", base_path.display());

            if base_path.exists() {
                eprintln!("INFO: Found bundled {} at {}", binary_name, base_path.display());

                // Ensure the binary is executable
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Ok(metadata) = std::fs::metadata(&base_path) {
                        let mut perms = metadata.permissions();
                        perms.set_mode(0o755);
                        let _ = std::fs::set_permissions(&base_path, perms);
                    }
                }

                return Ok(base_path);
            }

            // List what's actually in the resource directory for debugging
            eprintln!("INFO: Contents of resource directory:");
            if let Ok(entries) = std::fs::read_dir(&resource_dir) {
                for entry in entries.flatten() {
                    eprintln!("  - {}", entry.file_name().to_string_lossy());
                }
            }
        } else {
            eprintln!("WARN: Could not access resource directory");
        }

        // In dev mode, resource_dir might not exist, so fall back to system binary
        // Check if binary exists in PATH
        eprintln!("INFO: Falling back to system PATH lookup");
        if let Ok(output) = std::process::Command::new("which")
            .arg(binary_name)
            .output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    eprintln!("INFO: Using system {} at {}", binary_name, path_str);
                    return Ok(std::path::PathBuf::from(path_str));
                }
            }
        }

        // Fallback with WARNING - emit to frontend
        let error_msg = format!(
            "Binary '{}' (platform: {}) not found in bundle or system PATH",
            binary_name, platform_binary
        );
        eprintln!("ERROR: {}", error_msg);
        let _ = app_handle.emit("ffmpeg-warning", &error_msg);

        Err(error_msg)
    }

    /// Execute the FFmpeg command synchronously (for short operations)
    pub fn run_sync(&self) -> FFmpegResult<String> {
        let args = self.build_args();
        let output = self.execute_command(&args)?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(FFmpegError::ExecutionFailed(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }

    /// Execute command with sidecar fallback
    fn execute_command(&self, args: &[String]) -> FFmpegResult<std::process::Output> {
        // Require app_handle for sidecar resolution
        let app_handle = self.app_handle.as_ref()
            .ok_or_else(|| FFmpegError::CommandSpawn(
                "app_handle required for binary resolution".to_string()
            ))?;

        // Try bundled binary FIRST
        let binary_path = match Self::resolve_sidecar_binary(app_handle, "ffmpeg") {
            Ok(path) => path,
            Err(e) => {
                // Emit warning, use system fallback
                eprintln!("Warning: {}", e);
                std::path::PathBuf::from("ffmpeg")
            }
        };

        std::process::Command::new(binary_path)
            .args(args)
            .output()
            .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))
    }

    /// Execute the FFmpeg command asynchronously
    pub fn run(&self, app_handle: &tauri::AppHandle) -> FFmpegResult<String> {
        let args = self.build_args();

        // Try bundled binary first
        let binary_path = match Self::resolve_sidecar_binary(app_handle, "ffmpeg") {
            Ok(path) => path,
            Err(e) => {
                eprintln!("Warning: {}", e);
                std::path::PathBuf::from("ffmpeg")
            }
        };

        let output = std::process::Command::new(binary_path)
            .args(&args)
            .output()
            .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))?;

        if output.status.success() {
            if let Some(output_path) = &self.output {
                if !Path::new(output_path).exists() {
                    return Err(FFmpegError::OutputValidation(
                        "Output file was not created".to_string()
                    ));
                }
            }

            Ok(self.output.clone().unwrap_or_default())
        } else {
            Err(FFmpegError::ExecutionFailed(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }

    /// Execute with progress monitoring, supporting offset and range for multi-phase progress
    /// - progress_offset: starting percentage (0-100)
    /// - progress_range: how much of the total progress this phase represents (e.g., 30 means this phase is 30% of total)
    pub async fn run_with_progress(&self, app_handle: &tauri::AppHandle, duration: Option<f64>, progress_offset: u32, progress_range: u32) -> FFmpegResult<String> {
        let args = self.build_args();

        // Resolve bundled binary
        let binary_path = match Self::resolve_sidecar_binary(app_handle, "ffmpeg") {
            Ok(path) => path,
            Err(e) => {
                eprintln!("Warning: {}", e);
                std::path::PathBuf::from("ffmpeg")
            }
        };

        let mut command = tokio::process::Command::new(&binary_path);
        command.args(&args);

        if self.progress_enabled {
            command.stderr(Stdio::piped());
        }

        eprintln!("[FFmpeg] About to spawn command with progress_enabled={}, offset={}, range={}", self.progress_enabled, progress_offset, progress_range);
        let mut child = command.spawn()
            .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))?;

        eprintln!("[FFmpeg] Command spawned successfully");

        // Spawn a task to read progress from stderr
        if self.progress_enabled {
            eprintln!("[FFmpeg] Progress is enabled, checking for stderr...");
            if let Some(stderr) = child.stderr.take() {
                eprintln!("[FFmpeg] Stderr captured, spawning reader task");
                let app_handle_clone = app_handle.clone();
                tokio::spawn(async move {
                    eprintln!("[FFmpeg Progress Task] Started reading stderr");
                    let reader = AsyncBufReader::new(stderr);
                    let mut lines = reader.lines();

                    // Throttling state
                    let mut last_progress_time = std::time::Instant::now();
                    const PROGRESS_THROTTLE_MS: u128 = 100; // 100ms = max 10 events/sec

                    while let Ok(Some(line)) = lines.next_line().await {
                        eprintln!("[FFmpeg Progress] Line: {}", line);
                        if line.starts_with("out_time_us=") {
                            // Parse microseconds format (more accurate)
                            if let Some(time_str) = line.strip_prefix("out_time_us=") {
                                if let Ok(time_us) = time_str.trim().parse::<u64>() {
                                    let current_time = time_us as f64 / 1_000_000.0;  // Convert to seconds

                                    // Throttle: only emit if 100ms elapsed since last update
                                    let now = std::time::Instant::now();
                                    if now.duration_since(last_progress_time).as_millis() >= PROGRESS_THROTTLE_MS {
                                        last_progress_time = now;

                                        let phase_progress = if let Some(total) = duration {
                                            ((current_time / total * 100.0).min(100.0)) as u32
                                        } else {
                                            0
                                        };

                                        // Calculate overall progress: offset + (phase% * range%)
                                        let overall_progress = (progress_offset as f64 + (phase_progress as f64 / 100.0 * progress_range as f64)).min(100.0) as u32;
                                        eprintln!("[FFmpeg Progress] Phase: {}%, Overall: {}%", phase_progress, overall_progress);

                                        // Emit overall progress
                                        let _ = app_handle_clone.emit("ffmpeg-progress", overall_progress);
                                    }
                                }
                            }
                        } else if line.starts_with("out_time_ms=") {
                            // Fallback to milliseconds if microseconds not available
                            if let Some(time_str) = line.strip_prefix("out_time_ms=") {
                                if let Ok(time_ms) = time_str.trim().parse::<u64>() {
                                    let current_time = time_ms as f64 / 1_000.0;  // Convert to seconds

                                    // Throttle
                                    let now = std::time::Instant::now();
                                    if now.duration_since(last_progress_time).as_millis() >= PROGRESS_THROTTLE_MS {
                                        last_progress_time = now;

                                        let phase_progress = if let Some(total) = duration {
                                            ((current_time / total * 100.0).min(100.0)) as u32
                                        } else {
                                            0
                                        };

                                        // Calculate overall progress: offset + (phase% / 100 * range%)
                                        let overall_progress = (progress_offset as f64 + (phase_progress as f64 / 100.0 * progress_range as f64)).min(100.0) as u32;
                                        let _ = app_handle_clone.emit("ffmpeg-progress", overall_progress);
                                    }
                                }
                            }
                        }
                    }
                    eprintln!("[FFmpeg Progress Task] Finished reading stderr");
                });
            } else {
                eprintln!("[FFmpeg] No stderr available to capture");
            }
        } else {
            eprintln!("[FFmpeg] Progress is NOT enabled");
        }

        let status = child.wait().await
            .map_err(|e| FFmpegError::ExecutionFailed(e.to_string()))?;

        if status.success() {
            if let Some(output_path) = &self.output {
                if !Path::new(output_path).exists() {
                    return Err(FFmpegError::OutputValidation(
                        "Output file was not created".to_string()
                    ));
                }
            }

            Ok(self.output.clone().unwrap_or_default())
        } else {
            Err(FFmpegError::ExecutionFailed(
                format!("FFmpeg process exited with code: {:?}", status.code())
            ))
        }
    }
}

/// Execute FFprobe with sidecar support
pub fn execute_ffprobe(
    app_handle: &tauri::AppHandle,
    args: &[&str],
) -> FFmpegResult<std::process::Output> {
    // Try sidecar binary first
    let binary_path = match FfmpegBuilder::resolve_sidecar_binary(app_handle, "ffprobe") {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Warning: {}", e);
            std::path::PathBuf::from("ffprobe")  // Fallback
        }
    };

    std::process::Command::new(binary_path)
        .args(args)
        .output()
        .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))
}

/// Helper for version checking
impl FfmpegBuilder {
    pub fn version_check() -> Self {
        let builder = Self::new();
        // Special case: version check doesn't use build_args, runs directly
        builder
    }

    /// Run version check (special case)
    pub fn run_version_check(&self, app_handle: &tauri::AppHandle) -> FFmpegResult<String> {
        // Always try bundled binary
        let binary_path = match Self::resolve_sidecar_binary(app_handle, "ffmpeg") {
            Ok(path) => path,
            Err(e) => {
                eprintln!("Warning: {}", e);
                std::path::PathBuf::from("ffmpeg")
            }
        };

        let output = std::process::Command::new(binary_path)
            .args(["-version"])
            .output()
            .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(FFmpegError::ExecutionFailed(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }
}

