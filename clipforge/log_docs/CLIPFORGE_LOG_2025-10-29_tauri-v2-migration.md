# ClipForge Development Log - October 29, 2025
## Tauri v2 Migration & Configuration Fixes

### Session Summary
Complete migration from Tauri v1 to v2, resolving critical IPC communication issues and FFmpeg detection problems that prevented the app from running.

### Changes Made

#### Tauri v2 API Migration

**Package Updates:**
- Upgraded `@tauri-apps/api` from v1.5.0 to v2.9.0
- Added `@tauri-apps/plugin-dialog` v2.4.2 for file dialogs
- Updated Rust dependency `tauri-plugin-dialog` v2.0 in Cargo.toml

**Import Path Updates (across all source files):**
- Changed `@tauri-apps/api/tauri` → `@tauri-apps/api/core` for invoke/convertFileSrc
- Changed `@tauri-apps/api/dialog` → `@tauri-apps/plugin-dialog` for file dialogs
- Event imports from `@tauri-apps/api/event` remain unchanged

**Files Updated:**
- `src/App.tsx:4` - invoke import
- `src/components/export-button.tsx:7-8` - invoke and save dialog
- `src/components/import-button.tsx:4-5` - open dialog and invoke
- `src/components/media-library.tsx:4` - convertFileSrc and invoke
- `src/components/preview.tsx:7` - convertFileSrc
- `src/components/record-button.tsx:4` - invoke
- `src/components/save-button.tsx:4` - invoke
- `src/lib/workspace-persistence.ts:1` - invoke
- `src/lib/tauri-mock.ts:1-6` - mock imports
- `src/store/use-clip-store.ts:3` - invoke

**Rust Backend Updates:**
- Registered dialog plugin in `src-tauri/src/lib.rs:894` with `.plugin(tauri_plugin_dialog::init())`
- Added `tauri-plugin-dialog = "2.0"` dependency to `src-tauri/Cargo.toml:19`

#### Tauri Configuration Updates

**src-tauri/tauri.conf.json:**
- Added `"withGlobalTauri": true` under `app` section for IPC bridge initialization
- Restructured from v1 format to v2 format:
  - Moved `bundle`, `security`, `windows` under `app` key
  - Changed `devUrl` → `devPath`
  - Changed `frontendDist` → `distDir`
  - Removed deprecated `package` section
  - Simplified icon list

**Before (v1):**
```json
{
  "package": { ... },
  "build": { ... },
  "bundle": { ... }
}
```

**After (v2):**
```json
{
  "build": { ... },
  "app": {
    "withGlobalTauri": true,
    "security": { ... },
    "windows": [ ... ]
  },
  "bundle": { ... }
}
```

#### FFmpeg Detection Improvements

**src-tauri/src/utils/ffmpeg.rs:260-296:**
Enhanced `resolve_sidecar_binary()` to support dev mode:

1. First tries bundled binary in resource directory (production)
2. Falls back to `which` command to locate system binary in PATH
3. Logs INFO message when using system FFmpeg
4. Returns descriptive error if binary not found

**New Logic:**
```rust
// Check if binary exists in PATH using 'which' command
if let Ok(output) = std::process::Command::new("which")
    .arg(binary_name)
    .output() {
    if output.status.success() {
        let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path_str.is_empty() {
            eprintln!("INFO: Using system {} at {}", binary_name, path_str);
            return Ok(std::path::PathBuf::from(path_str));
        }
    }
}
```

This allows the app to use the system FFmpeg at `/Users/reuben/.nix-profile/bin/ffmpeg` during development.

**FFmpeg Binary Symlinks:**
- Created `src-tauri/binaries/ffmpeg` → `ffmpeg-aarch64-apple-darwin`
- Created `src-tauri/binaries/ffprobe` → `ffprobe-aarch64-apple-darwin`

These symlinks allow Tauri to find the correct platform-specific binaries.

#### Cargo.toml Configuration

