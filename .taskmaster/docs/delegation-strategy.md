# ClipForge Task Delegation Strategy
## Claude Code (Sonnet 4.5) vs OpenCode (Grok-4)

**Last Updated:** 2025-10-27
**Status:** Ready for execution

---

## Executive Summary

- **Total Tasks:** 12 (60 subtasks)
- **OpenCode (Grok-4):** 8 tasks (40 subtasks) - 67% of work
- **Claude Code (Sonnet 4.5):** 4 tasks (20 subtasks) - 33% of work

**Strategy:** Delegate high-volume, mechanical tasks to OpenCode while Claude handles critical path and complex async/error handling.

---

## Delegation Matrix

### ✅ OpenCode Tasks (Grok-4 Capable)

| Task | Title | Subtasks | Why OpenCode | Risk |
|------|-------|----------|--------------|------|
| #1 | Scaffold Tauri Project | 5 | CLI commands, verification | ⚪ Low |
| #2 | Download FFmpeg Binaries | 5 | Manual download/placement | ⚪ Low |
| #3 | Configure tauri.conf.json | 5 | JSON editing w/ template | ⚪ Low |
| #4 | Add Dependencies to Cargo.toml | 5 | Copy-paste from PRD | ⚪ Low |
| #7 | Implement trim_clip Command | 5 | Simple FFmpeg -c copy | ⚪ Low |
| #10 | Implement save_recording | 5 | Basic file I/O | ⚪ Low |
| #11 | Register Commands in main.rs | 5 | Boilerplate code | 🟡 Medium |
| #12 | Build and Package (partial) | 4/5 | Build commands | 🟡 Medium |

### 🔒 Claude Code Tasks (Requires Expertise)

| Task | Title | Subtasks | Why Claude | Risk |
|------|-------|----------|------------|------|
| #5 | Implement check_ffmpeg | 5 | **CRITICAL PATH** - blocks 6 tasks | 🔴 HIGH |
| #6 | Implement import_file | 5 | Complex metadata + error handling | 🟡 Medium |
| #8 | Implement export_video | 5 | **MOST COMPLEX** - progress parsing | 🔴 HIGH |
| #9 | Implement record_webcam_clip | 5 | Platform-specific camera + piping | 🟡 Medium |

---

## Execution Workflow

### Phase 1: Foundation (Claude) ⏱️ Est. 2-3 hours
**Goal:** Unblock all dependent tasks

1. **Task #5: Implement check_ffmpeg Command**
   - Establishes sidecar pattern for OpenCode reference
   - Unblocks tasks #6, #7, #8, #9, #10, #11
   - Test sidecar integration thoroughly

```bash
task-master set-status --id=5 --status=in-progress
# Claude implements all 5 subtasks
task-master set-status --id=5 --status=done
```

---

### Phase 2: Project Setup (OpenCode) ⏱️ Est. 1-2 hours
**Goal:** Scaffold project and configure foundation

**Delegate in sequence:**

#### 2a. Task #1: Scaffold Tauri Project
```bash
opencode run "Implement Task #1: Scaffold Tauri Project. Steps:
1. Run 'rustc --version && cargo --version' to verify Rust installation
2. Run 'cargo create-tauri-app clipforge --frontend react'
3. Verify src-tauri/ and src/ directories exist
4. Test with 'cargo tauri dev' (may need to install tauri-cli first)
5. Commit scaffolded structure

Reference: .taskmaster/docs/prd-backend.md
Use 'task-master show 1' for detailed subtasks
Mark subtasks complete: task-master update-subtask --id=1.X --prompt='Completed: <details>'"
```

#### 2b. Task #2: Download FFmpeg Binaries
```bash
opencode run "Implement Task #2: Download and Place FFmpeg Binaries. Steps:
1. Visit https://ffmpeg.org/download.html
2. Download static binaries for:
   - macOS: aarch64-apple-darwin
   - Windows: x86_64-pc-windows-msvc
3. Create src-tauri/binaries/ directory
4. Place binaries as:
   - src-tauri/binaries/ffmpeg-aarch64-apple-darwin
   - src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
5. Set executable permissions (chmod +x on macOS binary)
6. Test: ./src-tauri/binaries/ffmpeg-aarch64-apple-darwin -version

Reference PRD lines 19, 69
Mark each subtask complete as you go"
```

