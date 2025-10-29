use tauri::api::process::Command;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use std::io::Write;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use tokio::process::Command;
use tokio::io::{AsyncBufReadExt, BufReader as AsyncBufReader};
use regex::Regex;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use std::time::{Duration, Instant};
use std::sync::atomic::{AtomicBool, Ordering};

static CAMERA_PERMISSION: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Deserialize)]
struct VideoMetadata {
    duration: f64,
    width: u32,
    height: u32,
    file_path: String,
    thumbnail_path: Option<String>,
    file_size: u64,
    codec: Option<String>,
    fps: Option<f64>,
    bit_rate: Option<u64>,
}

#[derive(Serialize, Deserialize)]
struct Clip {
    id: String,
    name: String,
    path: String,
    start: f64,
    end: f64,
    duration: f64,
}

#[derive(Serialize, Deserialize)]
struct WorkspaceState {
    clips: Vec<Clip>,
    playhead: f64,
    is_playing: bool,
    zoom: f64,
    selected_clip_id: Option<String>,
    export_progress: f64,
}

#[derive(Serialize, Deserialize)]
struct ClipInfo {
    name: String,
    path: String,
    size: u64,
}

#[tauri::command]
async fn check_ffmpeg() -> Result<String, String> {
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&["-version"])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err("FFmpeg not found. Install via: brew install ffmpeg (macOS) or download from ffmpeg.org (Windows)".to_string())
    }
}

