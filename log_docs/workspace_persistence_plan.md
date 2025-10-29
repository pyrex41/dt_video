### Plan for Workspace Persistence in ClipForge

**Current State Analysis**:
- **State Management**: `useClipStore` (Zustand) holds in-memory state: `clips[]` (with `id`, `path`, `start`, `end`, `name`, `duration`), `playhead`, `isPlaying`, `zoom`, `selectedClipId`. No persistence; resets on restart.
- **File Handling**: `import_file` copies originals to `$APPDATA/clips/` (e.g., `/Users/reuben/Library/Application Support/ClipForge/clips/`). `trim_clip` creates new files in specified paths (likely also in clips dir). Edits (trimming, timeline drags) update state but not files until export.
- **Persistence Gaps**: State lost on close/reopen. If originals moved/deleted, clips break. No auto-save of workspace.
- **Tauri Config**: `assetScope: ["$APPDATA/clips/**"]` allows frontend access to clips dir. No existing state commands in `lib.rs`.

**Proposed Solution** (Non-Destructive, Read-Only Planning):
1. **Backend (Rust/Tauri) Enhancements**:
   - Add `save_workspace` command: Serialize store state (JSON of clips, playhead, etc.) to `$APPDATA/ClipForge/workspace.json`. Include relative paths (e.g., "clips/filename.mp4") for portability.
   - Add `load_workspace` command: Read/parse `workspace.json`, return state object. Validate clips exist (check file paths); flag missing ones.
   - Add `list_clips` command: Scan `clips/` dir, return metadata (name, path, size) for recovery if workspace missing.
   - Temp Files for Edits: On trim/drag in timeline, auto-call `trim_clip` to create edited copies in `clips/edited/` subdir (create if needed). Update clip `path` to point to copy. Originals untouched until explicit save/export.
     - Example: Trim "original.mp4" → copy to "clips/edited/original_trimmed_123.mp4"; update state `path`.
   - Error Handling: If file missing on load, prompt recovery (scan originals or user re-import).
   - Security: Validate paths (no traversal); limit to app data dir.

2. **Frontend (React/Zustand) Enhancements**:
   - On App Mount (`App.tsx` useEffect): Invoke `load_workspace`; if valid, `useClipStore.setState(newState)` (merge clips, restore playhead/zoom/selection). Fallback: empty state or `list_clips` for partial recovery.
   - On Changes (add/update/remove clip, playhead move, trim): Debounce (e.g., 2s) and invoke `save_workspace` to persist.
   - On App Close/Blur: Invoke `save_workspace` (use Tauri window event listener).
   - Temp Copy Logic: In `updateClip` (timeline drags), if `start/end` changed > threshold, trigger backend trim to new copy; update `path` in state.
   - UI: Add "Save Workspace" button; loading spinner on restore; toast for "Recovered X clips from last session".

3. **File Structure**:
   - `$APPDATA/ClipForge/clips/original.mp4` (imports).
   - `$APPDATA/ClipForge/clips/edited/trimmed_*.mp4` (auto-copies on edits).
   - `$APPDATA/ClipForge/workspace.json`: `{ clips: [...], playhead: 5.2, zoom: 10, ... }`.
   - On Reopen: Load JSON → verify paths exist → populate store → render timeline/preview.

**Implementation Steps** (High-Level, No Code Changes):
- **Phase 1**: Add backend commands (`save_workspace`, `load_workspace`) in `lib.rs`; register in `run()`. Test via mocks (no actual writes).
- **Phase 2**: Frontend integration in `App.tsx` and store actions. Add debounce in store updates.
- **Phase 3**: Temp copy logic in `trim_clip` (subdir creation); hook into timeline `updateClip`.
- **Testing Plan**: Simulate close/reopen; verify state restore, missing file handling, edit persistence without overwriting originals.
- **Edge Cases**: Empty workspace; corrupted JSON (fallback to empty); moved originals (scan/recover); large workspaces (limit clips?).

**Trade-offs**:
- **Pros**: Non-destructive (copies only); survives restarts; leverages existing clips dir.
- **Cons**: Disk usage grows with edits (cleanup on export?); initial load scans files (perf hit for 100s of clips).
- **Alternatives**: Full in-memory only (loses on crash); cloud sync (overkill for local app).

This ensures seamless resume without losing unsaved edits. Ready to implement once out of read-only mode.