# ClipForge

ClipForge is a desktop video editing application built with Tauri and Preact (React-compatible). It provides a modern interface for importing, trimming, arranging, and exporting video clips. The application supports multi-track timelines, preview playback, and workspace persistence.

## Features

- Video clip import and management
- Multi-track timeline editing
- Trim and cut video segments
- Real-time preview with playhead controls
- Workspace saving and loading
- Export to various video formats
- Cross-platform desktop application (macOS, Windows)

## Prerequisites

Before running ClipForge, ensure you have the following installed:

- Node.js (version 18 or higher)
- pnpm (package manager)
- FFmpeg (required for video processing)
- Rust (required for Tauri backend)
- Tauri CLI

### Installing FFmpeg

FFmpeg is required for video import, trimming, and export functionality.

#### macOS
```bash
# Using Homebrew
brew install ffmpeg
```

#### Windows
Download FFmpeg from the official website and add it to your system PATH.

#### Linux
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

### FFmpeg Integration

ClipForge includes a comprehensive FFmpeg builder utility (`src-tauri/src/utils/ffmpeg.rs`) that centralizes all video processing operations:

#### Key Features

- **Fluent Builder API**: Chain methods for building complex FFmpeg commands
- **Centralized Operations**: All FFmpeg usage now goes through the builder for consistency
- **Automatic Binary Management**: Binaries are downloaded and cached during CI/CD builds
- **Cross-Platform Support**: Supports macOS ARM64, macOS x64, Windows x64, and Linux x64
- **Progress Monitoring**: Real-time progress updates for long-running operations via Tauri events
- **Comprehensive Error Handling**: Detailed error types with user-friendly messages

#### Supported Operations

- **Video Trimming**: Precise start/duration trimming with seek optimization
- **Format Conversion**: WebM→MP4 with automatic dimension adjustment for MP4 compatibility
- **Thumbnail Generation**: Extract thumbnails at specific timestamps with scaling
- **Multi-Clip Concatenation**: Combine multiple clips using FFmpeg concat demuxer
- **Raw Video Encoding**: Process raw RGB frames from webcam capture
- **Stream Copy**: Fast operations without re-encoding when possible

#### Builder Usage Examples

```rust
use utils::ffmpeg::FfmpegBuilder;

// Basic video trimming
let result = FfmpegBuilder::new()
    .input("input.mp4")
    .trim(10.0, 5.0)  // Start at 10s, duration 5s
    .output("output.mp4")
    .run(&app_handle);

// Thumbnail extraction with progress
let result = FfmpegBuilder::new()
    .input("video.mp4")
    .thumbnail(15.0)  // Extract at 15 seconds
    .scale(320, Some(180))
    .output("thumbnail.jpg")
    .run_with_progress(&app_handle, None)
    .await;

// Multi-clip concatenation
let result = FfmpegBuilder::new()
    .concat("clips.txt")  // FFmpeg concat file
    .stream_copy()        // Fast concatenation
    .output("final.mp4")
    .run_with_progress(&app_handle, Some(total_duration))
    .await;
```

#### Binary Management

FFmpeg binaries are automatically managed via `src-tauri/binaries/download.sh`:
- Downloads platform-specific binaries with checksum verification
- Supports version pinning for reproducible builds
- Integrated with GitHub Actions CI/CD for caching
- Automatic manifest generation for dependency tracking

The builder automatically falls back to system FFmpeg if bundled binaries are unavailable.

### Installing Rust

```bash
# Install Rust using rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd clipforge
```

2. Install dependencies:
```bash
pnpm install
```

3. Install Tauri dependencies:
```bash
pnpm run tauri
```

## Development

### Running in Development Mode

The project supports two frontend configurations: Preact (React-compatible) and Elm. By default, it uses the Preact frontend.

#### Preact Frontend (Default)
```bash
# Start the development server
pnpm run dev
```

The application will be available at `http://localhost:1420`.

#### Tauri Development Mode (Preact)
```bash
# Start Tauri development with React frontend
pnpm run tauri:react
```

This launches the desktop application with hot reloading.

#### Elm Frontend
> **Note:** The Elm frontend is currently stale and not up-to-date with the latest features and bug fixes. The Preact frontend is the actively maintained and recommended option.

```bash
# Switch to Elm frontend
pnpm run use-elm

# Start Elm development server
pnpm run dev:elm
```