#[tauri::command]
async fn import_file(file_path: String, app_handle: tauri::AppHandle) -> Result<VideoMetadata, String> {
    // Validate file extension
    let path = Path::new(&file_path);
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or("Invalid file: no extension found")?;

    if extension != "mp4" && extension != "mov" {
        return Err(format!("Unsupported file format: .{}. Only MP4 and MOV files are supported.", extension));
    }

    // Check if file exists
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Extract metadata using ffprobe
    let output = Command::new_sidecar("ffprobe")
        .expect("failed to create ffprobe command")
        .args(&[
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration,codec_name,r_frame_rate,bit_rate",
            "-of", "json",
            &file_path
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFprobe failed: {}", output.stderr));
    }

    // Parse ffprobe JSON output
    let metadata_json: serde_json::Value = serde_json::from_str(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let stream = metadata_json["streams"]
        .get(0)
        .ok_or("No video stream found in file")?;

    let width = stream["width"].as_u64()
        .ok_or("Missing width in metadata")? as u32;
    let height = stream["height"].as_u64()
        .ok_or("Missing height in metadata")? as u32;
    let duration = stream["duration"].as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .ok_or("Missing or invalid duration in metadata")?;

    // Extract codec name
    let codec = stream["codec_name"].as_str().map(|s| s.to_string());

    // Extract and parse frame rate (format: "30000/1001" or "30")
    let fps = stream["r_frame_rate"].as_str().and_then(|fps_str| {
        let parts: Vec<&str> = fps_str.split('/').collect();
        if parts.len() == 2 {
            let num: f64 = parts[0].parse().ok()?;
            let den: f64 = parts[1].parse().ok()?;
            Some(num / den)
        } else {
            fps_str.parse::<f64>().ok()
        }
    });

    // Extract bit rate
    let bit_rate = stream["bit_rate"].as_str()
        .and_then(|s| s.parse::<u64>().ok());

    // Get app data directory and create clips subdirectory
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    let clips_dir = app_data_dir.join("clips");
    fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    // Copy file to clips directory with original filename
    let file_name = path.file_name()
        .ok_or("Invalid file path: no filename")?;
    let dest_path = clips_dir.join(file_name);
    fs::copy(&file_path, &dest_path)
        .map_err(|e| format!("Failed to copy file: {}", e))?;

    // Get file size from the destination file
    let file_size = fs::metadata(&dest_path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?
        .len();

    let dest_path_str = dest_path.to_str()
        .ok_or("Invalid destination path")?
        .to_string();

    // Generate thumbnail automatically
    let thumbnail_path = match generate_thumbnail(dest_path_str.clone(), app_handle).await {
        Ok(path) => Some(path),
        Err(e) => {
            eprintln!("Warning: Failed to generate thumbnail: {}", e);
            None  // Continue even if thumbnail generation fails
        }
    };

    // Return metadata with new file path and thumbnail
    Ok(VideoMetadata {
        duration,
        width,
        height,
        file_path: dest_path_str,
        thumbnail_path,
        file_size,
        codec,
        fps,
        bit_rate,
    })
}

#[tauri::command]
async fn generate_thumbnail(
    file_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate input file exists
    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Get app data directory and create thumbnails subdirectory
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    let thumbnails_dir = app_data_dir.join("clips").join("thumbnails");
    fs::create_dir_all(&thumbnails_dir)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;

    // Generate thumbnail filename based on source file
    let file_name = input_path.file_stem()
        .ok_or("Invalid file path: no filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;
    let thumbnail_name = format!("{}_thumb.jpg", file_name);
    let thumbnail_path = thumbnails_dir.join(&thumbnail_name);

    // Use FFmpeg to extract frame at 1 second
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-i", &file_path,
            "-ss", "00:00:01",
            "-vframes", "1",
            "-vf", "scale=320:-1",  // Scale width to 320px, maintain aspect ratio
            "-y",  // Overwrite output file if it exists
            thumbnail_path.to_str().ok_or("Invalid thumbnail path")?,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFmpeg thumbnail generation failed: {}", output.stderr));
    }

    // Return the thumbnail path
    Ok(thumbnail_path.to_str()
        .ok_or("Invalid thumbnail path")?
        .to_string())
}

#[tauri::command]
async fn trim_clip(
    input_path: String,
    output_path: String,
    start_time: f64,
    end_time: f64,
) -> Result<String, String> {
    // Validate input file exists
    let input = Path::new(&input_path);
    if !input.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    // Validate time range
    if start_time < 0.0 || end_time < 0.0 {
        return Err("Start and end times must be non-negative".to_string());
    }
    if start_time >= end_time {
        return Err("Start time must be less than end time".to_string());
    }

    // Create edited directory if it doesn't exist
    let output = Path::new(&output_path);
    if let Some(parent) = output.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Calculate duration for FFmpeg
    let duration = end_time - start_time;

    // Run FFmpeg trim command with stream copy (fast, no re-encoding)
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-ss", &start_time.to_string(),
            "-i", &input_path,
            "-t", &duration.to_string(),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-y", // Overwrite output file
            &output_path
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFmpeg trim failed: {}", output.stderr));
    }

    // Verify output file was created
    let output_file = Path::new(&output_path);
    if !output_file.exists() {
        return Err("Output file was not created".to_string());
    }

    Ok(output_path)
}

#[tauri::command]
async fn save_recording(
    file_name: String,
    data: Vec<u8>,
    convert_to_mp4: bool,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Get app data directory and create clips subdirectory
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    let clips_dir = app_data_dir.join("clips");
    fs::create_dir_all(&clips_dir)
        .map_err(|e| format!("Failed to create clips directory: {}", e))?;

    // Validate filename
    if file_name.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }
    if file_name.contains("..") || file_name.contains("/") || file_name.contains("\\") {
        return Err("Invalid filename: path traversal not allowed".to_string());
    }

    // Save WebM file
    let webm_path = clips_dir.join(&file_name);
    fs::write(&webm_path, &data)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Optionally convert to MP4
    if convert_to_mp4 {
        // Generate MP4 filename
        let mp4_filename = file_name.replace(".webm", ".mp4");
        let mp4_path = clips_dir.join(&mp4_filename);

        // Run FFmpeg conversion with optimized settings for playback
        let output = Command::new_sidecar("ffmpeg")
            .expect("failed to create ffmpeg command")
            .args(&[
                "-i", webm_path.to_str().ok_or("Invalid WebM path")?,
                "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",  // Ensure even dimensions
                "-c:v", "libx264",
                "-preset", "fast",          // Faster encoding
                "-crf", "23",               // Good quality/size balance
                "-movflags", "+faststart",  // Enable streaming/fast playback
                "-c:a", "aac",
                "-b:a", "128k",             // Audio bitrate
                "-strict", "experimental",
                "-y",                       // Overwrite output
                mp4_path.to_str().ok_or("Invalid MP4 path")?,
            ])
            .output()
            .map_err(|e| format!("Failed to run FFmpeg conversion: {}", e))?;

        if !output.status.success() {
            return Err(format!("FFmpeg conversion failed: {}", output.stderr));
        }

        // Delete original WebM file after successful conversion
        fs::remove_file(&webm_path)
            .map_err(|e| format!("Failed to remove WebM file: {}", e))?;

        Ok(mp4_path.to_str()
            .ok_or("Invalid MP4 path")?
            .to_string())
    } else {
        Ok(webm_path.to_str()
            .ok_or("Invalid WebM path")?
            .to_string())
    }
}

#[derive(serde::Deserialize)]
struct ClipExportInfo {
    path: String,
    trim_start: f64,
    trim_end: f64,
}

#[tauri::command]
async fn export_video(
    clips: Vec<ClipExportInfo>,
    output_path: String,
    resolution: String, // "720p" or "1080p"
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate inputs
    if clips.is_empty() {
        return Err("No clips provided for export".to_string());
    }

    // Validate all input files exist
    for clip in &clips {
        let path = Path::new(&clip.path);
        if !path.exists() {
            return Err(format!("Clip not found: {}", clip.path));
        }
    }

    // Parse resolution
    let (width, height) = match resolution.as_str() {
        "source" => {
            // For source resolution, we need to get it from the first clip
            if let Some(first_clip) = clips.first() {
                // We can't easily get source resolution without probing, so use 720p as fallback
                // In a real implementation, you'd probe the first clip for resolution
                (1280, 720)
            } else {
                (1280, 720)
            }
        },
        "480p" => (854, 480),
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        "4K" => (3840, 2160),
        _ => return Err(format!("Unsupported resolution: {}. Use 'source', '480p', '720p', '1080p', or '4K'.", resolution)),
    };

    // If single clip, simple re-encode with resolution and trim
    if clips.len() == 1 {
        return export_single_clip(&clips[0], &output_path, width, height, &app_handle).await;
    }

    // Multi-clip: use concat demuxer with trims
    export_multi_clips(&clips, &output_path, width, height, &app_handle).await
}

// Helper function to run FFmpeg with progress monitoring
async fn run_ffmpeg_with_progress(
    args: &[&str],
    app_handle: &tauri::AppHandle,
    total_duration: Option<f64>,
) -> Result<(), String> {
    let mut child = Command::new("ffmpeg")
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    let mut reader = AsyncBufReader::new(stderr).lines();

    // Regex to match FFmpeg progress lines
    let time_regex = Regex::new(r"time=(\d+):(\d+):(\d+\.\d+)").unwrap();
    let duration_regex = Regex::new(r"Duration: (\d+):(\d+):(\d+\.\d+)").unwrap();

    let mut total_seconds = total_duration.unwrap_or(0.0);

    while let Ok(Some(line)) = reader.next_line().await {
        // Parse duration if found
        if let Some(caps) = duration_regex.captures(&line) {
            let hours: f64 = caps[1].parse().unwrap_or(0.0);
            let minutes: f64 = caps[2].parse().unwrap_or(0.0);
            let seconds: f64 = caps[3].parse().unwrap_or(0.0);
            total_seconds = hours * 3600.0 + minutes * 60.0 + seconds;
        }

        // Parse current time if found
        if let Some(caps) = time_regex.captures(&line) {
            let hours: f64 = caps[1].parse().unwrap_or(0.0);
            let minutes: f64 = caps[2].parse().unwrap_or(0.0);
            let seconds: f64 = caps[3].parse().unwrap_or(0.0);
            let current_seconds = hours * 3600.0 + minutes * 60.0 + seconds;

            if total_seconds > 0.0 {
                let progress = (current_seconds / total_seconds * 100.0).min(100.0);
                // Emit progress event
                let _ = app_handle.emit_all("export-progress", progress as u32);
            }
        }
    }

    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !status.success() {
        return Err("FFmpeg process failed".to_string());
    }

    Ok(())
}

// Helper function for single clip export
async fn export_single_clip(
    clip: &ClipExportInfo,
    output_path: &str,
    width: u32,
    height: u32,
    app_handle: &tauri::AppHandle,
) -> Result<String, String> {
    // Calculate total duration for progress calculation
    let duration = clip.trim_end - clip.trim_start;

    // Run FFmpeg with progress monitoring and trim
    let args = vec![
        "-ss", &clip.trim_start.to_string(),
        "-t", &duration.to_string(),
        "-i", &clip.path,
        "-vf", &format!("scale={}:{}", width, height),
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-progress", "pipe:2", // Send progress to stderr
        "-y",
        output_path
    ];

    run_ffmpeg_with_progress(&args, app_handle, Some(duration)).await?;

    // Verify output file
    let output_file = Path::new(output_path);
    if !output_file.exists() {
        return Err("Output file was not created".to_string());
    }

    Ok(output_path.to_string())
}

// Helper function for multi-clip export using concat demuxer
async fn export_multi_clips(
    clips: &[ClipExportInfo],
    output_path: &str,
    width: u32,
    height: u32,
    app_handle: &tauri::AppHandle,
) -> Result<String, String> {
    // Get app data directory for temp files
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    // Calculate total duration for progress
    let total_duration: f64 = clips.iter().map(|c| c.trim_end - c.trim_start).sum();

    // For multi-clip with trims, we need to pre-process each clip first
    // Then concatenate the trimmed versions
    let mut trimmed_clip_paths = Vec::new();

    for (i, clip) in clips.iter().enumerate() {
        let temp_output = app_data_dir.join(format!("temp_clip_{}.mp4", i));
        let duration = clip.trim_end - clip.trim_start;

        // Trim and scale each clip individually (no progress for individual clips)
        let output = Command::new("ffmpeg")
            .args(&[
                "-ss", &clip.trim_start.to_string(),
                "-t", &duration.to_string(),
                "-i", &clip.path,
                "-vf", &format!("scale={}:{}", width, height),
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-y",
                &temp_output.to_str().ok_or("Invalid temp path")?
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to trim clip {}: {}", i, e))?;

        if !output.status.success() {
            return Err(format!("FFmpeg trim failed for clip {}: {}", i, String::from_utf8_lossy(&output.stderr)));
        }

        trimmed_clip_paths.push(temp_output);
    }

    // Create concat list file
    let concat_list_path = app_data_dir.join("concat_list.txt");
    let mut concat_file = fs::File::create(&concat_list_path)
        .map_err(|e| format!("Failed to create concat list file: {}", e))?;

    // Write concat demuxer format with trimmed clips
    for temp_path in &trimmed_clip_paths {
        writeln!(concat_file, "file '{}'", temp_path.to_str().ok_or("Invalid path")?)
            .map_err(|e| format!("Failed to write to concat list: {}", e))?;
    }

    // Flush to ensure file is written
    concat_file.flush()
        .map_err(|e| format!("Failed to flush concat list: {}", e))?;
    drop(concat_file); // Close file

    // Run FFmpeg with concat demuxer and progress monitoring
    let args = vec![
        "-f", "concat",
        "-safe", "0",
        "-i", &concat_list_path.to_str().ok_or("Invalid concat list path")?,
        "-c", "copy", // Stream copy since clips are already processed
        "-progress", "pipe:2", // Send progress to stderr
        "-y",
        output_path
    ];

    run_ffmpeg_with_progress(&args, app_handle, Some(total_duration)).await?;

    // Clean up temp files
    for temp_path in &trimmed_clip_paths {
        let _ = fs::remove_file(temp_path);
    }
    let _ = fs::remove_file(&concat_list_path);

    // Verify output file
    let output_file = Path::new(output_path);
    if !output_file.exists() {
        return Err("Output file was not created".to_string());
    }

    Ok(output_path.to_string())
}

        trimmed_clip_paths.push(temp_output);
    }

    // Create concat list file
    let concat_list_path = app_data_dir.join("concat_list.txt");
    let mut concat_file = fs::File::create(&concat_list_path)
        .map_err(|e| format!("Failed to create concat list file: {}", e))?;

    // Write concat demuxer format with trimmed clips
    for temp_path in &trimmed_clip_paths {
        writeln!(concat_file, "file '{}'", temp_path.to_str().ok_or("Invalid path")?)
            .map_err(|e| format!("Failed to write to concat list: {}", e))?;
    }

    // Flush to ensure file is written
    concat_file.flush()
        .map_err(|e| format!("Failed to flush concat list: {}", e))?;
    drop(concat_file); // Close file

    // Run FFmpeg with concat demuxer (no need to scale again, already done)
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path.to_str().ok_or("Invalid concat list path")?,
            "-c", "copy", // Stream copy since clips are already processed
            "-y",
            output_path
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    // Clean up temp files
    let _ = fs::remove_file(&concat_list_path);
    for temp_path in &trimmed_clip_paths {
        let _ = fs::remove_file(temp_path);
    }

    if !output.status.success() {
        return Err(format!("FFmpeg concat failed: {}", output.stderr));
    }

    // Verify output file
    let output_file = Path::new(output_path);
    if !output_file.exists() {
        return Err("Output file was not created".to_string());
    }

    Ok(output_path.to_string())
}

#[tauri::command]
async fn record_webcam_clip(
    duration_seconds: f64,
    output_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate duration
    if duration_seconds <= 0.0 {
        return Err("Duration must be greater than 0".to_string());
    }
    if duration_seconds > 300.0 {
        return Err("Duration cannot exceed 5 minutes (300 seconds)".to_string());
    }

    // Check if camera permission was granted during app initialization
    if !CAMERA_PERMISSION.load(Ordering::SeqCst) {
        return Err("Camera permission not granted. Please allow camera access in System Settings and restart the app.".to_string());
    }

    // Initialize camera with requested format: 1280x720, 30fps
    let index = CameraIndex::Index(0);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    let mut camera = Camera::new(index, requested)
        .map_err(|e| format!("Failed to initialize camera: {}", e))?;

    // Open camera stream
    camera.open_stream()
        .map_err(|e| format!("Failed to open camera stream: {}", e))?;

    // Get app data directory for temp raw frames file
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let temp_raw_path = app_data_dir.join("temp_webcam_raw.rgb");

    // Capture frames for specified duration
    let target_duration = Duration::from_secs_f64(duration_seconds);
    let start_time = Instant::now();
    let mut frame_count = 0;

    // Create temp file for raw RGB frames
    let mut temp_file = fs::File::create(&temp_raw_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    // Capture loop
    while start_time.elapsed() < target_duration {
        let frame = camera.frame()
            .map_err(|e| format!("Failed to capture frame: {}", e))?;

        // Write raw RGB data to temp file
        temp_file.write_all(&frame.buffer())
            .map_err(|e| format!("Failed to write frame data: {}", e))?;

        frame_count += 1;

        // Small delay to achieve ~30fps
        std::thread::sleep(Duration::from_millis(33));
    }

    // Close camera
    drop(camera);

    // Flush temp file
    temp_file.flush()
        .map_err(|e| format!("Failed to flush temp file: {}", e))?;
    drop(temp_file);

    // If no frames captured, error
    if frame_count == 0 {
        let _ = fs::remove_file(&temp_raw_path);
        return Err("No frames captured from webcam".to_string());
    }

    // Use FFmpeg to encode the captured frames to MP4
    // Note: This implementation writes raw frames to disk then encodes
    // For production, consider piping frames directly to FFmpeg stdin
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-f", "rawvideo",
            "-pixel_format", "rgb24",
            "-video_size", "1280x720",
            "-framerate", "30",
            "-i", temp_raw_path.to_str().ok_or("Invalid temp path")?,
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            "-y",
            &output_path
        ])
        .output()
        .map_err(|e| format!("Failed to run FFmpeg encoding: {}", e))?;

    // Clean up temp file
    let _ = fs::remove_file(&temp_raw_path);

    if !output.status.success() {
        return Err(format!("FFmpeg encoding failed: {}", output.stderr));
    }

    // Verify output file
    let output_file = Path::new(&output_path);
    if !output_file.exists() {
        return Err("Output video file was not created".to_string());
    }

    Ok(output_path)
}

