use std::env;
use std::path::PathBuf;

fn main() {
    // Run the default Tauri build
    tauri_build::build();

    // Get the target triple (e.g., "x86_64-pc-windows-msvc", "aarch64-apple-darwin")
    let target = env::var("TARGET").unwrap();

    // Determine the source binaries based on target platform
    let (ffmpeg_src, ffprobe_src) = if target.contains("windows") {
        (
            "binaries/ffmpeg-x86_64-pc-windows-msvc.exe",
            "binaries/ffprobe-x86_64-pc-windows-msvc.exe",
        )
    } else if target.contains("apple-darwin") {
        if target.contains("aarch64") {
            (
                "binaries/ffmpeg-aarch64-apple-darwin",
                "binaries/ffprobe-aarch64-apple-darwin",
            )
        } else {
            // x86_64 macOS - for now use aarch64 or add separate binary
            (
                "binaries/ffmpeg-aarch64-apple-darwin",
                "binaries/ffprobe-aarch64-apple-darwin",
            )
        }
    } else if target.contains("linux") {
        (
            "binaries/ffmpeg-x86_64-unknown-linux-gnu",
            "binaries/ffprobe-x86_64-unknown-linux-gnu",
        )
    } else {
        panic!("Unsupported target platform: {}", target);
    };

    println!("cargo:rerun-if-changed={}", ffmpeg_src);
    println!("cargo:rerun-if-changed={}", ffprobe_src);

    // Verify source binaries exist
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let ffmpeg_src_path = manifest_dir.join(ffmpeg_src);
    let ffprobe_src_path = manifest_dir.join(ffprobe_src);

    if !ffmpeg_src_path.exists() {
        panic!(
            "FFmpeg binary not found for target {}: {}",
            target,
            ffmpeg_src_path.display()
        );
    }

    if !ffprobe_src_path.exists() {
        panic!(
            "FFprobe binary not found for target {}: {}",
            target,
            ffprobe_src_path.display()
        );
    }

    println!("cargo:warning=Using FFmpeg from: {}", ffmpeg_src_path.display());
    println!("cargo:warning=Using FFprobe from: {}", ffprobe_src_path.display());
    println!("cargo:warning=Target platform: {}", target);
}