#### 2c. Task #3: Configure tauri.conf.json
```bash
opencode run "Implement Task #3: Configure tauri.conf.json. Use EXACT config from PRD lines 70-87:
{
  \"tauri\": {
    \"allowlist\": {
      \"fs\": { \"all\": true },
      \"dialog\": { \"open\": true },
      \"shell\": { \"all\": true, \"sidecar\": true }
    },
    \"security\": { \"csp\": \"default-src 'self' blob: data: filesystem: tauri://localhost\" },
    \"macOS\": { \"entitlements\": { \"com.apple.security.device.camera\": true } }
  },
  \"package\": { \"productName\": \"ClipForge\" },
  \"build\": {
    \"externalBin\": [\"binaries/ffmpeg-\$ARCH-\$OS\"]
  }
}

Complete all 5 subtasks in task-master show 3"
```

#### 2d. Task #4: Add Dependencies to Cargo.toml
```bash
opencode run "Implement Task #4: Add Dependencies to Cargo.toml in src-tauri/Cargo.toml [dependencies] section:

CRITICAL - Use EXACT versions from PRD lines 56-64:
tauri = { version = \"1.7\", features = [\"api-all\"] }
tauri-plugin-shell = \"1.7\"
nokhwa = { version = \"0.10.4\", features = [\"input-v4l\", \"input-avfoundation\", \"input-dshow\"] }
serde = { version = \"1.0\", features = [\"derive\"] }
serde_json = \"1.0\"
tokio = { version = \"1.38\", features = [\"rt\", \"process\"] }

IMPORTANT: nokhwa MUST have all 3 input features for cross-platform support!
Run 'cargo check' after to verify
Complete all 5 subtasks"
```

---

### Phase 3: Core Commands (Claude) ⏱️ Est. 6-8 hours
**Goal:** Implement complex async commands

**Claude handles sequentially:**

#### 3a. Task #6: Implement import_file Command
- ffprobe JSON parsing for metadata
- File validation (MP4/MOV)
- Error handling for corrupted files
- clips/ directory creation

#### 3b. Task #8: Implement export_video Command
- **MOST COMPLEX TASK**
- FFmpeg concat demuxer
- Stderr progress parsing (`-progress pipe:1`)
- Async progress event emission
- Multi-clip concatenation

#### 3c. Task #9: Implement record_webcam_clip Command
- nokhwa camera initialization (RgbAFormat)
- RGBA frame capture loop
- tokio::process::Command for FFmpeg
- AsyncWriteExt frame piping
- Platform-specific camera handling

---

### Phase 4: Simple Commands (OpenCode) ⏱️ Est. 1-2 hours
**Goal:** Implement straightforward commands

#### 4a. Task #7: Implement trim_clip Command
```bash
opencode run "Implement Task #7: trim_clip Command using PRD code (lines 124-139):

#[tauri::command]
async fn trim_clip(input: String, output: String, start: f32, end: f32) -> Result<(), String> {
    let output = Command::new_sidecar(\"ffmpeg\")
        .args([\"-i\", &input, \"-ss\", &start.to_string(), \"-to\", &end.to_string(), \"-c\", \"copy\", &output])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

Import: use tauri::plugin::shell::Command;
Complete all 5 subtasks in task-master show 7"
```

#### 4b. Task #10: Implement save_recording Command
```bash
opencode run "Implement Task #10: save_recording Command using PRD code (lines 186-192):

#[tauri::command]
async fn save_recording(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

Add to clips/ directory handling and optional WebM→MP4 conversion
Complete all 5 subtasks"
```

---

### Phase 5: Integration (OpenCode + Claude Review) ⏱️ Est. 1 hour
**Goal:** Wire up all commands in main.rs

#### 5a. Delegate to OpenCode
```bash
opencode run "Implement Task #11: Update main.rs and Register Commands using PRD lines 194-209:

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_ffmpeg,
            import_file,
            trim_clip,
            export_video,
            record_webcam_clip,
            save_recording
        ])
        .run(tauri::generate_context!())
        .expect(\"Error running Tauri app\");
}

Ensure ALL 6 commands are registered
Complete all 5 subtasks"
```

#### 5b. Claude Reviews
- Verify all commands registered
- Test each command via Tauri invoke
- Check error handling consistency

---

### Phase 6: Build & QA (OpenCode + Claude) ⏱️ Est. 2-3 hours
**Goal:** Package application for distribution

