# ClipForge Frontend Switching Guide

ClipForge now supports **two frontend implementations** that share the same Tauri Rust backend:

1. **Preact Frontend** (Default) - Located at `clipforge/src/`
2. **Elm Frontend** - Located at `clipforge/src-tauri/frontend/`

Both frontends provide the same video editing functionality but use different technologies.

---

## Quick Start

### Switch to Elm Frontend

```bash
cd clipforge
pnpm run use-elm
```

### Switch to React Frontend

```bash
cd clipforge
pnpm run use-react
```

---

## Running the Application

### Option 1: Run with Tauri (Desktop App)

**Preact Frontend:**
```bash
cd clipforge
pnpm run tauri:react
```

**Elm Frontend:**
```bash
cd clipforge
# First terminal: Start Elm dev server
pnpm run dev:elm

# Second terminal: Start Tauri
pnpm run tauri:elm
```

### Option 2: Run Frontend Only (Browser)

**Preact Frontend:**
```bash
cd clipforge
pnpm run dev
# Open http://localhost:1420
```

**Elm Frontend:**
```bash
cd clipforge
pnpm run dev:elm
# Open http://localhost:5173
```

---

## How It Works

### Configuration Files

The project uses multiple Tauri configuration files:

- `src-tauri/tauri.conf.json` - Active configuration (generated, do not edit directly)
- `src-tauri/tauri.conf.react.json` - React frontend configuration template
- `src-tauri/tauri.conf.elm.json` - Elm frontend configuration template

### NPM Scripts

| Script | Description |
|--------|-------------|
| `pnpm run use-react` | Switch active config to React (port 1420) |
| `pnpm run use-elm` | Switch active config to Elm (port 5173) |
| `pnpm run dev:elm` | Start Elm dev server only |
| `pnpm run tauri:react` | Switch to React and start Tauri |
| `pnpm run tauri:elm` | Switch to Elm and start Tauri |

---

## Frontend Comparison

### Preact Frontend

**Location:** `clipforge/src/`
**Port:** 1420
**Tech Stack:**
- Preact (React-compatible)
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Fabric.js (canvas)
- Plyr (video player)

**Pros:**
- Familiar React ecosystem (Preact-compatible)
- Rich component libraries
- TypeScript support
- Fast development with HMR
- Smaller bundle size than React

### Elm Frontend

**Location:** `clipforge/src-tauri/frontend/`
**Port:** 5173
**Tech Stack:**
- Elm 0.19.1
- Vite
- Tailwind CSS
- elm-canvas
- The Elm Architecture (TEA)

**Pros:**
- 100% type-safe, no runtime errors
- Pure functional programming
- Excellent refactoring support
- Immutable data structures
- Built-in performance optimizations

**Features:**
- Two-track timeline (main + PiP)
- Clip splitting at playhead
- Zoom controls (2x to 50x)
- Snap-to-grid (0.5s intervals)
- Visual grid lines
- Canvas-based rendering

---

## Directory Structure

```
clipforge/
├── src/                         # React/Preact frontend
│   ├── components/
│   ├── hooks/
│   ├── App.jsx
│   └── main.jsx
├── src-tauri/
│   ├── frontend/                # Elm frontend
│   │   ├── src/
│   │   │   ├── Main.elm        # ~970 lines
│   │   │   ├── main.js         # ~342 lines
│   │   │   └── index.css       # ~257 lines
│   │   ├── elm.json
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── src/                     # Shared Rust backend
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── tauri.conf.json          # Active config (generated)
│   ├── tauri.conf.react.json   # React template
│   └── tauri.conf.elm.json     # Elm template
├── package.json                 # Root package with switch scripts
└── vite.config.js              # React build config
```

---

## Backend Integration

Both frontends communicate with the **same Rust backend** via Tauri's invoke system.

### Shared Tauri Commands

Both frontends use these backend functions:

1. `import_file(path, dest)` - Import video with metadata
2. `trim_clip(input, output, start, end)` - Trim video clips
3. `export_video(inputs, output, resolution)` - Export final video
4. `record_webcam_clip(output, duration)` - Record from webcam
5. `save_recording(path, data)` - Save screen recordings

### Port Communication (Elm)

The Elm frontend uses ports for Tauri communication:

**Outgoing (Elm → JavaScript → Tauri):**
- `requestImport` - Trigger file dialog
- `setVideoTime` - Seek video
- `playVideo` / `pauseVideo` - Control playback
- `trimClip` - Request trim operation
- `exportVideo` - Request export
- `recordWebcam` / `recordScreen` - Recording

**Incoming (Tauri → JavaScript → Elm):**
- `clipImported` - Video metadata received
- `videoTimeUpdate` - Playback position updates
- `exportProgress` - Export progress (0-100)
- `recordingComplete` - Recording finished

---

## Development Workflow

### Starting Fresh

```bash
# Clone and install
git clone <repo>
cd dt_video/clipforge

# Install dependencies for both frontends
pnpm install                      # React dependencies
cd src-tauri/frontend && pnpm install  # Elm dependencies
cd ../..

# Choose your frontend
pnpm run use-react               # or use-elm
pnpm run tauri dev
```

### Switching During Development

1. Stop any running dev servers
2. Run `pnpm run use-react` or `pnpm run use-elm`
3. Restart with `pnpm run tauri dev`

### Building for Production

**Preact:**
```bash
pnpm run use-react
pnpm run tauri build
```

**Elm:**
```bash
pnpm run use-elm
pnpm run tauri build
```

---

## Troubleshooting

### Port Already in Use

If you get "port in use" errors:

```bash
# Kill processes on React port
lsof -ti:1420 | xargs kill -9

# Kill processes on Elm port
lsof -ti:5173 | xargs kill -9
```

### Config Not Switching

Verify the active config:
```bash
cat src-tauri/tauri.conf.json | grep devPath
# React: "devPath": "http://localhost:1420"
# Elm: "devPath": "http://localhost:5173"
```

### Elm Compilation Errors

```bash
cd src-tauri/frontend
npx elm make src/Main.elm --output=/dev/null
```

### Preact Build Errors

```bash
cd clipforge
pnpm run build
```

---

## Testing

### Manual Testing Checklist

For both frontends, verify:

- [ ] Video import works
- [ ] Timeline displays correctly
- [ ] Video playback syncs with timeline
- [ ] Trim functionality works
- [ ] Export produces valid video
- [ ] Webcam recording works
- [ ] Screen recording works
- [ ] Two-track timeline (Elm only)
- [ ] Clip splitting (Elm only)
- [ ] Zoom controls (Elm only)

---

## Documentation

- **Elm Implementation:** See `IMPLEMENTATION_LOG_A.md` and `IMPLEMENTATION_LOG_B.md`
- **Tauri Integration:** See `TAURI_INTEGRATION_GUIDE.md`
- **Task Tracking:** See `.taskmaster/tasks/task_*_elm.txt`

---

## Contributing

When contributing:

1. Specify which frontend your changes target
2. Test both frontends if modifying Rust backend
3. Update this guide if adding new features
4. Maintain backward compatibility with both frontends

---

**Last Updated:** 2025-10-28
**Branch:** reconnect
**Maintained By:** Claude Code