#### Tauri Development Mode (Elm)
```bash
# Start Tauri development with Elm frontend
pnpm run tauri:elm
```

### Project Structure

```
clipforge/
├── public/                 # Static assets (logos, favicon)
├── src/                    # Preact (React-compatible) frontend
│   ├── components/         # UI components
│   │   ├── controls.tsx    # Playback and timeline controls
│   │   ├── header.tsx      # Application header
│   │   ├── preview.tsx     # Video preview player
│   │   └── timeline.tsx    # Timeline editing interface
│   ├── lib/                # Utility functions
│   ├── store/              # Zustand state management
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Tauri backend
│   ├── src/                # Rust source code
│   ├── icons/              # Application icons
│   └── tauri.conf.json     # Tauri configuration
├── frontend/               # Alternative frontend directory
└── .taskmaster/            # Task management system
```

### Frontend Architecture

#### Preact Frontend
- State Management: Zustand for global application state
- UI Components: Custom components with Tailwind CSS styling
- Video Player: Plyr for preview playback
- Timeline: Fabric.js for interactive timeline canvas
- Styling: Tailwind CSS with component variants

#### Elm Frontend (Alternative)
- Located in `src-tauri/frontend/`
- Functional reactive programming approach
- Separate build configuration

### Backend Architecture

The Tauri backend handles:

- File System Operations: Video import, workspace persistence
- FFmpeg Integration: Video processing and export
- IPC Communication: Frontend-backend messaging
- Binary Management: FFmpeg and FFProbe binaries

## Building for Production

### Building the Web Application
```bash
# Build Preact frontend
pnpm run build
```

### Building the Desktop Application

#### macOS
```bash
# Build for current architecture (Apple Silicon)
pnpm run build:mac

# Build universal binary (Intel + Apple Silicon)
pnpm run build:mac-universal
```

#### Windows
```bash
# Build for Windows (requires Windows environment)
pnpm run build:win
```

#### All Platforms
```bash
# Build for all platforms (macOS only)
pnpm run build:all
```

The built application will be located in `src-tauri/target/release/`.

## Configuration

### Tauri Configuration

The Tauri configuration is located in `src-tauri/tauri.conf.json`. Key settings:

- Dev Path: `http://localhost:1420` (React) or `http://localhost:5173` (Elm)
- Bundle Identifier: `com.clipforge.dev`
- Window Size: 800x600 pixels
- Icons: Custom Film icon set for all platforms

### Environment Variables

Set the following environment variables for development:

```bash
# API keys for external services (if needed)
VITE_API_KEY=your-api-key

# Tauri development
TAURI_DEBUG=true
```

### Task Management

The project uses Task Master AI for development workflow management:

- Task Database: `.taskmaster/tasks/tasks.json`
- Documentation: `.taskmaster/docs/`
- Reports: `.taskmaster/reports/`

Commands:
```bash
# List tasks
task-master list

# Get next task
task-master next

# Show task details
task-master show <id>

# Mark task complete
task-master set-status --id=<id> --status=done
```

## Usage

### Importing Videos

1. Click the Import button in the header
2. Select video files from your system
3. Clips appear in the timeline

### Timeline Editing

- Drag clips to rearrange on the timeline
- Trim clips by dragging the start/end handles
- Multi-track support for layering clips
- Zoom controls for timeline navigation

### Preview and Playback

- Playhead shows current playback position
- Preview window displays the current composition
- Playback controls in the bottom panel
- Frame-accurate scrubbing with timeline interaction

### Exporting

1. Click the Export button in the header
2. Configure export settings (format, quality, resolution)
3. Select output location
4. Monitor export progress in the progress bar

## Keyboard Shortcuts

- Space: Play/Pause
- Left Arrow: Previous frame
- Right Arrow: Next frame
- I: Set in-point (trim start)
- O: Set out-point (trim end)
- Ctrl+Z: Undo
- Ctrl+Y: Redo
- +: Zoom in timeline
- -: Zoom out timeline

## Troubleshooting

### FFmpeg Not Found

If you see "FFmpeg not found" error:

1. Verify FFmpeg installation: `ffmpeg -version`
2. Ensure FFmpeg is in your system PATH
3. Restart the development server

### Port Already in Use

If port 1420 is occupied:

```bash
# Kill existing Vite processes
pkill -f vite

# Or change the port in vite.config.js
```

### Tauri Build Errors

Common Tauri issues:

1. Rust version mismatch: Update Rust with `rustup update`
2. Missing dependencies: Install system dependencies for your platform
3. Icon generation: Ensure all icon files exist in `src-tauri/icons/`

### Video Import Issues

- Ensure video files are in supported formats (MP4, MOV, AVI, etc.)
- Check file permissions and disk space
- Verify FFmpeg can read the file: `ffprobe input.mp4`

## Contributing

### Development Workflow

1. Setup development environment (see Installation section)
2. Review tasks using Task Master: `task-master list`
3. Work on next available task: `task-master next`
4. Update task progress: `task-master update-subtask --id=<id> --prompt="progress notes"`
5. Mark complete: `task-master set-status --id=<id> --status=done`

### Code Style

- Follow existing component patterns
- Use TypeScript for type safety
- Maintain consistent Tailwind class naming
- Write unit tests for new features
- Document complex logic with comments

### Testing

#### Running Tests
```bash
# Run all tests (Rust backend)
cd clipforge/src-tauri
cargo test

# Run with verbose output
cargo test -- --nocapture
```

#### Test Coverage
- **Unit Tests**: FFmpeg builder argument construction, error handling
- **Integration Tests**: End-to-end video processing workflows
- **Mock Dependencies**: Tauri AppHandle, external binaries

Test files are located in:
- `src-tauri/tests/` - Integration tests
- Inline unit tests in source files

### Pull Request Guidelines

1. Ensure all tests pass
2. Update documentation if needed
3. Reference relevant task IDs in commit messages
4. Test on multiple platforms if applicable
5. Keep commits focused on single features

## Architecture

### Frontend (Preact)

State Management:
- Global state managed with Zustand
- Clip data, timeline state, playback controls
- Workspace persistence through Tauri IPC

Component Hierarchy:
```
App
├── Header (Import, Export, Controls)
├── Preview (Video Player)
├── Controls (Playback, Zoom)
└── Timeline (Canvas-based editing)
```

Key Components:
- Timeline: Fabric.js canvas for clip arrangement
- Preview: Plyr video player with custom controls
- ClipStore: Zustand store for application state

### Backend (Rust/Tauri)

Core Commands:
- save_workspace: Serialize and save application state
- load_workspace: Deserialize and restore state
- check_ffmpeg: Verify FFmpeg availability
- import_video: Extract video metadata and thumbnails

File Structure:
```
src-tauri/src/
├── lib.rs          # Main entry point
├── commands.rs     # IPC command handlers
├── state.rs        # Workspace serialization
└── ffmpeg.rs       # Video processing utilities
```

### Data Flow

1. Import: File dialog → FFmpeg metadata → Clip objects
2. Timeline: User interactions → Canvas updates → State changes
3. Preview: Timeline state → Video composition → Plyr playback
4. Export: Timeline composition → FFmpeg processing → Output file

## API Reference

### Frontend Store (Zustand)

```typescript
interface ClipStore {
  clips: Clip[];
  playhead: number;
  isPlaying: boolean;
  zoom: number;
  selectedClipId: string | null;
  exportProgress: number;
  error: string | null;

  // Actions
  addClip(clip: Clip): void;
  updateClip(id: string, updates: Partial<Clip>): void;
  removeClip(id: string): void;
  setPlayhead(time: number): void;
  setPlaying(playing: boolean): void;
  setZoom(zoom: number): void;
  setSelectedClip(id: string): void;
  setError(error: string): void;
  setExportProgress(progress: number): void;
}
```

### Tauri Commands

```rust
#[tauri::command]
async fn save_workspace(state_json: String) -> Result<(), String>

#[tauri::command]
async fn load_workspace() -> Result<String, String>

#[tauri::command]
async fn check_ffmpeg() -> Result<String, String>

#[tauri::command]
async fn import_video(path: String) -> Result<ClipMetadata, String>
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Support

For support and questions:

- Check the Issues page
- Review the Task Master documentation (.taskmaster/)
- Consult the Tauri documentation (https://tauri.app/)
- Refer to the FFmpeg documentation (https://ffmpeg.org/documentation.html)

## Roadmap

### Next Features
- Advanced effects and transitions
- Audio track support
- Keyframe animation
- Multiple export presets
- Project templates
- Cloud sync integration

### Planned Improvements
- Performance optimization for large projects
- Better undo/redo implementation
- Plugin architecture
- Mobile companion app
- Collaboration features

---
ClipForge - Professional video editing made simple