#[tauri::command]
async fn save_workspace(state_json: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let workspace_path = app_data_dir.join("workspace.json");

    fs::write(&workspace_path, state_json)
        .map_err(|e| format!("Failed to save workspace: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn load_workspace(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let workspace_path = app_data_dir.join("workspace.json");

    if !workspace_path.exists() {
        return Err("No saved workspace found".to_string());
    }

    let content = fs::read_to_string(&workspace_path)
        .map_err(|e| format!("Failed to load workspace: {}", e))?;

    Ok(content)
}

#[tauri::command]
async fn list_clips(app_handle: tauri::AppHandle) -> Result<Vec<ClipInfo>, String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let clips_dir = app_data_dir.join("clips");

    if !clips_dir.exists() {
        return Ok(vec![]);
    }

    let mut clips = vec![];

    for entry in fs::read_dir(&clips_dir)
        .map_err(|e| format!("Failed to read clips dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            let name = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            let size = path.metadata().map(|m| m.len()).unwrap_or(0);
            let path_str = path.to_str().unwrap_or("").to_string();

            clips.push(ClipInfo {
                name,
                path: path_str,
                size,
            });
        }
    }

    Ok(clips)
}

#[tauri::command]
async fn delete_clip(file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);

    // Validate the file exists
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Validate the file is within allowed directories (clips or clips/edited)
    let path_str = path.to_str().ok_or("Invalid file path")?;
    if !path_str.contains("/clips/") && !path_str.contains("\\clips\\") {
        return Err("Can only delete files in the clips directory".to_string());
    }

    // Delete the file
    fs::remove_file(path)
        .map_err(|e| format!("Failed to delete file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn reset_workspace(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let clips_dir = app_data_dir.join("clips");
    let workspace_file = app_data_dir.join("workspace.json");

    // Delete workspace.json if it exists
    if workspace_file.exists() {
        fs::remove_file(&workspace_file)
            .map_err(|e| format!("Failed to delete workspace file: {}", e))?;
    }

    // Delete all files in clips directory (including subdirectories)
    if clips_dir.exists() {
        fs::remove_dir_all(&clips_dir)
            .map_err(|e| format!("Failed to delete clips directory: {}", e))?;

        // Recreate empty clips directory
        fs::create_dir_all(&clips_dir)
            .map_err(|e| format!("Failed to recreate clips directory: {}", e))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize nokhwa on macOS before starting Tauri app
  #[cfg(target_os = "macos")]
  {
    use std::sync::{Arc, Mutex};
    let permission_granted = Arc::new(Mutex::new(false));
    let permission_clone = permission_granted.clone();

    nokhwa::nokhwa_initialize(move |granted| {
      *permission_clone.lock().unwrap() = granted;
      CAMERA_PERMISSION.store(granted, Ordering::SeqCst);
      if granted {
        println!("Camera permission granted");
      } else {
        println!("Camera permission denied");
      }
    });

    // Wait for initialization to complete
    std::thread::sleep(Duration::from_secs(1));

    // Verify initialization
    if nokhwa::nokhwa_check() {
      println!("Nokhwa initialized successfully");
    } else {
      println!("Warning: Nokhwa initialization may not be complete");
    }
  }

  #[cfg(not(target_os = "macos"))]
  {
    CAMERA_PERMISSION.store(true, Ordering::SeqCst);
  }

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![check_ffmpeg, import_file, generate_thumbnail, trim_clip, save_recording, export_video, record_webcam_clip, save_workspace, load_workspace, list_clips, delete_clip, reset_workspace])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
