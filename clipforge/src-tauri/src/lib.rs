use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use std::time::{Duration, Instant};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, Emitter};

pub mod utils;

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
fn check_ffmpeg(app_handle: tauri::AppHandle) -> Result<String, String> {
    // Use bundled binary for version check
    match utils::ffmpeg::FfmpegBuilder::version_check().run_version_check(&app_handle) {
        Ok(output) => Ok(output),
        Err(_) => Err("FFmpeg not found. Install via: brew install ffmpeg (macOS) or download from ffmpeg.org (Windows)".to_string()),
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
    let output = utils::ffmpeg::execute_ffprobe(
        &app_handle,
        &[
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration,codec_name,r_frame_rate,bit_rate",
            "-of", "json",
            &file_path
        ]
    ).map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFprobe failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // Parse ffprobe JSON output
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let metadata_json: serde_json::Value = serde_json::from_str(&stdout_str)
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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
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
    let thumbnail_path = match generate_thumbnail(dest_path_str.clone(), duration, width, height, app_handle.clone()) {
        Ok(path) => {
            println!("Successfully generated thumbnail: {}", path);
            Some(path)
        },
        Err(e) => {
            eprintln!("Warning: Failed to generate thumbnail for {}: {}", file_path, e);
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
fn generate_thumbnail(
    file_path: String,
    duration: f64,
    width: u32,
    height: u32,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate input file exists
    let input_path = Path::new(&file_path);
    if !input_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Get app data directory and create thumbnails subdirectory
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let thumbnails_dir = app_data_dir.join("clips").join("thumbnails");
    println!("Creating thumbnails directory: {}", thumbnails_dir.display());
    fs::create_dir_all(&thumbnails_dir)
        .map_err(|e| format!("Failed to create thumbnails directory: {}", e))?;

    // Generate thumbnail filename based on source file
    let file_name = input_path.file_stem()
        .ok_or("Invalid file path: no filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;
    let thumbnail_name = format!("{}_thumb.jpg", file_name);
    let thumbnail_path = thumbnails_dir.join(&thumbnail_name);

    // Try multiple time positions for thumbnail extraction (more robust)
    let time_positions = [
        1.0,  // Try 1 second first
        duration * 0.1,  // Try 10% into the video
        0.5,  // Try 0.5 seconds
        0.0,  // Try beginning as last resort
    ];

    println!("Generating thumbnail for video: {} (duration: {:.2}s)", file_path, duration);
    println!("Thumbnail output path: {}", thumbnail_path.display());

    let mut last_error = String::new();

    for &time_pos in &time_positions {
        // Skip if time position is beyond video duration
        if time_pos >= duration && duration > 0.0 {
            println!("Skipping time position {:.2}s (beyond duration)", time_pos);
            continue;
        }

        println!("Trying thumbnail extraction at {:.2}s", time_pos);

        // Target thumbnail dimensions (16:9 aspect ratio)
        let target_width = 320u32;
        let target_height = 180u32;
        let target_aspect = target_width as f32 / target_height as f32;
        let source_aspect = width as f32 / height as f32;

        println!("Video dimensions: {}x{}, aspect ratio: {:.2}, target: {}x{} ({:.2})",
                 width, height, source_aspect, target_width, target_height, target_aspect);

        // Use scale_crop to zoom in and maintain aspect ratio without stretching
        // This scales to cover the target dimensions, then crops the excess from center
        let result = utils::ffmpeg::FfmpegBuilder::new()
            .input(&file_path)
            .thumbnail(time_pos)
            .scale_crop(target_width, target_height)
            .output(thumbnail_path.to_str().ok_or("Invalid thumbnail path")?)
            .with_app_handle(app_handle.clone())
            .run_sync();

        match result {
            Ok(_) => {
                // Verify thumbnail was actually created
                if thumbnail_path.exists() {
                    let metadata = thumbnail_path.metadata().map_err(|e| format!("Failed to get thumbnail metadata: {}", e))?;
                    println!("Successfully generated thumbnail: {} (size: {} bytes)", thumbnail_path.display(), metadata.len());
                    return Ok(thumbnail_path.to_str()
                        .ok_or("Invalid thumbnail path")?
                        .to_string());
                } else {
                    last_error = "Thumbnail file was not created".to_string();
                    println!("Thumbnail file not found at expected path");
                    continue;
                }
            }
            Err(e) => {
                last_error = format!("FFmpeg error at {:.2}s: {}", time_pos, e);
                println!("Failed at {:.2}s: {}", time_pos, e);
                continue;
            }
        }
    }

    Err(format!("Failed to generate thumbnail after trying multiple time positions: {}", last_error))
}

#[tauri::command]
async fn regenerate_thumbnails(app_handle: tauri::AppHandle) -> Result<(), String> {
    // Get app data directory
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let clips_dir = app_data_dir.join("clips");

    if !clips_dir.exists() {
        return Err("No clips directory found".to_string());
    }

    // Find all video files in clips directory
    let mut video_files = Vec::new();

    fn find_video_files(dir: &Path, files: &mut Vec<PathBuf>) -> std::io::Result<()> {
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_dir() {
                    find_video_files(&path, files)?;
                } else if let Some(ext) = path.extension() {
                    let ext_str = ext.to_str().unwrap_or("").to_lowercase();
                    if ext_str == "mp4" || ext_str == "mov" || ext_str == "webm" || ext_str == "avi" {
                        files.push(path);
                    }
                }
            }
        }
        Ok(())
    }

    find_video_files(&clips_dir, &mut video_files)
        .map_err(|e| format!("Failed to scan clips directory: {}", e))?;

    let mut success_count = 0;
    let mut error_count = 0;

    for video_path in video_files {
        // Skip if thumbnail already exists
        let file_name = video_path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or("Invalid video filename")?;
        let thumbnail_name = format!("{}_thumb.jpg", file_name);
        let thumbnails_dir = clips_dir.join("thumbnails");
        let thumbnail_path = thumbnails_dir.join(&thumbnail_name);

        if thumbnail_path.exists() {
            println!("Thumbnail already exists for: {}", video_path.display());
            continue;
        }

        // Get video metadata (duration, width, height)
        let output = utils::ffmpeg::execute_ffprobe(
            &app_handle,
            &[
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height,duration",
                "-of", "json",
                &video_path.to_str().unwrap_or("")
            ]
        ).map_err(|e| format!("Failed to get metadata for {}: {}", video_path.display(), e))?;

        let stdout_str = String::from_utf8_lossy(&output.stdout);
        let metadata_json: serde_json::Value = serde_json::from_str(&stdout_str)
            .map_err(|e| format!("Failed to parse metadata for {}: {}", video_path.display(), e))?;

        let stream = metadata_json["streams"]
            .get(0)
            .ok_or_else(|| format!("No video stream found for {}", video_path.display()))?;

        let width = stream["width"].as_u64()
            .ok_or_else(|| format!("Missing width for {}", video_path.display()))? as u32;
        let height = stream["height"].as_u64()
            .ok_or_else(|| format!("Missing height for {}", video_path.display()))? as u32;
        let duration = stream["duration"].as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        // Generate thumbnail
        match generate_thumbnail(video_path.to_str().unwrap_or("").to_string(), duration, width, height, app_handle.clone()) {
            Ok(path) => {
                println!("Generated thumbnail for: {} -> {}", video_path.display(), path);
                success_count += 1;
            }
            Err(e) => {
                eprintln!("Failed to generate thumbnail for {}: {}", video_path.display(), e);
                error_count += 1;
            }
        }
    }

    println!("Thumbnail regeneration complete: {} generated, {} failed", success_count, error_count);
    Ok(())
}

#[tauri::command]
async fn trim_clip(
    input_path: String,
    output_path: String,
    start_time: f64,
    end_time: f64,
    app_handle: tauri::AppHandle,
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

    // Use builder for trim operation
    let result = utils::ffmpeg::FfmpegBuilder::new()
        .input(&input_path)
        .trim(start_time, duration)
        .stream_copy()
        .output(&output_path)
        .run(&app_handle);

    match result {
        Ok(_) => Ok(output_path),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn save_recording(
    file_name: String,
    data: Vec<u8>,
    convert_to_mp4: bool,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Get app data directory and create clips subdirectory
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
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

        // Use builder for MP4 conversion
        let result = utils::ffmpeg::FfmpegBuilder::new()
            .input(webm_path.to_str().ok_or("Invalid WebM path")?)
            .scale_even()
            .encode()
            .preset("fast")
            .output(mp4_path.to_str().ok_or("Invalid MP4 path")?)
            .run(&app_handle);

        match result {
            Ok(_) => {
                // Delete original WebM file after successful conversion
                fs::remove_file(&webm_path)
                    .map_err(|e| format!("Failed to remove WebM file: {}", e))?;

                Ok(mp4_path.to_str()
                    .ok_or("Invalid MP4 path")?
                    .to_string())
            }
            Err(e) => Err(e.to_string()),
        }
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
    volume: Option<f64>,  // Audio volume (0.0-1.0, where 1.0 is 100%)
    muted: Option<bool>,  // Whether audio is muted
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
            if let Some(_first_clip) = clips.first() {
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

    // Build FFmpeg command with volume/mute settings
    let mut builder = utils::ffmpeg::FfmpegBuilder::new()
        .input(&clip.path)
        .trim(clip.trim_start, duration)
        .scale_with_pad(width, height)
        .encode()
        .with_progress();

    // Apply audio settings if present
    if clip.muted == Some(true) {
        builder = builder.mute();
    } else if let Some(vol) = clip.volume {
        builder = builder.volume(vol);
    }

    let result = builder
        .output(output_path)
        .run_with_progress(app_handle, Some(duration), 0, 100) // Single clip: 0-100%
        .await;

    match result {
        Ok(_) => Ok(output_path.to_string()),
        Err(e) => Err(e.to_string()),
    }
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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    // For multi-clip with trims, we need to pre-process each clip first
    // Then concatenate the trimmed versions
    let mut trimmed_clip_paths = Vec::new();

    // Get total estimated duration for individual clips (for accurate progress)
    let total_clip_duration: f64 = clips.iter().map(|c| c.trim_end - c.trim_start).sum();

    // Emit initial progress
    let _ = app_handle.emit("ffmpeg-progress", 0u32);

    let mut completed_clip_duration = 0.0f64;

    for (i, clip) in clips.iter().enumerate() {
        let temp_output = app_data_dir.join(format!("temp_clip_{}.mp4", i));
        let duration = clip.trim_end - clip.trim_start;

        // Calculate progress offset and range for this clip
        let progress_offset = (completed_clip_duration / total_clip_duration * 90.0) as u32;
        let progress_range = ((duration / total_clip_duration) * 90.0) as u32;

        // Build FFmpeg command with volume/mute settings
        let mut builder = utils::ffmpeg::FfmpegBuilder::new()
            .input(&clip.path)
            .trim(clip.trim_start, duration)
            .scale_with_pad(width, height)
            .encode()
            .with_progress();

        // Apply audio settings if present
        if clip.muted == Some(true) {
            builder = builder.mute();
        } else if let Some(vol) = clip.volume {
            builder = builder.volume(vol);
        }

        let result = builder
            .output(temp_output.to_str().ok_or("Invalid temp path")?)
            .run_with_progress(app_handle, Some(duration), progress_offset, progress_range)
            .await;

        if let Err(e) = result {
            return Err(format!("Failed to process clip {}: {}", i, e));
        }

        trimmed_clip_paths.push(temp_output);

        // Update completed duration
        completed_clip_duration += duration;
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

    // Use builder for concat operation - progress starts from 90%
    let concat_duration_estimate = total_clip_duration * 0.1; // Estimate 10% of total time for concat
    let result = utils::ffmpeg::FfmpegBuilder::new()
        .concat(concat_list_path.to_str().ok_or("Invalid concat list path")?)
        .stream_copy()
        .with_progress()
        .output(output_path)
        .run_with_progress(app_handle, Some(concat_duration_estimate), 90, 10) // 90% offset, 10% range
        .await;

    // Clean up temp files
    for temp_path in &trimmed_clip_paths {
        let _ = fs::remove_file(temp_path);
    }
    let _ = fs::remove_file(&concat_list_path);

    match result {
        Ok(_) => Ok(output_path.to_string()),
        Err(e) => Err(e.to_string()),
    }
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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

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

    // Use builder to encode the captured frames to MP4
    let raw_config = utils::ffmpeg::RawInputConfig {
        pixel_format: "rgb24".to_string(),
        video_size: "1280x720".to_string(),
        framerate: 30,
    };

    let result = utils::ffmpeg::FfmpegBuilder::new()
        .raw_input(raw_config)
        .encode()
        .pixel_format("yuv420p")
        .output(&output_path)
        .run(&app_handle);

    // Clean up temp file
    let _ = fs::remove_file(&temp_raw_path);

    match result {
        Ok(_) => {}
        Err(e) => return Err(e.to_string()),
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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let workspace_path = app_data_dir.join("workspace.json");

    fs::write(&workspace_path, state_json)
        .map_err(|e| format!("Failed to save workspace: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn load_workspace(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

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
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

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

#[tauri::command]
async fn write_text_file(
    file_path: String,
    content: String,
) -> Result<(), String> {
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn extract_audio(
    video_path: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate input file exists
    let input_path = Path::new(&video_path);
    if !input_path.exists() {
        return Err(format!("Video file not found: {}", video_path));
    }

    // Get app data directory and create audio subdirectory
    let app_data_dir = app_handle.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let audio_dir = app_data_dir.join("audio");
    fs::create_dir_all(&audio_dir)
        .map_err(|e| format!("Failed to create audio directory: {}", e))?;

    // Generate output filename (mp3 format for better compatibility with Whisper)
    let file_name = input_path.file_stem()
        .ok_or("Invalid file path: no filename")?
        .to_str()
        .ok_or("Invalid filename encoding")?;
    let audio_filename = format!("{}.mp3", file_name);
    let audio_path = audio_dir.join(&audio_filename);

    // Extract audio using FFmpeg
    // Using -vn (no video), -ar 16000 (16kHz for Whisper), -ac 1 (mono), -b:a 128k (128kbps)
    let args = vec![
        "-i".to_string(), video_path.clone(),
        "-vn".to_string(),
        "-ar".to_string(), "16000".to_string(),
        "-ac".to_string(), "1".to_string(),
        "-b:a".to_string(), "128k".to_string(),
        "-y".to_string(),
        audio_path.to_str().ok_or("Invalid audio path")?.to_string(),
    ];

    // Use FFmpeg builder's execute_command approach
    let binary_path = match utils::ffmpeg::FfmpegBuilder::resolve_sidecar_binary(&app_handle, "ffmpeg") {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Warning: {}", e);
            std::path::PathBuf::from("ffmpeg")
        }
    };

    let output = tokio::process::Command::new(&binary_path)
        .args(&args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute FFmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "FFmpeg failed to extract audio: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Verify output file was created
    if !audio_path.exists() {
        return Err("Audio file was not created".to_string());
    }

    Ok(audio_path.to_str()
        .ok_or("Invalid audio path")?
        .to_string())
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
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![check_ffmpeg, import_file, generate_thumbnail, regenerate_thumbnails, trim_clip, save_recording, export_video, record_webcam_clip, save_workspace, load_workspace, list_clips, delete_clip, reset_workspace, extract_audio, write_text_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
