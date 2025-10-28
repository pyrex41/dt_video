# FFmpeg Binaries for ClipForge

This directory contains FFmpeg and FFprobe static binaries for different platforms.

## Download Sources

### macOS ARM64 (Apple Silicon)
- **Source**: https://ffmpeg.martin-riedl.de/
- **FFmpeg**: https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip
- **FFprobe**: https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip

### Windows x64
- **Source**: https://ffbinaries.com/downloads
- **FFmpeg**: https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip
- **FFprobe**: https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip

## Manual Download Instructions

### macOS (Apple Silicon)
```bash
cd clipforge/src-tauri/binaries

# Download FFmpeg
curl -L https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip -o ffmpeg-macos-arm64.zip
unzip ffmpeg-macos-arm64.zip
mv ffmpeg ffmpeg-aarch64-apple-darwin
chmod +x ffmpeg-aarch64-apple-darwin

# Download FFprobe
curl -L https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffprobe.zip -o ffprobe-macos-arm64.zip
unzip ffprobe-macos-arm64.zip
mv ffprobe ffprobe-aarch64-apple-darwin
chmod +x ffprobe-aarch64-apple-darwin

# Cleanup
rm *.zip
```

### Windows x64
```powershell
cd clipforge/src-tauri/binaries

# Download FFmpeg
curl -L https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip -o ffmpeg-win-64.zip
unzip ffmpeg-win-64.zip
mv ffmpeg.exe ffmpeg-x86_64-pc-windows-msvc.exe

# Download FFprobe
curl -L https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip -o ffprobe-win-64.zip
unzip ffprobe-win-64.zip
mv ffprobe.exe ffprobe-x86_64-pc-windows-msvc.exe

# Cleanup
rm *.zip
```

## Development Note

For development on macOS, the system-installed FFmpeg can be used:
```bash
brew install ffmpeg
```

The Tauri sidecar commands will automatically use system FFmpeg if the bundled binaries are not available during development.

## Expected File Names

Tauri expects binaries to follow this naming convention:
- `ffmpeg-aarch64-apple-darwin` (macOS ARM64)
- `ffprobe-aarch64-apple-darwin` (macOS ARM64)
- `ffmpeg-x86_64-pc-windows-msvc.exe` (Windows x64)
- `ffprobe-x86_64-pc-windows-msvc.exe` (Windows x64)

## Verification

Test the binaries:
```bash
./ffmpeg-aarch64-apple-darwin -version
./ffprobe-aarch64-apple-darwin -version
```

## License

FFmpeg is licensed under the LGPL or GPL depending on configuration. See: https://ffmpeg.org/legal.html
