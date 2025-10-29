# ClipForge Development Log - FFmpeg Command API Analysis

**Date:** October 29, 2025
**Session:** FFmpeg Command Architecture Research & Partial Fix
**Status:** ⏸️ IN PROGRESS (Paused for checkpoint)

---

## Session Summary

Investigated and analyzed compilation errors in the Rust backend related to FFmpeg command execution. Identified architectural pattern mixing `tauri::api::process::Command` (sidecar) with `tokio::process::Command` (async with progress). Completed comprehensive research on trade-offs and began implementing fixes for the hybrid approach.

**Key Achievement**: Removed duplicate code and fixed critical import issues, reducing compilation errors from 10 to ~6.

---

## Changes Made

### Rust Backend (`clipforge/src-tauri/src/lib.rs`)

#### 1. Import Cleanup & Fixes

**Lines 1-10**: Updated imports to support hybrid approach
```rust
// BEFORE
use tauri::api::process::Command;
use std::io::{BufRead, BufReader};
use tokio::process::Command;  // ❌ Conflict!

// AFTER
use tauri::Manager;  // ✅ Added for emit_all()
use std::io::Write;  // Removed BufRead, BufReader (unused)
use std::process::Stdio;
use tokio::process::Command;  // ✅ For async progress monitoring
use tokio::io::{AsyncBufReadExt, BufReader as AsyncBufReader};
```

**Changes**:
- ✅ Replaced `tauri::api::process::Command` with `tauri::Manager` (needed for `emit_all()`)
- ✅ Removed unused `BufRead` and `BufReader` imports
- ✅ Kept `tokio::process::Command` for progress monitoring operations
- ⏳ **TODO**: Add `use tauri::api::process::Command as TauriCommand;` for sidecar operations

#### 2. Removed Duplicate Code (Lines 615-665)

**Problem**: Orphaned duplicate code from refactoring created syntax error with unexpected `}`

**Removed**: 51 lines of duplicate concat demuxer code that was leftover from implementing `run_ffmpeg_with_progress()`

**Impact**: Fixed primary syntax error blocking compilation

#### 3. Fixed Temporary Value Lifetime Issues

**`export_single_clip()` (Lines 493-512)**:
```rust
// BEFORE (lines 495-506)
let args = vec![
    "-ss", &clip.trim_start.to_string(),  // ❌ Temporary value!
    "-t", &duration.to_string(),          // ❌ Temporary value!
    "-vf", &format!("scale={}:{}", width, height),  // ❌ Temporary value!
    // ...
];

// AFTER (lines 493-512)
// Create string bindings to extend lifetime
let trim_start_str = clip.trim_start.to_string();
let duration_str = duration.to_string();
let scale_filter = format!("scale={}:{}", width, height);

let args = vec![
    "-ss", trim_start_str.as_str(),  // ✅ Proper lifetime!
    "-t", duration_str.as_str(),      // ✅ Proper lifetime!
    "-vf", scale_filter.as_str(),     // ✅ Proper lifetime!
    // ...
];
```

**`export_multi_clips()` (Lines 549-571)**:
```rust
// Similar pattern - created string bindings before args array
let trim_start_str = clip.trim_start.to_string();
let duration_str = duration.to_string();
let scale_filter = format!("scale={}:{}", width, height);
let temp_output_str = temp_output.to_str().ok_or("Invalid temp path")?.to_string();
```

**Impact**: Fixed 3 E0716 "temporary value dropped while borrowed" errors per function (6 total)

---

## Architecture Analysis Conducted

### Comprehensive Trade-Off Research

Completed deep-dive analysis comparing two FFmpeg command approaches:

| Criterion | Tauri Sidecar | Tokio Async | Winner |
|-----------|--------------|-------------|---------|
| Binary Bundling | ✅ Automatic | ❌ Manual | Tauri |
| Progress Monitoring | ❌ Blocked | ✅ Real-time | Tokio |
| Production Reliability | ✅ Bundled | ⚠️ System-dependent | Tauri |
| User Experience | ⚠️ No progress | ✅ Progress bars | Tokio |
| API Complexity | ✅ Simple | ⚠️ More code | Tauri |
| **Recommended** | Short operations | Long operations | **Hybrid** |

### Decision: Hybrid Approach (Approved)

**Rationale**:
1. **Export progress is non-negotiable** for good UX (already working with Tokio)
2. **Bundled binaries** ensure production reliability (Tauri sidecar strength)
3. **Minimal code changes** required (~10 lines of imports)
4. **Already 75% implemented correctly** in codebase

**Pattern**:
- **Tauri Sidecar** → Quick operations: version checks, metadata, thumbnails, trims
- **Tokio Command** → Long operations: export with progress, multi-clip processing

---

## Remaining Compilation Errors (6 remaining)

### Root Cause
Calling `Command::new_sidecar()` on `tokio::process::Command` instead of `tauri::api::process::Command`

### Errors to Fix:
1. **Line 61**: `check_ffmpeg()` - FFmpeg version check
2. **Line 93**: `import_file()` - FFprobe metadata extraction
3. **Line 219**: `generate_thumbnail()` - Thumbnail generation
4. **Line 274**: `trim_clip()` - Video trimming
5. **Line 336**: `save_recording()` - Recording conversion
6. **Line 693**: `record_webcam_clip()` - Webcam encoding

