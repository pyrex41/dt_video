# ClipForge Build Guide

## Prerequisites

- Rust and Cargo (latest stable)
- Node.js and pnpm
- Platform-specific requirements:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: Build essentials

## FFmpeg Binaries

The project includes platform-specific FFmpeg binaries in `src-tauri/binaries/`:

- `ffmpeg-aarch64-apple-darwin` / `ffprobe-aarch64-apple-darwin` (macOS ARM)
- `ffmpeg-x86_64-pc-windows-msvc.exe` / `ffprobe-x86_64-pc-windows-msvc.exe` (Windows)
- `ffmpeg-x86_64-unknown-linux-gnu` / `ffprobe-x86_64-unknown-linux-gnu` (Linux)

These are automatically bundled based on the target platform during build.

## Development Build

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm run tauri dev
```

## Production Build

### macOS

```bash
# Build for macOS (current architecture)
pnpm run tauri build

# Build for specific architecture
pnpm run tauri build -- --target aarch64-apple-darwin  # Apple Silicon
pnpm run tauri build -- --target x86_64-apple-darwin   # Intel Mac
```

**Output**: `src-tauri/target/release/bundle/macos/ClipForge.app`

### Windows (Cross-compilation from macOS/Linux)

```bash
# Install Windows target
rustup target add x86_64-pc-windows-msvc

# Build for Windows
pnpm run tauri build -- --target x86_64-pc-windows-msvc
```

**Output**: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/ClipForge_0.1.0_x64_en-US.msi`

### Linux

```bash
# Build for Linux
pnpm run tauri build

# Or for specific target
pnpm run tauri build -- --target x86_64-unknown-linux-gnu
```

**Output**: `src-tauri/target/release/bundle/appimage/ClipForge_0.1.0_amd64.AppImage`

## Code Signing

### macOS

For distribution outside the App Store, you'll need:

1. Apple Developer account
2. Developer ID Application certificate

Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "providerShortName": "TEAM_ID"
    }
  }
}
```

### Windows

For signed Windows builds:

1. Obtain a code signing certificate
2. Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

## Troubleshooting

### FFmpeg Binary Not Found

If you see "Binary 'ffmpeg' not found" errors:

1. Verify binaries exist in `src-tauri/binaries/`
2. Check permissions: `chmod +x src-tauri/binaries/ffmpeg-*`
3. Ensure correct platform binary is present for your build target

### Build Fails on Windows Cross-Compilation

Windows cross-compilation from macOS/Linux requires additional setup:

```bash
# Install cross-compilation tools
cargo install cross

# Use cross instead of cargo
cross build --target x86_64-pc-windows-msvc --release
```

### macOS Notarization

For notarized builds:

```bash
# After building
xcrun notarytool submit src-tauri/target/release/bundle/macos/ClipForge.app \
  --apple-id your@email.com \
  --password APP_SPECIFIC_PASSWORD \
  --team-id TEAM_ID

# Staple the ticket
xcrun stapler staple src-tauri/target/release/bundle/macos/ClipForge.app
```

## CI/CD

See `.github/workflows/build.yml` for automated build configuration.
