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

    /// Set even dimensions scaling (for MP4 compatibility)
    pub fn scale_even(mut self) -> Self {
        self.scale_width = Some(0); // Special marker for even scaling
        self.scale_height = None;
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
        if let Some(w) = self.scale_width {
            if w == 0 {
                // Special case: even dimensions scaling
                filters.push("scale=trunc(iw/2)*2:trunc(ih/2)*2".to_string());
            } else {
                let scale_str = if let Some(h) = self.scale_height {
                    format!("scale={}:{}", w, h)
                } else {
                    format!("scale={}:trunc(ih/2)*2", w)
                };
                filters.push(scale_str);
            }
        }

        if !filters.is_empty() {
            args.extend(["-vf".to_string(), filters.join(",")]);
        }
        } // Close the else block for concat handling

        // Encoding parameters (applied to both concat and regular input)
        if self.stream_copy {
            args.extend(["-c".to_string(), "copy".to_string(), "-avoid_negative_ts".to_string(), "make_zero".to_string()]);
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

    /// Resolve FFmpeg/FFprobe sidecar binary path
    fn resolve_sidecar_binary(
        app_handle: &tauri::AppHandle,
        binary_name: &str,
    ) -> Result<std::path::PathBuf, String> {
        // Try bundled sidecar FIRST (required)
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            let resource_path = resource_dir.join(binary_name);
            if resource_path.exists() {
                return Ok(resource_path);
            }
        }

        // Fallback with WARNING - emit to frontend
        let error_msg = format!(
            "Bundled binary '{}' not found! Using system fallback (not recommended)",
            binary_name
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

    /// Execute with progress monitoring
    pub async fn run_with_progress(&self, app_handle: &tauri::AppHandle, duration: Option<f64>) -> FFmpegResult<String> {
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

        let mut child = command.spawn()
            .map_err(|e| FFmpegError::CommandSpawn(e.to_string()))?;

        if self.progress_enabled {
            if let Some(stderr) = child.stderr.take() {
                let reader = AsyncBufReader::new(stderr);
                let mut lines = reader.lines();

                // Throttling state
                let mut last_progress_time = std::time::Instant::now();
                const PROGRESS_THROTTLE_MS: u128 = 100; // 100ms = max 10 events/sec

                while let Ok(Some(line)) = lines.next_line().await {
                    if line.starts_with("out_time_us=") {
                        // Parse microseconds format (more accurate)
                        if let Some(time_str) = line.strip_prefix("out_time_us=") {
                            if let Ok(time_us) = time_str.trim().parse::<u64>() {
                                let current_time = time_us as f64 / 1_000_000.0;  // Convert to seconds

                                // Throttle: only emit if 100ms elapsed since last update
                                let now = std::time::Instant::now();
                                if now.duration_since(last_progress_time).as_millis() >= PROGRESS_THROTTLE_MS {
                                    last_progress_time = now;

                                    let progress = if let Some(total) = duration {
                                        ((current_time / total * 100.0).min(100.0)) as u32
                                    } else {
                                        0
                                    };

                                    // Emit progress event
                                    let _ = app_handle.emit("ffmpeg-progress", progress);
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

                                    let progress = if let Some(total) = duration {
                                        ((current_time / total * 100.0).min(100.0)) as u32
                                    } else {
                                        0
                                    };

                                    let _ = app_handle.emit("ffmpeg-progress", progress);
                                }
                            }
                        }
                    }
                }
            }
        }

        let output = child.wait_with_output().await
            .map_err(|e| FFmpegError::ExecutionFailed(e.to_string()))?;

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

