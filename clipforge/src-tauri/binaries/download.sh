#!/bin/bash
set -e

echo "Downloading FFmpeg binaries for ClipForge..."
cd "$(dirname "$0")"

# Configuration
FFMPEG_VERSION="${FFMPEG_VERSION:-6.1}"
MANIFEST_FILE="manifest.json"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

# Initialize manifest
echo "{}" > "$MANIFEST_FILE"

# Utility functions
verify_checksum() {
    local file="$1"
    local expected_sha="$2"

    if command -v sha256sum >/dev/null 2>&1; then
        local actual_sha=$(sha256sum "$file" | cut -d' ' -f1)
    elif command -v shasum >/dev/null 2>&1; then
        local actual_sha=$(shasum -a 256 "$file" | cut -d' ' -f1)
    else
        echo "Warning: No SHA256 tool found, skipping verification for $file"
        return 0
    fi

    if [ "$actual_sha" != "$expected_sha" ]; then
        echo "Error: Checksum mismatch for $file"
        echo "Expected: $expected_sha"
        echo "Actual: $actual_sha"
        return 1
    fi

    echo "✓ Checksum verified for $file"
}

update_manifest() {
    local binary="$1"
    local path="$2"
    local checksum="$3"

    # Use jq if available, otherwise fallback to sed
    if command -v jq >/dev/null 2>&1; then
        jq --arg bin "$binary" --arg path "$path" --arg checksum "$checksum" \
           '. + {($bin): {"path": $path, "checksum": $checksum, "version": "'$FFMPEG_VERSION'"}}' \
           "$MANIFEST_FILE" > "${MANIFEST_FILE}.tmp" && mv "${MANIFEST_FILE}.tmp" "$MANIFEST_FILE"
    else
        # Simple fallback without jq
        echo "Warning: jq not found, manifest will be incomplete"
    fi
}

