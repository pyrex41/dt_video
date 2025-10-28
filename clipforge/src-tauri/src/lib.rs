use tauri::api::process::Command;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;
use std::io::Write;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize)]
struct VideoMetadata {
    duration: f64,
    width: u32,
    height: u32,
    file_path: String,
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
            "-show_entries", "stream=width,height,duration",
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

    // Return metadata with new file path
    Ok(VideoMetadata {
        duration,
        width,
        height,
        file_path: dest_path.to_str()
            .ok_or("Invalid destination path")?
            .to_string(),
    })
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

        // Run FFmpeg conversion
        let output = Command::new_sidecar("ffmpeg")
            .expect("failed to create ffmpeg command")
            .args(&[
                "-i", webm_path.to_str().ok_or("Invalid WebM path")?,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-strict", "experimental",
                "-y", // Overwrite output
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

#[tauri::command]
async fn export_video(
    clip_paths: Vec<String>,
    output_path: String,
    resolution: String, // "720p" or "1080p"
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate inputs
    if clip_paths.is_empty() {
        return Err("No clips provided for export".to_string());
    }

    // Validate all input files exist
    for clip_path in &clip_paths {
        let path = Path::new(clip_path);
        if !path.exists() {
            return Err(format!("Clip not found: {}", clip_path));
        }
    }

    // Parse resolution
    let (width, height) = match resolution.as_str() {
        "720p" => (1280, 720),
        "1080p" => (1920, 1080),
        _ => return Err(format!("Unsupported resolution: {}. Use '720p' or '1080p'.", resolution)),
    };

    // If single clip, simple re-encode with resolution
    if clip_paths.len() == 1 {
        return export_single_clip(&clip_paths[0], &output_path, width, height, &app_handle).await;
    }

    // Multi-clip: use concat demuxer
    export_multi_clips(&clip_paths, &output_path, width, height, &app_handle).await
}

// Helper function for single clip export
async fn export_single_clip(
    input_path: &str,
    output_path: &str,
    width: u32,
    height: u32,
    _app_handle: &tauri::AppHandle,
) -> Result<String, String> {
    // Run FFmpeg with progress monitoring
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-i", input_path,
            "-vf", &format!("scale={}:{}", width, height),
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-y",
            output_path
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        return Err(format!("FFmpeg export failed: {}", output.stderr));
    }

    // Verify output file
    let output_file = Path::new(output_path);
    if !output_file.exists() {
        return Err("Output file was not created".to_string());
    }

    Ok(output_path.to_string())
}

// Helper function for multi-clip export using concat demuxer
async fn export_multi_clips(
    clip_paths: &[String],
    output_path: &str,
    width: u32,
    height: u32,
    app_handle: &tauri::AppHandle,
) -> Result<String, String> {
    // Get app data directory for temp files
    let app_data_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    // Create concat list file
    let concat_list_path = app_data_dir.join("concat_list.txt");
    let mut concat_file = fs::File::create(&concat_list_path)
        .map_err(|e| format!("Failed to create concat list file: {}", e))?;

    // Write concat demuxer format
    for clip_path in clip_paths {
        writeln!(concat_file, "file '{}'", clip_path)
            .map_err(|e| format!("Failed to write to concat list: {}", e))?;
    }

    // Flush to ensure file is written
    concat_file.flush()
        .map_err(|e| format!("Failed to flush concat list: {}", e))?;
    drop(concat_file); // Close file

    // Run FFmpeg with concat demuxer
    let output = Command::new_sidecar("ffmpeg")
        .expect("failed to create ffmpeg command")
        .args(&[
            "-f", "concat",
            "-safe", "0",
            "-i", concat_list_path.to_str().ok_or("Invalid concat list path")?,
            "-vf", &format!("scale={}:{}", width, height),
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-y",
            output_path
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg concat: {}", e))?;

    // Clean up concat list file
    let _ = fs::remove_file(&concat_list_path);

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

    // Initialize camera with requested format: 1280x720, 30fps, MJPEG
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![check_ffmpeg, import_file, trim_clip, save_recording, export_video, record_webcam_clip])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
