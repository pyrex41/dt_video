# ClipForge

<div align="center">

![ClipForge](src-tauri/icons/film.svg)

**A Modern Desktop Video Editor Built with Tauri & React**

[![Tauri](https://img.shields.io/badge/Tauri-2.9.2-blue.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

[Features](#features) • [Getting Started](#getting-started) • [Usage](#usage) • [Development](#development) • [Architecture](#architecture)

</div>

---

## Overview

ClipForge is a lightweight, cross-platform desktop video editor designed for quick editing workflows. Built with modern web technologies (React, TypeScript, Tailwind CSS) and powered by Tauri and FFmpeg, it provides professional-grade video editing in a compact ~123 MB application.

### Key Highlights

- 🎬 **Multi-track timeline** with drag-and-drop clip management
- 📹 **Built-in recording** (webcam, screen, picture-in-picture)
- ✂️ **Precise trimming** with visual feedback
- 🎵 **Audio controls** with waveform visualization
- 💾 **Workspace persistence** - your edits are automatically saved
- 🚀 **Optimized bundle** - Only 123 MB with platform-specific FFmpeg binaries
- ⚡ **Fast performance** - Native desktop app with GPU acceleration

---

## Features

### Timeline Editing
- **Multi-track support** - Arrange clips across multiple tracks
- **Drag-and-drop** - Import and arrange clips intuitively
- **Visual trimming** - Adjust clip in/out points with handles
- **Precise playhead** - Frame-accurate seeking and positioning
- **Zoom and scroll** - Navigate large timelines easily
- **Keyboard shortcuts** - Space (play/pause), Delete (remove clip), arrows (seek)

### Recording
- **Webcam recording** - Capture from built-in or external cameras
- **Screen recording** - Record your entire screen or specific windows
- **Picture-in-Picture** - Combine screen and webcam in one recording
- **Audio mixing** - Mix system audio and microphone input
- **Real-time monitoring** - See recording duration and toggle audio

### Video Preview
- **Professional player** - Powered by Plyr with full playback controls
- **Smooth seeking** - Scrub through clips frame-by-frame
- **Playback controls** - Play, pause, volume, mute
- **Auto-scroll** - Timeline follows playhead during playback
- **Thumbnail previews** - Quick visual reference in media library

### Export & Processing
- **Multi-clip export** - Combine clips from timeline into final video
- **Real-time progress** - See FFmpeg processing status
- **Format support** - MP4, WebM, and more via FFmpeg
- **Quality options** - Control output bitrate and codec
- **Background processing** - Continue editing while exporting

### Media Library
- **Smart organization** - All imported clips in one place
- **Thumbnail generation** - Auto-generated preview images
- **Metadata display** - Duration, resolution, codec, file size
- **Search & filter** - Find clips by name, codec, resolution
- **Scrollable view** - Handles large media collections efficiently

### Workspace Management
- **Auto-save** - Work is saved automatically to disk
- **State persistence** - Resume exactly where you left off
- **Clip tracking** - Maintains file references and trim points
- **Playhead memory** - Restores playback position on launch

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **pnpm** (package manager)
- **Rust** 1.70+ (for Tauri development)
- **FFmpeg** (bundled with the app, or install separately for development)

### Installation

#### For Users (Pre-built Binaries)

1. Download the latest release for your platform:
   - **macOS**: `ClipForge.app` (~123 MB)
   - **Windows**: `ClipForge_setup.exe` (~TBD MB)
   - **Linux**: `ClipForge.AppImage` (~TBD MB)

2. Install and launch the application

#### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/clipforge.git
cd clipforge

# Install dependencies
pnpm install

# Install Rust dependencies
cd src-tauri
cargo build
cd ..

# Run development server
pnpm run tauri dev
```

---

## Usage

### Quick Start

1. **Import videos** - Click the import button or drag files into the media library
2. **Drag to timeline** - Drag clips from the library onto the timeline
3. **Edit** - Trim clips, adjust positions, arrange on multiple tracks
4. **Preview** - Use the video player to review your edits
5. **Export** - Click export to render your final video

### Recording Workflow

1. **Click record button** - Choose webcam, screen, or PiP mode
2. **Select audio device** - Choose your microphone from the dropdown
3. **Start recording** - Click to begin, click again to stop
4. **Auto-import** - Recording automatically appears in media library
5. **Edit & export** - Treat like any other clip

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Space` | Play/Pause |
| `Delete` / `Backspace` | Remove selected clip |
| `Escape` | Deselect clip |
| `←` / `→` | Seek backward/forward |
| `Cmd/Ctrl + C` | Copy selected clip |
| `Cmd/Ctrl + V` | Paste clip |

---

## Development

### Project Structure

```
clipforge/
├── src/                      # React frontend
│   ├── components/          # UI components
│   │   ├── timeline.tsx    # Multi-track timeline
│   │   ├── preview.tsx     # Video player
│   │   ├── record-button.tsx # Recording controls
│   │   └── media-library.tsx # Media management
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript definitions
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs        # Tauri app entry
│   │   └── lib.rs         # Core backend logic
│   ├── binaries/          # FFmpeg binaries
│   └── Cargo.toml         # Rust dependencies
├── log_docs/              # Development logs
└── docs/                  # Documentation
```

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS for styling
- Zustand for state management
- Fabric.js for canvas timeline
- Plyr for video playback

**Backend:**
- Tauri 2.9.2 (Rust)
- FFmpeg for video processing
- Tokio for async runtime

**Build Tools:**
- Vite (frontend bundler)
- Cargo (Rust build system)
- pnpm (package manager)

### Development Commands

```bash
# Start dev server (frontend + Tauri)
pnpm run tauri dev

# Frontend only (for rapid UI development)
pnpm run dev

# Build release
pnpm run tauri build

# Type check
pnpm run type-check

# Lint
pnpm run lint
```

### Testing

```bash
# Run frontend tests
pnpm run test

# Run Rust tests
cd src-tauri
cargo test
```

---

## Architecture

### State Management

ClipForge uses **Zustand** for centralized state management:

- **Clips store** - All video clips, positions, trim points
- **Playhead position** - Current timeline position
- **Zoom & scroll** - Timeline view state
- **Selected clip** - Active clip for editing

### Video Processing Pipeline

1. **Import** - Read file metadata with FFmpeg
2. **Thumbnail generation** - Extract frame for preview
3. **Timeline rendering** - Fabric.js canvas with visual clips
4. **Preview playback** - Plyr player with offset calculation
5. **Export** - FFmpeg concatenates and encodes clips

### Recording Architecture

```
User clicks record
  ↓
MediaRecorder API captures stream
  ↓
Audio mixing (if needed) via Web Audio API
  ↓
Blob chunks collected
  ↓
Convert to ArrayBuffer
  ↓
Save via Tauri invoke to Rust backend
  ↓
FFmpeg converts WebM → MP4
  ↓
Generate thumbnail
  ↓
Add to media library
```

### Bundle Optimization

ClipForge uses platform-specific resource bundling:

- **Separate configs** for macOS, Windows, Linux
- Each platform only bundles its FFmpeg binaries
- Rust compiler optimizations (LTO, size-focused)
- **Result:** 77% size reduction (536 MB → 123 MB)

---

## Performance

### Bundle Sizes

| Platform | Size | Contents |
|----------|------|----------|
| macOS | ~123 MB | FFmpeg (aarch64) + App |
| Windows | ~TBD MB | FFmpeg (x86_64) + App |
| Linux | ~TBD MB | FFmpeg (x86_64) + App |

### Optimizations

- **Platform-specific binaries** - No wasted space
- **Rust size optimization** - Minimal binary footprint
- **Frontend minification** - Vite production builds
- **Asset compression** - Efficient resource loading

---

## Configuration

### FFmpeg Binaries

FFmpeg binaries are bundled in `src-tauri/binaries/`:
- `ffmpeg-aarch64-apple-darwin` (macOS ARM)
- `ffmpeg-x86_64-pc-windows-msvc.exe` (Windows)
- `ffmpeg-x86_64-unknown-linux-gnu` (Linux)

Platform-specific configs determine which binaries are included in each build.

### Workspace Storage

User data is stored in:
- **macOS:** `~/Library/Application Support/com.clipforge.dev/`
- **Windows:** `%APPDATA%\com.clipforge.dev\`
- **Linux:** `~/.config/com.clipforge.dev/`

Files stored:
- `workspace.json` - Clip data, timeline state
- `thumbnails/` - Generated preview images

---

## Troubleshooting

### Common Issues

**FFmpeg not found**
- Check that FFmpeg binaries are in `src-tauri/binaries/`
- For development, install FFmpeg globally: `brew install ffmpeg` (macOS)

**Recording doesn't work**
- Grant camera/microphone permissions in system settings
- Check that audio device is selected in dropdown

**Video won't play**
- Ensure video codec is supported (H.264 recommended)
- Try converting file: `ffmpeg -i input.mov -c:v libx264 output.mp4`

**App crashes on startup**
- Check console for errors (`Cmd+Option+I` or `Ctrl+Shift+I`)
- Delete workspace file to reset state
- Report issue with logs attached

### Debug Mode

Enable debug logging:
1. Open DevTools (`Cmd+Option+I` or `Ctrl+Shift+I`)
2. Look for logs prefixed with `[ClipForge]`
3. Check Rust logs in terminal running `tauri dev`

---

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Build/tooling changes

---

## Roadmap

### Planned Features

- [ ] **Transitions** - Crossfades, wipes, and other effects
- [ ] **Text overlays** - Add titles and captions
- [ ] **Audio tracks** - Independent audio editing
- [ ] **Color grading** - Basic color correction tools
- [ ] **Effects** - Filters and video effects
- [ ] **Templates** - Pre-built project templates
- [ ] **Cloud sync** - Optional workspace backup
- [ ] **Plugins** - Extensibility system

### Future Optimizations

- [ ] Virtual scrolling for large media libraries
- [ ] WebGL-accelerated timeline rendering
- [ ] Hardware-accelerated encoding
- [ ] Proxy editing for 4K+ footage

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Tauri** - For the amazing desktop app framework
- **FFmpeg** - For powerful video processing
- **Plyr** - For the beautiful video player
- **Fabric.js** - For canvas rendering capabilities
- **Zustand** - For elegant state management

---

## Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/clipforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/clipforge/discussions)
- **Email**: support@clipforge.app

---

<div align="center">

**Made with ❤️ using Tauri, React, and FFmpeg**

[⬆ Back to Top](#clipforge)

</div>