### Solution (Not Yet Applied):
```rust
// Add import at top
use tauri::api::process::Command as TauriCommand;

// Replace all instances of:
Command::new_sidecar("ffmpeg")  // ❌ Wrong import!

// With:
TauriCommand::new_sidecar("ffmpeg")  // ✅ Correct!
```

---

## Current Build Status

**Compilation**: ❌ Fails with 6 `new_sidecar` errors (down from 10)
**Dev Server**: Running but not compiling
**Frontend**: Waiting for backend compilation

**Progress**:
- ✅ Duplicate code removed
- ✅ Manager trait imported
- ✅ Temporary value issues fixed
- ⏳ Sidecar import not yet added
- ⏳ 6 `new_sidecar` calls not yet fixed

---

## Task-Master Status

**Timeline Tag**: 100% Complete (8/8 tasks, 20/20 subtasks)

All timeline-related work is complete. This session focused on build/infrastructure fixes discovered during development.

**No task-master updates needed** - this is build maintenance work outside the timeline tag scope.

---

## Current Todo List Status

### Session Todos (Implicit)
- ✅ Identify compilation errors
- ✅ Research FFmpeg command approaches
- ✅ Analyze trade-offs and make architectural decision
- ✅ Remove duplicate code
- ✅ Fix Manager trait import
- ✅ Fix temporary value lifetime issues
- ⏳ Add TauriCommand import
- ⏳ Fix 6 new_sidecar calls
- ⏳ Verify compilation succeeds
- ⏳ Test export progress still works

### Next Session Todos
1. Add `use tauri::api::process::Command as TauriCommand;` import
2. Replace 6 instances of `Command::new_sidecar()` with `TauriCommand::new_sidecar()`
3. Verify clean compilation
4. Test critical features:
   - Export with progress (Tokio - must work!)
   - Thumbnail generation (Tauri sidecar)
   - Metadata extraction (Tauri sidecar)
5. Create comprehensive testing checklist for hybrid approach

---

## Code References

### Fixed Issues:
- **Duplicate code removal**: `lib.rs:615-665` (deleted)
- **Import fixes**: `lib.rs:1-10`
- **Temporary value fixes**: `lib.rs:493-512, 549-571`

### Remaining Issues:
- **Sidecar calls to fix**: `lib.rs:61, 93, 219, 274, 336, 693`

---

## Next Steps

### Immediate (Next Session - 15 minutes)
1. **Add TauriCommand import**
2. **Fix 6 sidecar calls** using search-replace
3. **Verify compilation** succeeds with zero errors
4. **Test export progress** to ensure Tokio path works

### Short-term (After Compilation Fix)
1. **Integration testing**:
   - Test all FFmpeg operations (import, thumbnail, trim, export)
   - Verify progress bars work on long exports
   - Test on clean system without system FFmpeg
2. **Documentation**:
   - Add code comments explaining hybrid approach
   - Document when to use each Command type
   - Create developer guide

### Long-term (Future Enhancements)
1. Consider adding progress to long trim operations (>30s clips)
2. Optimize webcam recording with stdin piping (Tokio)
3. Create unified FFmpeg wrapper abstracting command choice

---

## Key Insights from Research

### Why Hybrid is Optimal:
1. **Export progress is critical** - users expect real-time feedback on 30s+ exports
2. **Tauri sidecar excels at reliability** - no "FFmpeg not found" errors in production
3. **Tokio enables progress** - async stderr parsing impossible with Tauri API
4. **Performance identical** - both spawn same FFmpeg subprocess
5. **Minimal complexity** - 10 lines of imports to support both

### Anti-patterns Avoided:
- ❌ Pure Tauri → Would lose export progress (UX deal-breaker)
- ❌ Pure Tokio → Extra complexity for no benefit
- ✅ Hybrid → Best of both worlds with clear separation

---

## Session Metrics

| Metric | Value |
|--------|-------|
| **Duration** | ~2 hours (research + partial implementation) |
| **Compilation Errors** | Reduced 10 → 6 |
| **Lines Modified** | ~70 |
| **Lines Deleted** | ~51 (duplicate code) |
| **Files Changed** | 1 (lib.rs) |
| **Research Depth** | Comprehensive (trade-off table, 8 operations analyzed) |
| **Build Status** | ⏸️ Still failing, but progress made |

---

## Lessons Learned

1. **Mixing APIs requires care** - import aliases prevent conflicts
2. **Temporary values in args** - must create bindings for string literals
3. **Research before refactoring** - understanding trade-offs saves time
4. **Hybrid approaches can be optimal** - don't force single-pattern solutions
5. **UX drives architecture** - export progress is non-negotiable feature

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Remaining fixes break existing code | Low | Medium | Minimal changes, test after each |
| Export progress stops working | Low | High | Already working, just import changes |
| Tauri sidecar path issues | Low | Medium | Well-documented Tauri feature |
| Bundled binary size concerns | N/A | Low | Already bundling FFmpeg (120MB) |

---

## References

- **Architecture Analysis**: Comprehensive trade-off comparison in session research
- **Tauri Sidecar Docs**: `tauri.conf.json` externalBin configuration
- **Tokio Async I/O**: `tokio::io::AsyncBufReadExt` for line-by-line parsing
- **Progress Monitoring**: `run_ffmpeg_with_progress()` implementation at `lib.rs:427-480`

---

**End of Log** - October 29, 2025 (Session Paused for Checkpoint)

**Status**: Build fixes in progress, 6 compilation errors remaining
**Next Action**: Complete sidecar import and fix remaining `new_sidecar` calls
**Estimated Time to Working Build**: 15 minutes
