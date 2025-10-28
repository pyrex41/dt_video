#!/bin/bash
set -e

echo "Downloading FFmpeg binaries for ClipForge..."
cd "$(dirname "$0")"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

download_macos_arm64() {
    echo "Downloading macOS ARM64 binaries..."

    # Download FFmpeg
    echo "  - Downloading ffmpeg..."
    curl -L https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip -o ffmpeg-macos-arm64.zip
    unzip -q ffmpeg-macos-arm64.zip
    mv ffmpeg ffmpeg-aarch64-apple-darwin
    chmod +x ffmpeg-aarch64-apple-darwin
    rm ffmpeg-macos-arm64.zip

    # Download FFprobe
    echo "  - Downloading ffprobe..."
    curl -L https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip -o ffprobe-macos-arm64.zip
    unzip -q ffprobe-macos-arm64.zip
    mv ffprobe ffprobe-aarch64-apple-darwin
    chmod +x ffprobe-aarch64-apple-darwin
    rm ffprobe-macos-arm64.zip

    echo "✓ macOS ARM64 binaries downloaded successfully"
}

download_windows_x64() {
    echo "Downloading Windows x64 binaries..."

    # Download FFmpeg
    echo "  - Downloading ffmpeg..."
    curl -L https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip -o ffmpeg-win-64.zip
    unzip -q ffmpeg-win-64.zip
    mv ffmpeg.exe ffmpeg-x86_64-pc-windows-msvc.exe
    rm ffmpeg-win-64.zip

    # Download FFprobe
    echo "  - Downloading ffprobe..."
    curl -L https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip -o ffprobe-win-64.zip
    unzip -q ffprobe-win-64.zip
    mv ffprobe.exe ffprobe-x86_64-pc-windows-msvc.exe
    rm ffprobe-win-64.zip

    echo "✓ Windows x64 binaries downloaded successfully"
}

# Main script
if [[ "$OS" == "Darwin" && "$ARCH" == "arm64" ]]; then
    echo "Detected: macOS ARM64"
    download_macos_arm64
    download_windows_x64  # Also download Windows for cross-compilation
else
    echo "Platform: $OS $ARCH"
    echo "This script supports downloading from macOS ARM64."
    echo "For other platforms, please download manually or use CI/CD."
    echo ""
    echo "Downloading both macOS ARM64 and Windows x64 binaries..."
    download_macos_arm64
    download_windows_x64
fi

echo ""
echo "All binaries downloaded successfully!"
echo ""
ls -lh ffmpeg* ffprobe* 2>/dev/null || echo "No binaries found"