**src-tauri/Cargo.toml:**
- Maintained `tauri = { version = "2.9.2", features = [] }` (empty features for v2)
- Added `tauri-plugin-dialog = "2.0"` for dialog support
- No `api-all` feature (doesn't exist in v2)

### Issues Resolved

#### 1. IPC Communication Error
**Error:** `TypeError: window.__TAURI_IPC__ is not a function`

**Root Cause:** Using Tauri v1 API (@tauri-apps/api v1.5.0) with Tauri v2 backend (2.9.2)

**Solution:**
1. Upgraded @tauri-apps/api to v2.9.0
2. Updated all imports to use new v2 paths (`/core` instead of `/tauri`)
3. Added `withGlobalTauri: true` to tauri.conf.json (though not strictly required in v2)

#### 2. FFmpeg Not Found Error
**Error:** App showed "FFmpeg not found. Please install FFmpeg to use ClipForge."

**Root Cause:** FFmpeg detection only checked bundled resources, which don't exist in dev mode

**Solution:** Enhanced binary resolution to:
1. Check bundled resources first (for production builds)
2. Fall back to system PATH using `which` command
3. Properly log when using system binary

#### 3. Dialog Import Errors
**Error:** `Failed to resolve import "@tauri-apps/api/dialog"`

**Root Cause:** In Tauri v2, dialog functionality moved to separate plugin

**Solution:**
1. Installed `@tauri-apps/plugin-dialog` npm package
2. Added `tauri-plugin-dialog` Rust dependency
3. Registered plugin in Tauri builder
4. Updated all dialog imports to use plugin path

### Technical Notes

**Tauri v1 vs v2 API Differences:**
- v1: `import { invoke } from "@tauri-apps/api/tauri"`
- v2: `import { invoke } from "@tauri-apps/api/core"`
- v1: `import { open } from "@tauri-apps/api/dialog"`
- v2: `import { open } from "@tauri-apps/plugin-dialog"`

**Backward Compatibility:**
The Tauri v2 API maintains backward compatibility for most import paths, but core functionality moved to `/core` for better modularity.

**Configuration Schema:**
Tauri v2 uses a flatter configuration structure with most app-specific settings under the `app` key rather than at the root level.

### Current Status

**Working:**
- ✅ Tauri v2 backend and frontend fully integrated
- ✅ IPC communication functional
- ✅ FFmpeg detection working with system binary
- ✅ File dialogs operational (import/export)
- ✅ Dev server running successfully
- ✅ All Rust compilation warnings are non-critical (unused structs)

**Pending Testing:**
- ⏳ Timeline responsive width on window resize
- ⏳ No duplicate video previews when moving clips
- ⏳ Horizontal scrolling and clip boundary behavior
- ⏳ Video import and thumbnail generation
- ⏳ Video export functionality

### Next Steps

1. **User Testing**
   - Import videos to test FFmpeg integration
   - Resize window to verify timeline responsiveness
   - Move clips between tracks to verify no Plyr duplication
   - Test horizontal scrolling behavior

2. **Code Cleanup**
   - Remove unused `Clip` and `WorkspaceState` structs (lib.rs:30, 40)
   - Clean up legacy helper scripts (fix-cargo.sh, fix-and-run.sh)
   - Remove `withGlobalTauri` if confirmed unnecessary in v2

3. **Documentation**
   - Update README with Tauri v2 setup instructions
   - Document FFmpeg binary requirements
   - Add migration guide for other developers

### Files Modified

**Frontend (17 files):**
- `package.json` - Updated @tauri-apps/api version
- `pnpm-lock.yaml` - Dependency lock updates
- `src/App.tsx` - API import updates
- `src/components/*.tsx` (7 files) - API import updates
- `src/lib/*.ts` (2 files) - API import updates
- `src/store/use-clip-store.ts` - API import updates

**Backend (6 files):**
- `src-tauri/Cargo.toml` - Added dialog plugin dependency
- `src-tauri/Cargo.lock` - Dependency lock updates (+487 lines)
- `src-tauri/tauri.conf.json` - v2 configuration format
- `src-tauri/src/lib.rs` - Registered dialog plugin
- `src-tauri/src/utils/ffmpeg.rs` - Enhanced binary resolution
- `src-tauri/binaries/*` - FFmpeg symlinks (untracked)

### Related Logs

- Previous session: `CLIPFORGE_LOG_2025-10-29_timeline-fixes.md` (timeline width & scroll clipping)

---

**Session Duration:** ~1.5 hours
**Primary Focus:** Tauri v2 migration and configuration fixes
**Status:** Dev server running, app functional, pending user testing