#### 6a. Delegate Build (OpenCode)
```bash
opencode run "Implement Task #12 subtasks 12.1-12.4: Build and Package

12.1 - Verify prerequisites:
  - Run 'cargo check' and 'cargo tauri info'
  - Verify FFmpeg binaries in src-tauri/binaries/

12.2 - Verify tauri.conf.json:
  - Confirm externalBin points to 'binaries/ffmpeg-\$ARCH-\$OS'
  - No modifications needed (configured in Task #3)

12.3 - Build for macOS:
  - Run 'cargo tauri build --target aarch64-apple-darwin'
  - Check bundle size <200MB
  - Verify .dmg in target/release/bundle/dmg/

12.4 - Build for Windows:
  - Run 'cargo tauri build --target x86_64-pc-windows-msvc'
  - Check bundle size <200MB
  - Verify .exe in target/release/bundle/msi/ or nsis/"
```

#### 6b. Claude Handles QA (Subtask 12.5)
- Install packages on both platforms
- Measure launch time (<5 seconds)
- Test import → trim → export workflow
- Verify FFmpeg availability in bundle
- Test webcam capture (macOS permissions)

---

## OpenCode Command Reference

### Basic Pattern
```bash
opencode run "<task description>"
opencode run --model xai/grok-4 "<task>"
opencode run --continue "<follow-up>"
```

### Verification After Delegation
```bash
# Check OpenCode's work
task-master show <id>
git diff  # Review changes
cargo check  # Rust syntax
cargo tauri dev  # Test in dev mode
```

---

## Task Dependencies Graph

```
Task #1 (Scaffold)
   ├─→ Task #2 (FFmpeg binaries)
   ├─→ Task #3 (tauri.conf)
   └─→ Task #4 (Cargo.toml)
         └─→ Task #5 (check_ffmpeg) ⭐ CRITICAL
               ├─→ Task #6 (import_file)
               ├─→ Task #7 (trim_clip)
               ├─→ Task #8 (export_video)
               ├─→ Task #9 (record_webcam)
               └─→ Task #10 (save_recording)
                     └─→ Task #11 (main.rs)
                           └─→ Task #12 (build)
```

**Key Insight:** Task #5 is the bottleneck - Claude MUST complete it first to unblock 6 dependent tasks.

---

## Success Criteria

### OpenCode Tasks
- ✅ Code compiles with `cargo check`
- ✅ Tauri dev mode runs without errors
- ✅ Configuration files valid (JSON/TOML syntax)
- ✅ All subtasks marked complete in task-master

### Claude Tasks
- ✅ All async commands functional
- ✅ Error handling comprehensive
- ✅ Progress events emitting correctly
- ✅ Platform-specific code tested (macOS/Windows)

### Final Deliverable
- ✅ `.dmg` and `.exe` packages <200MB
- ✅ Launch time <5 seconds
- ✅ All 6 Tauri commands working
- ✅ FFmpeg bundled and accessible
- ✅ Camera permissions working (macOS)

---

## Risk Mitigation

### High-Risk Tasks (Claude Only)
- **Task #5:** Test sidecar pattern thoroughly before proceeding
- **Task #8:** Implement progress parsing incrementally, test with small files first
- **Task #9:** Handle camera permission denials gracefully

### Medium-Risk Tasks (OpenCode + Review)
- **Task #11:** Claude reviews command registration before building
- **Task #12:** Verify builds on both platforms before QA

### OpenCode Failure Recovery
If OpenCode produces errors:
1. Review git diff for obvious issues
2. Fix syntax errors manually
3. Re-delegate with `--continue` flag providing context
4. If blocked >30min, reassign to Claude

---

## Timeline Estimate

| Phase | Duration | Assignee |
|-------|----------|----------|
| Phase 1: Task #5 | 2-3 hours | Claude |
| Phase 2: Tasks #1-4 | 1-2 hours | OpenCode |
| Phase 3: Tasks #6, #8, #9 | 6-8 hours | Claude |
| Phase 4: Tasks #7, #10 | 1-2 hours | OpenCode |
| Phase 5: Task #11 | 1 hour | OpenCode + Claude |
| Phase 6: Task #12 | 2-3 hours | OpenCode + Claude |
| **Total** | **13-19 hours** | **Mixed** |

**Efficiency Gain:** ~40% time savings by parallelizing setup tasks through OpenCode while Claude focuses on complex logic.

---

## Next Steps

1. ✅ Strategy approved
2. ⏭️ **Start Phase 1:** Claude implements Task #5
3. Track progress with `task-master list`
4. Update this document with learnings

**Last Updated:** 2025-10-27