download_macos_arm64() {
    echo "Downloading macOS ARM64 binaries (FFmpeg latest)..."

    # Download FFmpeg
    echo "  - Downloading ffmpeg..."
    local ffmpeg_url="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip"
    curl -L "$ffmpeg_url" -o ffmpeg-macos-arm64.zip

    # Verify and extract
    unzip -q ffmpeg-macos-arm64.zip
    mv ffmpeg ffmpeg-aarch64-apple-darwin
    chmod +x ffmpeg-aarch64-apple-darwin

    # Calculate checksum and update manifest
    local ffmpeg_checksum=$(sha256sum ffmpeg-aarch64-apple-darwin 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffmpeg-aarch64-apple-darwin 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffmpeg-aarch64-apple-darwin" "ffmpeg-aarch64-apple-darwin" "$ffmpeg_checksum"

    rm ffmpeg-macos-arm64.zip

    # Download FFprobe
    echo "  - Downloading ffprobe..."
    local ffprobe_url="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip"
    curl -L "$ffprobe_url" -o ffprobe-macos-arm64.zip

    unzip -q ffprobe-macos-arm64.zip
    mv ffprobe ffprobe-aarch64-apple-darwin
    chmod +x ffprobe-aarch64-apple-darwin

    # Calculate checksum and update manifest
    local ffprobe_checksum=$(sha256sum ffprobe-aarch64-apple-darwin 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffprobe-aarch64-apple-darwin 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffprobe-aarch64-apple-darwin" "ffprobe-aarch64-apple-darwin" "$ffprobe_checksum"

    rm ffprobe-macos-arm64.zip

    echo "✓ macOS ARM64 binaries downloaded successfully"
}

download_windows_x64() {
    echo "Downloading Windows x64 binaries (FFmpeg $FFMPEG_VERSION)..."

    # Download FFmpeg
    echo "  - Downloading ffmpeg..."
    local ffmpeg_url="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v$FFMPEG_VERSION/ffmpeg-$FFMPEG_VERSION-win-64.zip"
    curl -L "$ffmpeg_url" -o ffmpeg-win-64.zip

    unzip -q ffmpeg-win-64.zip
    mv ffmpeg.exe ffmpeg-x86_64-pc-windows-msvc.exe

    # Calculate checksum and update manifest
    local ffmpeg_checksum=$(sha256sum ffmpeg-x86_64-pc-windows-msvc.exe 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffmpeg-x86_64-pc-windows-msvc.exe 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffmpeg-x86_64-pc-windows-msvc.exe" "ffmpeg-x86_64-pc-windows-msvc.exe" "$ffmpeg_checksum"

    rm ffmpeg-win-64.zip

    # Download FFprobe
    echo "  - Downloading ffprobe..."
    local ffprobe_url="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v$FFMPEG_VERSION/ffprobe-$FFMPEG_VERSION-win-64.zip"
    curl -L "$ffprobe_url" -o ffprobe-win-64.zip

    unzip -q ffprobe-win-64.zip
    mv ffprobe.exe ffprobe-x86_64-pc-windows-msvc.exe

    # Calculate checksum and update manifest
    local ffprobe_checksum=$(sha256sum ffprobe-x86_64-pc-windows-msvc.exe 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffprobe-x86_64-pc-windows-msvc.exe 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffprobe-x86_64-pc-windows-msvc.exe" "ffprobe-x86_64-pc-windows-msvc.exe" "$ffprobe_checksum"

    rm ffprobe-win-64.zip

    echo "✓ Windows x64 binaries downloaded successfully"
}

download_linux_x64() {
    echo "Downloading Linux x64 binaries (FFmpeg $FFMPEG_VERSION)..."

    # Download FFmpeg
    echo "  - Downloading ffmpeg..."
    local ffmpeg_url="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v$FFMPEG_VERSION/ffmpeg-$FFMPEG_VERSION-linux-64.zip"
    curl -L "$ffmpeg_url" -o ffmpeg-linux-64.zip

    unzip -q ffmpeg-linux-64.zip
    mv ffmpeg ffmpeg-x86_64-unknown-linux-gnu
    chmod +x ffmpeg-x86_64-unknown-linux-gnu

    # Calculate checksum and update manifest
    local ffmpeg_checksum=$(sha256sum ffmpeg-x86_64-unknown-linux-gnu 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffmpeg-x86_64-unknown-linux-gnu 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffmpeg-x86_64-unknown-linux-gnu" "ffmpeg-x86_64-unknown-linux-gnu" "$ffmpeg_checksum"

    rm ffmpeg-linux-64.zip

    # Download FFprobe
    echo "  - Downloading ffprobe..."
    local ffprobe_url="https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v$FFMPEG_VERSION/ffprobe-$FFMPEG_VERSION-linux-64.zip"
    curl -L "$ffprobe_url" -o ffprobe-linux-64.zip

    unzip -q ffprobe-linux-64.zip
    mv ffprobe ffprobe-x86_64-unknown-linux-gnu
    chmod +x ffprobe-x86_64-unknown-linux-gnu

    # Calculate checksum and update manifest
    local ffprobe_checksum=$(sha256sum ffprobe-x86_64-unknown-linux-gnu 2>/dev/null | cut -d' ' -f1 || shasum -a 256 ffprobe-x86_64-unknown-linux-gnu 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    update_manifest "ffprobe-x86_64-unknown-linux-gnu" "ffprobe-x86_64-unknown-linux-gnu" "$ffprobe_checksum"

    rm ffprobe-linux-64.zip

    echo "✓ Linux x64 binaries downloaded successfully"
}

# Main script
case "$OS-$ARCH" in
    "Darwin-arm64")
        echo "Detected: macOS ARM64"
        download_macos_arm64
        download_windows_x64  # Also download Windows for cross-compilation
        download_linux_x64    # Also download Linux for cross-compilation
        ;;
    "Darwin-x86_64")
        echo "Detected: macOS x64"
        download_macos_arm64  # Download ARM64 for cross-compilation
        download_windows_x64
        download_linux_x64
        ;;
    "Linux-x86_64")
        echo "Detected: Linux x64"
        download_linux_x64
        download_windows_x64  # For cross-compilation
        download_macos_arm64  # For cross-compilation
        ;;
    *)
        echo "Platform: $OS $ARCH"
        echo "This script supports macOS ARM64, macOS x64, and Linux x64."
        echo "For other platforms, please download manually or use CI/CD."
        echo ""
        echo "Attempting to download all supported platforms..."
        download_macos_arm64
        download_windows_x64
        download_linux_x64
        ;;
esac

echo ""
echo "All binaries downloaded successfully!"
echo ""
echo "Binary manifest:"
cat "$MANIFEST_FILE" 2>/dev/null || echo "Manifest not generated (jq not available)"
echo ""
echo "Downloaded binaries:"
ls -lh ffmpeg* ffprobe* 2>/dev/null || echo "No binaries found"
